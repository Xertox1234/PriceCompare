import { test, expect } from '@playwright/test';

/**
 * Homepage E2E Tests
 * Tests basic functionality of the landing page
 */

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage before each test
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/PriceCompare/i);

    // Verify main content is visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display navigation elements', async ({ page }) => {
    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Check for key navigation items (adjust selectors based on your actual nav)
    // These are examples - update based on your actual navigation structure
    const homeLink = page.getByRole('link', { name: /home/i });
    await expect(homeLink).toBeVisible();
  });

  test('should have responsive layout', async ({ page }) => {
    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('body')).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('body')).toBeVisible();
  });

  test('should not have console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known/acceptable errors if any
    const criticalErrors = consoleErrors.filter(
      (error) => !error.includes('favicon') // Ignore favicon errors
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('should have no accessibility violations (basic check)', async ({ page }) => {
    // Check for basic accessibility features
    await expect(page.locator('html')).toHaveAttribute('lang');

    // Verify images have alt attributes
    const images = await page.locator('img').all();
    for (const img of images) {
      await expect(img).toHaveAttribute('alt');
    }
  });
});
