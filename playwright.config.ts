import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Load .env.test for E2E tests
loadEnv({ path: '.env.test' });

/**
 * Playwright E2E Test Configuration
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Run tests sequentially to avoid database conflicts
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Single worker to prevent database race conditions
  workers: 1,

  // Reporter to use
  reporter: process.env.CI
    ? [['html'], ['junit', { outputFile: 'test-results/junit.xml' }], ['github']]
    : [['html'], ['list']],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // Note: Using port 5001 because macOS AirPlay Receiver uses 5000
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Maximum time each action such as `click()` can take
    actionTimeout: 10000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment to test on Firefox and WebKit
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: process.env.CI
    ? undefined
    : {
        // TESTING: Run server in test mode to bypass rate limiting
        // Uses dev:test script which sets NODE_ENV=test to disable rate limiter
        command: 'npm run dev:test',
        url: 'http://localhost:5001', // macOS AirPlay uses 5000
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },

  // Global timeout for each test
  timeout: 30000,

  // Global test setup
  globalSetup: undefined,
  globalTeardown: undefined,
});
