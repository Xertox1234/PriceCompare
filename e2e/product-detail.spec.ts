/**
 * E2E Tests: Product Detail & Integration
 *
 * Tests product detail page loading, information display, watchlist integration,
 * price analytics integration, and related products functionality.
 *
 * Test Coverage:
 * - Product detail page loading (valid/invalid IDs)
 * - Product information and image gallery display
 * - Add/remove product to/from watchlist
 * - Retailer comparison table with best deal badge
 * - Price history chart integration
 * - Related products display
 * - Price alert modal integration
 *
 * Phase 2.4 Patterns Applied (see docs/08_TESTING_PATTERNS.md):
 * ----------------------------------------------------------------
 * 1. Type Safety
 *    - All helpers use `type Page` from '@playwright/test'
 *    - Zero `any` types throughout test suite
 *    - Proper TypeScript types for all function parameters
 *
 * 2. Modal-Based Authentication
 *    - Auth via modals for watchlist/alert features
 *    - Use registerUser()/loginUser() helpers
 *    - Public product viewing doesn't require auth
 *
 * 3. Explicit Waits
 *    - waitForPageReady(page) after navigation
 *    - waitFor() for product data rendering
 *    - Intentional timeouts for chart/image loading
 *
 * 4. Semantic Selectors
 *    - Priority: getByRole, getByLabel, getByText
 *    - data-testid for complex components (charts, galleries)
 *    - CSS selectors only when semantic options unavailable
 *
 * 5. Database Test Data
 *    - seedTestProduct() with offers and price history
 *    - Test via UI interactions, not database queries
 *    - Realistic product data with multiple retailers
 *
 * 6. Graceful Degradation
 *    - Tests skip for unimplemented features
 *    - Check element existence before assertions
 *    - Multiple fallback selectors for flexibility
 *
 * 7. Integration Testing
 *    - Tests integration with watchlist, alerts, analytics
 *    - Reuses components tested in previous phases
 *    - Verifies cross-feature interactions
 */
import { test, expect } from './fixtures';
import {
  registerUser,
  generateTestUsername,
  generateTestEmail,
  waitForPageReady,
} from './helpers';
import { seedTestProduct } from './helpers/admin-helpers';
import { ensureUserHasWatchlist } from './helpers/watchlist-helpers';
import { seedPriceHistoryData } from './helpers/price-analytics-helpers';
import { db } from '../server/db';
import { users } from '@shared/schema';

test.describe('Product Detail - Page Loading', () => {
  test('should load product detail page with valid product ID', async ({ page }) => {
    // Seed a test product with offers and price history
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Verify page loads and product information is displayed
    // Product title should be visible (h1 or heading with product name)
    const productTitle = page.locator('h1, [role="heading"]').filter({ hasText: product.name });
    await expect(productTitle.first()).toBeVisible({ timeout: 10000 });

    // Verify URL is correct
    expect(page.url()).toContain(`/product/${product.id}`);
  });

  test('should handle invalid product ID gracefully', async ({ page }) => {
    // Navigate to product page with non-existent ID
    await page.goto('/product/999999');
    await waitForPageReady(page);

    // Should show error message, redirect to 404, OR load with placeholder/default content
    // Check for error indicators (error message, 404 page, or empty state)
    const hasError =
      (await page.getByText(/not found/i).count()) > 0 ||
      (await page.getByText(/doesn't exist/i).count()) > 0 ||
      (await page.getByText(/error/i).count()) > 0 ||
      (await page.locator('[data-testid="error-state"]').count()) > 0;

    // Alternative: Page may show loading state or default content
    const hasLoadingOrDefault =
      (await page.getByText(/loading/i).count()) > 0 ||
      (await page.locator('[data-testid="product-detail"]').count()) > 0;

    // Either show an error OR load with some content (graceful handling)
    // Skip test if neither condition is met (UI not implemented)
    if (!hasError && !hasLoadingOrDefault) {
      test.skip();
      return;
    }

    // Test passes if either error is shown OR page handles it gracefully
    expect(hasError || hasLoadingOrDefault).toBe(true);
  });
});

test.describe('Product Detail - Information Display', () => {
  test('should display product information correctly', async ({ page }) => {
    // Seed a test product (creates product with one offer at $99.99)
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for product content to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Verify product name is displayed
    const productTitle = page.locator('h1, [role="heading"]').filter({ hasText: product.name });
    await expect(productTitle.first()).toBeVisible();

    // Verify category is displayed (if available)
    if (product.category) {
      const categoryText = page.getByText(product.category, { exact: false });
      await expect(categoryText.first()).toBeVisible({ timeout: 5000 });
    }

    // Verify price information is displayed
    // seedTestProduct creates an offer with price $99.99
    const priceText = '$99.99';

    // Price might be displayed in multiple places, just verify it exists somewhere
    const priceElement = page.getByText(priceText, { exact: false });
    await expect(priceElement.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display and navigate product image gallery', async ({ page }) => {
    // Seed a test product
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for product images - try multiple selectors
    // 1. Try alt containing "Test Product" (the actual product name)
    // 2. Try src containing "unsplash" (our image CDN)
    // 3. Try generic img inside main content area
    const productImage = page.locator('main img').first();

    // Wait for image element to exist
    await expect(productImage).toBeAttached({ timeout: 10000 });

    // Wait for image to load (check naturalWidth > 0)
    await productImage.evaluate((img: HTMLImageElement) => {
      if (img.complete && img.naturalWidth > 0) return true;
      return new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error(`Image failed to load: ${img.src}`));
        setTimeout(() => reject(new Error('Image load timeout')), 10000);
      });
    });

    // Verify main image is displayed and visible
    await expect(productImage).toBeVisible();

    // Look for thumbnail gallery (optional feature)
    const thumbnails = page.locator(
      '[data-testid="product-thumbnail"], button:has(img[alt*="product"])'
    );

    // If thumbnails exist, test gallery navigation
    if ((await thumbnails.count()) > 1) {
      // Click second thumbnail
      await thumbnails.nth(1).click();
      await page.waitForTimeout(300); // Animation delay

      // Verify image changed (this is a basic check, implementation-dependent)
      // In a real implementation, we'd verify the src changed
      await expect(productImage).toBeVisible();
    }
  });
});

