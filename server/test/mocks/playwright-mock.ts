/**
 * Playwright Mock Factory
 *
 * Provides complete Playwright mock implementations for testing scraping agents.
 * Prevents "X is not a function" errors by including all methods
 * that code paths might call (including helper functions like antibot-detection).
 *
 * Usage:
 *   import { createPageMock, createBrowserMock } from '../../test/mocks/playwright-mock';
 *
 *   const mockPage = createPageMock();
 *   const mockBrowser = createBrowserMock(mockPage);
 *
 * Pattern: docs/08_TESTING_PATTERNS.md#mock-completeness-for-playwright
 * Source: Test debugging session 2026-01-17 (extraction-agent.test.ts)
 */

import { vi } from 'vitest';
import type { Page, Browser, BrowserContext, Locator, ElementHandle } from 'playwright';

/**
 * Create a mock Playwright Locator
 *
 * Includes all common locator methods for element interaction.
 */
export function createLocatorMock(overrides: Partial<Locator> = {}): Locator {
  const locator = {
    // Text/Content
    textContent: vi.fn().mockResolvedValue('Mock Text'),
    innerText: vi.fn().mockResolvedValue('Mock Inner Text'),
    innerHTML: vi.fn().mockResolvedValue('<span>Mock HTML</span>'),
    inputValue: vi.fn().mockResolvedValue(''),
    getAttribute: vi.fn().mockResolvedValue(null),

    // Visibility/State
    isVisible: vi.fn().mockResolvedValue(true),
    isHidden: vi.fn().mockResolvedValue(false),
    isEnabled: vi.fn().mockResolvedValue(true),
    isDisabled: vi.fn().mockResolvedValue(false),
    isChecked: vi.fn().mockResolvedValue(false),
    isEditable: vi.fn().mockResolvedValue(true),

    // Actions
    click: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue([]),
    hover: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    blur: vi.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),

    // Waiting
    waitFor: vi.fn().mockResolvedValue(undefined),

    // Counts
    count: vi.fn().mockResolvedValue(1),

    // Chaining
    first: vi.fn().mockReturnThis(),
    last: vi.fn().mockReturnThis(),
    nth: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    locator: vi.fn().mockReturnThis(),
    getByRole: vi.fn().mockReturnThis(),
    getByText: vi.fn().mockReturnThis(),
    getByLabel: vi.fn().mockReturnThis(),
    getByPlaceholder: vi.fn().mockReturnThis(),
    getByTestId: vi.fn().mockReturnThis(),

    // Element handles
    elementHandle: vi.fn().mockResolvedValue(null),
    elementHandles: vi.fn().mockResolvedValue([]),

    // Evaluation
    evaluate: vi.fn().mockResolvedValue(undefined),
    evaluateAll: vi.fn().mockResolvedValue([]),
    evaluateHandle: vi.fn().mockResolvedValue(null),

    // Screenshots
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),

    // Bounding box
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),

    // All locators
    all: vi.fn().mockResolvedValue([]),

    // Apply overrides
    ...overrides,
  } as unknown as Locator;

  return locator;
}

/**
 * Create a mock Playwright ElementHandle
 */
