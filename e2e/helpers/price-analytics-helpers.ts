/**
 * E2E Test Helpers: Price Analytics & History
 *
 * Helper functions for price history chart, volatility, and cross-retailer comparison tests.
 */
import { type Page } from '@playwright/test';
import { db } from '../../server/db';
import { products, retailers, productOffers, priceHistory } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Animation timing constants
const COLLAPSIBLE_ANIMATION_MS = 300;
const TOOLTIP_ANIMATION_MS = 200;

/**
 * Navigate to price history page for a specific product
 * Phase 3.1 components are on /product/:id (singular) in collapsible section
 * Opens the "Price Analytics & History" collapsible section
 */
export async function navigateToPriceHistory(page: Page, productId: number): Promise<void> {
  // Navigate to product detail page (singular "product") where Phase 3.1 components are
  await page.goto(`/product/${productId}`);
  await page.waitForLoadState('networkidle');

  // Look for "Price Analytics & History" collapsible trigger
  const analyticsTrigger = page.locator('text=/Price Analytics.*History/i');

  if ((await analyticsTrigger.count()) > 0) {
    // Scroll to collapsible section
    await analyticsTrigger.scrollIntoViewIfNeeded();

    // Check if it's already open (data-state="open")
    const triggerParent = analyticsTrigger.locator('..');
    const isOpen = await triggerParent.getAttribute('data-state');

    // Click to open if closed
    if (isOpen !== 'open') {
      await analyticsTrigger.click();
      // Wait for collapsible animation to complete
      await page.waitForTimeout(COLLAPSIBLE_ANIMATION_MS);
    }
  }
}

/**
 * Select time range for price history chart
 * Supports: 7d, 30d, 90d, 1y, all
 */
