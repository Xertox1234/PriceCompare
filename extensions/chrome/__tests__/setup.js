/**
 * Jest setup file for browser extension tests
 * Configures global mocks and test utilities
 */

// Import Chrome API mock
const chromeMock = require('../__mocks__/chrome');

// Setup global Chrome API mock
global.chrome = chromeMock;

// Setup global fetch mock
global.fetch = jest.fn();

// Setup console mocks to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock window.location
delete window.location;
window.location = {
  href: 'https://www.amazon.com/dp/B08N5WRWNW',
  hostname: 'www.amazon.com',
  pathname: '/dp/B08N5WRWNW',
  search: '',
  hash: ''
};

// Mock document.querySelector and other DOM methods
document.querySelector = jest.fn();
document.querySelectorAll = jest.fn(() => []);
document.getElementById = jest.fn();
document.createElement = jest.fn((tag) => {
  const element = {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(function(child) {
      this.children.push(child);
      return child;
    }),
    insertBefore: jest.fn(),
    remove: jest.fn(),
    innerHTML: '',
    textContent: '',
    parentNode: null
  };

  // Make innerHTML and textContent writable
  Object.defineProperty(element, 'innerHTML', {
    get() { return this._innerHTML || ''; },
    set(value) { this._innerHTML = value; }
  });

  Object.defineProperty(element, 'textContent', {
    get() { return this._textContent || ''; },
    set(value) { this._textContent = value; }
  });

  return element;
});

// Mock MutationObserver
global.MutationObserver = class MutationObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset fetch mock
  global.fetch.mockReset();

  // Reset Chrome API mocks
  chromeMock.storage.sync.get.mockReset();
  chromeMock.storage.sync.set.mockReset();
  chromeMock.storage.local.get.mockReset();
  chromeMock.storage.local.set.mockReset();
});

// Cleanup after each test
afterEach(() => {
  jest.restoreAllMocks();
});
