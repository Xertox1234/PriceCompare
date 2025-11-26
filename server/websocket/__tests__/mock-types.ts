/**
 * Shared Mock Types for WebSocket Tests
 *
 * Centralized type definitions for mocking Redis clients and sockets
 * to ensure consistency across test files.
 */

import type { AuthenticatedSocket } from '../types';
import { vi } from 'vitest';

/**
 * Mock Redis Client for testing rate limiting and other Redis operations
 */
export interface MockRedisClient {
  incr?: (key: string) => Promise<number>;
  expire?: (key: string, seconds: number) => Promise<void>;
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string) => Promise<void>;
  del?: (key: string) => Promise<number>;
  // Allow other methods with flexible typing for test mocking
  [key: string]: ((...args: unknown[]) => Promise<unknown>) | undefined;
}

/**
 * Create a mock authenticated socket for testing
 * @param userId - User ID for the authenticated socket
 * @param id - Optional socket ID (defaults to test-socket-{userId})
 * @returns Mocked AuthenticatedSocket with basic properties
 */
export function createMockSocket(userId: number, id?: string): AuthenticatedSocket {
  return {
    id: id ?? `test-socket-${userId}`,
    emit: vi.fn(),
    userId,
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  } as unknown as AuthenticatedSocket;
}
