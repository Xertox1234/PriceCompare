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
 *
 * Partial type to allow mocking only needed methods for tests
 */
export type MockRedisClient = Partial<{
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<number>;
  // Add other Redis methods as needed for tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: (...args: any[]) => Promise<any>;
}>;

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
