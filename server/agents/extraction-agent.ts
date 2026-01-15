import { BaseAgent } from './base-agent';
import { chromium, type Browser, type Page } from 'playwright';
import type { ExtractedProductData, ExtractionTask } from './types';
import { logger } from '../utils/logger';
import { storage } from '../storage';
import { ExtractionMonitoring } from './extraction-monitoring';
import { validateScrapingUrl, DEFAULT_ALLOWED_RETAILER_DOMAINS } from '../utils/url-validation';
import { urlLockService } from '../services/url-lock-service';

/** Result of a successful extraction task */
interface ExtractionTaskResult {
  success: true;
  data: ExtractedProductData;
}

/** Result of a failed extraction task */
interface ExtractionTaskFailure {
  success: false;
  reason: string;
}

/** Extraction strategy for a retailer */
interface ExtractionStrategy {
  titleSelectors: string[];
  priceSelectors: string[];
  availabilitySelectors: string[];
  imageSelectors: string[];
  ratingSelectors?: string[];
  descriptionSelectors?: string[];
  brandSelectors?: string[];
}

/**
 * Data Extraction Agent - Playwright Version
 *
 * Uses headless Chromium to extract product information from JavaScript-rendered pages.
 * Solves axios+cheerio limitations:
 * - Executes JavaScript (React/Vue/Angular apps)
 * - Waits for dynamic content (AJAX price loading)
 * - Handles modern e-commerce sites with client-side rendering
 *
 * Design Philosophy: SIMPLE
 * - Launch/close browser per request (no custom pooling)
 * - Use Playwright native stealth mode (no custom plugins)
 * - Reuse existing selector strategies from axios+cheerio version
 * - Always cleanup browser resources in finally block
 *
 * Pattern Alignment:
 * - 01_TYPESCRIPT_PATTERNS.md: Strict typing, async/await, proper error handling
 * - 06_ERROR_HANDLING_PATTERNS.md: Browser cleanup in finally blocks
 * - CLAUDE.md: Playwright EXCLUSIVELY for browser automation
 */
export class DataExtractionAgent extends BaseAgent {
  private browser: Browser | null = null;
  private extractionStrategies: Map<string, ExtractionStrategy> = new Map();

  constructor() {
    super({
      name: 'Data Extraction Agent (Playwright)',
      type: 'extraction',
      maxConcurrentTasks: 3,
      retryAttempts: 3,
      retryDelay: 2000,
    });

    this.setupExtractionStrategies();
  }

  /**
   * Setup retailer-specific extraction strategies
   * Reuses selectors from axios+cheerio version for compatibility
   */
  private setupExtractionStrategies(): void {
    this.extractionStrategies = new Map([
      [
        'amazon.com',
        {
          titleSelectors: ['#productTitle', 'h1.a-size-large', '.product-title'],
          priceSelectors: [
            '.a-price-whole',
            '.a-offscreen',
            '[data-asin-price]',
            '.a-price .a-offscreen',
          ],
          availabilitySelectors: [
            '#availability span',
            '.a-size-medium.a-color-success',
            '.a-size-medium.a-color-price',
          ],
          imageSelectors: ['#landingImage', '.a-dynamic-image', '#main-image'],
          ratingSelectors: ['.a-icon-alt', '[data-hook="average-star-rating"]'],
          descriptionSelectors: ['#feature-bullets ul', '.a-unordered-list.a-vertical'],
          brandSelectors: ['#bylineInfo', '.a-size-base.po-break-word'],
        },
      ],
      [
        'walmart.com',
        {
          titleSelectors: ['h1[data-automation-id="product-title"]', 'h1', '.prod-ProductTitle'],
          priceSelectors: [
            '[itemprop="price"]',
            '[data-automation-id="product-price"]',
            '.price-current',
          ],
          availabilitySelectors: [
            '[data-automation-id="fulfillment-summary"]',
            '.prod-fulfillment-msg',
          ],
          imageSelectors: ['[data-testid="hero-image"]', '.prod-hero-image img'],
          ratingSelectors: ['.average-rating', '[data-testid="reviews-section"]'],
          descriptionSelectors: ['.about-desc', '[data-automation-id="product-highlights"]'],
          brandSelectors: ['[data-automation-id="product-brand"]', '.prod-brand'],
        },
      ],
      [
        'target.com',
        {
          titleSelectors: ['h1[data-test="product-title"]', 'h1', '.pdp-product-name'],
          priceSelectors: ['[data-test="product-price"]', '.Price-characteristic', '.sr-only'],
          // OPTIMIZED: Validated in Step 2.4 live testing (2026-01-13)
          // Original '[data-test="shipping-eligibility"]' not found
          // Using wildcard selector '[data-test*="fulfillment"]' found "PickupNot available"
          availabilitySelectors: [
            '[data-test*="fulfillment"]',
            '[data-test="shipping-eligibility"]',
            '.fulfillment-add-to-cart',
          ],
          // OPTIMIZED: Validated in Step 2.4 live testing (2026-01-13)
          // Original '[data-test="@web/ProductImages/PrimaryImage"]' not found
          // Using 'img[src*="scene7"]' found Target CDN images successfully
          imageSelectors: [
            'img[src*="scene7"]',
            'img[alt*="AirPods"]',
            'img[alt*="Apple"]',
            '[data-test="@web/ProductImages/PrimaryImage"]',
            '.ProductImages img',
            'picture img',
            'main img[src*="target"]',
          ],
          ratingSelectors: ['[data-test="ratings-and-reviews"]', '.ugc-ratings'],
          descriptionSelectors: ['[data-test="item-details-description"]', '.product-details'],
          brandSelectors: ['[data-test="product-brand"]', '.brand-name'],
        },
      ],
    ]);
  }

