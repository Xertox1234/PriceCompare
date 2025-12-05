/**
 * Shared Logger Mock for Tests
 *
 * Centralizes the logger mock to eliminate duplication across test files.
 * Import this file to apply the mock automatically.
 *
 * @example
 * ```typescript
 * import './helpers/mock-logger';
 * // Logger is now mocked
 * ```
 */

import { vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));
