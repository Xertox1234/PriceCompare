/**
 * useWebSocket Hook
 *
 * Core React hook for WebSocket connection management.
 * Automatically connects when user is authenticated and handles cleanup.
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { isConnected, connectionState } = useWebSocket();
 *
 *   return <div>Status: {connectionState}</div>;
 * }
 * ```
 */

import { useEffect, useState } from 'react';
import { websocketClient, type ConnectionState } from '@/lib/websocket-client';
import { useUser } from './use-user';

export function useWebSocket() {
  const { user } = useUser();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    websocketClient.getState()
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = websocketClient.onStateChange((state) => {
      setConnectionState(state);
      setIsConnected(state === 'connected');
    });

    // Connect if user is authenticated
    if (user) {
      websocketClient.connect();
    } else {
      // Disconnect if user logs out
      websocketClient.disconnect();
    }

    return () => {
      unsubscribe();
      // Don't disconnect here - other components may be using the connection
    };
  }, [user]); // Reconnect when user changes (login/logout)

  return {
    connectionState,
    isConnected,
    connect: () => websocketClient.connect(),
    disconnect: () => websocketClient.disconnect(),
  };
}
