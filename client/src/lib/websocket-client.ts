/**
 * WebSocket Client Manager - Singleton
 *
 * Manages Socket.io connection with automatic reconnection, exponential backoff,
 * and online/offline detection. Provides type-safe event handling.
 *
 * Features:
 * - Automatic reconnection with exponential backoff (1s -> 30s max)
 * - Online/offline transition handling
 * - Connection state tracking (disconnected, connecting, connected, reconnecting)
 * - Type-safe event subscriptions using server event types
 * - Event listener cleanup management
 * - Authentication-aware connection
 */

import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@shared/websocket-types';

// Connection states
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * WebSocket Client Manager
 * Singleton pattern - only one instance per application
 */
export class WebSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Base delay: 1 second
  private connectionState: ConnectionState = 'disconnected';
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;

  constructor() {
    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }

  /**
   * Establish Socket.io connection to the server
   * Includes credentials for authentication via Express session
   */
  connect(): void {
    // Don't connect if already connected or connecting
    if (this.socket?.connected || this.connectionState === 'connecting') {
      return;
    }

    this.isIntentionalDisconnect = false;
    this.setConnectionState('connecting');

    try {
      // Create Socket.io connection to /ws path
      this.socket = io('/ws', {
        withCredentials: true, // Include session cookies
        transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
        reconnection: false, // We handle reconnection ourselves
        timeout: 10000, // 10 second connection timeout
      });

      // Connection successful
      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0; // Reset reconnect counter
        this.setConnectionState('connected');
      });

      // Handle authenticated event from server
      this.socket.on('authenticated', (data) => {
        console.log(`🔐 WebSocket authenticated for user ${data.userId}`);
      });

      // Connection error
      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error.message);

        // Handle authentication errors (401)
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          console.warn('⚠️  WebSocket authentication failed - user may not be logged in');
          this.disconnect(); // Don't retry on auth errors
          return;
        }

        // Trigger reconnection
        this.handleDisconnect();
      });

      // Disconnection (server-initiated or network issue)
      this.socket.on('disconnect', (reason) => {
        console.warn('⚠️  WebSocket disconnected:', reason);

        // Don't reconnect if intentional disconnect or server initiated
        if (this.isIntentionalDisconnect || reason === 'io server disconnect') {
          this.setConnectionState('disconnected');
        } else {
          this.handleDisconnect();
        }
      });

      // Server error event
      this.socket.on('error', (data) => {
        console.error('❌ WebSocket server error:', data.message, data.details);
      });

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.handleDisconnect();
    }
  }

  /**
   * Close connection cleanly (intentional disconnect)
   */
  disconnect(): void {
    this.isIntentionalDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.reconnectAttempts = 0;
    this.setConnectionState('disconnected');
  }

  /**
   * Subscribe to a server event
   * Type-safe event handler with TypeScript generics
   *
   * Socket.io's typed socket already handles event typing through the
   * ServerToClientEvents generic parameter, so we can use the native on() method.
   */
  on<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ): void {
    if (!this.socket) {
      console.warn(`⚠️  Cannot subscribe to '${String(event)}' - socket not connected`);
      return;
    }

    // Socket.io typed sockets handle event typing through the generic parameter.
    // The handler type matches ServerToClientEvents[E] which Socket.io expects.
    // Use any to bypass Socket.IO's overly strict listener type checking
    this.socket.on(event, handler as any);
  }

  /**
   * Unsubscribe from a server event
   * If no handler provided, removes all handlers for that event
   *
   * Socket.io's typed socket handles event typing through the generic parameter.
   */
  off<E extends keyof ServerToClientEvents>(
    event: E,
    handler?: ServerToClientEvents[E]
  ): void {
    if (!this.socket) {
      return;
    }

    if (handler) {
      // Socket.io typed sockets handle event typing through the generic parameter.
      // Use any to bypass Socket.IO's overly strict listener type checking
      this.socket.off(event, handler as any);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Emit an event to the server
   * Type-safe with client event types
   *
   * Socket.io's typed socket handles event typing through the generic parameter.
   */
  emit<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): void {
    if (!this.socket || !this.socket.connected) {
      console.warn(`⚠️  Cannot emit '${String(event)}' - socket not connected`);
      return;
    }

    // Socket.io typed sockets handle emit typing through the ClientToServerEvents generic.
    // Spread args to pass event data correctly to the emit method.
    this.socket.emit(event, ...args);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === 'connected' && this.socket?.connected === true;
  }

  /**
   * Subscribe to connection state changes
   * Returns unsubscribe function
   */
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);

    // Immediately call with current state
    listener(this.connectionState);

    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Handle disconnection and schedule reconnection
   * @private
   */
  private handleDisconnect(): void {
    if (this.isIntentionalDisconnect) {
      return;
    }

    // Check if we've exceeded max reconnect attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      this.setConnectionState('disconnected');
      return;
    }

    this.setConnectionState('reconnecting');
    this.scheduleReconnect();
  }

  /**
   * Schedule reconnection with exponential backoff
   * Delay: 1s, 2s, 4s, 8s, 16s, 30s (max)
   * @private
   */
  private scheduleReconnect(): void {
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Maximum 30 seconds
    );

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Handle online event (network restored)
   * @private
   */
  private handleOnline(): void {
    console.log('🌐 Network online - reconnecting WebSocket...');
    this.reconnectAttempts = 0; // Reset counter on network restore

    if (!this.socket?.connected && !this.isIntentionalDisconnect) {
      this.connect();
    }
  }

  /**
   * Handle offline event (network lost)
   * @private
   */
  private handleOffline(): void {
    console.warn('📡 Network offline - WebSocket connection lost');
    this.setConnectionState('disconnected');
  }

  /**
   * Update connection state and notify listeners
   * @private
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return;
    }

    this.connectionState = state;
    console.log(`📡 WebSocket state: ${state}`);

    // Notify all listeners
    this.stateListeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }
}

/**
 * Singleton instance - export for use throughout application
 */
export const websocketClient = new WebSocketClient();

/**
 * Expose to window for debugging in development
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.websocketClient = websocketClient;
}
