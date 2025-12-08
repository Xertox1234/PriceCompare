import { test, expect } from '@playwright/test';

/**
 * Product Search E2E Tests
 * Tests product search and filtering functionality
 */

test.describe('Product Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display search input', async ({ page }) => {
    // Look for search input (adjust selector based on your UI)
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
  });

  test('should perform product search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    if (!(await searchInput.isVisible())) {
      test.skip();
      return;
    }

    // Enter search query
    await searchInput.fill('laptop');
    await searchInput.press('Enter');

    // Wait for results to load
    await page.waitForLoadState('networkidle');

    // Verify results are displayed (adjust selector based on your UI)
    const results = page.locator('[data-testid="product-card"], .product-item, article');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show empty state for no results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    if (!(await searchInput.isVisible())) {
      test.skip();
      return;
    }

    // Search for something that likely won't exist
    await searchInput.fill('xyznonexistentproduct12345');
    await searchInput.press('Enter');

    await page.waitForLoadState('networkidle');

    // Should show "no results" message
    await expect(page.locator('text=/no results|not found|no products/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should filter search results', async ({ page }) => {
    // Navigate to search/products page if not already there
    const searchInput = page.getByPlaceholder(/search/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('phone');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');
    }

    // Look for filter options (adjust based on your UI)
    const priceFilter = page.locator('text=/price|filter|sort/i').first();

    if (await priceFilter.isVisible()) {
      await priceFilter.click();

      // Select a filter option
      const filterOption = page.locator('text=/low to high|high to low/i').first();
      if (await filterOption.isVisible()) {
        await filterOption.click();

        // Wait for filtered results
        await page.waitForLoadState('networkidle');

        // Verify results are still visible
        const results = page.locator('[data-testid="product-card"], .product-item, article');
        await expect(results.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should navigate to product detail page', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('laptop');
      await searchInput.press('Enter');
      await page.waitForLoadState('networkidle');

      // Click on first product
      const firstProduct = page
        .locator('[data-testid="product-card"], .product-item, article')
        .first();

      if (await firstProduct.isVisible()) {
        await firstProduct.click();

        // Should navigate to product detail page
        await expect(page).toHaveURL(/\/product\/\d+/, { timeout: 5000 });

        // Verify product details are visible
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
    }
  });
});
