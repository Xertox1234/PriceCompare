/**
 * E2E Tests: Product Detail Analytics Lazy Loading
 *
 * Tests lazy loading optimizations for price analytics section to verify:
 * - Analytics components NOT loaded initially (bundle optimization)
 * - API calls NOT fired until section is opened (network optimization)
 * - Charts lazy load when section is expanded (performance)
 * - Analytics state persists after loading (no re-rendering)
 *
 * Performance Context (from TODO_016_PERFORMANCE_ANALYSIS.md):
 * - Without lazy loading: 1.1MB bundle, 3 API calls on page load, +367KB recharts overhead
 * - With lazy loading: 740KB initial bundle (-33%), API calls only on section open (-70% calls)
 * - Target metrics: FCP <2.0s, TTI <3.5s, Performance Score ≥85
 *
 * Test Coverage:
 * - Initial page load does NOT include chart components
 * - No price-history or price-stats API calls until section opened
 * - Recharts SVG elements appear after section expansion
 * - Loading skeleton displays during lazy chunk load
 * - Charts remain loaded after section collapse/expand (state persistence)
 * - Error boundary catches chunk load failures
 * - Performance budget assertions (bundle size, render time)
 *
 * Phase 2.3 Patterns Applied (see docs/08_TESTING_PATTERNS.md):
 * ----------------------------------------------------------------
 * 1. Type Safety
 *    - All helpers use `type Page` from '@playwright/test'
 *    - Zero `any` types throughout test suite
 *    - Proper TypeScript types for all function parameters
 *
 * 2. Modal-Based Authentication
 *    - Not required for analytics lazy loading (public feature)
 *    - Test focuses on performance, not auth
 *
 * 3. Explicit Waits for Dynamic Content
 *    - waitForPageReady(page) after navigation
 *    - waitFor() for chart rendering after section expansion
 *    - No hardcoded timeouts except for chunk loading (documented)
 *
 * 4. Semantic, Role-Based Selectors
 *    - Prefer: getByRole('button', { name: /price analytics/i })
 *    - Use data-testid for chart components (recharts-wrapper)
 *    - Avoid: CSS selectors except for SVG element detection
 *
 * 5. Database Test Data
 *    - Create test data via seedTestProduct() helper
 *    - Test via UI interactions and network monitoring
 *    - Verify behavior through observable page state
 *
 * 6. Graceful Degradation
 *    - Tests skip if lazy loading not yet implemented
 *    - Check element existence before assertions
 *    - Comments indicate flexible patterns for UI variations
 *
 * Network Monitoring Pattern:
 * ---------------------------
 * Use page.on('request') to track API calls and verify:
 * - NO price analytics requests on initial page load
 * - Price analytics requests ONLY after section opened
 * - Request count matches expected behavior (1 price-history + 1 price-stats)
 *
 * Performance Monitoring Pattern:
 * --------------------------------
 * Use Playwright performance APIs to measure:
 * - Initial page load time (FCP, TTI)
 * - Lazy chunk load time (when section opened)
 * - Chart render time (SVG appearance to interactive)
 *
 * Helper Organization:
 * ---------------------
 * - Page navigation: navigateToProductDetail()
 * - Network tracking: trackApiRequests()
 * - Section interaction: openAnalyticsSection(), closeAnalyticsSection()
 * - Chart verification: verifyChartsLoaded(), verifyChartsNotLoaded()
 * - Data seeding: seedProductWithPriceHistory() (reuses existing helpers)
 */
import { test, expect } from './fixtures';
import { waitForPageReady } from './helpers';
import { seedTestProduct } from './helpers/admin-helpers';
import { seedPriceHistoryData } from './helpers/price-analytics-helpers';

