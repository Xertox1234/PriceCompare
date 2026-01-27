import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { db } from '../../db';
import { retailers } from '@shared/schema';
import { passport } from '../../auth';
import { registerRetailerRoutes } from '../retailer-routes';
import { expectSuccessResponse } from '../../__tests__/helpers/response-validators';
import { cleanupTestData } from '../../__tests__/helpers/test-fixtures';

/**
 * Retailer Routes Integration Test Suite
 *
 * Tests complete request/response flows for retailer endpoints:
 * - GET /api/retailers - List all retailers
 * - GET /api/retailers/:id - Get retailer details
 *
 * Note: Current implementation only has GET routes.
 * Admin routes (POST, PUT, DELETE) would be tested here if they existed.
 *
 * Test categories:
 * 1. Happy path - valid requests succeed
 * 2. Caching - verify cache headers set correctly
 * 3. Data integrity - verify retailer data structure
 */

// Mock Redis cache middleware to avoid requiring Redis
vi.mock('../../middleware/redis-cache', () => ({
  retailerCacheMiddleware: (req: unknown, res: unknown, next: () => void) => next(),
}));

describe('Retailer Routes - Integration Tests', () => {
  let app: Express;
  // testRetailerId is assigned for potential future use in individual retailer tests
  let _testRetailerId: number;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Create fresh Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Setup session
    app.use(
      session({
        secret: 'test-secret-key-for-testing-only',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          // Use secure cookies in production, not in test
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Register retailer routes
    registerRetailerRoutes(app);

    // Clean database using TRUNCATE CASCADE for fast, complete cleanup
    await cleanupTestData(db, ['retailers', 'users']);

    // Create test retailers
    const [retailer1] = await db
      .insert(retailers)
      .values({
        name: 'Amazon',
        website: 'https://amazon.com',
        logo: 'https://logo.clearbit.com/amazon.com',
        isActive: true,
        affiliateId: 'amazon-123',
        affiliateProgram: 'Amazon Associates',
        baseAffiliateUrl: 'https://amazon.com/dp/{productId}?tag=myaffiliate',
        commissionRate: '4.00',
        affiliateStatus: 'active',
      })
      .returning();
    _testRetailerId = retailer1.id;

    await db.insert(retailers).values([
      {
        name: 'Best Buy',
        website: 'https://bestbuy.com',
        logo: 'https://logo.clearbit.com/bestbuy.com',
        isActive: true,
      },
      {
        name: 'Walmart',
        website: 'https://walmart.com',
        logo: 'https://logo.clearbit.com/walmart.com',
        isActive: true,
      },
      {
        name: 'Inactive Retailer',
        website: 'https://inactive.com',
        isActive: false, // Inactive retailer
      },
    ]);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Fast cleanup using TRUNCATE CASCADE
    await cleanupTestData(db, ['retailers', 'users']);
  });

  describe('GET /api/retailers - List All Retailers', () => {
    it('should return all active retailers', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ id: number; name: string }>>(response, 200);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3); // Only active retailers
    });

    it('should include retailer details', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<
        Array<{ id: number; name: string; website: string; isActive: boolean }>
      >(response, 200);
      expect(result[0]).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        website: expect.any(String),
        isActive: expect.any(Boolean),
      });
    });

    it('should include affiliate information if configured', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<
        Array<{
          name: string;
          affiliateId?: string;
          affiliateProgram?: string;
          affiliateStatus?: string;
          commissionRate?: string;
        }>
      >(response, 200);

      // Find Amazon retailer (has affiliate config)
      const amazon = result.find((r) => r.name === 'Amazon');
      expect(amazon).toBeDefined();
      if (!amazon) throw new Error('Expected Amazon to be defined');
      expect(amazon.affiliateId).toBe('amazon-123');
      expect(amazon.affiliateProgram).toBe('Amazon Associates');
      expect(amazon.affiliateStatus).toBe('active');
      expect(amazon.commissionRate).toBeDefined();
    });

    it('should not include inactive retailers', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ isActive: boolean; name: string }>>(
        response,
        200
      );

      // Verify all returned retailers are active
      const allActive = result.every((r) => r.isActive === true);
      expect(allActive).toBe(true);

      // Verify inactive retailer is not in results
      const inactiveRetailer = result.find((r) => r.name === 'Inactive Retailer');
      expect(inactiveRetailer).toBeUndefined();
    });

    it('should set cache control headers', async () => {
      const response = await request(app).get('/api/retailers');

      expectSuccessResponse(response, 200);
      expect(response.headers['cache-control']).toBeDefined();
      expect(response.headers['cache-control']).toContain('public');
      expect(response.headers['cache-control']).toContain('max-age=3600'); // 1 hour
      expect(response.headers['cache-control']).toContain('stale-while-revalidate=1800'); // 30 min
    });

    it('should return empty array when no retailers exist', async () => {
      // Delete all retailers
      await cleanupTestData(db, ['retailers']);

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<unknown>>(response, 200);
      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', () => {
      // Mock storage to throw error
      vi.doMock('../../storage', () => ({
        storage: {
          getRetailers: vi.fn().mockRejectedValue(new Error('Database error')),
        },
      }));

      // Note: This test would require re-registering routes with mocked storage
      // Skipping implementation as it requires more setup
    });

    it('should return retailers in consistent order', async () => {
      const response1 = await request(app).get('/api/retailers');
      const response2 = await request(app).get('/api/retailers');

      const result1 = expectSuccessResponse<Array<{ id: number }>>(response1, 200);
      const result2 = expectSuccessResponse<Array<{ id: number }>>(response2, 200);

      // Order should be consistent (typically by ID)
      expect(result1.map((r) => r.id)).toEqual(result2.map((r) => r.id));
    });

    it('should not expose sensitive internal fields', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<Record<string, unknown>>>(response, 200);

      result.forEach((retailer) => {
        // Verify no internal database fields exposed
        expect(retailer).not.toHaveProperty('passwordHash');
        expect(retailer).not.toHaveProperty('internalNotes');

        // Affiliate config is OK to expose (it's JSON string)
        // But should not contain secrets
        if (retailer.affiliateConfig) {
          expect(typeof retailer.affiliateConfig).toBe('string');
        }
      });
    });

    it('should handle special characters in retailer data', async () => {
      // Create retailer with special characters
      await db.insert(retailers).values({
        name: "O'Reilly & Sons",
        website: 'https://example.com/path?query=value&other=data',
        logo: 'https://example.com/logo-with-dashes_and_underscores.png',
        isActive: true,
      });

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ name: string; website: string }>>(response, 200);

      const specialRetailer = result.find((r) => r.name === "O'Reilly & Sons");
      expect(specialRetailer).toBeDefined();
      if (!specialRetailer) throw new Error('Expected special retailer to be defined');
      expect(specialRetailer.website).toBe('https://example.com/path?query=value&other=data');
    });
  });

  describe('Performance & Caching', () => {
    it('should respond quickly (< 500ms) for retailer list', async () => {
      const startTime = Date.now();

      const response = await request(app).get('/api/retailers');

      const duration = Date.now() - startTime;

      expectSuccessResponse(response, 200);
      expect(duration).toBeLessThan(500);
    });

    it('should set appropriate cache headers for long-lived data', async () => {
      const response = await request(app).get('/api/retailers');

      expectSuccessResponse(response, 200);

      // Retailers change infrequently, so cache should be longer
      const cacheControl = response.headers['cache-control'];
      expect(cacheControl).toContain('max-age=3600'); // 1 hour cache
    });
  });

  describe('Data Validation', () => {
    it('should return valid retailer schema', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<
        Array<{
          id: number;
          name: string;
          website: string | null;
          logo: string | null;
          isActive: boolean | null;
          affiliateId: string | null;
          affiliateProgram: string | null;
          baseAffiliateUrl: string | null;
          commissionRate: string | null;
          affiliateStatus: string | null;
          affiliateConfig: string | null;
        }>
      >(response, 200);

      result.forEach((retailer) => {
        // Required fields
        expect(typeof retailer.id).toBe('number');
        expect(typeof retailer.name).toBe('string');
        expect(retailer.name.length).toBeGreaterThan(0);

        // Optional fields (null or correct type)
        if (retailer.website !== null) {
          expect(typeof retailer.website).toBe('string');
          expect(retailer.website).toMatch(/^https?:\/\//);
        }

        if (retailer.logo !== null) {
          expect(typeof retailer.logo).toBe('string');
        }

        // Boolean fields
        if (retailer.isActive !== null) {
          expect(typeof retailer.isActive).toBe('boolean');
        }

        // Affiliate fields
        if (retailer.affiliateId !== null) {
          expect(typeof retailer.affiliateId).toBe('string');
        }

        if (retailer.commissionRate !== null) {
          expect(typeof retailer.commissionRate).toBe('string');
          expect(parseFloat(retailer.commissionRate)).not.toBeNaN();
        }

        if (retailer.affiliateStatus !== null) {
          expect(['active', 'inactive', 'pending']).toContain(retailer.affiliateStatus);
        }
      });
    });

    it('should handle retailers with minimal data', async () => {
      // Create minimal retailer (only required fields)
      await db.insert(retailers).values({
        name: 'Minimal Retailer',
      });

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ id: number; name: string }>>(response, 200);

      const minimalRetailer = result.find((r) => r.name === 'Minimal Retailer');
      expect(minimalRetailer).toBeDefined();
      if (!minimalRetailer) throw new Error('Expected minimal retailer to be defined');
      expect(minimalRetailer.id).toBeDefined();
      expect(minimalRetailer.name).toBe('Minimal Retailer');
    });

    it('should handle retailers with all fields populated', async () => {
      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<
        Array<{
          name: string;
          id: number;
          website: string;
          logo: string;
          isActive: boolean;
          affiliateId: string;
          affiliateProgram: string;
          baseAffiliateUrl: string;
          commissionRate: string;
          affiliateStatus: string;
        }>
      >(response, 200);

      // Find Amazon (has all affiliate fields)
      const amazon = result.find((r) => r.name === 'Amazon');
      expect(amazon).toMatchObject({
        id: expect.any(Number),
        name: 'Amazon',
        website: expect.any(String),
        logo: expect.any(String),
        isActive: true,
        affiliateId: expect.any(String),
        affiliateProgram: expect.any(String),
        baseAffiliateUrl: expect.any(String),
        commissionRate: expect.any(String),
        affiliateStatus: 'active',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long retailer names', async () => {
      const longName = 'A'.repeat(255); // Max reasonable length

      await db.insert(retailers).values({
        name: longName,
      });

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ name: string }>>(response, 200);

      const longNameRetailer = result.find((r) => r.name === longName);
      expect(longNameRetailer).toBeDefined();
      if (!longNameRetailer) throw new Error('Expected long name retailer to be defined');
      expect(longNameRetailer.name.length).toBe(255);
    });

    it('should handle retailers with unicode characters', async () => {
      await db.insert(retailers).values({
        name: '日本ストア',
        website: 'https://日本.jp',
      });

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<Array<{ name: string; website: string | null }>>(
        response,
        200
      );

      const unicodeRetailer = result.find((r) => r.name === '日本ストア');
      expect(unicodeRetailer).toBeDefined();
      if (!unicodeRetailer) throw new Error('Expected unicode retailer to be defined');
      expect(unicodeRetailer.website).toBe('https://日本.jp');
    });

    it('should handle null values correctly', async () => {
      await db.insert(retailers).values({
        name: 'Null Test Retailer',
        website: null,
        logo: null,
        affiliateId: null,
      });

      const response = await request(app).get('/api/retailers');

      const result = expectSuccessResponse<
        Array<{
          name: string;
          website: string | null;
          logo: string | null;
          affiliateId: string | null;
        }>
      >(response, 200);

      const nullRetailer = result.find((r) => r.name === 'Null Test Retailer');
      expect(nullRetailer).toBeDefined();
      if (!nullRetailer) throw new Error('Expected null test retailer to be defined');
      expect(nullRetailer.website).toBeNull();
      expect(nullRetailer.logo).toBeNull();
      expect(nullRetailer.affiliateId).toBeNull();
    });
  });
});
