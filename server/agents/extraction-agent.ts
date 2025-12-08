import { BaseAgent } from './base-agent';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScraperUtils } from '../utils/scraper-utils';
import { db } from '../db';
import { products, productOffers, retailers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { ExtractedProductData, ExtractionTask } from './types';
import { logger } from '../utils/logger';
import type { AxiosResponse } from 'axios';

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
 * Data Extraction Agent - Extracts product information and pricing from retailer websites
 */
export class DataExtractionAgent extends BaseAgent {
  private userAgents: string[];
  private extractionStrategies: Map<string, ExtractionStrategy> = new Map();

  constructor() {
    super({
      name: 'Data Extraction Agent',
      type: 'extraction',
      maxConcurrentTasks: 3,
      retryAttempts: 3,
      retryDelay: 2000,
    });

    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];

    this.setupExtractionStrategies();
  }

  private setupExtractionStrategies() {
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
          availabilitySelectors: ['[data-test="shipping-eligibility"]', '.fulfillment-add-to-cart'],
          imageSelectors: ['[data-test="@web/ProductImages/PrimaryImage"]', '.ProductImages img'],
          ratingSelectors: ['[data-test="ratings-and-reviews"]', '.ugc-ratings'],
          descriptionSelectors: ['[data-test="item-details-description"]', '.product-details'],
          brandSelectors: ['[data-test="product-brand"]', '.brand-name'],
        },
      ],
    ]);
  }

  async processTask(task: ExtractionTask): Promise<ExtractionTaskResult | ExtractionTaskFailure> {
    logger.info(`Starting extraction for ${task.url}`);

    try {
      const extractedData = await this.extractProductData(task.url, task.retailer);

      if (extractedData.price) {
        await this.storeProductData(extractedData, task.url, task.retailer, task.searchQuery);
        logger.info(`Successfully extracted and stored product: ${extractedData.title}`);
        return { success: true, data: extractedData };
      } else {
        logger.warn(`No price found for ${task.url}`);
        return { success: false, reason: 'No price data found' };
      }
    } catch (error) {
      logger.error(`Extraction failed for ${task.url}`, {
        error: error instanceof Error ? error.message : String(error),
        url: task.url,
      });
      throw error;
    }
  }

  private async extractProductData(
    url: string,
    retailerDomain: string
  ): Promise<ExtractedProductData> {
    const response = await this.fetchPage(url);
    const $ = cheerio.load(response.data);

    const strategy = this.extractionStrategies.get(retailerDomain) || this.getGenericStrategy();

    const extractedData: ExtractedProductData = {
      title: this.extractText($, strategy.titleSelectors) || '',
      price: this.extractPrice($, strategy.priceSelectors),
      currency: 'USD', // Default to USD, could be enhanced to detect currency
      availability: this.extractAvailability($, strategy.availabilitySelectors),
      description: strategy.descriptionSelectors
        ? this.extractText($, strategy.descriptionSelectors)
        : undefined,
      imageUrl: this.extractImageUrl($, strategy.imageSelectors) || undefined,
      rating: strategy.ratingSelectors
        ? this.extractRating($, strategy.ratingSelectors)
        : undefined,
      brand: strategy.brandSelectors ? this.extractText($, strategy.brandSelectors) : undefined,
    };

    // Clean and validate data
    extractedData.title = this.cleanText(extractedData.title) || '';
    extractedData.description = this.cleanText(extractedData.description);

    return extractedData;
  }

  private async fetchPage(url: string): Promise<AxiosResponse<string>> {
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];

    // Add random delay to avoid detection
    await ScraperUtils.delay(1500, true);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
        timeout: 15000,
        maxRedirects: 5,
      });

      return response;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 403) {
          throw new Error('Access denied - anti-bot protection detected');
        } else if (error.response?.status === 404) {
          throw new Error('Product page not found');
        }
        throw new Error(`Failed to fetch page: ${error.message}`);
      }
      throw new Error(
        `Failed to fetch page: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private extractText($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        return element.text().trim();
      }
    }
    return '';
  }

  private extractPrice($: cheerio.CheerioAPI, selectors: string[]): number | null {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const priceText = element.text().trim();
        const price = this.parsePrice(priceText);
        if (price !== null && price > 0) {
          return price;
        }
      }
    }
    return null;
  }

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

  private extractAvailability($: cheerio.CheerioAPI, selectors: string[]): string {
    const availabilityText = this.extractText($, selectors).toLowerCase();

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

  private extractImageUrl($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        const src = element.attr('src') || element.attr('data-src');
        if (src && src.startsWith('http')) {
          return src;
        }
      }
    }
    return undefined;
  }

  private extractRating($: cheerio.CheerioAPI, selectors: string[]): number | undefined {
    const ratingText = this.extractText($, selectors);
    const match = ratingText.match(/(\d+\.?\d*)/);

    if (match) {
      const rating = parseFloat(match[1]);
      return isNaN(rating) ? undefined : Math.min(rating, 5); // Cap at 5 stars
    }

    return undefined;
  }

  private cleanText(text: string | undefined): string | undefined {
    if (!text) return undefined;

    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim()
      .substring(0, 1000); // Limit length
  }

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

  private async storeProductData(
    data: ExtractedProductData,
    url: string,
    retailerDomain: string,
    searchQuery?: string
  ): Promise<void> {
    try {
      // Find or create retailer
      let retailer = await db.query.retailers.findFirst({
        where: eq(retailers.website, retailerDomain),
      });

      if (!retailer) {
        const [newRetailer] = await db
          .insert(retailers)
          .values({
            name: this.capitalizeRetailerName(retailerDomain),
            website: retailerDomain,
            logo: `https://logo.clearbit.com/${retailerDomain}`,
            isActive: true,
          })
          .returning();
        retailer = newRetailer;
      }

      // Find or create product
      let product = await db.query.products.findFirst({
        where: eq(products.name, data.title),
      });

      if (!product) {
        const [newProduct] = await db
          .insert(products)
          .values({
            name: data.title,
            description: data.description,
            brand: data.brand,
            image: data.imageUrl,
            category: this.inferCategory(data.title, searchQuery || ''),
          })
          .returning();
        product = newProduct;
      }

      // Create or update product offer
      await db
        .insert(productOffers)
        .values({
          productId: product.id,
          retailerId: retailer.id,
          price: data.price ? data.price.toString() : '0',
          availability: data.availability,
          productUrl: url,
          lastLinkCheck: new Date(),
        })
        .onConflictDoUpdate({
          target: [productOffers.productId, productOffers.retailerId],
          set: {
            price: data.price ? data.price.toString() : '0',
            availability: data.availability,
            lastLinkCheck: new Date(),
          },
        });

      logger.info(`Stored product offer: ${data.title} - $${data.price} from ${retailerDomain}`);
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