  async processTask(task: ExtractionTask): Promise<ExtractionTaskResult | ExtractionTaskFailure> {
    logger.info(`Starting Playwright extraction for ${task.url}`);

    const startTime = Date.now();
    let errorMessage: string | undefined;

    // DISTRIBUTED LOCK: Prevent concurrent scraping of the same URL
    // Uses Redis-based locking with 5-minute TTL (300 seconds)
    const result = await urlLockService.withLock<ExtractionTaskResult | ExtractionTaskFailure>(
      task.url,
      async (): Promise<ExtractionTaskResult | ExtractionTaskFailure> => {
        try {
          const extractedData = await this.extractProductData(task.url, task.retailer);

          if (extractedData.price) {
            await this.storeProductData(extractedData, task.url, task.retailer, task.searchQuery);
            logger.info(`Successfully extracted and stored product: ${extractedData.title}`);

            const duration = Date.now() - startTime;

            // Record successful extraction (non-blocking)
            void ExtractionMonitoring.recordAttempt(task.retailer, true, duration);

            return { success: true as const, data: extractedData };
          } else {
            logger.warn(`No price found for ${task.url}`);

            errorMessage = 'No price data found';
            const duration = Date.now() - startTime;

            // Record failed extraction (non-blocking)
            void ExtractionMonitoring.recordAttempt(task.retailer, false, duration, errorMessage);

            return { success: false as const, reason: errorMessage };
          }
        } catch (error) {
          errorMessage = error instanceof Error ? error.message : String(error);
          const duration = Date.now() - startTime;

          logger.error(`Playwright extraction failed for ${task.url}`, {
            error: errorMessage,
            url: task.url,
          });

          // Record failed extraction (non-blocking)
          void ExtractionMonitoring.recordAttempt(task.retailer, false, duration, errorMessage);

          throw error;
        }
      },
      { ttlSeconds: 300 } // 5 minute lock
    );

    // Lock held by another worker - skip gracefully
    if (result === null) {
      logger.info(`URL already being scraped by another worker, skipping`, {
        url: task.url,
      });

      // Return failure (no retry needed)
      // This is intentional - another worker is handling this URL
      return {
        success: false as const,
        reason: 'URL already being scraped by another worker',
      };
    }

    return result;
  }

