/**
 * Direct Retailer Search Service
 *
 * Searches Canadian retailers directly via their search pages, bypassing
 * Google Custom Search API to reduce costs and get real-time results.
 *
 * Pattern: Direct URL construction + Playwright scraping
 *
 * @see CLAUDE.md - Playwright EXCLUSIVELY for browser automation
 * @see docs/04_SECURITY_PATTERNS.md - URL validation for SSRF prevention
 */

import { chromium, type Page } from 'playwright';
import { logger } from '../utils/logger';
import { SCRAPER } from '../utils/constants';

/**
 * Canadian retailer search URL configuration
 */
export interface RetailerSearchConfig {
  domain: string;
  name: string;
  searchUrlTemplate: string;
  currency: 'CAD' | 'USD';
  /** CSS selectors to find product links on search results page */
  productLinkSelectors: string[];
  /** CSS selectors to find product titles */
  productTitleSelectors: string[];
  /** CSS selectors to find product prices */
  productPriceSelectors: string[];
  /** CSS selector to wait for (indicates search results loaded) */
  waitForSelector: string;
}

/**
 * Search result from a retailer
 */
export interface RetailerSearchResult {
  retailer: string;
  domain: string;
  products: Array<{
    title: string;
    price: number | null;
    url: string;
  }>;
  searchUrl: string;
  success: boolean;
  error?: string;
}

/**
 * Canadian retailer configurations
 */
const CANADIAN_RETAILERS: RetailerSearchConfig[] = [
  {
    domain: 'amazon.ca',
    name: 'Amazon Canada',
    searchUrlTemplate: 'https://www.amazon.ca/s?k={query}',
    currency: 'CAD',
    productLinkSelectors: [
      'a.a-link-normal.s-no-outline[href*="/dp/"]',
      '[data-component-type="s-search-result"] h2 a',
      '.s-result-item h2 a.a-link-normal',
    ],
    productTitleSelectors: [
      '[data-component-type="s-search-result"] h2 span',
      '.s-result-item h2 span.a-text-normal',
      'h2.a-size-mini span',
    ],
    productPriceSelectors: [
      '.a-price .a-offscreen',
      '.a-price-whole',
      '[data-a-color="base"] .a-offscreen',
    ],
    waitForSelector: '[data-component-type="s-search-result"]',
  },
  {
    domain: 'bestbuy.ca',
    name: 'Best Buy Canada',
    searchUrlTemplate: 'https://www.bestbuy.ca/en-ca/search?search={query}',
    currency: 'CAD',
    productLinkSelectors: [
      // Best Buy uses /en-ca/product/ path with CSS module classes
      'a[href*="/en-ca/product/"][class*="productInfoLink"]',
      'a[href*="/en-ca/product/"]',
      '[class*="productLine"] a[href*="/product/"]',
    ],
    productTitleSelectors: [
      // CSS module classes - match partial class names
      '[class*="productInfoLink"]',
      '[class*="productLine"] a[class*="productInfoLink"]',
      '[class*="productItemName"]',
    ],
    productPriceSelectors: [
      // CSS module price classes
      '[class*="style-module_price"]',
      '[class*="price__"]',
      '[class*="productPrice"]',
    ],
    // Wait for product lines to render (React hydration)
    waitForSelector: '[class*="productLine"]',
  },
  {
    domain: 'canadacomputers.com',
    name: 'Canada Computers',
    // New URL structure as of 2024
    searchUrlTemplate: 'https://www.canadacomputers.com/en/search?q={query}',
    currency: 'CAD',
    productLinkSelectors: [
      // New site structure uses different classes
      'a[href*="/en/product/"]',
      'a[href*="/product/"]',
      '.product-card a',
    ],
    productTitleSelectors: [
      '.product-title',
      '.product-card h3',
      '[class*="productTitle"]',
    ],
    productPriceSelectors: [
      '[class*="product-price"]',
      '.price',
      '[class*="Price"]',
    ],
    waitForSelector: '.product-card, [class*="product-list"]',
  },
  {
    domain: 'newegg.ca',
    name: 'Newegg Canada',
    searchUrlTemplate: 'https://www.newegg.ca/p/pl?d={query}',
    currency: 'CAD',
    productLinkSelectors: [
      '.item-container a.item-title',
      '.item-cell a[href*="/p/"]',
      '.item-info a.item-title',
    ],
    productTitleSelectors: [
      'a.item-title',
      '.item-title',
      '.item-info .item-brand-and-title',
    ],
    productPriceSelectors: [
      '.price-current strong',
      '.price-current',
      'li.price-current',
    ],
    waitForSelector: '.item-container',
  },
  {
    domain: 'memoryexpress.com',
    name: 'Memory Express',
    searchUrlTemplate:
      'https://www.memoryexpress.com/Search/Products?Search={query}',
    currency: 'CAD',
    productLinkSelectors: [
      'a.c-shca-icon-item__body-link',
      '.c-shca-icon-item a[href*="/Products/"]',
      '.c-shca-list-item a',
    ],
    productTitleSelectors: [
      '.c-shca-icon-item__body-name',
      '.c-shca-list-item__body-name',
      '.c-shca-icon-item h3',
    ],
    productPriceSelectors: [
      '.c-shca-icon-item__summary-list .c-shca-icon-item__summary-list--price',
      '.c-shca-list-item__price',
      '.GrandTotal',
    ],
    waitForSelector: '.c-shca-icon-item',
  },
];

