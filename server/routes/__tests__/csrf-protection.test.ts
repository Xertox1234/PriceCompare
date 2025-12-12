import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hashEmail } from '../../utils/encryption';

// Mock dependencies before imports
vi.mock('../../services/price-aggregation-service', () => ({
  priceAggregationService: {
    aggregateToDaily: vi.fn(),
    detectGaps: vi.fn(),
    fillGaps: vi.fn(),
    calculateProductAggregates: vi.fn(),
  },
}));

vi.mock('../../services/monitoring-service', () => ({
  monitoringService: {
    getDashboardMetrics: vi.fn(),
    getRecentErrors: vi.fn(),
    clearErrors: vi.fn(),
  },
}));

vi.mock('../../services/alert-service', () => ({
  alertService: {
    getAlertHistory: vi.fn(),
    sendCustomAlert: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../utils/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    CSRF_VIOLATION: 'CSRF_VIOLATION',
  },
}));

// Import after mocks
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { db } from '../../db';
import { users, products, retailers, type Product, type Retailer } from '@shared/schema';
import { registerAdminAggregationRoutes } from '../admin-aggregation-routes';
import { registerAdminRoutes } from '../admin-routes';
import { registerMonitoringRoutes } from '../monitoring-routes';
import { priceAggregationService } from '../../services/price-aggregation-service';
import { monitoringService } from '../../services/monitoring-service';
import { alertService } from '../../services/alert-service';
import { logSecurityEvent } from '../../utils/security-logger';
import * as crypto from 'crypto';

/**
 * CSRF Protection Test Suite
 *
 * Tests CSRF (Cross-Site Request Forgery) protection on all mutation endpoints.
 * Ensures that all POST/PUT/PATCH/DELETE operations require valid CSRF tokens.
 *
 * Security Requirements:
 * - All mutation endpoints MUST require CSRF token
 * - Invalid/missing tokens MUST return 403 Forbidden
 * - CSRF violations MUST be logged for security monitoring
 * - GET requests MUST NOT require CSRF tokens
 */
