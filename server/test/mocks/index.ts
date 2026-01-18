/**
 * Test Mock Factories
 *
 * Centralized exports for all test mock factories.
 * Import from here for consistent, complete mocks.
 *
 * @example
 * import { createRedisMock, createPageMock } from '../../test/mocks';
 */

// Redis mocks
export {
  createRedisMock,
  createRedisClientMock,
  createNullRedisMock,
  createInMemoryRedisMock,
} from './redis-mock';

// Playwright mocks
export {
  createPageMock,
  createBrowserMock,
  createBrowserContextMock,
  createLocatorMock,
  createElementHandleMock,
  createPlaywrightMock,
} from './playwright-mock';
