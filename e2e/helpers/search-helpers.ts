/**
 * E2E Test Helpers: Advanced Search
 *
 * Helper functions for advanced search E2E tests
 */
import { type Page } from '@playwright/test';

function getResultCardLocator(page: Page) {
  // Current UI renders product results as expandable cards.
  // Keep legacy selectors as fallbacks.
  return page.locator('.expandable-card, [data-testid="product-card"], .product-card');
}

function normalizeSortValue(sortBy: string): string {
  const key = sortBy.trim().toLowerCase();

  if (key === 'price') {
    // UI default for price sorting is low-to-high.
    return 'price_low';
  }

  // Map common test-friendly aliases to UI option values.
  if (key === 'price_low' || key === 'price: low to high' || key === 'price low' || key === 'low') {
    return 'price_low';
  }
  if (
    key === 'price_high' ||
    key === 'price: high to low' ||
    key === 'price high' ||
    key === 'high'
  ) {
    return 'price_high';
  }
  // IMPORTANT: Some test inputs include both "high" and "low" (e.g. "high.*low").
  // Prefer descending/high-to-low when any strong descending signal is present.
  if (key === 'price-desc' || key === 'price_desc' || key === 'desc' || key.includes('high')) {
    return 'price_high';
  }
  if (key === 'price-asc' || key === 'price_asc' || key === 'asc' || key.includes('low')) {
    return 'price_low';
  }
  if (key === 'rating') {
    return 'rating';
  }
  if (key === 'popularity' || key === 'relevance') {
    return 'popularity';
  }

  return key;
}

/**
 * Perform a product search with query term
 * Navigates to search page and submits search query
 */
export async function performSearch(page: Page, query: string): Promise<void> {
  // Navigate to products page (current search UI lives here)
  await page.goto('/products');
  await page.waitForLoadState('networkidle');

  // Tests should prefer basic mode to avoid SmartSearch flakiness/errors.
  const switchToBasic = page.getByRole('button', { name: /switch to basic search mode/i }).first();
  if (await switchToBasic.isVisible().catch(() => false)) {
    await switchToBasic.click();
  }

  // Find search input (multiple possible patterns)
  const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]').first();

  await searchInput.fill(query);
  await searchInput.press('Enter');

  // Wait for the products search request to complete.
  await page
    .waitForResponse((r) => r.url().includes('/api/products') && r.status() === 200, {
      timeout: 10000,
    })
    .catch(() => null);

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
  // IMPORTANT: Do NOT include /search/i here (it collides with the search mode toggle and "Clear Search").
  const applyButton = page.getByRole('button', { name: /^apply filters$/i });
  if ((await applyButton.count()) > 0) await applyButton.first().click();

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

  const normalizedValue = normalizeSortValue(sortBy);

  if ((await sortSelect.count()) > 0) {
    // Prefer value-based selection to avoid brittle label matching.
    try {
      await sortSelect.selectOption({ value: normalizedValue });
    } catch {
      // Fallback: resolve an option by inspecting option text/label/value.
      const fallbackValue = await sortSelect.evaluate((el, value) => {
        const select = el as HTMLSelectElement;
        const options = Array.from(select.options);

        const patterns: Record<string, RegExp> = {
          price_low: /price\s*[:-]?\s*low\s*to\s*high|low\s*to\s*high|asc/i,
          price_high: /price\s*[:-]?\s*high\s*to\s*low|high\s*to\s*low|desc/i,
          popularity: /most\s*popular|popularity|relevance/i,
          rating: /rating/i,
        };

        const re = patterns[value] ?? new RegExp(String(value).replace(/_/g, '\\s*'), 'i');
        const match = options.find(
          (o) => re.test(o.label) || re.test(o.textContent ?? '') || re.test(o.value)
        );
        return match?.value ?? null;
      }, normalizedValue);

      if (fallbackValue) {
        await sortSelect.selectOption({ value: fallbackValue });
      } else {
        await sortSelect.selectOption(normalizedValue);
      }
    }
    await page.waitForLoadState('networkidle');
    return;
  }

  // Try button pattern (dropdown menu)
  const sortButton = page.getByRole('button', { name: /sort|order/i });

  if ((await sortButton.count()) > 0) {
    await sortButton.click();

    // Click sort option
    const sortMenuItem = page
      .getByRole('menuitem', { name: new RegExp(normalizedValue, 'i') })
      .first();
    await sortMenuItem.waitFor({ state: 'visible', timeout: 3000 });
    await sortMenuItem.click();
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
    getResultCardLocator(page).first().waitFor({ state: 'visible', timeout: 10000 }),
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
  return await getResultCardLocator(page).count();
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
  const productCards = getResultCardLocator(page);
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
  const productCards = getResultCardLocator(page);
  const count = await productCards.count();
  const categories: string[] = [];

  for (let i = 0; i < count; i++) {
    const card = productCards.nth(i);

    // Look for category badge/tag
    const categoryText = await card
      .locator(
        '[data-testid="product-category"], [data-testid="category"], .category, .badge, [class*="badge"]'
      )
      .first()
      .textContent()
      .catch(() => null);

    if (categoryText) {
      categories.push(categoryText.trim());
    }
  }

  return categories;
}
