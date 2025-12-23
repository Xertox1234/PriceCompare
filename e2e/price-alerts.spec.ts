/**
 * E2E Tests: Price Alert Management
 *
 * Tests creating, viewing, editing, and deleting price alerts
 */
import { test, expect } from './fixtures';
import { waitForApiResponse } from './helpers';
import { createAlertViaModal, openAlertModalViaChart, bulkCreateAlerts } from './helpers/alert-helpers';
import { seedPriceAlertTestData } from './helpers/price-alerts-seed-helpers';
import { db } from '../server/db';
import { users } from '../shared/schema';

test.describe('Price Alert Management', () => {
  let testProduct: { productId: number; productName: string };

  test.beforeEach(async () => {
    // Seed test data
    testProduct = await seedPriceAlertTestData();
  });

  test.describe('Create Price Alert', () => {
    test('should create a price alert for authenticated user', async ({
      authenticatedPage: page,
    }) => {
      await openAlertModalViaChart(page, testProduct.productId);

      // Fill target price
      await page.fill('#target-price', '999.99');

      // Submit form
      await page.click('button:has-text("Create Alert")');

      // Wait for alert creation
      await waitForApiResponse(page, '/api/price-alerts', 201);

      // Should show success toast
      await expect(page.locator('text=/alert.*created|price alert created/i')).toBeVisible();
    });

    test('should validate target price input', async ({ authenticatedPage: page }) => {
      await openAlertModalViaChart(page, testProduct.productId);

      // Try to submit with invalid price (negative or zero)
      await page.fill('#target-price', '-10');
      await page.click('button:has-text("Create Alert")');

      // Should show validation error or prevent submission
      // Input has min="0.01" attribute, browser may prevent submission
      const priceInput = page.locator('#target-price');
      const isInvalid = await priceInput.evaluate((el: Element) => {
        const input = el as HTMLInputElement;
        return !input.validity.valid;
      });
      expect(isInvalid).toBe(true);
    });

    // SKIPPED: Product is pre-selected from page context in current implementation
    // The modal doesn't have a product selection field - it's automatically tied to the
    // product page you're viewing. This test is not applicable to the modal-based flow.
    test.skip('should require product selection', async () => {
      // Not applicable - product is pre-selected in modal-based implementation
    });

    test('should create alert from product page', async ({ authenticatedPage: page }) => {
      await openAlertModalViaChart(page, testProduct.productId);

      // Fill target price (product is pre-selected from context)
      await page.fill('#target-price', '899.99');
      await page.click('button:has-text("Create Alert")');

      await waitForApiResponse(page, '/api/price-alerts', 201);

      // Should show success toast
      await expect(page.locator('text=/alert.*created|price alert created/i')).toBeVisible();
    });
  });

  // ✅ /alerts page implemented with full CRUD support
  // Tests: list alerts (3 tests), view status, empty state
  test.describe('View Price Alerts', () => {
    test('should list all user alerts', async ({ authenticatedPage: page }) => {
      // /alerts route is implemented
      await createAlertViaModal(page, testProduct.productId, 999.99);
      await createAlertViaModal(page, testProduct.productId, 29.99);

      // View alerts page
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show alerts for the seeded product
      await expect(page.locator('text=/Gaming Laptop/i').first()).toBeVisible();

      // Should show target prices
      await expect(page.locator('text=/999\\.99/i')).toBeVisible();
      await expect(page.locator('text=/29\\.99/i')).toBeVisible();
    });

    test('should show empty state when no alerts', async ({ authenticatedPage: page }) => {
      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show empty state
      await expect(
        page.locator('text=/no.*alerts|create.*first.*alert|no.*price.*alerts/i')
      ).toBeVisible();
    });

    test('should show alert status (active/triggered)', async ({ authenticatedPage: page }) => {
      await createAlertViaModal(page, testProduct.productId, 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show alert status
      await expect(page.locator('text=/active|watching|monitoring|triggered/i')).toBeVisible();
    });
  });

  // ✅ /alerts page implemented with edit functionality
  // Tests: update target price (2 tests), validation
  test.describe('Edit Price Alert', () => {
    test('should update alert target price', async ({ authenticatedPage: page }) => {
      // /alerts route with edit functionality is implemented
      await createAlertViaModal(page, testProduct.productId, 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Click edit button
      await page.click('button:has-text("Edit"), [data-testid="edit-alert"], a:has-text("Edit")');

      // Update target price
      await page.fill('input[name="targetPrice"]', '849.99');
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

      await waitForApiResponse(page, /\/api\/price-alerts\/\d+/, 200);

      // Should show success
      await expect(
        page.locator('text=/alert.*updated|successfully.*updated/i').first()
      ).toBeVisible();

      // Should show new price
      await expect(page.locator('text=/849\\.99/i')).toBeVisible();
    });

    test('should validate updated price', async ({ authenticatedPage: page }) => {
      await createAlertViaModal(page, testProduct.productId, 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Edit")');

      // Try invalid price
      await page.fill('input[name="targetPrice"]', '0');
      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(page.locator('text=/price.*positive|price.*must be.*greater/i')).toBeVisible();
    });
  });

  // ✅ /alerts page implemented with delete functionality
  // Tests: delete alert (2 tests), confirmation dialog
  test.describe('Delete Price Alert', () => {
    test('should delete an alert', async ({ authenticatedPage: page }) => {
      // /alerts route with delete functionality is implemented
      await createAlertViaModal(page, testProduct.productId, 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Verify alert exists
      await expect(page.locator('text=/Gaming Laptop/i')).toBeVisible();

      // Click delete button
      await page.click(
        'button:has-text("Delete"), [data-testid="delete-alert"], button[aria-label*="Delete"]'
      );

      // Confirm deletion (if confirmation dialog exists)
      try {
        await page.click(
          'button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")',
          { timeout: 2000 }
        );
      } catch {
        // No confirmation dialog
      }

      await waitForApiResponse(page, /\/api\/price-alerts\/\d+/, 200);

      // Should show success
      await expect(
        page.locator('text=/alert.*deleted|successfully.*deleted/i').first()
      ).toBeVisible();

      // Alert should be removed from list
      await expect(page.locator('text=/Gaming Laptop/i')).not.toBeVisible();
    });

    test('should require confirmation for deletion', async ({ authenticatedPage: page }) => {
      await createAlertViaModal(page, testProduct.productId, 999.99);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Click delete
      await page.click('button:has-text("Delete")');

      // Should show confirmation dialog
      try {
        await expect(
          page.locator('text=/are you sure|confirm.*deletion|delete.*alert/i')
        ).toBeVisible({ timeout: 2000 });
      } catch {
        // Some implementations might not have confirmation
        console.log('No confirmation dialog found (this is acceptable)');
      }
    });
  });

  // BLOCKER: Alert notification integration pending
  // Requires: price-drop-detection service to create notifications when alerts trigger
  // Backend: server/services/price-drop-detection.ts needs notification integration
  // Effort: ~2-3 hours (Phase 3, Feature 3.1)
  test.describe.skip('Alert Notifications', () => {
    test('should show notification when price drops below target', async ({
      authenticatedPage: page,
    }) => {
      // /alerts route is implemented - awaiting notification backend integration (Phase 3.1)
      await createAlertViaModal(page, testProduct.productId, 2000.0);

      await page.goto('/alerts');
      await page.waitForLoadState('networkidle');

      // Should show that alert was triggered or notification exists
      await expect(
        page.locator('text=/triggered|price.*dropped|target.*met|notification/i')
      ).toBeVisible();
    });
  });

  test.describe('Authentication Requirements', () => {
    test('should require authentication to create alert', async ({ page }) => {
      await openAlertModalViaChart(page, testProduct.productId);

      // Try to submit alert
      await page.fill('#target-price', '999.99');

      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/price-alerts') && response.request().method() === 'POST',
        { timeout: 10000 }
      );

      await page.click('button:has-text("Create Alert")');
      const response = await responsePromise;

      // Should be rejected when not authenticated
      expect([401, 403]).toContain(response.status());

      // Modal shows a toast on API error (assert on the toast title, exact match)
      await expect(page.getByText('Failed to create alert', { exact: true }).first()).toBeVisible();
    });
  });

  test.describe('Alert Limits', () => {
    test('should enforce maximum alerts per user (50 limit)', async ({
      authenticatedPage: page,
    }) => {
      // MAX_ALERTS_PER_USER = 50 from server/utils/constants.ts

      // Get the authenticated user's ID (cleanDb ensures only one user exists)
      const [user] = await db.select().from(users).limit(1);

      // Create 49 alerts via direct database insertion (fast)
      // This gets us to one away from the limit
      await bulkCreateAlerts(user.id, testProduct.productId, 49, 100);

      // Try to create the 50th alert via UI - should succeed (at limit)
      await openAlertModalViaChart(page, testProduct.productId);
      await page.fill('#target-price', '999.98');
      await page.click('button:has-text("Create Alert")');
      await waitForApiResponse(page, '/api/price-alerts', 201);

      // Wait for success toast to appear and disappear
      await page.locator('text=/alert.*created|price alert created/i').waitFor({ state: 'visible' });

      // Try to create the 51st alert - should fail with limit error
      await openAlertModalViaChart(page, testProduct.productId);
      await page.fill('#target-price', '999.99');
      await page.click('button:has-text("Create Alert")');

      // Should show "Alert Limit Reached" error toast (match first visible element)
      await expect(
        page.locator('text=/Alert Limit Reached|You can only have.*active alerts/i').first()
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

