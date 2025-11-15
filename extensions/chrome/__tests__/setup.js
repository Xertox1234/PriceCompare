/**
 * Vitest setup file for browser extension tests
 * Configures global mocks and test utilities
 */

import { vi, beforeEach, afterEach, expect } from 'vitest';
import chromeMock from '../__mocks__/chrome.js';

// Setup global Chrome API mock
global.chrome = chromeMock;

// Setup global fetch mock
global.fetch = vi.fn();

// Setup console mocks to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
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
document.querySelector = vi.fn();
document.querySelectorAll = vi.fn(() => []);
document.getElementById = vi.fn();
document.createElement = vi.fn((tag) => {
  const attributes = {};
  const element = {
    tagName: tag.toUpperCase(),
    children: [],
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn()
    },
    setAttribute: vi.fn(function(key, value) {
      attributes[key] = String(value);
      if (key in this) {
        this[key] = value;
      }
    }),
    getAttribute: vi.fn(function(key) {
      return attributes[key] || null;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(function(child) {
      this.children.push(child);
      return child;
    }),
    insertBefore: vi.fn(),
    remove: vi.fn(),
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
  // Reset storage data
  chromeMock.__resetStorage();

  // Clear call history but keep implementations
  chromeMock.storage.sync.get.mockClear();
  chromeMock.storage.sync.set.mockClear();
  chromeMock.storage.sync.remove.mockClear();
  chromeMock.storage.sync.clear.mockClear();
  chromeMock.storage.local.get.mockClear();
  chromeMock.storage.local.set.mockClear();
  chromeMock.storage.local.remove.mockClear();
  chromeMock.storage.local.clear.mockClear();
});
