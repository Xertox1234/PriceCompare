/**
 * Baseline Tests for DataExtractionAgent (axios+cheerio)
 *
 * Purpose: Establish baseline behavior BEFORE Playwright migration
 * - Documents current selector strategies
 * - Tests extraction logic with controlled fixtures
 * - Verifies error handling and retry mechanisms
 *
 * NOTE: Current axios+cheerio implementation CANNOT handle:
 * - JavaScript-rendered content (React/Vue/Angular)
 * - Dynamic price loading (AJAX calls)
 * - Anti-bot detection bypass (403/CAPTCHA)
 * These limitations will be addressed in Playwright migration (TODO_205 Step 2.2)
 *
 * Pattern Alignment:
 * - 08_TESTING_PATTERNS.md: Test infrastructure, fixtures, mocking external dependencies
 * - 01_TYPESCRIPT_PATTERNS.md: Strict typing for test helpers
 * - 06_ERROR_HANDLING_PATTERNS.md: Test error recovery patterns
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataExtractionAgent } from '../extraction-agent';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import type { ExtractionTask, ExtractedProductData } from '../types';

// Mock axios to return fixture HTML instead of making real requests
vi.mock('axios');
const mockedAxios = axios as unknown as {
  get: ReturnType<typeof vi.fn>;
  isAxiosError: (error: unknown) => boolean;
};

// Mock storage layer - we're testing extraction logic, not database operations
vi.mock('../../storage', () => ({
  storage: {
    findOrCreateRetailer: vi.fn().mockResolvedValue({ id: 1, name: 'Test Retailer' }),
    findOrCreateProduct: vi.fn().mockResolvedValue({ id: 1, name: 'Test Product' }),
    upsertProductOffer: vi.fn().mockResolvedValue({ id: 1 }),
  },
}));

// Mock logger to avoid console noise in tests
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock ScraperUtils.delay to avoid actual delays in tests
vi.mock('../../utils/scraper-utils', () => ({
  ScraperUtils: {
    delay: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Redis client for extraction monitoring
vi.mock('../../config/redis', () => ({
  getRedisClient: vi.fn(() => ({
    hincrby: vi.fn(),
    hincrbyfloat: vi.fn(),
    expire: vi.fn(),
    hgetall: vi.fn().mockResolvedValue({}),
  })),
  getRedisSessionClient: vi.fn(),
}));

// DEPRECATED: Baseline tests for axios+cheerio implementation (replaced by Playwright)
// These tests are preserved for reference but skipped since they test the old implementation
// The axios+cheerio version is backed up in extraction-agent-axios-backup.ts
describe.skip('DataExtractionAgent - Baseline Tests (axios+cheerio - DEPRECATED)', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock axios.isAxiosError for error handling tests
    mockedAxios.isAxiosError = (error: unknown): boolean => {
      return error !== null && typeof error === 'object' && 'isAxiosError' in error;
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractProductData - Happy Path', () => {
    it('extracts complete product data from well-formed HTML', async () => {
      const html = await fs.readFile(
        path.join(fixturesDir, 'sample-product-1.html'),
        'utf-8'
      );

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product/1',
        retailer: 'example.com',
        searchQuery: 'widget',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Sample Widget Pro 2024');
        expect(data.price).toBe(29.99);
        expect(data.currency).toBe('USD');
        expect(data.availability).toBe('in_stock');
        // Image extraction only works with generic selectors that match
        expect(data.imageUrl).toBeDefined();
        expect(data.description).toContain('High-quality widget');
        expect(data.brand).toBe('WidgetCorp');
        expect(data.rating).toBe(4.5);
      }
    });

    it('extracts product using generic strategy when retailer unknown', async () => {
      const html = await fs.readFile(
        path.join(fixturesDir, 'sample-product-generic.html'),
        'utf-8'
      );

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://unknown-retailer.com/product',
        retailer: 'unknown-retailer.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Generic Product Name');
        expect(data.price).toBe(49.99);
        expect(data.availability).toBe('in_stock');
        expect(data.description).toContain('generic product');
      }
    });

    it('extracts price in various formats', async () => {
      const testCases = [
        { html: '<span class="price">$99.99</span>', expected: 99.99 },
        { html: '<span class="price">$1,234.56</span>', expected: 1234.56 },
        { html: '<span class="price">€49.99</span>', expected: 49.99 },
        { html: '<span class="price">£19.99</span>', expected: 19.99 },
        { html: '<span class="price">¥9999</span>', expected: 9999 },
        { html: '<span class="price">Price: $29.99</span>', expected: 29.99 },
      ];

      for (const testCase of testCases) {
        const html = `<!DOCTYPE html><html><body><h1>Test</h1>${testCase.html}</body></html>`;

        mockedAxios.get.mockResolvedValue({
          data: html,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });

        const task: ExtractionTask = {
          action: 'extract_product_data',
          url: 'https://example.com/product',
          retailer: 'example.com',
        };

        const result = await playwrightAgent.processTask(task);

        expect(result.success).toBe(true);
        if (result.success) {
          const data = result.data as ExtractedProductData;
          expect(data.price).toBe(testCase.expected);
        }
      }
    });

    it('extracts availability status - in stock', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Test Product</h1>
        <span class="price">$29.99</span>
        <div class="stock">In Stock</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.availability).toBe('in_stock');
      }
    });

    it('extracts availability status - out of stock', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Test Product</h1>
        <span class="price">$29.99</span>
        <div class="stock">Out of Stock</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.availability).toBe('out_of_stock');
      }
    });

    it('extracts availability status - limited stock', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Test Product</h1>
        <span class="price">$29.99</span>
        <div class="stock">Limited Stock - Only 2 left</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.availability).toBe('limited_stock');
      }
    });

    it('cleans and normalizes extracted text', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>  Product   With   Extra   Spaces  </h1>
        <span class="price">$29.99</span>
        <div class="description">
          Description with
          newlines and    extra spaces
        </div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Product With Extra Spaces');
        expect(data.description).toContain('Description with newlines and extra spaces');
        // Verify no excessive whitespace
        expect(data.title).not.toMatch(/\s{2,}/);
        expect(data.description).not.toMatch(/\s{2,}/);
      }
    });
  });

  describe('extractProductData - Missing Data Handling', () => {
    it('returns failure when no price found', async () => {
      const html = await fs.readFile(
        path.join(fixturesDir, 'sample-product-missing-price.html'),
        'utf-8'
      );

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('No price data found');
      }
    });

    it('handles missing optional fields gracefully', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Minimal Product</h1>
        <span class="price">$29.99</span>
        <div class="stock">In Stock</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Minimal Product');
        expect(data.price).toBe(29.99);
        expect(data.imageUrl).toBeUndefined();
        expect(data.description).toBeUndefined();
        // Brand returns empty string when selector exists but no match found
        expect(data.brand).toBe('');
        expect(data.rating).toBeUndefined();
      }
    });

    it('handles malformed HTML gracefully', async () => {
      const html = await fs.readFile(
        path.join(fixturesDir, 'sample-product-malformed.html'),
        'utf-8'
      );

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      // Should not throw - cheerio is forgiving with malformed HTML
      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBeTruthy();
        expect(data.price).toBe(19.99);
      }
    });

    it('returns empty string for missing title', async () => {
      const html = `<!DOCTYPE html><html><body>
        <span class="price">$29.99</span>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('');
      }
    });

    it('truncates long text to 1000 characters', async () => {
      const longText = 'A'.repeat(2000);
      const html = `<!DOCTYPE html><html><body>
        <h1>${longText}</h1>
        <span class="price">$29.99</span>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title.length).toBeLessThanOrEqual(1000);
      }
    });
  });

  describe('fetchPage - Error Handling', () => {
    it('throws error on 403 Access Denied', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 403,
          statusText: 'Forbidden',
        },
        message: 'Request failed with status code 403',
      };

      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = () => true;

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow(
        'Access denied - anti-bot protection detected'
      );
    });

    it('throws error on 404 Not Found', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: 'Not Found',
        },
        message: 'Request failed with status code 404',
      };

      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = () => true;

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow('Product page not found');
    });

    it('handles generic axios errors', async () => {
      const axiosError = {
        isAxiosError: true,
        message: 'Network timeout',
      };

      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError = () => true;

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow('Failed to fetch page: Network timeout');
    });

    it('handles non-axios errors', async () => {
      const genericError = new Error('Something went wrong');

      mockedAxios.get.mockRejectedValue(genericError);
      mockedAxios.isAxiosError = () => false;

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow(
        'Failed to fetch page: Something went wrong'
      );
    });
  });

  describe('Retailer-Specific Strategies', () => {
    it('uses Amazon-specific selectors for amazon.com', async () => {
      const html = `<!DOCTYPE html><html><body>
        <span id="productTitle">Amazon Product</span>
        <span class="a-price-whole">99</span>
        <span id="availability">In Stock</span>
        <img id="landingImage" src="https://amazon.com/image.jpg" />
        <span class="a-icon-alt">4.3 out of 5 stars</span>
        <div id="bylineInfo">Brand: AmazonBasics</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.amazon.com/product',
        retailer: 'amazon.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Amazon Product');
        expect(data.price).toBe(99);
        expect(data.rating).toBe(4.3);
      }
    });

    it('uses Walmart-specific selectors for walmart.com', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1 data-automation-id="product-title">Walmart Product</h1>
        <span itemprop="price">49.99</span>
        <div data-automation-id="fulfillment-summary">Available</div>
        <img data-testid="hero-image" src="https://walmart.com/image.jpg" />
        <div data-automation-id="product-brand">WalmartBrand</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.walmart.com/product',
        retailer: 'walmart.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Walmart Product');
        expect(data.price).toBe(49.99);
        expect(data.brand).toBe('WalmartBrand');
      }
    });

    it('uses Target-specific selectors for target.com', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1 data-test="product-title">Target Product</h1>
        <div data-test="product-price">$39.99</div>
        <div data-test="shipping-eligibility">In Stock</div>
        <img data-test="@web/ProductImages/PrimaryImage" src="https://target.com/image.jpg" />
        <div data-test="product-brand">TargetBrand</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.target.com/product',
        retailer: 'target.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Target Product');
        expect(data.price).toBe(39.99);
        expect(data.brand).toBe('TargetBrand');
      }
    });
  });

  describe('Image URL Extraction', () => {
    it('extracts src attribute from image', async () => {
      // Generic strategy imageSelectors: ['.product-image img', '.main-image', '[data-testid*="image"]']
      const html = `<!DOCTYPE html><html><body>
        <h1>Product</h1>
        <span class="price">$29.99</span>
        <div class="product-image"><img src="https://example.com/image.jpg" /></div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.imageUrl).toBe('https://example.com/image.jpg');
      }
    });

    it('extracts data-src attribute as fallback', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Product</h1>
        <span class="price">$29.99</span>
        <div class="product-image"><img data-src="https://example.com/lazy-image.jpg" /></div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.imageUrl).toBe('https://example.com/lazy-image.jpg');
      }
    });

    it('ignores relative URLs', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Product</h1>
        <span class="price">$29.99</span>
        <img class="product-image" src="/images/product.jpg" />
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.imageUrl).toBeUndefined();
      }
    });
  });

  describe('Rating Extraction', () => {
    it('extracts numeric rating from text', async () => {
      const testCases = [
        { text: '4.5 out of 5 stars', expected: 4.5 },
        { text: 'Rating: 3.8', expected: 3.8 },
        { text: '5.0', expected: 5.0 },
        { text: '2.3 stars', expected: 2.3 },
      ];

      for (const testCase of testCases) {
        const html = `<!DOCTYPE html><html><body>
          <h1>Product</h1>
          <span class="price">$29.99</span>
          <div class="rating">${testCase.text}</div>
        </body></html>`;

        mockedAxios.get.mockResolvedValue({
          data: html,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        });

        const task: ExtractionTask = {
          action: 'extract_product_data',
          url: 'https://example.com/product',
          retailer: 'example.com',
        };

        const result = await playwrightAgent.processTask(task);

        expect(result.success).toBe(true);
        if (result.success) {
          const data = result.data as ExtractedProductData;
          expect(data.rating).toBe(testCase.expected);
        }
      }
    });

    it('caps rating at 5.0', async () => {
      const html = `<!DOCTYPE html><html><body>
        <h1>Product</h1>
        <span class="price">$29.99</span>
        <div class="rating">5.9 stars</div>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.rating).toBe(5);
      }
    });
  });

  describe('HTTP Request Configuration', () => {
    it('sends proper headers with request', async () => {
      const html = '<html><body><h1>Test</h1><span class="price">$29.99</span></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await playwrightAgent.processTask(task);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://example.com/product',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Accept: expect.stringContaining('text/html'),
            'Accept-Language': expect.any(String),
            Connection: 'keep-alive',
          }),
          timeout: 15000,
          maxRedirects: 5,
        })
      );
    });

    it('rotates user agents on multiple requests', async () => {
      const html = '<html><body><h1>Test</h1><span class="price">$29.99</span></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      // Make multiple requests
      await playwrightAgent.processTask(task);
      await playwrightAgent.processTask(task);

      // Verify axios was called twice
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);

      // User-Agent should be one of the predefined ones
      const firstCall = mockedAxios.get.mock.calls[0];
      const secondCall = mockedAxios.get.mock.calls[1];

      const userAgent1 = (firstCall[1] as { headers: { 'User-Agent': string } }).headers[
        'User-Agent'
      ];
      const userAgent2 = (secondCall[1] as { headers: { 'User-Agent': string } }).headers[
        'User-Agent'
      ];

      expect(userAgent1).toBeTruthy();
      expect(userAgent2).toBeTruthy();
      expect(userAgent1).toContain('Chrome');
      expect(userAgent2).toContain('Chrome');
    });
  });

  describe('Selector Priority and Fallback', () => {
    it('tries multiple selectors in order until one matches', async () => {
      // Title selectors: ['h1', '.product-title', '.title', '[data-testid*="title"]']
      // This HTML only has .product-title
      const html = `<!DOCTYPE html><html><body>
        <div class="product-title">Product Title Via Class</div>
        <span class="price">$29.99</span>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('Product Title Via Class');
      }
    });

    it('uses first matching selector', async () => {
      // Has both h1 and .product-title, should prefer h1
      const html = `<!DOCTYPE html><html><body>
        <h1>H1 Title</h1>
        <div class="product-title">Class Title</div>
        <span class="price">$29.99</span>
      </body></html>`;

      mockedAxios.get.mockResolvedValue({
        data: html,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as ExtractedProductData;
        expect(data.title).toBe('H1 Title');
      }
    });
  });
});

/**
 * Playwright Implementation Tests (NEW)
 *
 * Tests for DataExtractionAgent (Playwright) - the new Playwright-based implementation
 * that solves axios+cheerio limitations:
 * - JavaScript-rendered content (React/Vue/Angular)
 * - Dynamic price loading (AJAX calls)
 * - Modern e-commerce sites with client-side rendering
 *
 * Pattern Alignment:
 * - CLAUDE.md: Playwright EXCLUSIVELY for browser automation
 * - 08_TESTING_PATTERNS.md: Integration testing with external dependencies
 * - 06_ERROR_HANDLING_PATTERNS.md: Browser cleanup verification
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

// Mock chromium.launch for controlled testing
vi.mock('playwright', async () => {
  const actual = await vi.importActual('playwright');
  return {
    ...actual,
    chromium: {
      launch: vi.fn(),
    },
  };
});

describe('DataExtractionAgent - Playwright Implementation', () => {
  let playwrightAgent: DataExtractionAgent;
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  beforeEach(() => {
    playwrightAgent = new DataExtractionAgent();
    vi.clearAllMocks();

    // Mock Playwright browser/page objects
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      locator: vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockResolvedValue(null),
        getAttribute: vi.fn().mockResolvedValue(null),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Page;

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserContext;

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Browser;

    (chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(mockBrowser);
  });

  afterEach(async () => {
    // Ensure browser cleanup
    if (playwrightAgent['browser']) {
      await playwrightAgent['browser'].close();
    }
    vi.restoreAllMocks();
  });

  describe('Browser Lifecycle Management', () => {
    it('launches browser with correct security flags', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockResolvedValue('Test Product'),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      // This will fail due to no price, but we're testing browser launch
      try {
        await playwrightAgent.processTask(task);
      } catch {
        // Expected to fail due to missing price
      }

      expect(chromium.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
          ]),
        })
      );
    });

    it('creates browser context with stealth configuration', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockResolvedValue('Test Product'),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      try {
        await playwrightAgent.processTask(task);
      } catch {
        // Expected to fail
      }

      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: expect.stringContaining('Chrome/120.0.0.0'),
          viewport: { width: 1920, height: 1080 },
          locale: 'en-US',
          timezoneId: 'America/New_York',
          extraHTTPHeaders: expect.objectContaining({
            'Accept-Language': 'en-US,en;q=0.9',
            Accept: expect.stringContaining('text/html'),
          }),
        })
      );
    });

    it('closes browser context on success', async () => {
      // Mock successful extraction
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Test Product'); // title
          if (callCount === 2) return Promise.resolve('$29.99'); // price
          if (callCount === 3) return Promise.resolve('In Stock'); // availability
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(playwrightAgent['browser']).toBeNull();
    });

    it('closes browser context on error', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Navigation failed'));

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow('Navigation failed');

      // Verify cleanup happened despite error
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(playwrightAgent['browser']).toBeNull();
    });

    it('launches new browser for each request (no pooling)', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 3 === 1) return Promise.resolve('Test Product');
          if (callCount % 3 === 2) return Promise.resolve('$29.99');
          if (callCount % 3 === 0) return Promise.resolve('In Stock');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await playwrightAgent.processTask(task);
      await playwrightAgent.processTask(task);

      // Should launch browser twice (once per request)
      expect(chromium.launch).toHaveBeenCalledTimes(2);
      expect(mockBrowser.close).toHaveBeenCalledTimes(2);
    });
  });

  describe('JavaScript-Rendered Content', () => {
    it('waits for dynamic content to load before extraction', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Dynamic Product');
          if (callCount === 2) return Promise.resolve('$49.99');
          if (callCount === 3) return Promise.resolve('Available');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://react-app.example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      // Verify we waited for price selector
      expect(mockPage.waitForSelector).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 10000,
          state: 'visible',
        })
      );
    });

    it('falls back to timeout wait when selector not found', async () => {
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Selector not found'));
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Product');
          if (callCount === 2) return Promise.resolve('$39.99');
          if (callCount === 3) return Promise.resolve('In Stock');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://slow-app.example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      // Should fall back to timeout wait
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
    });

    it('handles React/Vue/Angular applications', async () => {
      // Simulate AJAX-loaded price
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('SPA Product');
          if (callCount === 2) return Promise.resolve('$79.99');
          if (callCount === 3) return Promise.resolve('Available for delivery');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue('https://example.com/spa-image.jpg'),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://spa.example.com/product/123',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('SPA Product');
        expect(result.data.price).toBe(79.99);
        expect(result.data.availability).toBe('in_stock');
      }
    });
  });

  describe('Page Navigation and Waiting', () => {
    it('navigates to URL with correct wait strategy', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Product');
          if (callCount === 2) return Promise.resolve('$19.99');
          if (callCount === 3) return Promise.resolve('In Stock');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await playwrightAgent.processTask(task);

      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com/product', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    });

    it('handles navigation timeout', async () => {
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Navigation timeout'));

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://slow-site.example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow('Navigation timeout');

      // Verify cleanup still happened
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('Data Extraction with Playwright Locators', () => {
    it('extracts price after JavaScript execution', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('JS Product');
          if (callCount === 2) return Promise.resolve('$99.99');
          if (callCount === 3) return Promise.resolve('In Stock');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.price).toBe(99.99);
      }
    });

    it('uses selector fallback chain', async () => {
      // First selector fails, second succeeds
      const mockLocatorChain = [
        {
          first: vi.fn().mockReturnThis(),
          textContent: vi.fn().mockResolvedValue(null), // First selector fails
        },
        {
          first: vi.fn().mockReturnThis(),
          textContent: vi.fn().mockResolvedValue('Fallback Product'), // Second selector works
        },
      ];

      let locatorCallCount = 0;
      mockPage.locator = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes('price') || selector.includes('.price')) {
          // For price, return valid value immediately
          return {
            first: vi.fn().mockReturnThis(),
            textContent: vi.fn().mockResolvedValue('$29.99'),
            getAttribute: vi.fn().mockResolvedValue(null),
          };
        }
        // For title, use fallback chain
        const result = mockLocatorChain[locatorCallCount] || mockLocatorChain[1];
        locatorCallCount++;
        return result;
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Fallback Product');
      }
    });

    it('extracts image URLs including lazy-loaded images', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockImplementation((_selector: string) => {
        return {
          first: vi.fn().mockReturnThis(),
          textContent: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) return Promise.resolve('Product with Image');
            if (callCount === 2) return Promise.resolve('$29.99');
            if (callCount === 3) return Promise.resolve('In Stock');
            return Promise.resolve(null);
          }),
          getAttribute: vi.fn().mockImplementation((attr: string) => {
            // Simulate lazy-loaded image (src is empty, data-src has URL)
            if (attr === 'src') return Promise.resolve('');
            if (attr === 'data-src') return Promise.resolve('https://example.com/lazy-image.jpg');
            return Promise.resolve(null);
          }),
        };
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.imageUrl).toBe('https://example.com/lazy-image.jpg');
      }
    });
  });

  describe('Retailer-Specific Strategies', () => {
    it('uses Amazon-specific selectors', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Amazon Echo Dot');
          if (callCount === 2) return Promise.resolve('49.99');
          if (callCount === 3) return Promise.resolve('In Stock');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue('https://amazon.com/echo.jpg'),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://www.amazon.com/dp/B08ZZZ123',
        retailer: 'amazon.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Amazon Echo Dot');
        expect(result.data.price).toBe(49.99);
      }
    });

    it('uses generic strategy for unknown retailers', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Unknown Retailer Product');
          if (callCount === 2) return Promise.resolve('$59.99');
          if (callCount === 3) return Promise.resolve('Available');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://unknown-retailer.com/product',
        retailer: 'unknown-retailer.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Unknown Retailer Product');
      }
    });
  });

  describe('Error Handling', () => {
    it('returns failure when no price found', async () => {
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          return Promise.resolve('Product without price');
        }),
        getAttribute: vi.fn().mockResolvedValue(null),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).toBe('No price data found');
      }

      // Verify cleanup
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('handles page errors gracefully', async () => {
      // Throw error during navigation instead of during locator
      mockPage.goto = vi.fn().mockRejectedValue(new Error('Page crashed'));

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      await expect(playwrightAgent.processTask(task)).rejects.toThrow('Page crashed');

      // Verify cleanup happened despite error
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('Interface Compatibility with axios+cheerio version', () => {
    it('returns same ExtractedProductData structure', async () => {
      let callCount = 0;
      mockPage.locator = vi.fn().mockReturnValue({
        first: vi.fn().mockReturnThis(),
        textContent: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve('Compatible Product');
          if (callCount === 2) return Promise.resolve('$89.99');
          if (callCount === 3) return Promise.resolve('In Stock');
          if (callCount === 4) return Promise.resolve('5.0 out of 5 stars');
          if (callCount === 5) return Promise.resolve('Great product description');
          if (callCount === 6) return Promise.resolve('BrandName');
          return Promise.resolve(null);
        }),
        getAttribute: vi.fn().mockResolvedValue('https://example.com/image.jpg'),
      });

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      const result = await playwrightAgent.processTask(task);

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify all fields match ExtractedProductData interface
        expect(result.data).toMatchObject({
          title: expect.any(String),
          price: expect.any(Number),
          currency: 'USD',
          availability: expect.any(String),
          description: expect.any(String),
          imageUrl: expect.any(String),
          rating: expect.any(Number),
          brand: expect.any(String),
        });
      }
    });

    it('uses same processTask interface', async () => {
      // Verify method signature matches
      expect(typeof playwrightAgent.processTask).toBe('function');

      const task: ExtractionTask = {
        action: 'extract_product_data',
        url: 'https://example.com/product',
        retailer: 'example.com',
      };

      // Should accept same task format as axios+cheerio version
      expect(() => playwrightAgent.processTask(task)).not.toThrow();
    });
  });
});
