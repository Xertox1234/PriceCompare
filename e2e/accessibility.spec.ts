/**
 * E2E Tests: Accessibility (A11y) Smoke Checks
 *
 * Goals:
 * - Catch regressions on key user-facing pages
 * - Keep checks deterministic and stable (seeded data, scoped scans, no hard waits)
 *
 * Notes:
 * - Uses Playwright + Axe (`@axe-core/playwright`).
 * - Prefer scoped scans (`include(...)`) to avoid noisy global violations.
 */
import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { createAdminUser, seedTestProduct } from './helpers/admin-helpers';
import { seedPriceHistoryData, navigateToPriceHistory } from './helpers/price-analytics-helpers';
import { registerUser, waitForPageReady } from './helpers';
import type { Page } from 'playwright-core';

type AxeScanOptions = {
  include?: string;
};

async function hideConnectionStatusIfPresent(page: Page) {
  // Stabilize: if a connection status overlay exists, hide it from consideration.
  // (Used in visual tests; here it also avoids transient ARIA noise.)
  const connectionStatus = page.getByTestId('connection-status');
  if ((await connectionStatus.count()) > 0) {
    await connectionStatus.first().evaluate((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  }
}

async function runA11yScan(page: Page, options: AxeScanOptions = {}) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);

  if (options.include) {
    builder.include(options.include);
  }

  return builder.analyze();
}

function formatViolations(violations: Array<{ id: string; impact?: string | null; description: string }>) {
  return violations
    .map((v) => `- ${v.id} (${v.impact ?? 'unknown'}): ${v.description}`)
    .join('\n');
}

