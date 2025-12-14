/**
 * E2E Test Helpers: Advanced Search
 *
 * Helper functions for advanced search E2E tests
 */
import { type Page } from '@playwright/test';

/**
 * Perform a product search with query term
 * Navigates to search page and submits search query
 */
export async function performSearch(page: Page, query: string): Promise<void> {
  // Navigate to search page
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Find search input (multiple possible patterns)
  const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();

  await searchInput.fill(query);
  await searchInput.press('Enter');

  // Wait for results to load
  await page.waitForLoadState('networkidle');
}

/**
 * Apply category filter to search results
 * Works with select dropdowns or filter buttons
 */
export async function applyCategoryFilter(page: Page, category: string): Promise<void> {
  // Try select dropdown first (most common pattern)
  const categorySelect = page.getByLabel(/category/i);

  if ((await categorySelect.count()) > 0) {
    await categorySelect.selectOption(category);
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try filter button/link pattern
  const categoryButton = page.getByRole('button', { name: new RegExp(category, 'i') });

  if ((await categoryButton.count()) > 0) {
    await categoryButton.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try checkbox pattern
  const categoryCheckbox = page.getByLabel(new RegExp(category, 'i'));

  if ((await categoryCheckbox.count()) > 0) {
    await categoryCheckbox.check();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Apply price range filter
 * Sets minimum and maximum price values
 */
export async function applyPriceRangeFilter(
  page: Page,
  minPrice: number,
  maxPrice: number
): Promise<void> {
  // Find min price input
  const minPriceInput = page.getByLabel(/min.*price|minimum.*price/i);
  await minPriceInput.fill(minPrice.toString());

  // Find max price input
  const maxPriceInput = page.getByLabel(/max.*price|maximum.*price/i);
  await maxPriceInput.fill(maxPrice.toString());

  // Look for apply/submit button (may or may not exist - auto-apply is common)
  const applyButton = page.getByRole('button', { name: /apply.*filter|search/i });

  if ((await applyButton.count()) > 0) {
    await applyButton.click();
  }

  // Wait for filtered results
  await page.waitForLoadState('networkidle');
}

/**
 * Apply retailer filter
 * Selects specific retailer from filter options
 */
export async function applyRetailerFilter(page: Page, retailer: string): Promise<void> {
  // Try select dropdown
  const retailerSelect = page.getByLabel(/retailer|store/i);

  if ((await retailerSelect.count()) > 0) {
    await retailerSelect.selectOption(retailer);
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try checkbox pattern
  const retailerCheckbox = page.getByLabel(new RegExp(retailer, 'i'));

  if ((await retailerCheckbox.count()) > 0) {
    await retailerCheckbox.check();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Sort search results by given criteria
 * Common sort options: price-asc, price-desc, rating, relevance
 */
export async function sortSearchResults(page: Page, sortBy: string): Promise<void> {
  // Find sort dropdown
  const sortSelect = page.getByLabel(/sort.*by|order.*by/i);

  if ((await sortSelect.count()) > 0) {
    await sortSelect.selectOption(sortBy);
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try button pattern (dropdown menu)
  const sortButton = page.getByRole('button', { name: /sort|order/i });

  if ((await sortButton.count()) > 0) {
    await sortButton.click();

    // Wait for menu to appear
    await page.waitForTimeout(300);

    // Click sort option
    await page.getByRole('menuitem', { name: new RegExp(sortBy, 'i') }).click();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Wait for search results to load
 * Waits for product cards or empty state to appear
 */
export async function waitForSearchResults(page: Page): Promise<void> {
  // Wait for either product cards or empty state message
  await Promise.race([
    page
      .locator('[data-testid="product-card"], .product-card')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 }),
    page
      .locator('text=/no.*results|no.*products.*found|nothing.*found/i')
      .waitFor({ state: 'visible', timeout: 10000 }),
  ]);
}

/**
 * Get count of search results displayed
 * Returns the number of product cards visible on current page
 */
export async function getSearchResultCount(page: Page): Promise<number> {
  const productCards = page.locator('[data-testid="product-card"], .product-card');
  return await productCards.count();
}

/**
 * Navigate to specific page in paginated results
 */
export async function navigateToPage(page: Page, pageNumber: number): Promise<void> {
  // Try page number button
  const pageButton = page.getByRole('button', { name: pageNumber.toString() });

  if ((await pageButton.count()) > 0) {
    await pageButton.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try "Next" button pattern for sequential navigation
  if (pageNumber > 1) {
    const currentPage = await getCurrentPageNumber(page);

    for (let i = currentPage; i < pageNumber; i++) {
      const nextButton = page.getByRole('button', { name: /next/i });
      await nextButton.click();
      await page.waitForLoadState('networkidle');
    }
  }
}

/**
 * Get current page number from URL or pagination UI
 */
export async function getCurrentPageNumber(page: Page): Promise<number> {
  // Try URL parameter first
  const url = new URL(page.url());
  const pageParam = url.searchParams.get('page');

  if (pageParam) {
    return parseInt(pageParam, 10);
  }

  // Try active page button (look for aria-current="page" or similar)
  const activePage = page.locator('button[aria-current="page"], button.active, button.selected');

  if ((await activePage.count()) > 0) {
    const text = await activePage.textContent();
    return parseInt(text || '1', 10);
  }

  // Default to page 1
  return 1;
}

/**
 * Extract prices from search result cards
 * Returns array of prices as numbers
 */
export async function getSearchResultPrices(page: Page): Promise<number[]> {
  const productCards = page.locator('[data-testid="product-card"], .product-card');
  const count = await productCards.count();
  const prices: number[] = [];

  for (let i = 0; i < count; i++) {
    const card = productCards.nth(i);

    // Look for price text (matches pattern $X.XX or $X,XXX.XX)
    const priceText = await card.locator('text=/\\$[0-9,]+\\.?[0-9]*/i').first().textContent();

    if (priceText) {
      // Remove $ and commas, parse as float
      const price = parseFloat(priceText.replace(/[$,]/g, ''));
      prices.push(price);
    }
  }

  return prices;
}

/**
 * Extract categories from search result cards
 * Returns array of category names
 */
export async function getSearchResultCategories(page: Page): Promise<string[]> {
  const productCards = page.locator('[data-testid="product-card"], .product-card');
  const count = await productCards.count();
  const categories: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = productCards.nth(i);

    // Look for category badge/tag
    const categoryText = await card
      .locator('[data-testid="category"], .category, .badge')
      .first()
      .textContent()
      .catch(() => null);

    if (categoryText) {
      categories.push(categoryText.trim());
    }
  }

  return categories;
}
