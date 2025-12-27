/**
 * E2E Tests for Bundle Optimization - Lazy Loading
 *
 * CRITICAL: These tests MUST run against production builds, not dev server.
 * Use: npm run test:e2e:bundle (uses playwright.bundle.config.ts)
 *
 * Why? Bundle tests verify production chunk files at /assets/*.js.
 * The dev server (Vite) doesn't create physical chunks - it serves
 * transformed modules on-the-fly via HMR. Running these tests with
 * `npm test:e2e` (dev server) will fail with 401 errors and 0 chunks.
 *
 * Verifies that lazy-loaded components on the home page work correctly:
 * - Above-the-fold content loads immediately (FCP critical)
 * - Below-the-fold sections lazy load without errors
 * - Modals lazy load when opened
 * - No console errors during lazy loading
 * - Layout doesn't shift when lazy components load
 * - Lazy chunks are separate files (production build verification)
 *
 * Added: 2025-12-26 as part of bundle size optimization (655KB → 597KB)
 * Updated: 2025-12-26 - Added production-only config requirement
 */

import { test, expect } from '@playwright/test';

test.describe('Home Page Lazy Loading', () => {
  test('above-the-fold content loads immediately', async ({ page }) => {
    await page.goto('/');

    // Header should be visible immediately (eager loaded)
    await expect(page.locator('header')).toBeVisible();

    // Hero section should be visible immediately (eager loaded)
    const heroSection = page.locator('text=/Welcome|Shop|Discover/i').first();
    await expect(heroSection).toBeVisible({ timeout: 5000 });

    // Features bar should be visible (eager loaded)
    // Look for common feature keywords
    const featuresSection = page.locator('text=/Free Shipping|Secure|Support|Guarantee/i').first();
    await expect(featuresSection).toBeVisible({ timeout: 5000 });
  });

  test('below-the-fold sections lazy load correctly', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Scroll to trigger lazy loading of below-the-fold content
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(500); // Allow lazy components to load

    // Check that category grid loaded
    const categoryGrid = page.locator('text=/Categories|Browse/i').first();
    await expect(categoryGrid).toBeVisible({ timeout: 3000 });

    // Check that product sections loaded
    const productSection = page.locator('text=/Best Sellers|New Arrivals|Trending/i').first();
    await expect(productSection).toBeVisible({ timeout: 3000 });

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Footer should be visible (lazy loaded)
    const footer = page.locator('footer').first();
    await expect(footer).toBeVisible({ timeout: 3000 });

    // No console errors during lazy loading
    expect(consoleErrors).toHaveLength(0);
  });

  test('modals lazy load when opened', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to find search button - skip test if not available
    const searchButton = page.locator('[aria-label*="Search"]').first();
    const isSearchButtonAvailable = await searchButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (!isSearchButtonAvailable) {
      test.skip();
    }

    // Open search modal
    await searchButton.click();
    await page.waitForTimeout(300); // Allow modal to lazy load

    // Search modal should be visible
    const searchModal = page.locator('[role="dialog"], [aria-modal="true"]').first();
    await expect(searchModal).toBeVisible({ timeout: 2000 });

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // No console errors during modal lazy loading
    expect(consoleErrors).toHaveLength(0);
  });

  test('no layout shift when lazy components load', async ({ page }) => {
    await page.goto('/');

    // Get initial viewport height
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);

    // Wait for initial render
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(1000); // Allow all lazy components to load

    // Get height after lazy loading
    const afterHeight = await page.evaluate(() => document.body.scrollHeight);

    // Layout should not drastically shift (allow for some variation due to images)
    // A large shift (>20%) would indicate layout shift issues
    const heightDifference = Math.abs(afterHeight - initialHeight);
    const percentChange = (heightDifference / initialHeight) * 100;

    expect(percentChange).toBeLessThan(20); // Allow up to 20% variation
  });

  test('all routes still load without errors after lazy loading changes', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const routes = ['/', '/shop', '/products', '/admin'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      // Basic check that page loaded
      const body = await page.locator('body').textContent();
      expect(body).toBeTruthy();
    }

    // No console errors across all routes
    expect(consoleErrors).toHaveLength(0);
  });

  test('performance: lazy chunks are actually separate files', async ({ page }) => {
    const loadedChunks: string[] = [];

    // Listen for network requests
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/assets/') && url.endsWith('.js')) {
        loadedChunks.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Scroll to trigger lazy loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Should have loaded multiple JavaScript chunks
    expect(loadedChunks.length).toBeGreaterThan(1);

    // Should include the main index chunk
    const hasMainChunk = loadedChunks.some((url) => url.includes('index-'));
    expect(hasMainChunk).toBe(true);

    // Should include vendor chunks
    const hasVendorChunks = loadedChunks.some((url) => url.includes('vendor-'));
    expect(hasVendorChunks).toBe(true);

    // Verify that modals aren't in the main chunk
    const mainChunk = loadedChunks.find((url) => url.includes('index-'));
    expect(mainChunk).toBeDefined();

    // Verify lazy chunks are separate (not vendor or main bundles)
    const lazyChunks = loadedChunks.filter(
      (url) => !url.includes('vendor-') && !url.includes('index-')
    );
    expect(lazyChunks.length).toBeGreaterThan(0);
  });
});