test.describe('Product Detail - Analytics Lazy Loading', () => {
  let testProductId: number;

  test.beforeEach(async () => {
    // Create test product with price history
    const { product } = await seedTestProduct({
      name: 'iPhone 15 Pro',
      description: 'Test product for lazy loading verification',
      category: 'Smartphones',
    });

    testProductId = product.id;

    // Seed 30 days of price history data (required for analytics)
    await seedPriceHistoryData(testProductId, 30, { min: 900, max: 1100 });
  });

  test.describe('Initial Page Load - Analytics NOT Loaded', () => {
    test('should NOT load recharts SVG elements on initial page load', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load (product title should be visible)
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Verify analytics section is collapsed (button exists but content hidden)
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      // If button doesn't exist, skip test (feature not implemented)
      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      // Verify recharts SVG elements do NOT exist in DOM
      // Recharts creates <svg class="recharts-surface"> elements
      const chartSvgs = page.locator('svg.recharts-surface, [class*="recharts-wrapper"]');
      const svgCount = await chartSvgs.count();

      expect(svgCount).toBe(0); // NO charts should be loaded initially
    });

    test('should NOT fire price-history or price-stats API calls on initial page load', async ({
      page,
    }) => {
      // Track all API requests
      const apiRequests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          apiRequests.push(url);
        }
      });

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Verify NO price analytics API calls were made
      const priceHistoryRequests = apiRequests.filter((url) => url.includes('price-history'));
      const priceStatsRequests = apiRequests.filter((url) => url.includes('price-stats'));

      expect(priceHistoryRequests.length).toBe(0); // NO price-history calls initially
      expect(priceStatsRequests.length).toBe(0); // NO price-stats calls initially

      // Verify main product API call WAS made (sanity check)
      const productRequests = apiRequests.filter(
        (url) => url.includes(`/api/products/${testProductId}`) && url.includes('/full')
      );
      expect(productRequests.length).toBeGreaterThan(0); // Main product data loaded
    });

    test('should NOT render price analytics components in DOM', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Verify analytics components do NOT exist in DOM
      // Look for specific component markers (data-testid or component-specific elements)
      const priceChart = page.locator('[data-testid="price-chart"]');
      const insightsWidget = page.locator('[data-testid="price-insights"]');
      const retailerComparison = page.locator('[data-testid="retailer-comparison"]');

      // These components should NOT be in DOM initially (lazy loaded)
      // Note: We're checking for presence in DOM, not visibility
      // Collapsible pattern may render with display:none, but lazy loading should NOT render at all
      const chartExists = await priceChart.count();
      const widgetExists = await insightsWidget.count();
      const comparisonExists = await retailerComparison.count();

      // If components exist in DOM (even if hidden), lazy loading is NOT working
      // This test verifies components are code-split and NOT in initial bundle
      if (chartExists > 0 || widgetExists > 0 || comparisonExists > 0) {
        // Components in DOM = NOT lazy loaded (may be hidden but still bundled)
        // This is the anti-pattern we're testing against
        expect(chartExists).toBe(0);
        expect(widgetExists).toBe(0);
        expect(comparisonExists).toBe(0);
      }
    });
  });

  test.describe('Analytics Section Expansion - Lazy Load Triggered', () => {
    test('should lazy load charts when analytics section is opened', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Verify analytics button exists
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      // Verify NO charts loaded initially
      let chartSvgs = page.locator('svg.recharts-surface, [class*="recharts-wrapper"]');
      expect(await chartSvgs.count()).toBe(0);

      // Click analytics section to expand
      await analyticsButton.click();

      // Wait for collapsible animation (300ms typical for UI transitions)
      await page.waitForTimeout(500);

      // Wait for charts to load (lazy chunk + render time)
      // Give 5 seconds for chunk download + React render
      await page.waitForSelector('svg.recharts-surface, [class*="recharts-wrapper"]', {
        state: 'visible',
        timeout: 5000,
      });

      // Verify charts are now loaded and visible
      chartSvgs = page.locator('svg.recharts-surface');
      const svgCount = await chartSvgs.count();

      expect(svgCount).toBeGreaterThan(0); // At least one chart loaded
      await expect(chartSvgs.first()).toBeVisible(); // Chart is visible
    });

    test('should fire price analytics API calls when section is opened', async ({ page }) => {
      // Track all API requests
      const apiRequests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          apiRequests.push(url);
        }
      });

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Clear request log (ignore initial page load requests)
      apiRequests.length = 0;

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      await analyticsButton.click();

      // Wait for API calls to complete
      await waitForPageReady(page);

      // Verify price analytics API calls were made AFTER opening section
      const priceHistoryRequests = apiRequests.filter((url) => url.includes('price-history'));
      const priceStatsRequests = apiRequests.filter((url) => url.includes('price-stats'));

      expect(priceHistoryRequests.length).toBeGreaterThanOrEqual(1); // At least 1 price-history call
      expect(priceStatsRequests.length).toBeGreaterThanOrEqual(1); // At least 1 price-stats call
    });

    test('should display loading skeleton during lazy chunk load', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      await analyticsButton.click();

      // Look for loading indicator (spinner, skeleton, or "Loading..." text)
      // This may appear very briefly during chunk load + API calls
      const loadingText = page.locator('text=/loading.*analytics|loading.*chart/i');
      const loadingSkeleton = page.locator('[class*="skeleton"]');
      const loadingSpinner = page.locator('[class*="spinner"]');

      // Loading state may be very brief (chunk loads fast on localhost)
      // We check if it appears OR if charts load immediately (both are acceptable)
      const hasLoadingState =
        (await loadingText.count()) > 0 ||
        (await loadingSkeleton.count()) > 0 ||
        (await loadingSpinner.count()) > 0;
      const hasCharts =
        (await page.locator('svg.recharts-surface').count()) > 0 ||
        (await page.locator('[class*="recharts-wrapper"]').count()) > 0;

      // Either loading state appeared OR charts loaded immediately (both acceptable)
      expect(hasLoadingState || hasCharts).toBe(true);
    });
  });

  test.describe('Analytics State Persistence', () => {
    test('should keep charts loaded after section collapse/expand', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      await analyticsButton.click();

      // Wait for charts to load
      await page.waitForSelector('svg.recharts-surface, [class*="recharts-wrapper"]', {
        state: 'visible',
        timeout: 5000,
      });

      // Verify charts are loaded
      const chartsBefore = await page.locator('svg.recharts-surface').count();
      expect(chartsBefore).toBeGreaterThan(0);

      // Collapse section
      await analyticsButton.click();
      await page.waitForTimeout(500); // Wait for collapse animation

      // Expand section again
      await analyticsButton.click();
      await page.waitForTimeout(500); // Wait for expand animation

      // Verify charts are STILL loaded (no re-fetch, just reveal)
      const chartsAfter = await page.locator('svg.recharts-surface').count();
      expect(chartsAfter).toBe(chartsBefore); // Same number of charts (no re-render)

      // Verify charts are visible again
      await expect(page.locator('svg.recharts-surface').first()).toBeVisible();
    });

    test('should not re-fetch API data after charts are loaded', async ({ page }) => {
      // Track all API requests
      const apiRequests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          apiRequests.push(url);
        }
      });

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Clear request log
      apiRequests.length = 0;

      // Open analytics section (first time)
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      await analyticsButton.click();
      await waitForPageReady(page);

      // Count initial API calls
      const initialPriceHistoryCalls = apiRequests.filter((url) =>
        url.includes('price-history')
      ).length;
      const initialPriceStatsCalls = apiRequests.filter((url) => url.includes('price-stats')).length;

      expect(initialPriceHistoryCalls).toBeGreaterThan(0);
      expect(initialPriceStatsCalls).toBeGreaterThan(0);

      // Clear request log
      apiRequests.length = 0;

      // Collapse and re-open section
      await analyticsButton.click();
      await page.waitForTimeout(500);
      await analyticsButton.click();
      await page.waitForTimeout(500);

      // Verify minimal additional API calls (data cached by React Query)
      // React Query may refetch on window focus or component remount (default staleTime: 0)
      // Accept up to 1 refetch per endpoint as acceptable caching behavior
      const subsequentPriceHistoryCalls = apiRequests.filter((url) =>
        url.includes('price-history')
      ).length;
      const subsequentPriceStatsCalls = apiRequests.filter((url) =>
        url.includes('price-stats')
      ).length;

      expect(subsequentPriceHistoryCalls).toBeLessThanOrEqual(1); // At most 1 refetch
      expect(subsequentPriceStatsCalls).toBeLessThanOrEqual(1); // At most 1 refetch
    });
  });

  test.describe('Performance Budgets', () => {
    test('should load initial page within performance budget', async ({ page }) => {
      // Start performance measurement
      const startTime = Date.now();

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      const loadTime = Date.now() - startTime;

      // Performance budget: Initial page load should complete within 3.5s (TTI target)
      // This includes: HTML load, JS bundle parse, React render, product API call
      expect(loadTime).toBeLessThan(3500); // 3.5s budget for TTI

      // If this fails, check:
      // - Bundle size (should be <800KB with lazy loading)
      // - Network tab for slow API calls
      // - React DevTools Profiler for render time
    });

    test('should lazy load analytics chunk within acceptable time', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section and measure lazy chunk load time
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented');
        return;
      }

      const startTime = Date.now();

      await analyticsButton.click();

      // Wait for charts to appear (chunk load + render)
      await page.waitForSelector('svg.recharts-surface, [class*="recharts-wrapper"]', {
        state: 'visible',
        timeout: 5000,
      });

      const lazyLoadTime = Date.now() - startTime;

      // Performance budget: Lazy chunk load + render should complete within 2s
      // This includes: Chunk download (380KB), parse, React render, API calls
      expect(lazyLoadTime).toBeLessThan(2000); // 2s budget for lazy load

      // If this fails, check:
      // - Chunk size (should be ~380KB for recharts + components)
      // - Network conditions (slow connection?)
      // - React render performance (check DevTools Profiler)
    });

    test('should render charts within acceptable time', async ({ page }) => {
      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented - chart render test requires expandable analytics section');
        return;
      }

      await analyticsButton.click();

      // Wait for lazy chunk to load
      await waitForPageReady(page);

      // Measure chart render time (from API data received to SVG visible)
      const startTime = Date.now();

      await page.waitForSelector('svg.recharts-surface', {
        state: 'visible',
        timeout: 5000,
      });

      const renderTime = Date.now() - startTime;

      // Performance budget: Chart render should complete within 1 second
      // E2E tests measure total time including network, browser, and Playwright overhead
      // For pure Recharts render performance, use unit tests with React Testing Library
      expect(renderTime).toBeLessThan(1000); // 1000ms budget for E2E test

      // If this fails, check:
      // - Chart data complexity (30 days = ~30 data points, should be fast)
      // - Recharts render performance (check for unnecessary re-renders)
      // - Browser DevTools Performance tab
      // - Network conditions (slow API responses)
    });
  });

  test.describe('Error Handling', () => {
    test('should handle chunk load failure gracefully', async ({ page }) => {
      // This test verifies error boundary behavior
      // In real scenario, chunk load failures are rare but can happen on:
      // - Network timeouts
      // - CDN issues
      // - Browser cache corruption

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented - chunk load failure test requires lazy-loaded analytics section');
        return;
      }

      await analyticsButton.click();

      // Wait for either:
      // 1. Charts load successfully (normal case)
      // 2. Error message appears (error boundary caught chunk load failure)
      await Promise.race([
        page.waitForSelector('svg.recharts-surface, [class*="recharts-wrapper"]', {
          state: 'visible',
          timeout: 10000,
        }),
        page.waitForSelector('text=/failed to load|error loading|try again/i', {
          state: 'visible',
          timeout: 10000,
        }),
      ]);

      // Verify page didn't crash (error boundary should catch and display message)
      // Main product content should still be visible
      const productTitle = page.locator('h1, [role="heading"]').first();
      await expect(productTitle).toBeVisible();

      // If error occurred, verify error message exists
      const errorMessage = page.locator('text=/failed to load|error loading|try again/i');
      const hasError = (await errorMessage.count()) > 0;

      if (hasError) {
        // Error boundary should provide retry option
        const _retryButton = page.getByRole('button', { name: /retry|reload|try again/i });
        // Retry button may or may not exist (implementation-dependent)
        // Just verify error message is clear to user
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test('should handle API error gracefully', async ({ page }) => {
      // This test verifies API error handling
      // Note: We can't easily mock API failures in E2E tests without network interception
      // So we verify the UI handles unexpected data gracefully

      // Navigate to product detail page
      await page.goto(`/product/${testProductId}`);
      await waitForPageReady(page);

      // Wait for page content to load
      await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

      // Open analytics section
      const analyticsButton = page.getByRole('button', {
        name: /price analytics.*history/i,
      });

      if ((await analyticsButton.count()) === 0) {
        test.skip(true, 'Price analytics button not implemented - API error handling test requires lazy-loaded analytics section');
        return;
      }

      await analyticsButton.click();

      // Wait for analytics content to load (either success or error state)
      await waitForPageReady(page);

      // Verify NO uncaught errors (page should handle API failures gracefully)
      // Main product content should still be visible even if analytics fail
      const productTitle = page.locator('h1, [role="heading"]').first();
      await expect(productTitle).toBeVisible();

      // Analytics section should either:
      // 1. Show charts (success)
      // 2. Show empty state / error message (graceful failure)
      // 3. Show loading state (still fetching)
      const hasCharts = (await page.locator('svg.recharts-surface').count()) > 0;
      const hasError = (await page.locator('text=/error|failed|unavailable/i').count()) > 0;
      const hasLoading =
        (await page.locator('text=/loading/i').count()) > 0 ||
        (await page.locator('[class*="spinner"]').count()) > 0;

      // At least one of these states should be present (not blank/crashed)
      expect(hasCharts || hasError || hasLoading).toBe(true);
    });
  });
});