export async function selectTimeRange(
  page: Page,
  range: '7d' | '30d' | '90d' | '1y' | 'all'
): Promise<void> {
  // Map shorthand to button text (buttons say "7 Days", not "7d")
  const rangeText = {
    '7d': '7 Days',
    '30d': '30 Days',
    '90d': '90 Days',
    '1y': '1 Year',
    'all': 'All Time',
  }[range];

  // Try button group pattern (most common for time range selectors)
  const rangeButton = page.getByRole('button', { name: new RegExp(rangeText, 'i') });

  if ((await rangeButton.count()) > 0) {
    await rangeButton.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try select dropdown pattern
  const rangeSelect = page.getByLabel(/time.*range|period|range/i);

  if ((await rangeSelect.count()) > 0) {
    await rangeSelect.selectOption(range);
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try tab pattern
  const rangeTab = page.getByRole('tab', { name: new RegExp(range, 'i') });

  if ((await rangeTab.count()) > 0) {
    await rangeTab.click();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Get price data points from chart
 * Returns array of visible price points (extracts from chart or data attributes)
 */
export async function getPriceDataPoints(
  page: Page
): Promise<Array<{ date: string; price: number }>> {
  const dataPoints: Array<{ date: string; price: number }> = [];

  // Try getting data from chart tooltip or data attributes
  // Pattern 1: Recharts uses SVG circles with data attributes
  const chartDots = page.locator('circle[class*="recharts-dot"], circle[class*="data-point"]');
  const dotCount = await chartDots.count();

  if (dotCount > 0) {
    for (let i = 0; i < dotCount; i++) {
      const dot = chartDots.nth(i);
      const priceAttr = await dot.getAttribute('data-price').catch(() => null);
      const dateAttr = await dot.getAttribute('data-date').catch(() => null);

      if (priceAttr && dateAttr) {
        dataPoints.push({
          date: dateAttr,
          price: parseFloat(priceAttr),
        });
      }
    }
  }

  // Pattern 2: If no data attributes, try hovering to read tooltips
  if (dataPoints.length === 0) {
    const chartArea = page
      .locator('[class*="recharts-wrapper"], [data-testid="price-chart"]')
      .first();

    if ((await chartArea.count()) > 0) {
      // Hover over chart to trigger tooltip
      await chartArea.hover();
      await page.waitForTimeout(TOOLTIP_ANIMATION_MS); // Wait for tooltip animation

      // Use .first() to avoid strict mode violation (tooltip div vs cursor path)
      const tooltip = page
        .locator('[class*="recharts-tooltip"], [data-testid="chart-tooltip"]')
        .first();

      if ((await tooltip.count()) > 0) {
        const tooltipText = await tooltip.textContent();

        if (tooltipText) {
          // Extract price from tooltip text (e.g., "$99.99" or "Price: $99.99")
          const priceMatch = tooltipText.match(/\$([0-9,]+\.?[0-9]*)/);

          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            dataPoints.push({ date: new Date().toISOString(), price });
          }
        }
      }
    }
  }

  return dataPoints;
}

/**
 * Get volatility score from price analytics widget
 * Returns { score: number, level: 'low' | 'moderate' | 'high' | 'very-high' | 'unknown' }
 */
export async function getVolatilityScore(
  page: Page
): Promise<{ score: number; level: 'low' | 'moderate' | 'high' | 'very-high' | 'unknown' } | null> {
  // Look for volatility widget/card
  const volatilityWidget = page.locator(
    '[data-testid="volatility-score"], [data-testid="price-volatility"]'
  );

  if ((await volatilityWidget.count()) === 0) {
    // Try text-based locator
    const volatilitySection = page.locator('text=/volatility.*score|price.*volatility/i').first();

    if ((await volatilitySection.count()) === 0) {
      return null;
    }
  }

  // Extract score (e.g., "45/100" or just "45")
  const scoreText = await page
    .locator('text=/[0-9]+\\/100|score.*[0-9]+/i')
    .first()
    .textContent()
    .catch(() => null);

  let score = 0;

  if (scoreText) {
    const scoreMatch = scoreText.match(/([0-9]+)/);
    if (scoreMatch) {
      score = parseInt(scoreMatch[1], 10);
    }
  }

  // Extract level badge (e.g., "LOW", "MODERATE", "HIGH")
  const levelBadge = page
    .locator('[data-testid="volatility-level"], .badge, [class*="badge"]')
    .first();
  let level: 'low' | 'moderate' | 'high' | 'very-high' | 'unknown' = 'unknown';

  if ((await levelBadge.count()) > 0) {
    const levelText = await levelBadge.textContent();

    if (levelText) {
      const normalized = levelText.toLowerCase().trim();
      // Validate that the extracted level is one of the valid values
      if (
        normalized === 'low' ||
        normalized === 'moderate' ||
        normalized === 'high' ||
        normalized === 'very-high'
      ) {
        level = normalized;
      }
    }
  }

  return { score, level };
}

/**
 * Get price change percentage indicator
 * Returns percentage as number (positive or negative)
 */
export async function getPriceChangePercentage(page: Page): Promise<number | null> {
  // Look for price change indicator (e.g., "+5.2%" or "-12.5%")
  const changeIndicator = page.locator('text=/[+-]?[0-9]+\\.?[0-9]*%/i').first();

  if ((await changeIndicator.count()) === 0) {
    return null;
  }

  const changeText = await changeIndicator.textContent();

  if (!changeText) {
    return null;
  }

  const changeMatch = changeText.match(/([+-]?[0-9]+\.?[0-9]*)%/);

  if (changeMatch) {
    return parseFloat(changeMatch[1]);
  }

  return null;
}

/**
 * Get current prices across all retailers for a product
 * Returns array of { retailerName: string, price: number, isBestDeal: boolean }
 */
export async function getRetailerPrices(
  page: Page
): Promise<Array<{ retailerName: string; price: number; isBestDeal: boolean }>> {
  const retailerPrices: Array<{ retailerName: string; price: number; isBestDeal: boolean }> = [];

  // Look for retailer comparison table or grid
  const retailerCards = page.locator('[data-testid="retailer-price"], [class*="retailer-card"]');
  const cardCount = await retailerCards.count();

  if (cardCount > 0) {
    for (let i = 0; i < cardCount; i++) {
      const card = retailerCards.nth(i);

      // Extract retailer name
      const nameElement = card.locator('[data-testid="retailer-name"], h3, .retailer-name').first();
      const retailerName = (await nameElement.textContent()) || '';

      // Extract price
      const priceElement = card.locator('text=/\\$[0-9,]+\\.?[0-9]*/i').first();
      const priceText = (await priceElement.textContent()) || '';
      const price = parseFloat(priceText.replace(/[$,]/g, ''));

      // Check for best deal badge
      const bestDealBadge = card.locator('text=/best.*deal|lowest.*price/i');
      const isBestDeal = (await bestDealBadge.count()) > 0;

      retailerPrices.push({ retailerName, price, isBestDeal });
    }
  }

  return retailerPrices;
}

/**
 * Get "Best Deal" badge status
 * Returns retailer name with best deal badge, or null if not found
 */
export async function getBestDealBadge(page: Page): Promise<string | null> {
  const bestDealBadge = page.locator('[data-testid="best-deal"], text=/best.*deal/i').first();

  if ((await bestDealBadge.count()) === 0) {
    return null;
  }

  // Find parent retailer card to get retailer name
  const parentCard = bestDealBadge.locator('..').locator('..'); // Navigate up to card container
  const retailerName = await parentCard
    .locator('[data-testid="retailer-name"], h3, .retailer-name')
    .first()
    .textContent();

  return retailerName || 'Unknown Retailer';
}

/**
 * Click on a price data point in the chart
 * Opens price alert modal with pre-filled price
 */
export async function clickChartDataPoint(page: Page, dataPointIndex = 0): Promise<void> {
  // Wait for chart to be fully rendered
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Wait for chart animation

  const chartArea = page
    .locator('[data-testid="price-chart"], [class*="recharts-wrapper"]')
    .first();

  if ((await chartArea.count()) === 0) {
    return;
  }

  await chartArea.scrollIntoViewIfNeeded();

  // Try multiple selectors for Recharts dots
  const dotSelectors = [
    'circle[class*="recharts-dot"]', // Standard Recharts dot class
    'circle.recharts-dot', // Exact class match
    '.recharts-line circle', // Circles within line path
    'svg circle[r]', // Any SVG circle with radius attribute (within chart area)
  ];

  for (const selector of dotSelectors) {
    const chartDots = chartArea.locator(selector);
    const dotCount = await chartDots.count();

    if (dotCount > dataPointIndex) {
      // Found dots with this selector, try to click
      const dot = chartDots.nth(dataPointIndex);
      await dot.scrollIntoViewIfNeeded();
      await dot.click({ force: true }); // Force click in case of overlay issues
      return;
    }
  }

  // Fallback: Click chart area to trigger interaction
  await chartArea.click();
}

/**
 * Verify price alert modal has pre-filled price
 * Returns the pre-filled price value from the modal
 */
export async function getAlertModalPrefilledPrice(page: Page): Promise<number | null> {
  // Wait for modal to appear
  const modal = page.locator('[data-testid="alert-modal"], [role="dialog"]').first();
  await modal.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);

  if ((await modal.count()) === 0) {
    return null;
  }

  // Find price input field
  const priceInput = modal.getByLabel(/target.*price|price.*alert|alert.*price/i);

  if ((await priceInput.count()) === 0) {
    return null;
  }

  const priceValue = await priceInput.inputValue();

  if (!priceValue) {
    return null;
  }

  return parseFloat(priceValue.replace(/[$,]/g, ''));
}

/**
 * Seed price history data for a product
 * Creates realistic price trends over specified number of days
 *
 * Distribution:
 * - 20% stable prices (variation < 5%)
 * - 30% gradual decline (-1% to -3% per day)
 * - 25% sharp drop (-10% to -20% over 3 days)
 * - 25% volatility (random ±5% to ±15%)
 */
export async function seedPriceHistoryData(
  productId: number,
  days = 30,
  priceRange: { min: number; max: number } = { min: 50, max: 200 },
  options?: {
    /**
     * Optional deterministic seed for stable test data.
     * When omitted, data is randomized (default behavior).
     */
    seed?: number;
  }
): Promise<void> {
  // Deterministic PRNG (Mulberry32) for stable test data when requested.
  const rand = (() => {
    if (options?.seed === undefined) return Math.random;

    let t = options.seed >>> 0;
    return () => {
      // https://stackoverflow.com/a/47593316 (public domain snippet)
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  })();

  // Get product and create offers/retailers if needed
  const productList = await db.select().from(products).where(eq(products.id, productId));
  const product = productList[0];

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  // Always ensure we have the standard 3 test retailers
  // Check if they exist first to avoid duplicates
  const existingRetailers = await db.select().from(retailers).where(
    sql`${retailers.name} IN ('Amazon', 'Best Buy', 'Walmart')`
  );

  let retailerList: Array<{
    id: number;
    name: string;
    website: string | null;
    isActive: boolean | null;
  }> = [];

  if (existingRetailers.length < 3) {
    // Create missing retailers
    const retailersToCreate = [
      { name: 'Amazon', website: 'https://amazon.com', isActive: true },
      { name: 'Best Buy', website: 'https://bestbuy.com', isActive: true },
      { name: 'Walmart', website: 'https://walmart.com', isActive: true },
    ].filter((r) => !existingRetailers.some((er) => er.name === r.name));

    const newRetailers = await db.insert(retailers).values(retailersToCreate).returning();
    retailerList = [...existingRetailers, ...newRetailers];
  } else {
    retailerList = existingRetailers;
  }

  // Delete existing offers for this product to ensure clean state
  await db.delete(productOffers).where(eq(productOffers.productId, product.id));

  // Create offers for all retailers with varying current prices
  const offerList = await db
    .insert(productOffers)
    .values(
      retailerList.map((retailer, index) => {
        // Distribute prices across the range for variety
        const priceOffset = (priceRange.max - priceRange.min) / (retailerList.length + 1);
        const currentPrice = priceRange.min + priceOffset * (index + 1);
        const retailerName = retailer.name.toLowerCase().replace(' ', '');
        return {
          productId: product.id,
          retailerId: retailer.id,
          price: currentPrice.toFixed(2),
          url: `https://${retailerName}.com/product/${product.id}`,
          availability: 'in_stock',
        };
      })
    )
    .returning();

  // Generate price history data with realistic patterns
  const now = new Date();
  const priceHistoryRecords = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const recordDate = new Date(now);
    recordDate.setDate(recordDate.getDate() - dayOffset);
    recordDate.setHours(12, 0, 0, 0); // Noon UTC for timezone safety

    // Determine price pattern based on distribution
    const patternType = rand();
    let basePrice = priceRange.min + rand() * (priceRange.max - priceRange.min);

    if (patternType < 0.2) {
      // 20% stable prices (variation < 5%)
      const variation = (rand() - 0.5) * 0.05; // ±2.5%
      basePrice = basePrice * (1 + variation);
    } else if (patternType < 0.5) {
      // 30% gradual decline (-1% to -3% per day)
      const declineRate = -0.01 - rand() * 0.02; // -1% to -3%
      basePrice = basePrice * Math.pow(1 + declineRate, dayOffset);
    } else if (patternType < 0.75) {
      // 25% sharp drop (-10% to -20% over 3 days)
      if (dayOffset % 3 === 0) {
        const dropRate = -0.1 - rand() * 0.1; // -10% to -20%
        basePrice = basePrice * (1 + dropRate);
      }
    } else {
      // 25% volatility (random ±5% to ±15%)
      const volatility = (rand() - 0.5) * 0.3; // ±15%
      basePrice = basePrice * (1 + volatility);
    }

    // Ensure price stays within bounds
    basePrice = Math.max(priceRange.min, Math.min(priceRange.max, basePrice));

    // Create price records for each offer (retailer)
    for (const offer of offerList) {
      priceHistoryRecords.push({
        productOfferId: offer.id,
        productId: product.id,
        retailerId: offer.retailerId,
        price: basePrice.toFixed(2),
        availability: 'in_stock',
        source: 'test',
        recordedAt: recordDate,
      });
    }
  }

  // Insert all price history records
  await db.insert(priceHistory).values(priceHistoryRecords);
}

/**
 * Get price trend direction from page
 * Returns 'rising' | 'falling' | 'stable' based on trend indicator
 */
export async function getPriceTrend(page: Page): Promise<'rising' | 'falling' | 'stable' | null> {
  // Look for trend indicator text
  const trendIndicator = page.locator(
    'text=/price.*is.*rising|price.*is.*falling|price.*is.*stable/i'
  );

  if ((await trendIndicator.count()) === 0) {
    return null;
  }

  const trendText = await trendIndicator.textContent();

  if (!trendText) {
    return null;
  }

  if (/rising|upward/i.test(trendText)) return 'rising';
  if (/falling|downward/i.test(trendText)) return 'falling';
  if (/stable/i.test(trendText)) return 'stable';

  return null;
}