/**
 * Direct Retailer Search Service
 *
 * Searches Canadian retailers directly using Playwright to scrape
 * search result pages and extract product information.
 */
class DirectRetailerSearchService {
  private retailers: RetailerSearchConfig[] = CANADIAN_RETAILERS;

  /**
   * Build search URL for a retailer
   */
  private buildSearchUrl(config: RetailerSearchConfig, query: string): string {
    const encodedQuery = encodeURIComponent(query.trim());
    return config.searchUrlTemplate.replace('{query}', encodedQuery);
  }

  /**
   * Search a single retailer
   */
  async searchRetailer(
    config: RetailerSearchConfig,
    query: string,
    maxResults = 5
  ): Promise<RetailerSearchResult> {
    const searchUrl = this.buildSearchUrl(config, query);

    logger.info('Searching retailer directly', {
      retailer: config.name,
      domain: config.domain,
      query,
      searchUrl,
    });

    const browser = await chromium.launch({
      headless: true,
      args: [...SCRAPER.BROWSER_ARGS],
    });

    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-CA',
        timezoneId: 'America/Toronto',
        extraHTTPHeaders: {
          'Accept-Language': 'en-CA,en;q=0.9',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        },
      });

      try {
        const page = await context.newPage();

        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: SCRAPER.NAVIGATION_TIMEOUT_MS,
        });

        // Wait for search results to load
        try {
          await page.waitForSelector(config.waitForSelector, {
            timeout: SCRAPER.SELECTOR_TIMEOUT_MS,
            state: 'visible',
          });
        } catch (waitError) {
          logger.warn('Search results selector not found, attempting extraction anyway', {
            retailer: config.name,
            selector: config.waitForSelector,
            error: waitError instanceof Error ? waitError.message : String(waitError),
          });
          // For React SPAs, networkidle never completes due to constant activity.
          // Just wait a fixed time for hydration instead.
          await page.waitForTimeout(5000);
        }

        // Extract products from search results
        const products = await this.extractSearchResults(page, config, maxResults);

        logger.info('Retailer search completed', {
          retailer: config.name,
          productsFound: products.length,
        });

        return {
          retailer: config.name,
          domain: config.domain,
          products,
          searchUrl,
          success: true,
        };
      } finally {
        await context.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Retailer search failed', {
        retailer: config.name,
        error: errorMessage,
      });

      return {
        retailer: config.name,
        domain: config.domain,
        products: [],
        searchUrl,
        success: false,
        error: errorMessage,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract product information from search results page
   */
  private async extractSearchResults(
    page: Page,
    config: RetailerSearchConfig,
    maxResults: number
  ): Promise<Array<{ title: string; price: number | null; url: string }>> {
    const products: Array<{ title: string; price: number | null; url: string }> = [];

    // Try each link selector until we find products
    for (const linkSelector of config.productLinkSelectors) {
      try {
        const links = page.locator(linkSelector);
        const count = await links.count();

        if (count === 0) continue;

        const linksToProcess = Math.min(count, maxResults);

        for (let i = 0; i < linksToProcess; i++) {
          try {
            const link = links.nth(i);
            const href = await link.getAttribute('href', {
              timeout: SCRAPER.ELEMENT_TIMEOUT_MS,
            });

            if (!href) continue;

            // Build full URL if relative
            const fullUrl = href.startsWith('http')
              ? href
              : `https://www.${config.domain}${href.startsWith('/') ? '' : '/'}${href}`;

            // Try to get title from the link or nearby elements
            let title = '';
            for (const titleSelector of config.productTitleSelectors) {
              try {
                // Try to find title relative to the link or on the page
                const titleElement = page.locator(titleSelector).nth(i);
                title = (await titleElement.textContent({ timeout: 2000 })) || '';
                if (title.trim()) break;
              } catch {
                continue;
              }
            }

            // If still no title, try getting text from the link itself
            if (!title.trim()) {
              title = (await link.textContent({ timeout: 2000 })) || '';
            }

            // Try to get price
            let price: number | null = null;
            for (const priceSelector of config.productPriceSelectors) {
              try {
                const priceElement = page.locator(priceSelector).nth(i);
                const priceText = await priceElement.textContent({ timeout: 2000 });
                if (priceText) {
                  price = this.parsePrice(priceText);
                  if (price !== null) break;
                }
              } catch {
                continue;
              }
            }

            if (title.trim() && fullUrl) {
              products.push({
                title: title.trim().substring(0, 500),
                price,
                url: fullUrl,
              });
            }
          } catch (itemError) {
            logger.debug('Failed to extract product item', {
              retailer: config.name,
              index: i,
              error: itemError instanceof Error ? itemError.message : String(itemError),
            });
            continue;
          }
        }

        // If we found products with this selector, stop trying others
        if (products.length > 0) break;
      } catch (selectorError) {
        logger.debug('Link selector failed', {
          retailer: config.name,
          selector: linkSelector,
          error: selectorError instanceof Error ? selectorError.message : String(selectorError),
        });
        continue;
      }
    }

    return products;
  }

  /**
   * Parse price from text
   */
  private parsePrice(priceText: string): number | null {
    const cleanPrice = priceText.replace(/[C$£€¥,\s]/g, '');
    const match = cleanPrice.match(/(\d+\.?\d*)/);

    if (match) {
      const price = parseFloat(match[1]);
      return isNaN(price) ? null : price;
    }

    return null;
  }

  /**
   * Search multiple retailers in parallel
   */
  async searchAllRetailers(
    query: string,
    maxResultsPerRetailer = 5
  ): Promise<RetailerSearchResult[]> {
    logger.info('Starting multi-retailer search', {
      query,
      retailers: this.retailers.map((r) => r.name),
    });

    const results = await Promise.all(
      this.retailers.map((config) =>
        this.searchRetailer(config, query, maxResultsPerRetailer)
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const totalProducts = results.reduce((sum, r) => sum + r.products.length, 0);

    logger.info('Multi-retailer search completed', {
      query,
      successfulRetailers: successCount,
      totalRetailers: this.retailers.length,
      totalProducts,
    });

    return results;
  }

  /**
   * Search specific retailers by domain
   */
  async searchRetailersByDomain(
    query: string,
    domains: string[],
    maxResultsPerRetailer = 5
  ): Promise<RetailerSearchResult[]> {
    const selectedRetailers = this.retailers.filter((r) => domains.includes(r.domain));

    if (selectedRetailers.length === 0) {
      logger.warn('No matching retailers found for domains', { domains });
      return [];
    }

    const results = await Promise.all(
      selectedRetailers.map((config) =>
        this.searchRetailer(config, query, maxResultsPerRetailer)
      )
    );

    return results;
  }

  /**
   * Get all configured retailers
   */
  getRetailers(): RetailerSearchConfig[] {
    return [...this.retailers];
  }

  /**
   * Get Canadian retailer domains
   */
  getCanadianDomains(): string[] {
    return this.retailers.map((r) => r.domain);
  }
}

export const directRetailerSearchService = new DirectRetailerSearchService();
