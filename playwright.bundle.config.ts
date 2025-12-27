/**
 * Playwright Configuration for Bundle Optimization Tests
 *
 * CRITICAL: Bundle optimization tests MUST run against production builds,
 * not the Vite dev server. This config ensures:
 * - npm run build creates production bundle BEFORE tests
 * - NODE_ENV=production uses serveStatic() (not setupVite())
 * - Static chunk files exist at /assets/*.js for verification
 * - Tests verify real production bundle behavior
 *
 * Why a separate config?
 * - Dev server (NODE_ENV=test) uses Vite HMR with no physical chunks
 * - Vite serves transformed modules on-the-fly, not pre-built bundles
 * - Asset requests to /assets/*.js return 401 (fall through to app routes)
 * - Bundle tests expect production chunk files and code splitting
 *
 * Usage:
 *   npm run test:e2e:bundle  // Run bundle tests in production mode
 *   npm test:e2e             // Run all other tests in dev mode
 */

import { defineConfig, devices } from '@playwright/test';

// Extend base config but override webServer for production
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/bundle-optimization.spec.ts',  // ONLY run bundle tests with this config

  // Test execution settings
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: 'html',

  // Shared test configuration
  use: {
    baseURL: 'http://localhost:5002',
    trace: 'on-first-retry',
  },

  // Projects - just Chromium for bundle tests
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // PRODUCTION WEB SERVER - Critical for bundle tests
  webServer: {
    // Build production bundle, then start server in bundle_test mode
    // NODE_ENV=bundle_test triggers serveStatic() (not 'development' or 'test')
    // but doesn't trigger production Redis requirements (not 'production')
    // Loads DATABASE_URL, SESSION_SECRET, CSRF_SECRET from .env.test
    command: 'npm run build && NODE_ENV=bundle_test DATABASE_URL=$(grep DATABASE_URL .env.test | cut -d= -f2-) SESSION_SECRET=$(grep SESSION_SECRET .env.test | cut -d= -f2-) CSRF_SECRET=$(grep CSRF_SECRET .env.test | cut -d= -f2-) PORT=5002 node dist/index.js',
    url: 'http://localhost:5002',
    reuseExistingServer: false,  // Always rebuild for accurate bundle size tests
    timeout: 180000,  // 3 minutes (build takes longer than dev server startup)
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