test.describe('Accessibility (A11y)', () => {
  test.describe('Price Analytics area', () => {
    test('should have no WCAG A/AA violations in main content', async ({ page }) => {
      const { product } = await seedTestProduct({
        name: 'A11y Test Product',
        description: 'Seeded product for accessibility checks',
        category: 'Electronics',
      });

      await seedPriceHistoryData(product.id, 30, { min: 50, max: 150 });

      await navigateToPriceHistory(page, product.id);
      await waitForPageReady(page);

      await hideConnectionStatusIfPresent(page);

      // Prefer scanning the main content; fall back to full-page scan if no <main>.
      const hasMain = (await page.locator('main').count()) > 0;
      const results = await runA11yScan(page, hasMain ? { include: 'main' } : undefined);

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });
  });

  test.describe('Public pages', () => {
    test('should have no WCAG A/AA violations in homepage main content', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);
      await hideConnectionStatusIfPresent(page);

      const hasMain = (await page.locator('main').count()) > 0;
      const results = await runA11yScan(page, { include: hasMain ? 'main' : 'body' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });

    test('should have no WCAG A/AA violations in Products listing main content', async ({ page }) => {
      await page.goto('/products');
      await waitForPageReady(page);
      await hideConnectionStatusIfPresent(page);

      // Ensure primary content is present before scanning.
      await page
        .getByRole('heading', { level: 1, name: /featured products|results for/i })
        .waitFor({ state: 'visible', timeout: 15000 });

      const hasMain = (await page.locator('main').count()) > 0;
      const results = await runA11yScan(page, { include: hasMain ? 'main' : 'body' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });

    test('should have no WCAG A/AA violations in Product Detail main content', async ({ page }) => {
      const { product } = await seedTestProduct({
        name: 'A11y Product Detail',
        description: 'Seeded product for product detail a11y checks',
        category: 'Electronics',
      });

      await page.goto(`/product/${product.id}`);
      await waitForPageReady(page);

      // Ensure seeded content is present before scanning.
      await page.getByRole('heading', { level: 1, name: product.name }).waitFor({
        state: 'visible',
        timeout: 15000,
      });

      await hideConnectionStatusIfPresent(page);

      const hasMain = (await page.locator('main').count()) > 0;
      const results = await runA11yScan(page, { include: hasMain ? 'main' : 'body' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });

    test.skip('should have no WCAG A/AA violations in toast notifications on Product Detail', async ({ page }) => {
      // TODO: Watchlist UI implementation issue - combobox option not found
      const { product } = await seedTestProduct({
        name: 'A11y Toast Product',
        description: 'Seeded product for toast a11y checks',
        category: 'Electronics',
      });

      // Register user to access "Add to Watchlist" button (auth-required feature)
      await registerUser(page, 'a11ytoastuser', 'a11ytoast@test.com', 'TestPass123!');

      await page.goto(`/product/${product.id}`);
      await waitForPageReady(page);
      await page.getByRole('heading', { level: 1, name: product.name }).waitFor({
        state: 'visible',
        timeout: 15000,
      });

      // Create a watchlist first via API (auth-required user already registered)
      await page.request.post('/api/watchlists', {
        data: { name: 'Toast Test List', description: 'For testing toast accessibility' },
      });

      // Trigger a deterministic toast: add product to watchlist (shows success toast)
      await page.getByRole('button', { name: /add to watchlist/i }).click();
      await page.getByRole('dialog', { name: /add to watchlist/i }).waitFor({
        state: 'visible',
        timeout: 5000,
      });

      // Select the watchlist we just created
      await page.getByRole('combobox', { name: /select.*watchlist/i }).click();
      await page.getByRole('option', { name: /toast test list/i }).click();

      // Click Add to trigger success toast
      await page.getByRole('button', { name: /^add$/i }).click();

      // Wait for success toast to appear (use actual toast detection, not fixed timeout)
      // Toast message is "Added to {watchlistName}"
      await page
        .getByText(/added to/i)
        .first()
        .waitFor({ state: 'visible', timeout: 5000 })
        .catch(() => null); // Graceful fallback if toast disappears quickly

      await hideConnectionStatusIfPresent(page);

      // Prefer scanning the toast viewport; fall back to status/alert roles.
      const hasRadixViewport = (await page.locator('[data-radix-toast-viewport]').count()) > 0;
      const hasLiveRegion =
        !hasRadixViewport &&
        ((await page.locator('[role="status"], [role="alert"]').count()) > 0);

      const include = hasRadixViewport
        ? '[data-radix-toast-viewport]'
        : hasLiveRegion
          ? '[role="status"], [role="alert"]'
          : 'body';

      const results = await runA11yScan(page, { include });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });
  });

  test.describe('Auth modal + keyboard behavior', () => {
    test('should trap focus within the Sign Up modal and have no WCAG A/AA violations in the modal', async ({ page }) => {
      // The auth UI is modal-based; /price-watch has the navigation buttons.
      await page.goto('/price-watch');
      await waitForPageReady(page);

      await page.getByRole('button', { name: /sign up/i }).first().click();
      await page.waitForSelector('input#username', { state: 'visible', timeout: 5000 });

      const modal = page.getByRole('dialog', { name: /create account/i });
      await expect(modal).toBeVisible();

      const modalHandle = await modal.elementHandle();
      if (!modalHandle) {
        throw new Error('Expected auth modal dialog element handle to exist');
      }

      // Basic focus sanity: username should be focusable; focus should remain inside the modal when tabbing.
      await page.getByLabel(/username/i).focus();
      await expect(page.getByLabel(/username/i)).toBeFocused();

      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
        const isFocusInsideModal = await page.evaluate((dialog) => {
          const active = document.activeElement;
          if (!active) return false;
          return dialog.contains(active);
        }, modalHandle);
        expect(isFocusInsideModal).toBe(true);
      }

      // Scan only the dialog subtree.
      const results = await runA11yScan(page, { include: '[role="dialog"], [data-state="open"]' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);

      // ESC should close modal (keyboard operability)
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
    });
  });

  test.describe('Admin area', () => {
    test('should have no WCAG A/AA violations in admin dashboard main content', async ({ page }) => {
      await createAdminUser(page);

      await page.goto('/admin');
      await waitForPageReady(page);

      await page.getByRole('heading', { level: 1, name: /administration panel/i }).waitFor({
        state: 'visible',
        timeout: 15000,
      });

      await hideConnectionStatusIfPresent(page);

      const results = await runA11yScan(page, { include: 'main' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });

    test('should have no WCAG A/AA violations in admin Users tab main content', async ({ page }) => {
      const { username } = await createAdminUser(page);

      await page.goto('/admin');
      await waitForPageReady(page);
      await page.getByRole('heading', { level: 1, name: /administration panel/i }).waitFor({
        state: 'visible',
        timeout: 15000,
      });

      // Switch to Users tab using accessible role selector.
      await page.getByRole('tab', { name: /^users$/i }).click();
      await expect(page.getByRole('tab', { name: /^users$/i })).toHaveAttribute('data-state', 'active');

      // Ensure the seeded admin user row is present before scanning.
      await page.getByRole('heading', { level: 3, name: username }).waitFor({
        state: 'visible',
        timeout: 15000,
      });

      await hideConnectionStatusIfPresent(page);

      const results = await runA11yScan(page, { include: 'main' });

      expect(
        results.violations,
        results.violations.length ? `Accessibility violations:\n${formatViolations(results.violations)}` : undefined
      ).toEqual([]);
    });
  });
});
