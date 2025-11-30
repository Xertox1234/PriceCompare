import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { monitoringService, DashboardMetrics } from './monitoring-service';
import { alertService } from './alert-service';
import { logger } from '../utils/logger';
import { cleanupManager } from '../utils/cleanup-manager';

/**
 * WebSocket Service for Real-Time Dashboard Updates
 *
 * Broadcasts system metrics and events to connected dashboard clients
 */

// Generic WebSocket event with typed data payload
export interface WebSocketEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

// Specific event payload types
export interface MetricsUpdatePayload {
  metrics: DashboardMetrics;
  timestamp: string;
}

export interface ErrorsUpdatePayload {
  errors: unknown[];
  count: number;
  timestamp: string;
}

export interface AgentEventPayload {
  agentType: string;
  event: string;
  data: unknown;
}

export interface JobEventPayload {
  jobId: number;
  jobType: string;
  status: string;
  data?: unknown;
}

export interface ErrorEventPayload {
  level: 'error' | 'warn';
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface SuccessEventPayload {
  message: string;
  data?: unknown;
}

class WebSocketService {
  private io: SocketIOServer | null = null;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_FREQUENCY = 5000; // 5 seconds

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io'
    });

    this.io.on('connection', (socket: Socket) => {
      logger.info('Dashboard client connected', {
        socketId: socket.id,
        clientIP: socket.handshake.address
      });

      // Send initial metrics immediately (fire-and-forget)
      void this.sendMetricsToClient(socket);

      // Handle client events
      socket.on('request:metrics', () => {
        void this.sendMetricsToClient(socket);
      });

      socket.on('request:errors', () => {
        this.sendErrorsToClient(socket);
      });

      socket.on('disconnect', (reason) => {
        logger.info('Dashboard client disconnected', {
          socketId: socket.id,
          reason
        });
      });

      socket.on('error', (error) => {
        logger.error('WebSocket client error', {
          socketId: socket.id,
          error: error.message
        });
      });
    });

    // Start periodic updates
    this.startPeriodicUpdates();

    logger.info('WebSocket service initialized', {
      updateFrequency: `${this.UPDATE_FREQUENCY / 1000}s`
    });
  }

  /**
   * Start broadcasting periodic updates to all connected clients
   */
  private startPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      void this.broadcastMetrics();
    }, this.UPDATE_FREQUENCY);

    // Register with cleanup manager
    cleanupManager.addInterval('websocket-updates', this.updateInterval);
  }

  /**
   * Broadcast metrics to all connected clients
   */
  private async broadcastMetrics(): Promise<void> {
    if (!this.io) return;

    try {
      const metrics = await monitoringService.getDashboardMetrics();

      // Check alert rules
      await alertService.checkAlerts(metrics);

      this.broadcast('metrics:update', {
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to broadcast metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Send metrics to a specific client
   */
  private async sendMetricsToClient(socket: Socket): Promise<void> {
    try {
      const metrics = await monitoringService.getDashboardMetrics();

      socket.emit('metrics:update', {
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send metrics to client', {
        error: error instanceof Error ? error.message : String(error),
        socketId: socket.id
      });
    }
  }

  /**
   * Send error logs to a specific client
   */
  private sendErrorsToClient(socket: Socket): void {
    try {
      const errors = monitoringService.getRecentErrors(20);

      socket.emit('errors:update', {
        errors,
        count: errors.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send errors to client', {
        error: error instanceof Error ? error.message : String(error),
        socketId: socket.id
      });
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: Record<string, unknown>): void {
    if (!this.io) {
      logger.warn('Cannot broadcast - WebSocket not initialized');
      return;
    }

    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.debug('Broadcasted WebSocket event', {
      event,
      clientCount: this.io.sockets.sockets.size
    });
  }

  /**
   * Broadcast an agent event (task started, completed, failed)
   */
  broadcastAgentEvent(agentType: string, event: string, data: unknown): void {
    this.broadcast('agent:event', {
      agentType,
      event,
      data
    });
  }

  /**
   * Broadcast a job event
   */
  broadcastJobEvent(jobId: number, jobType: string, status: string, data?: unknown): void {
    this.broadcast('job:event', {
      jobId,
      jobType,
      status,
      data
    });
  }

  /**
   * Broadcast an error event
   */
  broadcastError(level: 'error' | 'warn', message: string, context?: Record<string, unknown>): void {
    // Log to monitoring service
    monitoringService.logError(level, message, context);

    // Broadcast to connected clients
    this.broadcast('error:new', {
      level,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast a success event
   */
  broadcastSuccess(message: string, data?: unknown): void {
    this.broadcast('success:event', {
      message,
      data
    });
  }

  /**
   * Get connected client count
   */
  getConnectedClients(): number {
    return this.io ? this.io.sockets.sockets.size : 0;
  }

  /**
   * Stop periodic updates and close connections
   */
  async shutdown(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.io) {
      await this.io.close();
      this.io = null;
    }

    logger.info('WebSocket service shut down');
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
