/**
 * DEBUG VERSION of price-analytics.spec.ts
 * Captures page state and screenshots to diagnose why elements aren't found
 */
import { test, expect } from '@playwright/test';
import { cleanDatabase } from './helpers';
import { seedTestProduct } from './helpers/admin-helpers';
import {
  navigateToPriceHistory,
  seedPriceHistoryData,
} from './helpers/price-analytics-helpers';
import { db } from '../server/db';
import { productOffers, priceHistory } from '@shared/schema';
import { eq } from 'drizzle-orm';

let testProductId: number;
let testOfferId: number;

test.beforeEach(async () => {
  await cleanDatabase();

  const { product } = await seedTestProduct({
    name: 'iPhone 15 Pro',
    description: 'Latest iPhone with price history',
    category: 'Smartphones',
  });

  testProductId = product.id;

  // Seed 30 days of realistic price history data
  await seedPriceHistoryData(testProductId, 30, { min: 900, max: 1100 });

  // Get the first offer ID for API testing
  const offers = await db.select().from(productOffers).where(eq(productOffers.productId, testProductId));
  testOfferId = offers[0]?.id || 0;

  console.log('=== SETUP COMPLETE ===');
  console.log('Product ID:', testProductId);
  console.log('Offer ID:', testOfferId);
  console.log('Offers count:', offers.length);
});

test('DEBUG: verify database has price history records', async () => {
  console.log('=== DATABASE CHECK ===');

  // Check database directly
  const historyRecords = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.productOfferId, testOfferId));

  console.log('Price history records in DB:', historyRecords.length);
  if (historyRecords.length > 0) {
    console.log('Sample record:', {
      id: historyRecords[0].id,
      productOfferId: historyRecords[0].productOfferId,
      productId: historyRecords[0].productId,
      price: historyRecords[0].price,
      recordedAt: historyRecords[0].recordedAt,
    });
  }

  expect(historyRecords.length).toBeGreaterThan(0);
});

test('DEBUG: test API endpoint directly', async ({ page }) => {
  console.log('=== API ENDPOINT CHECK ===');

  // Navigate to a page first to establish session
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Test API endpoint
  const apiUrl = `http://localhost:5000/api/products/${testProductId}/offers/${testOfferId}/price-history?limit=100`;
  console.log('API URL:', apiUrl);

  const response = await page.request.get(apiUrl);
  console.log('API Status:', response.status());
  console.log('API Headers:', response.headers());

  const responseText = await response.text();
  console.log('API Response Text:', responseText);

  let data;
  try {
    data = JSON.parse(responseText);
    console.log('API Response JSON:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    console.error('Response was:', responseText);
  }

  expect(response.status()).toBe(200);
  if (data) {
    expect(data.success).toBe(true);
    if (data.data?.data) {
      expect(data.data.data.length).toBeGreaterThan(0);
    } else if (Array.isArray(data.data)) {
      expect(data.data.length).toBeGreaterThan(0);
    }
  }
});

test('DEBUG: price history chart detection', async ({ page }) => {
  console.log('========== DEBUG TEST START ==========');
  console.log('Test Product ID:', testProductId);
  console.log('Test Offer ID:', testOfferId);

  // Enable console logging from the page
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));

  // Navigate to price history page
  console.log('Navigating to price history page...');
  await navigateToPriceHistory(page, testProductId);

  // Take screenshot after navigation
  await page.screenshot({ path: '/tmp/price-analytics-after-nav.png', fullPage: true });
  console.log('Screenshot saved: /tmp/price-analytics-after-nav.png');

  // Get page URL
  const url = page.url();
  console.log('Current URL:', url);

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Check for common error indicators
  const errorText = await page.locator('text=/error|not found|404/i').count();
  console.log('Error text count:', errorText);

  // Check if price-history section exists
  const priceHistorySection = await page.locator('[data-testid="price-history"]').count();
  console.log('price-history section count:', priceHistorySection);

  // Check if price-chart exists
  const priceChart = await page.locator('[data-testid="price-chart"]').count();
  console.log('price-chart count:', priceChart);

  // Check for recharts-wrapper class
  const rechartsWrapper = await page.locator('[class*="recharts-wrapper"]').count();
  console.log('recharts-wrapper count:', rechartsWrapper);

  // Get all elements with data-testid
  const testIds = await page.locator('[data-testid]').allTextContents();
  console.log('All data-testid elements:', testIds);

  // Get page HTML (first 2000 chars)
  const html = await page.content();
  console.log('Page HTML (first 2000 chars):', html.substring(0, 2000));

  // Take screenshot before checking chart
  await page.screenshot({ path: '/tmp/price-analytics-final.png', fullPage: true });
  console.log('Final screenshot saved: /tmp/price-analytics-final.png');

  // Check if price history chart exists
  const chart = page.locator('[data-testid="price-chart"], [class*="recharts-wrapper"]');
  const chartCount = await chart.count();

  console.log('Chart count:', chartCount);
  console.log('========== DEBUG TEST END ==========');

  // Fail the test intentionally to see all output
  expect(chartCount).toBeGreaterThan(0);
});