  /**
   * Extract product data using Playwright (headless browser with JavaScript execution)
   * Handles modern JavaScript-rendered e-commerce sites
   */
  private async extractProductData(
    url: string,
    retailerDomain: string
  ): Promise<ExtractedProductData> {
    // SECURITY: Validate URL to prevent SSRF attacks
    const validationResult = validateScrapingUrl(url, {
      allowedDomains: [...DEFAULT_ALLOWED_RETAILER_DOMAINS],
    });

    if (!validationResult.valid || !validationResult.parsedUrl) {
      throw new Error(`URL validation failed: ${validationResult.error || 'Invalid URL'}`);
    }

    const validatedUrl = validationResult.parsedUrl;

    // SIMPLE: Launch new browser per request (optimize later if needed)
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await this.browser.newContext({
      // Playwright native stealth mode
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      // Additional headers for realism
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
    });

    const page = await context.newPage();

    try {
      // Navigate and wait for content
      await page.goto(validatedUrl.toString(), {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Get extraction strategy for retailer
      const strategy = this.extractionStrategies.get(retailerDomain) || this.getGenericStrategy();

      // Wait for price element (indicates page loaded)
      // This is KEY DIFFERENCE from axios+cheerio: we wait for JavaScript to render
      try {
        await page.waitForSelector(strategy.priceSelectors[0], {
          timeout: 10000,
          state: 'visible',
        });
      } catch (selectorError) {
        logger.warn(
          `Price selector not found immediately for ${retailerDomain}, attempting extraction anyway`,
          {
            error: selectorError instanceof Error ? selectorError.message : String(selectorError),
            selector: strategy.priceSelectors[0],
            url,
          }
        );
        // Fallback: wait for network to be idle (indicates AJAX/dynamic content loaded)
        try {
          await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (networkError) {
          logger.warn('Network idle wait failed, falling back to DOM load', {
            error: networkError instanceof Error ? networkError.message : String(networkError),
            retailerDomain,
          });
          // If networkidle also fails, try waiting for DOM to be fully loaded
          await page.waitForLoadState('load', { timeout: 5000 });
        }
      }

      // Extract data AFTER JavaScript execution
      const title = await this.extractText(page, strategy.titleSelectors);
      const price = await this.extractPrice(page, strategy.priceSelectors);
      const availability = await this.extractAvailability(page, strategy.availabilitySelectors);
      const imageUrl = await this.extractImageUrl(page, strategy.imageSelectors);
      const rating = strategy.ratingSelectors
        ? await this.extractRating(page, strategy.ratingSelectors)
        : undefined;
      const description = strategy.descriptionSelectors
        ? await this.extractText(page, strategy.descriptionSelectors)
        : undefined;
      const brand = strategy.brandSelectors
        ? await this.extractText(page, strategy.brandSelectors)
        : undefined;

      const extractedData: ExtractedProductData = {
        title: this.cleanText(title) || '',
        price,
        currency: 'USD', // Default to USD, could be enhanced to detect currency
        availability,
        description: this.cleanText(description),
        imageUrl: imageUrl || undefined,
        rating,
        brand: brand || '',
      };

      return extractedData;
    } finally {
      // ALWAYS cleanup (prevent memory leaks)
      await context.close();
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Extract text from page using selector array (first match wins)
   */
  private async extractText(page: Page, selectors: string[]): Promise<string> {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        const text = await element.textContent({ timeout: 2000 });
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (error) {
        logger.debug('Text selector failed, trying next', {
          error: error instanceof Error ? error.message : String(error),
          selector,
        });
        continue; // Try next selector
      }
    }
    return '';
  }

  /**
   * Extract price from page
   */
  private async extractPrice(page: Page, selectors: string[]): Promise<number | null> {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        const priceText = await element.textContent({ timeout: 2000 });
        if (priceText && priceText.trim()) {
          const price = this.parsePrice(priceText);
          if (price !== null && price > 0) {
            return price;
          }
        }
      } catch (error) {
        logger.debug('Price selector failed, trying next', {
          error: error instanceof Error ? error.message : String(error),
          selector,
        });
        continue;
      }
    }
    return null;
  }

  /**
   * Parse price from text string
   */
  private parsePrice(priceText: string): number | null {
    // Remove common currency symbols and extract numeric value
    const cleanPrice = priceText.replace(/[$£€¥,\s]/g, '');
    const match = cleanPrice.match(/(\d+\.?\d*)/);

    if (match) {
      const price = parseFloat(match[1]);
      return isNaN(price) ? null : price;
    }

    return null;
  }

  /**
   * Extract availability status from page
   */
  private async extractAvailability(page: Page, selectors: string[]): Promise<string> {
    const availabilityText = (await this.extractText(page, selectors)).toLowerCase();

    if (availabilityText.includes('in stock') || availabilityText.includes('available')) {
      return 'in_stock';
    } else if (
      availabilityText.includes('out of stock') ||
      availabilityText.includes('unavailable')
    ) {
      return 'out_of_stock';
    } else if (availabilityText.includes('limited') || availabilityText.includes('few left')) {
      return 'limited_stock';
    }

    return 'unknown';
  }

  /**
   * Extract image URL from page
   */
  private async extractImageUrl(page: Page, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        // Try src first, then data-src for lazy-loaded images
        let src = await element.getAttribute('src', { timeout: 2000 });
        if (!src || !src.startsWith('http')) {
          src = await element.getAttribute('data-src', { timeout: 2000 });
        }
        if (src && src.startsWith('http')) {
          return src;
        }
      } catch (error) {
        logger.debug('Image selector failed, trying next', {
          error: error instanceof Error ? error.message : String(error),
          selector,
        });
        continue;
      }
    }
    return null;
  }

