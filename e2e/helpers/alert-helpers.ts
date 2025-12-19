/**
 * E2E Test Helpers: Price Alerts
 *
 * Feature-specific helper functions for price alert E2E tests.
 * Tier 2 helpers (feature-specific) - extends core helpers from e2e/helpers.ts
 */
import type { Page } from '@playwright/test';
import { waitForApiResponse } from '../helpers';

export async function openAlertModalViaChart(page: Page, productId: number): Promise<void> {
  // Navigate to product detail page
  await page.goto(`/product/${productId}`);
  await page.waitForLoadState('networkidle');

  // Expand Price Analytics & History section (collapsible, closed by default)
  const analyticsSection = page.locator('text=/Price Analytics.*History/i').first();
  await analyticsSection.click();
  await page.locator('[data-testid="price-chart"]').waitFor({ state: 'visible', timeout: 15000 });

  // Ensure the chart is in view (it can be below the fold)
  await page.locator('[data-testid="price-chart"]').scrollIntoViewIfNeeded();

  // Click on a chart data point to open the price alert modal.
  // In our app, clickable dots are SVG circles.
  const chartDot = page.locator('[data-testid="price-chart"] svg circle.recharts-dot').first();
  await chartDot.waitFor({ state: 'visible', timeout: 10000 });

  const dotBox = await chartDot.boundingBox();
  if (dotBox) {
    await page.mouse.click(dotBox.x + dotBox.width / 2, dotBox.y + dotBox.height / 2);
  } else {
    await chartDot.click({ force: true });
  }

  // Some SVG nodes can be flaky with synthetic clicks depending on layout/overlays.
  // Dispatch a native click event as a fallback to ensure the handler fires.
  await chartDot.evaluate((el) => {
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  });

  // Wait for modal to open (rendered in a portal)
  await page.locator('[data-testid="alert-modal"]').waitFor({ state: 'visible', timeout: 15000 });
}

/**
 * Helper to create a price alert via the modal on a product page
 *
 * Navigates to the product page, expands price analytics, clicks a chart point to open
 * the alert modal, fills in the target price, and submits.
 *
 * @param page - Playwright Page object
 * @param productId - ID of the product to create alert for
 * @param targetPrice - Target price threshold for the alert
 *
 * @example
 * await createAlertViaModal(page, 1, 999.99);
 */
export async function createAlertViaModal(
  page: Page,
  productId: number,
  targetPrice: number
): Promise<void> {
  await openAlertModalViaChart(page, productId);

  // Fill in target price (input has id="target-price")
  await page.fill('#target-price', targetPrice.toString());

  // Submit the form
  await page.click('button:has-text("Create Alert")');

  // Wait for API call to complete
  await waitForApiResponse(page, '/api/price-alerts', 201);
  // Wait for UI to reflect the created alert (toast)
  await page
    .locator('text=/alert.*created|price alert created/i')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}