export function createElementHandleMock(
  overrides: Partial<ElementHandle> = {}
): ElementHandle {
  return {
    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    $eval: vi.fn().mockResolvedValue(undefined),
    $$eval: vi.fn().mockResolvedValue([]),
    textContent: vi.fn().mockResolvedValue('Mock Text'),
    innerText: vi.fn().mockResolvedValue('Mock Inner Text'),
    innerHTML: vi.fn().mockResolvedValue('<span>Mock HTML</span>'),
    getAttribute: vi.fn().mockResolvedValue(null),
    isVisible: vi.fn().mockResolvedValue(true),
    isEnabled: vi.fn().mockResolvedValue(true),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    evaluate: vi.fn().mockResolvedValue(undefined),
    evaluateHandle: vi.fn().mockResolvedValue(null),
    dispose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ElementHandle;
}

/**
 * Create a complete mock Playwright Page
 *
 * Includes:
 * - Navigation (goto, reload, goBack, goForward)
 * - Content (content, title, url)
 * - Selectors (locator, $, $$, waitForSelector)
 * - Actions (click, fill, type, press)
 * - Evaluation (evaluate, evaluateHandle)
 * - Screenshots
 * - Events (on, once, off)
 * - Dialog handling
 *
 * IMPORTANT: Includes title() method required by antibot-detection.ts
 */
export function createPageMock(overrides: Partial<Page> = {}): Page {
  const locatorMock = createLocatorMock();
  const elementMock = createElementHandleMock();

  const page = {
    // Navigation
    goto: vi.fn().mockResolvedValue(null),
    reload: vi.fn().mockResolvedValue(null),
    goBack: vi.fn().mockResolvedValue(null),
    goForward: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),

    // Content - CRITICAL: title() required by antibot-detection.ts
    content: vi.fn().mockResolvedValue('<html><body>Mock Page</body></html>'),
    title: vi.fn().mockResolvedValue('Mock Page Title'),
    url: vi.fn().mockReturnValue('https://example.com/mock'),

    // Selectors - Modern API
    locator: vi.fn().mockReturnValue(locatorMock),
    getByRole: vi.fn().mockReturnValue(locatorMock),
    getByText: vi.fn().mockReturnValue(locatorMock),
    getByLabel: vi.fn().mockReturnValue(locatorMock),
    getByPlaceholder: vi.fn().mockReturnValue(locatorMock),
    getByTestId: vi.fn().mockReturnValue(locatorMock),
    getByAltText: vi.fn().mockReturnValue(locatorMock),
    getByTitle: vi.fn().mockReturnValue(locatorMock),

    // Selectors - Legacy API (still used in some code)
    $: vi.fn().mockResolvedValue(elementMock),
    $$: vi.fn().mockResolvedValue([elementMock]),
    $eval: vi.fn().mockResolvedValue(undefined),
    $$eval: vi.fn().mockResolvedValue([]),

    // Waiting
    waitForSelector: vi.fn().mockResolvedValue(elementMock),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForURL: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue(null),
    waitForResponse: vi.fn().mockResolvedValue(null),
    waitForRequest: vi.fn().mockResolvedValue(null),
    waitForEvent: vi.fn().mockResolvedValue(null),

    // Actions
    click: vi.fn().mockResolvedValue(undefined),
    dblclick: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    press: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    uncheck: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue([]),
    hover: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),

    // Keyboard & Mouse
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      insertText: vi.fn().mockResolvedValue(undefined),
    },
    mouse: {
      click: vi.fn().mockResolvedValue(undefined),
      dblclick: vi.fn().mockResolvedValue(undefined),
      move: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
      wheel: vi.fn().mockResolvedValue(undefined),
    },
    touchscreen: {
      tap: vi.fn().mockResolvedValue(undefined),
    },

    // Evaluation
    evaluate: vi.fn().mockResolvedValue(undefined),
    evaluateHandle: vi.fn().mockResolvedValue(null),
    addScriptTag: vi.fn().mockResolvedValue(null),
    addStyleTag: vi.fn().mockResolvedValue(null),
    exposeFunction: vi.fn().mockResolvedValue(undefined),
    exposeBinding: vi.fn().mockResolvedValue(undefined),

    // Screenshots & PDF
    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),
    pdf: vi.fn().mockResolvedValue(Buffer.from('')),

    // Frames
    mainFrame: vi.fn().mockReturnValue({
      url: vi.fn().mockReturnValue('https://example.com/mock'),
      content: vi.fn().mockResolvedValue('<html><body>Mock</body></html>'),
      evaluate: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue(locatorMock),
    }),
    frames: vi.fn().mockReturnValue([]),
    frame: vi.fn().mockReturnValue(null),

    // Events
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    addListener: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),

    // Dialog handling
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),

    // Context
    context: vi.fn().mockReturnValue({
      close: vi.fn().mockResolvedValue(undefined),
      newPage: vi.fn().mockResolvedValue(null),
      cookies: vi.fn().mockResolvedValue([]),
      addCookies: vi.fn().mockResolvedValue(undefined),
      clearCookies: vi.fn().mockResolvedValue(undefined),
    }),

    // State
    isClosed: vi.fn().mockReturnValue(false),
    viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    setViewportSize: vi.fn().mockResolvedValue(undefined),

    // Network
    route: vi.fn().mockResolvedValue(undefined),
    unroute: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),

    // Storage
    addInitScript: vi.fn().mockResolvedValue(undefined),

    // Video
    video: vi.fn().mockReturnValue(null),

    // Accessibility
    accessibility: {
      snapshot: vi.fn().mockResolvedValue(null),
    },

    // Apply overrides
    ...overrides,
  } as unknown as Page;

  return page;
}

