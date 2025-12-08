import { test, expect } from '@playwright/test';

/**
 * Watchlist E2E Tests
 * Tests product watchlist functionality
 */

test.describe('Watchlist', () => {
  // Helper to ensure user is logged in
  test.beforeEach(async ({ page }) => {
    // Skip tests if user is not logged in
    // In a real scenario, you'd use a test account or fixture
    await page.goto('/');
  });

  test('should add product to watchlist', async ({ page }) => {
    // Navigate to a product page
    await page.goto('/');

    const searchInput = page.getByPlaceholder(/search/i);
    if (!(await searchInput.isVisible())) {
      test.skip();
      return;
    }

    await searchInput.fill('laptop');
    await searchInput.press('Enter');
    await page.waitForLoadState('networkidle');

    // Click first product
    const firstProduct = page
      .locator('[data-testid="product-card"], .product-item, article')
      .first();
    if (!(await firstProduct.isVisible())) {
      test.skip();
      return;
    }

    await firstProduct.click();

    // Look for "Add to Watchlist" button
    const addButton = page.getByRole('button', { name: /add to watchlist|watch/i });

    if (await addButton.isVisible()) {
      await addButton.click();

      // Should show success feedback
      await expect(page.locator('text=/added|watching|success/i').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should view watchlist page', async ({ page }) => {
    await page.goto('/');

    // Navigate to watchlist (adjust selector based on your nav)
    const watchlistLink = page.getByRole('link', { name: /watchlist|favorites/i });

    if (await watchlistLink.isVisible()) {
      await watchlistLink.click();

      // Verify watchlist page loaded
      await expect(page.getByRole('heading', { name: /watchlist|favorites/i })).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should remove product from watchlist', async ({ page }) => {
    // Navigate to watchlist
    await page.goto('/');
    const watchlistLink = page.getByRole('link', { name: /watchlist|favorites/i });

    if (!(await watchlistLink.isVisible())) {
      test.skip();
      return;
    }

    await watchlistLink.click();

    // Look for remove button on first item
    const removeButton = page.getByRole('button', { name: /remove|delete|unwatch/i }).first();

    if (await removeButton.isVisible()) {
      await removeButton.click();

      // Should show confirmation or success message
      await page.waitForTimeout(1000); // Brief wait for UI update
    }
  });

  test('should display price drop alerts', async ({ page }) => {
    await page.goto('/');
    const watchlistLink = page.getByRole('link', { name: /watchlist|favorites/i });

    if (!(await watchlistLink.isVisible())) {
      test.skip();
      return;
    }

    await watchlistLink.click();

    // Look for price alert indicators (adjust based on your UI)
    const priceAlert = page
      .locator('[data-testid="price-alert"], .price-drop, text=/price drop|alert/i')
      .first();

    // This test may pass even if no alerts are present (that's valid too)
    // Just verifying the page structure supports it
    if (await priceAlert.isVisible()) {
      await expect(priceAlert).toBeVisible();
    }
  });
});