  /**
   * Extract rating from page
   */
  private async extractRating(page: Page, selectors: string[]): Promise<number | undefined> {
    const ratingText = await this.extractText(page, selectors);
    const match = ratingText.match(/(\d+\.?\d*)/);

    if (match) {
      const rating = parseFloat(match[1]);
      return isNaN(rating) ? undefined : Math.min(rating, 5); // Cap at 5 stars
    }

    return undefined;
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanText(text: string | undefined): string | undefined {
    if (!text) return undefined;

    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 1000); // Limit length
  }

  /**
   * Get generic extraction strategy for unknown retailers
   */
  private getGenericStrategy(): ExtractionStrategy {
    return {
      titleSelectors: ['h1', '.product-title', '.title', '[data-testid*="title"]'],
      priceSelectors: ['.price', '.cost', '[data-testid*="price"]', '[class*="price"]'],
      availabilitySelectors: ['.availability', '.stock', '[data-testid*="stock"]'],
      imageSelectors: ['.product-image img', '.main-image', '[data-testid*="image"]'],
      ratingSelectors: ['.rating', '.stars', '[data-testid*="rating"]'],
      descriptionSelectors: ['.description', '.product-desc', '[data-testid*="description"]'],
      brandSelectors: ['.brand', '.manufacturer', '[data-testid*="brand"]'],
    };
  }

  /**
   * Store extracted product data in database
   */
  private async storeProductData(
    data: ExtractedProductData,
    url: string,
    retailerDomain: string,
    searchQuery?: string
  ): Promise<void> {
    try {
      // Find or create retailer using storage layer
      const retailer = await storage.findOrCreateRetailer(retailerDomain, {
        name: this.capitalizeRetailerName(retailerDomain),
        logo: `https://logo.clearbit.com/${retailerDomain}`,
        isActive: true,
      });

      // Find or create product using storage layer
      const product = await storage.findOrCreateProduct(
        data.title,
        this.inferCategory(data.title, searchQuery || ''),
        {
          description: data.description,
          brand: data.brand,
          image: data.imageUrl,
        }
      );

      // Create or update product offer using storage layer
      await storage.upsertProductOffer({
        productId: product.id,
        retailerId: retailer.id,
        price: data.price ? data.price.toString() : '0',
        availability: data.availability,
        productUrl: url,
        lastLinkCheck: new Date(),
      });

      logger.info(
        `Stored product offer: ${data.title} - $${data.price} from ${retailerDomain}`
      );
    } catch (error) {
      logger.error('Failed to store product data', {
        error: error instanceof Error ? error.message : String(error),
        productTitle: data.title,
      });
      throw error;
    }
  }

  private capitalizeRetailerName(domain: string): string {
    return domain.replace('.com', '').replace(/^\w/, (c) => c.toUpperCase());
  }

  private inferCategory(title: string, searchQuery?: string): string {
    const titleLower = title.toLowerCase();
    const queryLower = searchQuery?.toLowerCase() || '';

    const categories = [
      { keywords: ['laptop', 'notebook', 'computer'], category: 'Laptops' },
      { keywords: ['phone', 'mobile', 'smartphone'], category: 'Smartphones' },
      { keywords: ['tablet', 'ipad'], category: 'Tablets' },
      { keywords: ['headphone', 'earphone', 'earbuds'], category: 'Audio' },
      { keywords: ['tv', 'television', 'monitor'], category: 'Electronics' },
      { keywords: ['watch', 'smartwatch'], category: 'Wearables' },
      { keywords: ['camera', 'photography'], category: 'Cameras' },
      { keywords: ['gaming', 'console', 'xbox', 'playstation'], category: 'Gaming' },
    ];

    for (const cat of categories) {
      if (
        cat.keywords.some((keyword) => titleLower.includes(keyword) || queryLower.includes(keyword))
      ) {
        return cat.category;
      }
    }

    return 'General';
  }
}

export const dataExtractionAgent = new DataExtractionAgent();