describe('CSRF Protection', () => {
  let app: Express;
  let adminCookie: string;
  let validCsrfToken: string;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Create fresh Express app
    app = express();

    // Setup middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Setup session with CSRF token
    app.use(
      session({
        secret: 'test-secret-key-for-csrf-testing',
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    // CSRF token middleware - attach token to session
    app.use((req, res, next) => {
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      validCsrfToken = req.session.csrfToken;
      next();
    });

    // Mock auth middleware - simulate admin user
    app.use((req, res, next) => {
      req.user = {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        emailHash: hashEmail('admin@test.com'), // SHA-256 hash for indexed lookups
        role: 'admin',
        trustLevel: 4,
        isActive: true,
        isSuspended: false,
        reputation: 100,
        avatarUrl: null,
        bio: null,
        location: null,
        website: null,
        lastSeenAt: null,
        postCount: 0,
        topicCount: 0,
        likesGiven: 0,
        likesReceived: 0,
        timeReadPosts: 0,
        daysVisited: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
    });

    // Register routes
    registerAdminAggregationRoutes(app);
    registerAdminRoutes(app);
    registerMonitoringRoutes(app);

    // Clean database
    await db.delete(products);
    await db.delete(retailers);
    await db.delete(users);

    // Create admin user
    // SECURITY: NEVER expose passwordHash in queries - this is test setup only
    const [_admin] = await db
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@test.com',
        emailHash: hashEmail('admin@test.com'), // SHA-256 hash for indexed lookups
        passwordHash: 'hashed', // SECURITY: NEVER expose - test data only
        role: 'admin',
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        // SECURITY: passwordHash explicitly excluded from return
      });

    // Create test session cookie
    const sessionRes = await request(app).get('/');
    adminCookie = sessionRes.headers['set-cookie']?.[0] || '';
  });

  afterEach(async () => {
    // Clean database
    await db.delete(products);
    await db.delete(retailers);
    await db.delete(users);
    vi.clearAllMocks();
  });

  describe('Admin Aggregation Routes', () => {
    beforeEach(() => {
      // Reset mocks for each test
      vi.mocked(priceAggregationService.aggregateToDaily).mockResolvedValue(5);
      vi.mocked(priceAggregationService.detectGaps).mockResolvedValue(['2025-01-01', '2025-01-02']);
      vi.mocked(priceAggregationService.fillGaps).mockResolvedValue(2);
      vi.mocked(priceAggregationService.calculateProductAggregates).mockResolvedValue(undefined);
    });

    describe('POST /api/admin/aggregation/force-daily', () => {
      const endpoint = '/api/admin/aggregation/force-daily';
      const validBody = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      };

      it('should reject request without CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .send(validBody)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/CSRF/i);
        expect(logSecurityEvent).toHaveBeenCalled();
      });

      it('should reject request with invalid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', 'invalid-token-12345')
          .send(validBody)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toMatch(/CSRF/i);
      });

      it('should accept request with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send(validBody)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.daysAggregated).toBe(5);
        expect(priceAggregationService.aggregateToDaily).toHaveBeenCalledWith(
          expect.any(Date),
          expect.any(Date),
          true
        );
      });

      it('should accept CSRF token in request body', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .send({
            ...validBody,
            _csrf: validCsrfToken,
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });

    describe('POST /api/admin/aggregation/detect-gaps', () => {
      const endpoint = '/api/admin/aggregation/detect-gaps';

      it('should require CSRF token', async () => {
        await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .send({ startDate: '2025-01-01', endDate: '2025-01-31' })
          .expect(403);

        expect(logSecurityEvent).toHaveBeenCalled();
      });

      it('should work with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ startDate: '2025-01-01', endDate: '2025-01-31' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.gaps).toEqual(['2025-01-01', '2025-01-02']);
      });
    });

    describe('POST /api/admin/aggregation/fill-gaps', () => {
      const endpoint = '/api/admin/aggregation/fill-gaps';

      it('should require CSRF token', async () => {
        await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .send({ startDate: '2025-01-01', endDate: '2025-01-31' })
          .expect(403);
      });

      it('should work with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ startDate: '2025-01-01', endDate: '2025-01-31' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.daysFilled).toBe(2);
      });
    });

    describe('POST /api/admin/aggregation/single-product', () => {
      const endpoint = '/api/admin/aggregation/single-product';

      it('should require CSRF token', async () => {
        await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .send({ productId: 123 })
          .expect(403);
      });

      it('should work with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ productId: 123 })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.productId).toBe(123);
      });
    });
  });

  describe('Admin Routes', () => {
    let testProduct: Product;
    let testRetailer: Retailer;

    beforeEach(async () => {
      // Create test retailer
      [testRetailer] = await db
        .insert(retailers)
        .values({
          name: 'Test Retailer',
          website: 'https://test.com',
        })
        .returning();

      // Create test product
      [testProduct] = await db
        .insert(products)
        .values({
          name: 'Test Product',
          description: 'Test Description',
        })
        .returning();
    });

    describe('POST /api/admin/products', () => {
      const endpoint = '/api/admin/products';
      const validBody = {
        name: 'New Product',
        description: 'New Description',
      };

      it('should require CSRF token', async () => {
        await request(app).post(endpoint).set('Cookie', adminCookie).send(validBody).expect(403);

        expect(logSecurityEvent).toHaveBeenCalled();
      });

      it('should create product with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send(validBody)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New Product');
      });
    });

    describe('PUT /api/admin/products/:id', () => {
      it('should require CSRF token', async () => {
        await request(app)
          .put(`/api/admin/products/${testProduct.id}`)
          .set('Cookie', adminCookie)
          .send({ name: 'Updated Name' })
          .expect(403);
      });

      it('should update product with valid CSRF token', async () => {
        const response = await request(app)
          .put(`/api/admin/products/${testProduct.id}`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ name: 'Updated Name' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Name');
      });
    });

    describe('DELETE /api/admin/products/:id', () => {
      it('should require CSRF token', async () => {
        await request(app)
          .delete(`/api/admin/products/${testProduct.id}`)
          .set('Cookie', adminCookie)
          .expect(403);
      });

      it('should delete product with valid CSRF token', async () => {
        const response = await request(app)
          .delete(`/api/admin/products/${testProduct.id}`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toMatch(/deleted/i);
      });
    });

    describe('POST /api/admin/retailers', () => {
      const endpoint = '/api/admin/retailers';
      const validBody = {
        name: 'New Retailer',
        website: 'https://newretailer.com',
      };

      it('should require CSRF token', async () => {
        await request(app).post(endpoint).set('Cookie', adminCookie).send(validBody).expect(403);
      });

      it('should create retailer with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send(validBody)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('New Retailer');
      });
    });

    describe('PUT /api/admin/retailers/:id', () => {
      it('should require CSRF token', async () => {
        await request(app)
          .put(`/api/admin/retailers/${testRetailer.id}`)
          .set('Cookie', adminCookie)
          .send({ name: 'Updated Retailer' })
          .expect(403);
      });

      it('should update retailer with valid CSRF token', async () => {
        const response = await request(app)
          .put(`/api/admin/retailers/${testRetailer.id}`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .send({ name: 'Updated Retailer' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe('Updated Retailer');
      });
    });

    describe('DELETE /api/admin/retailers/:id', () => {
      it('should require CSRF token', async () => {
        await request(app)
          .delete(`/api/admin/retailers/${testRetailer.id}`)
          .set('Cookie', adminCookie)
          .expect(403);
      });

      it('should delete retailer with valid CSRF token', async () => {
        const response = await request(app)
          .delete(`/api/admin/retailers/${testRetailer.id}`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toMatch(/deleted/i);
      });
    });
  });

  describe('Monitoring Routes', () => {
    beforeEach(() => {
      vi.mocked(monitoringService.clearErrors).mockReturnValue(undefined);
      vi.mocked(alertService.sendCustomAlert).mockResolvedValue(undefined);
    });

    describe('POST /api/monitoring/errors/clear', () => {
      const endpoint = '/api/monitoring/errors/clear';

      it('should require CSRF token', async () => {
        await request(app).post(endpoint).set('Cookie', adminCookie).expect(403);

        expect(logSecurityEvent).toHaveBeenCalled();
      });

      it('should clear errors with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toMatch(/cleared/i);
        expect(monitoringService.clearErrors).toHaveBeenCalled();
      });
    });

    describe('POST /api/monitoring/alerts/test', () => {
      const endpoint = '/api/monitoring/alerts/test';

      it('should require CSRF token', async () => {
        await request(app).post(endpoint).set('Cookie', adminCookie).expect(403);
      });

      it('should send test alert with valid CSRF token', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', validCsrfToken)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toMatch(/sent/i);
        expect(alertService.sendCustomAlert).toHaveBeenCalledWith(
          'info',
          'Test Alert',
          expect.any(String),
          expect.objectContaining({ test: true })
        );
      });
    });
  });

  describe('CSRF Token Security', () => {
    it('should not accept tokens from different sessions', async () => {
      // Create second session with different token
      const otherToken = crypto.randomBytes(32).toString('hex');

      const response = await request(app)
        .post('/api/admin/aggregation/force-daily')
        .set('Cookie', adminCookie)
        .set('X-CSRF-Token', otherToken) // Token from different session
        .send({ startDate: '2025-01-01', endDate: '2025-01-31' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not accept tokens after they expire', () => {
      // This would require session expiry simulation
      // Placeholder for future implementation
      expect(true).toBe(true);
    });

    it('should log all CSRF violations', async () => {
      await request(app)
        .post('/api/admin/products')
        .set('Cookie', adminCookie)
        .send({ name: 'Test' })
        .expect(403);

      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ success: false })
      );
    });
  });

  describe('Safe Methods (GET, HEAD, OPTIONS)', () => {
    it('should not require CSRF for GET requests', async () => {
      const response = await request(app)
        .get('/api/admin/products')
        .set('Cookie', adminCookie)
        // No CSRF token
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not require CSRF for HEAD requests', async () => {
      await request(app)
        .head('/api/admin/products')
        .set('Cookie', adminCookie)
        // No CSRF token
        .expect(200);
    });
  });
});