/**
 * Create a mock Playwright BrowserContext
 */
export function createBrowserContextMock(
  pageMock?: Page,
  overrides: Partial<BrowserContext> = {}
): BrowserContext {
  const page = pageMock || createPageMock();

  return {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
    pages: vi.fn().mockReturnValue([page]),
    cookies: vi.fn().mockResolvedValue([]),
    addCookies: vi.fn().mockResolvedValue(undefined),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    grantPermissions: vi.fn().mockResolvedValue(undefined),
    clearPermissions: vi.fn().mockResolvedValue(undefined),
    setGeolocation: vi.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    setOffline: vi.fn().mockResolvedValue(undefined),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    exposeFunction: vi.fn().mockResolvedValue(undefined),
    exposeBinding: vi.fn().mockResolvedValue(undefined),
    route: vi.fn().mockResolvedValue(undefined),
    unroute: vi.fn().mockResolvedValue(undefined),
    waitForEvent: vi.fn().mockResolvedValue(null),
    storageState: vi.fn().mockResolvedValue({ cookies: [], origins: [] }),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    browser: vi.fn().mockReturnValue(null),
    ...overrides,
  } as unknown as BrowserContext;
}

/**
 * Create a complete mock Playwright Browser
 */
export function createBrowserMock(
  pageMock?: Page,
  overrides: Partial<Browser> = {}
): Browser {
  const page = pageMock || createPageMock();
  const context = createBrowserContextMock(page);

  return {
    newContext: vi.fn().mockResolvedValue(context),
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
    contexts: vi.fn().mockReturnValue([context]),
    isConnected: vi.fn().mockReturnValue(true),
    version: vi.fn().mockReturnValue('mock-browser-version'),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    ...overrides,
  } as unknown as Browser;
}

/**
 * Create a mock for the 'playwright' module
 *
 * @example
 * vi.mock('playwright', () => createPlaywrightMock());
 */
export function createPlaywrightMock(pageMock?: Page) {
  const page = pageMock || createPageMock();
  const browser = createBrowserMock(page);

  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(browser),
      connect: vi.fn().mockResolvedValue(browser),
      connectOverCDP: vi.fn().mockResolvedValue(browser),
      executablePath: vi.fn().mockReturnValue('/mock/chromium'),
    },
    firefox: {
      launch: vi.fn().mockResolvedValue(browser),
      connect: vi.fn().mockResolvedValue(browser),
      executablePath: vi.fn().mockReturnValue('/mock/firefox'),
    },
    webkit: {
      launch: vi.fn().mockResolvedValue(browser),
      connect: vi.fn().mockResolvedValue(browser),
      executablePath: vi.fn().mockReturnValue('/mock/webkit'),
    },
    devices: {},
    errors: {
      TimeoutError: class TimeoutError extends Error {},
    },
  };
}
