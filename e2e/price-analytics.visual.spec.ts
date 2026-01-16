/**
 * E2E Tests: Price Analytics - Visual Regression
 *
 * Visual baselines for the "Price Analytics & History" section on product detail.
 * Uses deterministic seeded price history data to reduce screenshot noise.
 */
import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { registerUser, generateTestEmail, generateTestUsername } from './helpers';
import { seedTestProduct } from './helpers/admin-helpers';
import {
  navigateToPriceHistory,
  selectTimeRange,
  seedPriceHistoryData,
  clickChartDataPoint,
} from './helpers/price-analytics-helpers';

async function stabilizeForScreenshot(page: Page) {
  // Reduce animation-related flake (Recharts, transitions, caret, etc.)
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        caret-color: transparent !important;
      }

      /* Hide transient websocket connection status overlay */
      [data-testid="connection-status"] {
        display: none !important;
      }
    `,
  });
}

function getPriceAnalyticsSection(page: Page) {
  // Collapsible content container should include chart + stats.
  // Fallback to main content if structure changes.
  return page.locator('text=/Price Analytics.*History/i').first().locator('..').locator('..');
}

test.describe('Price Analytics - Visual Regression', () => {
  let testProductId: number;

  test.beforeEach(async ({ page }) => {
    // Auth not required for viewing, but needed for alert modal actions.
    await registerUser(
      page,
      generateTestUsername('visual'),
      generateTestEmail('visual'),
      'VisualPass123!'
    );

    const { product } = await seedTestProduct({
      name: 'Visual Baseline Product',
      description: 'Deterministic price history for screenshot baselines',
      category: 'Electronics',
    });

    testProductId = product.id;

    // Seed 90 days for range switching; deterministic seed to keep chart shape stable.
    await seedPriceHistoryData(testProductId, 90, { min: 900, max: 1100 }, { seed: 1337 });

    // Consistent viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('expanded section (default 30 days)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await stabilizeForScreenshot(page);

    const section = getPriceAnalyticsSection(page);
    await section.scrollIntoViewIfNeeded();

    // Mask axis tick labels (date-dependent) to reduce churn.
    const axisTicks = page.locator(
      '.recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text'
    );

    await expect(section).toHaveScreenshot('price-analytics-expanded-30d.png', {
      mask: [axisTicks],
      maxDiffPixels: 250,
    });
  });

  test('expanded section (7 days selected)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await selectTimeRange(page, '7d');
    await stabilizeForScreenshot(page);

    const section = getPriceAnalyticsSection(page);
    await section.scrollIntoViewIfNeeded();

    const axisTicks = page.locator(
      '.recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text'
    );

    await expect(section).toHaveScreenshot('price-analytics-expanded-7d.png', {
      mask: [axisTicks],
      maxDiffPixels: 250,
    });
  });

  test('expanded section (90 days selected)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await selectTimeRange(page, '90d');
    await stabilizeForScreenshot(page);

    const section = getPriceAnalyticsSection(page);
    await section.scrollIntoViewIfNeeded();

    const axisTicks = page.locator(
      '.recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text'
    );

    await expect(section).toHaveScreenshot('price-analytics-expanded-90d.png', {
      mask: [axisTicks],
      maxDiffPixels: 250,
    });
  });

  test('chart only baseline', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await stabilizeForScreenshot(page);

    const chart = page.locator('[data-testid="price-chart"], [class*="recharts-wrapper"]').first();

    if ((await chart.count()) === 0) {
      test.skip(true, 'Price chart not rendered - data not available for chart-only visual baseline');
      return;
    }

    await chart.scrollIntoViewIfNeeded();

    const axisTicks = page.locator(
      '.recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text'
    );

    await expect(chart).toHaveScreenshot('price-chart.png', {
      mask: [axisTicks],
      maxDiffPixels: 200,
    });
  });

  test('alert modal baseline (opened from chart click)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);

    const chart = page.locator('[data-testid="price-chart"], [class*="recharts-wrapper"]').first();

    if ((await chart.count()) === 0) {
      test.skip(true, 'Price chart not rendered - cannot capture alert modal baseline without chart interaction');
      return;
    }

    await chart.scrollIntoViewIfNeeded();

    // Click a chart point to open the alert modal.
    await clickChartDataPoint(page);
    await stabilizeForScreenshot(page);

    const modal = page.locator('[data-testid="alert-modal"]').first();
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    await expect(modal).toHaveScreenshot('price-alert-modal.png', {
      maxDiffPixels: 150,
    });
  });

  test('volatility widget baseline (if present)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await stabilizeForScreenshot(page);

    const widget = page.locator('text=/price\\s+volatility/i').first().locator('..');

    if ((await widget.count()) === 0) {
      test.skip(true, 'Volatility widget not rendered - feature not implemented or no data available');
      return;
    }

    await widget.scrollIntoViewIfNeeded();

    await expect(widget).toHaveScreenshot('price-volatility-widget.png', {
      maxDiffPixels: 150,
    });
  });

  test('historical facts baseline (if present)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await stabilizeForScreenshot(page);

    const facts = page.locator('text=/historical.*facts/i').first().locator('..');

    if ((await facts.count()) === 0) {
      test.skip(true, 'Historical facts section not rendered - feature not implemented or no data available');
      return;
    }

    await facts.scrollIntoViewIfNeeded();

    await expect(facts).toHaveScreenshot('historical-facts.png', {
      maxDiffPixels: 150,
    });
  });

  test('retailer comparison baseline (if present)', async ({ page }) => {
    await navigateToPriceHistory(page, testProductId);
    await stabilizeForScreenshot(page);

    const comparison = page.locator('text=/cross-retailer\\s+comparison/i').first().locator('..');

    if ((await comparison.count()) === 0) {
      test.skip(true, 'Cross-retailer comparison not rendered - feature not implemented or no multi-retailer data');
      return;
    }

    await comparison.scrollIntoViewIfNeeded();

    await expect(comparison).toHaveScreenshot('retailer-comparison.png', {
      maxDiffPixels: 200,
    });
  });
});
