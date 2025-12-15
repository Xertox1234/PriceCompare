/**
 * DEBUG: Time Range Button Detection
 */
import { test } from '@playwright/test';
import { cleanDatabase } from './helpers';
import { seedTestProduct } from './helpers/admin-helpers';
import { navigateToPriceHistory, seedPriceHistoryData } from './helpers/price-analytics-helpers';

test('DEBUG: find time range buttons', async ({ page }) => {
  // Setup
  await cleanDatabase();
  const { product } = await seedTestProduct({
    name: 'iPhone 15 Pro',
    description: 'Latest iPhone',
    category: 'Smartphones',
  });
  await seedPriceHistoryData(product.id, 90, { min: 800, max: 1200 });

  // Navigate
  await navigateToPriceHistory(page, product.id);

  // Log all buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons:`);
  for (const button of buttons) {
    const text = await button.textContent();
    console.log(`  - "${text}"`);
  }

  // Check specific patterns
  const pattern1 = page.getByRole('button', { name: /7\s*days/i });
  console.log(`Pattern /7\\s*days/i count: ${await pattern1.count()}`);

  const pattern2 = page.getByRole('button', { name: /7 Days/i });
  console.log(`Pattern /7 Days/i count: ${await pattern2.count()}`);

  const pattern3 = page.getByRole('button', { name: '7 Days' });
  console.log(`Exact "7 Days" count: ${await pattern3.count()}`);

  // Take screenshot
  await page.screenshot({ path: '/tmp/time-range-debug.png', fullPage: true });
  console.log('Screenshot saved to /tmp/time-range-debug.png');
});
