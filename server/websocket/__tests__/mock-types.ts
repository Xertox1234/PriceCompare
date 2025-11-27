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
 * Partial type to allow mocking only needed methods for tests.
 * Uses specific method signatures instead of 'any' for better type safety.
 */
export type MockRedisClient = Partial<{
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<void>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  del: (key: string) => Promise<number>;
  duplicate: () => MockRedisClient;
  // Add other Redis methods as needed for tests with specific signatures
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
    // Type assertion: Test mock implements all required AuthenticatedSocket properties
    // Safe because: (1) Vitest mock context, (2) vi.fn() creates function mocks for methods
  } as unknown as AuthenticatedSocket;
}
