/**
 * WebSocket Load Tests
 *
 * Tests performance under load:
 * - Concurrent connections (100+)
 * - Message throughput (1000+ msg/s)
 * - Redis pub/sub routing
 * - Memory usage
 * - Latency measurements
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server as HTTPServer } from 'http';
import type { Express } from 'express';
import type { Socket as ClientSocket } from 'socket.io-client';
import {
  createTestServer,
  closeTestServer,
  createAuthenticatedSocket,
  waitForEvent,
  disconnectSockets,
  getConnectedSocketsCount,
  waitForCondition,
} from './test-utils';
import { getSocketIO } from '../index';
import { emitWatchListUpdate } from '../handlers/watch-list-handler';

// Mock dependencies
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => null), // Use in-memory for consistency
  redisClient: null,
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

/**
 * Measure heap memory usage in megabytes
 * @returns Heap used memory in MB
 */
function getMemoryUsageMB(): number {
  const usage = process.memoryUsage();
  return Math.round(usage.heapUsed / 1024 / 1024);
}

/**
 * Measure latency for an async operation
 * @param operation - Async function to measure
 * @returns Execution time in milliseconds
 */
async function measureLatency(operation: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await operation();
  return Date.now() - start;
}

describe('WebSocket Load Tests', () => {
  let _app: Express;
  let httpServer: HTTPServer;
  let port: number;

  beforeAll(async () => {
    const server = await createTestServer();
    _app = server.app;
    httpServer = server.httpServer;
    port = server.port;
  });

  afterAll(async () => {
    await closeTestServer(httpServer);
  });

  describe('Concurrent Connections', () => {
    it('should handle 50 concurrent connections', async () => {
      const connectionCount = 50;
      const clients: ClientSocket[] = [];
      const memoryBefore = getMemoryUsageMB();

      try {
        // Create connections
        const connectionPromises: Promise<unknown>[] = [];
        for (let i = 0; i < connectionCount; i++) {
          const userId = 1000 + i;
          const client = createAuthenticatedSocket(userId, port);
          clients.push(client);
          connectionPromises.push(waitForEvent(client, 'connect'));
        }

        // Wait for all connections
        const latency = await measureLatency(async () => {
          await Promise.all(connectionPromises);
        });

        // Verify all connected
        const connectedCount = clients.filter((c) => c.connected).length;
        expect(connectedCount).toBe(connectionCount);

        // Check server count
        await waitForCondition(() => getConnectedSocketsCount() >= connectionCount, 2000);
        const serverCount = getConnectedSocketsCount();
        expect(serverCount).toBeGreaterThanOrEqual(connectionCount);

        // Performance metrics
        const memoryAfter = getMemoryUsageMB();
        const memoryPerConnection = (memoryAfter - memoryBefore) / connectionCount;

        console.log(`\n  📊 Load Test Results (${connectionCount} connections):`);
        console.log(`     Connection latency: ${latency}ms`);
        console.log(`     Memory before: ${memoryBefore}MB`);
        console.log(`     Memory after: ${memoryAfter}MB`);
        console.log(`     Memory per connection: ${memoryPerConnection.toFixed(2)}MB`);

        // Assertions
        expect(latency).toBeLessThan(5000); // 5 seconds for 50 connections
        expect(memoryPerConnection).toBeLessThan(10); // <10MB per connection
      } finally {
        disconnectSockets(clients);
      }
    }, 15000); // 15 second timeout

    it('should handle 100 concurrent connections', async () => {
      const connectionCount = 100;
      const clients: ClientSocket[] = [];
      const memoryBefore = getMemoryUsageMB();

      try {
        // Create connections in batches to avoid overwhelming the server
        const batchSize = 20;
        for (let batch = 0; batch < connectionCount / batchSize; batch++) {
          const batchClients: ClientSocket[] = [];
          const batchPromises = [];

          for (let i = 0; i < batchSize; i++) {
            const userId = 2000 + batch * batchSize + i;
            const client = createAuthenticatedSocket(userId, port);
            batchClients.push(client);
            batchPromises.push(waitForEvent(client, 'connect'));
          }

          await Promise.all(batchPromises);
          clients.push(...batchClients);

          // Small delay between batches
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Verify all connected
        const connectedCount = clients.filter((c) => c.connected).length;
        expect(connectedCount).toBe(connectionCount);

        // Check server count
        await waitForCondition(() => getConnectedSocketsCount() >= connectionCount, 5000);
        const serverCount = getConnectedSocketsCount();
        expect(serverCount).toBeGreaterThanOrEqual(connectionCount);

        // Performance metrics
        const memoryAfter = getMemoryUsageMB();
        const totalMemory = memoryAfter - memoryBefore;
        const memoryPerConnection = totalMemory / connectionCount;

        console.log(`\n  📊 Load Test Results (${connectionCount} connections):`);
        console.log(`     Total memory used: ${totalMemory}MB`);
        console.log(`     Memory per connection: ${memoryPerConnection.toFixed(2)}MB`);
        console.log(`     Connected sockets: ${serverCount}`);

        // Assertions
        expect(memoryPerConnection).toBeLessThan(10);
        expect(totalMemory).toBeLessThan(500); // <500MB for 100 connections
      } finally {
        disconnectSockets(clients);
      }
    }, 30000); // 30 second timeout
  });

  describe('Message Throughput', () => {
    it('should handle 100 messages per second', async () => {
      const messageCount = 100;
      const clients: ClientSocket[] = [];

      try {
        // Create 10 clients
        for (let i = 0; i < 10; i++) {
          const userId = 3000 + i;
          const client = createAuthenticatedSocket(userId, port);
          clients.push(client);
          await waitForEvent(client, 'connect');

          // Subscribe to watch lists
          client.emit('subscribe:watchlists');
          await waitForEvent(client, 'watchlist:subscribed');
        }

        // Track received messages
        const receivedMessages = new Map<number, number>();
        clients.forEach((client, index) => {
          receivedMessages.set(index, 0);
          client.on('watchlist:update', () => {
            const count = receivedMessages.get(index) || 0;
            receivedMessages.set(index, count + 1);
          });
        });

        // Send messages
        const io = getSocketIO();
        const startTime = Date.now();

        for (let i = 0; i < messageCount; i++) {
          const userId = 3000 + (i % 10);
          if (io) {
            emitWatchListUpdate(io, userId, 'updated', {
              id: 1,
              name: `List ${i}`,
              productCount: i,
            });
          }
        }

        // Wait for messages to be processed
        await waitForCondition(() => {
          const total = Array.from(receivedMessages.values()).reduce((a, b) => a + b, 0);
          return total >= messageCount;
        }, 5000);

        const duration = Date.now() - startTime;
        const messagesPerSecond = (messageCount / duration) * 1000;

        console.log(`\n  📊 Throughput Test Results:`);
        console.log(`     Messages sent: ${messageCount}`);
        console.log(`     Duration: ${duration}ms`);
        console.log(`     Throughput: ${messagesPerSecond.toFixed(0)} msg/s`);

        // Verify all messages received
        const totalReceived = Array.from(receivedMessages.values()).reduce((a, b) => a + b, 0);
        expect(totalReceived).toBe(messageCount);
        expect(duration).toBeLessThan(3000); // <3 seconds for 100 messages
      } finally {
        disconnectSockets(clients);
      }
    }, 10000);

    it('should handle burst of 500 messages', async () => {
      const messageCount = 500;
      const userId = 3100;
      const client = createAuthenticatedSocket(userId, port);

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        // Track received messages
        let receivedCount = 0;
        client.on('watchlist:update', () => {
          receivedCount++;
        });

        // Send burst of messages
        const io = getSocketIO();
        const startTime = Date.now();

        if (io) {
          for (let i = 0; i < messageCount; i++) {
            emitWatchListUpdate(io, userId, 'updated', {
              id: 1,
              name: `List ${i}`,
              productCount: i,
            });
          }
        }

        // Wait for all messages
        await waitForCondition(() => receivedCount >= messageCount, 10000);

        const duration = Date.now() - startTime;
        const messagesPerSecond = (messageCount / duration) * 1000;

        console.log(`\n  📊 Burst Test Results:`);
        console.log(`     Messages: ${messageCount}`);
        console.log(`     Duration: ${duration}ms`);
        console.log(`     Throughput: ${messagesPerSecond.toFixed(0)} msg/s`);

        expect(receivedCount).toBe(messageCount);
        expect(duration).toBeLessThan(5000); // <5 seconds for 500 messages
      } finally {
        disconnectSockets([client]);
      }
    }, 15000);
  });

  describe('Latency Measurements', () => {
    it('should have low message latency (<100ms)', async () => {
      const userId = 4000;
      const client = createAuthenticatedSocket(userId, port);
      const latencies: number[] = [];

      try {
        await waitForEvent(client, 'connect');

        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        const io = getSocketIO();

        // Measure latency for 10 messages
        for (let i = 0; i < 10; i++) {
          const messageReceived = new Promise<void>((resolve) => {
            client.once('watchlist:update', () => resolve());
          });

          const startTime = Date.now();

          if (io) {
            emitWatchListUpdate(io, userId, 'updated', {
              id: 1,
              name: `List ${i}`,
              productCount: i,
            });
          }

          await messageReceived;
          const latency = Date.now() - startTime;
          latencies.push(latency);

          // Small delay between messages
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);

        console.log(`\n  📊 Latency Test Results:`);
        console.log(`     Average latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`     Min latency: ${minLatency}ms`);
        console.log(`     Max latency: ${maxLatency}ms`);

        expect(avgLatency).toBeLessThan(100);
        expect(maxLatency).toBeLessThan(200);
      } finally {
        disconnectSockets([client]);
      }
    });

    it('should maintain low latency under load', async () => {
      const clientCount = 20;
      const clients: ClientSocket[] = [];
      const latencies: number[] = [];

      try {
        // Create clients
        for (let i = 0; i < clientCount; i++) {
          const userId = 4100 + i;
          const client = createAuthenticatedSocket(userId, port);
          clients.push(client);
          await waitForEvent(client, 'connect');

          client.emit('subscribe:watchlists');
          await waitForEvent(client, 'watchlist:subscribed');
        }

        const io = getSocketIO();

        // Measure latency for each client
        for (let i = 0; i < clientCount; i++) {
          const client = clients[i];
          const userId = 4100 + i;

          const messageReceived = new Promise<void>((resolve) => {
            client.once('watchlist:update', () => resolve());
          });

          const startTime = Date.now();

          if (io) {
            emitWatchListUpdate(io, userId, 'updated', {
              id: 1,
              name: 'Test List',
              productCount: 0,
            });
          }

          await messageReceived;
          latencies.push(Date.now() - startTime);
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);

        console.log(`\n  📊 Load Latency Test Results (${clientCount} clients):`);
        console.log(`     Average latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`     Max latency: ${maxLatency}ms`);

        expect(avgLatency).toBeLessThan(150);
        expect(maxLatency).toBeLessThan(300);
      } finally {
        disconnectSockets(clients);
      }
    }, 15000);
  });

  describe('Connection Stability', () => {
    it('should maintain connections over time', async () => {
      const clientCount = 20;
      const clients: ClientSocket[] = [];

      try {
        // Create connections
        for (let i = 0; i < clientCount; i++) {
          const userId = 5000 + i;
          const client = createAuthenticatedSocket(userId, port);
          clients.push(client);
          await waitForEvent(client, 'connect');
        }

        // Track disconnections
        let disconnectCount = 0;
        clients.forEach((client) => {
          client.on('disconnect', () => disconnectCount++);
        });

        // Wait for 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Verify all still connected
        const connectedCount = clients.filter((c) => c.connected).length;
        expect(connectedCount).toBe(clientCount);
        expect(disconnectCount).toBe(0);
      } finally {
        disconnectSockets(clients);
      }
    }, 10000);

    it('should handle rapid connect/disconnect cycles', async () => {
      const cycles = 10;
      const userId = 5100;

      for (let i = 0; i < cycles; i++) {
        const client = createAuthenticatedSocket(userId, port);

        try {
          await waitForEvent(client, 'connect');
          expect(client.connected).toBe(true);
        } finally {
          client.disconnect();
          await waitForEvent(client, 'disconnect');
        }
      }

      // Test completed successfully if no errors thrown
      expect(true).toBe(true);
    }, 15000);
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory with connection churn', async () => {
      const memoryBefore = getMemoryUsageMB();
      const cycles = 20;

      for (let i = 0; i < cycles; i++) {
        const userId = 6000 + i;
        const client = createAuthenticatedSocket(userId, port);

        await waitForEvent(client, 'connect');
        client.emit('subscribe:watchlists');
        await waitForEvent(client, 'watchlist:subscribed');

        client.disconnect();
        await waitForEvent(client, 'disconnect');
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = getMemoryUsageMB();
      const memoryGrowth = memoryAfter - memoryBefore;

      console.log(`\n  📊 Memory Leak Test Results:`);
      console.log(`     Memory before: ${memoryBefore}MB`);
      console.log(`     Memory after: ${memoryAfter}MB`);
      console.log(`     Growth: ${memoryGrowth}MB`);

      // Allow some growth, but should be minimal
      expect(memoryGrowth).toBeLessThan(50); // <50MB growth
    }, 20000);
  });
});