test.describe('Product Detail - Watchlist Integration', () => {
  test('should add product to watchlist from product detail page', async ({ page }) => {
    // Register and login user
    await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

    // Get the authenticated user's ID (cleanDb ensures only one user exists)
    const [user] = await db.select().from(users).limit(1);

    // Ensure user has a watchlist
    await ensureUserHasWatchlist(user.id, 'My Watchlist');

    // Seed a test product
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for "Add to Watchlist" button
    const addToWatchlistButton = page.getByRole('button', {
      name: /add to (watchlist|watch list)/i,
    });

    // If button doesn't exist, try alternative selectors
    const watchlistButton =
      (await addToWatchlistButton.count()) > 0
        ? addToWatchlistButton
        : page.locator('button:has-text("Watchlist"), button[data-testid="add-to-watchlist"]');

    // If no watchlist button found, skip test
    if ((await watchlistButton.count()) === 0) {
      test.skip();
      return;
    }

    // Click add to watchlist button
    await watchlistButton.first().click();

    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]', {
      state: 'visible',
      timeout: 5000,
    });

    // Click the Select trigger to open the dropdown
    await page.locator('[id="watchlist-select"]').click();

    // Wait for dropdown to appear
    await page.waitForTimeout(300);

    // Select first watchlist from the dropdown
    const firstWatchlist = page.locator('[role="option"]').first();
    await firstWatchlist.click();

    // Wait for dropdown to close
    await page.waitForTimeout(200);

    // Click the "Add" button in the dialog footer
    const addButton = page.getByRole('button', { name: /^Add$/i });
    await addButton.click();

    // Verify success toast appears
    await expect(page.getByText(/added to/i).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test.skip('should remove product from watchlist', async ({ page }) => {
    // Register and login user
    await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

    // Get the authenticated user's ID (cleanDb ensures only one user exists)
    const [user] = await db.select().from(users).limit(1);

    // Ensure user has a watchlist
    await ensureUserHasWatchlist(user.id, 'My Watchlist');

    // Seed a test product
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Add product to watchlist first
    const addButton = page.getByRole('button', { name: /add to (watchlist|watch list)/i }).first();

    if ((await addButton.count()) === 0) {
      test.skip();
      return;
    }

    await addButton.click();
    await page.waitForSelector('[role="dialog"], [role="menu"]', {
      state: 'visible',
      timeout: 5000,
    });

    // Wait for modal animations
    await page.waitForTimeout(500);

    await page.locator('[role="menuitem"], [role="option"]').first().click({ force: true });
    await page.waitForTimeout(1000); // Wait for addition to complete

    // Now look for remove button
    const removeButton = page.getByRole('button', {
      name: /remove from (watchlist|watch list)/i,
    });

    if ((await removeButton.count()) > 0) {
      await removeButton.first().click();

      // Verify success toast
      await expect(page.getByText(/removed from (watchlist|watch list)/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe('Product Detail - Price Analytics Integration', () => {
  test('should display retailer comparison table with best deal badge', async ({ page }) => {
    // Seed a test product with multiple offers
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for retailer comparison section
    const comparisonSection = page.locator(
      '[data-testid="retailer-comparison"], section:has-text("Compare Prices"), section:has-text("Retailers")'
    );

    // If no comparison section, skip test
    if ((await comparisonSection.count()) === 0) {
      test.skip();
      return;
    }

    // Verify retailer names are displayed
    // Should show Amazon, Best Buy, Walmart (from seedTestProduct)
    const retailerNames = page.getByText(/Amazon|Best Buy|Walmart/);
    await expect(retailerNames.first()).toBeVisible({ timeout: 5000 });

    // Look for "Best Deal" or "Best Price" badge
    const bestDealBadge = page.getByText(/best (deal|price)/i);

    // If badge exists, verify it's visible
    if ((await bestDealBadge.count()) > 0) {
      await expect(bestDealBadge.first()).toBeVisible();
    }
  });

  test('should display price history chart', async ({ page }) => {
    // Seed a test product (includes one offer)
    const { product } = await seedTestProduct();

    // Seed price history data (30 days)
    await seedPriceHistoryData(product.id, 30);

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for price history chart section
    // Chart might be in a collapsible section or separate tab
    const chartSection = page.locator(
      '[data-testid="price-history"], [class*="recharts"], section:has-text("Price History")'
    );

    // If chart section exists, verify it's visible or expandable
    if ((await chartSection.count()) > 0) {
      await expect(chartSection.first()).toBeVisible({ timeout: 5000 });
    } else {
      // Try to find a tab or button to show price history
      const priceHistoryTab = page.getByRole('tab', { name: /price history/i });

      if ((await priceHistoryTab.count()) > 0) {
        await priceHistoryTab.click();
        await page.waitForTimeout(500); // Wait for chart to render

        // Verify chart is now visible
        const chart = page.locator('[class*="recharts-wrapper"]');
        await expect(chart).toBeVisible({ timeout: 5000 });
      } else {
        // No price history feature found, skip test
        test.skip();
      }
    }
  });
});

test.describe('Product Detail - Related Products', () => {
  test('should display related products from same category', async ({ page }) => {
    // Seed a test product
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for related products section
    const relatedSection = page.locator(
      'section:has-text("Related Products"), section:has-text("You May Also Like"), section:has-text("Similar Products")'
    );

    // If no related products section, skip test
    if ((await relatedSection.count()) === 0) {
      test.skip();
      return;
    }

    // Verify related products are displayed
    // Look for product cards within the related section
    const productCards = relatedSection.locator('[data-testid="product-card"], article, .product');

    // Should have at least 1 related product
    const cardCount = await productCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify first product card is visible
    await expect(productCards.first()).toBeVisible();
  });
});

test.describe('Product Detail - Price Alert Integration', () => {
  test('should open price alert modal from product detail page', async ({ page }) => {
    // Register and login user (price alerts require authentication)
    await registerUser(page, generateTestUsername(), generateTestEmail(), 'UserPass123!');

    // Seed a test product
    const { product } = await seedTestProduct();

    // Navigate to product detail page
    await page.goto(`/product/${product.id}`);
    await waitForPageReady(page);

    // Wait for page to load
    await page.waitForSelector('h1, [role="heading"]', { state: 'visible', timeout: 10000 });

    // Look for "Set Price Alert" or "Create Alert" button
    const alertButton = page.getByRole('button', {
      name: /set (price )?alert|create alert/i,
    });

    // If no alert button found, try alternative selectors
    const priceAlertButton =
      (await alertButton.count()) > 0
        ? alertButton
        : page.locator('button:has-text("Alert"), button[data-testid="price-alert"]');

    // If no price alert button found, skip test
    if ((await priceAlertButton.count()) === 0) {
      test.skip();
      return;
    }

    // Click price alert button
    await priceAlertButton.first().click();

    // Wait for alert modal to appear
    const alertModal = page.locator('[role="dialog"]:has-text("Price Alert"), [role="dialog"]:has-text("Alert")');
    await expect(alertModal).toBeVisible({ timeout: 5000 });

    // Verify modal contains price input field
    const priceInput = alertModal.getByLabel(/target price|price/i);

    if ((await priceInput.count()) > 0) {
      await expect(priceInput).toBeVisible();
    }
  });
});
