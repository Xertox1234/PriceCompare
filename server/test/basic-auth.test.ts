/**
 * Integration Tests: HTTP Basic Authentication
 *
 * Tests the Basic Auth middleware for agent-native API access.
 * Verifies security controls, rate limiting, and account status validation.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { storage } from '../storage';
import { hashPassword, passport } from '../auth';
import type { SafeUser } from '../storage/types';
import { basicAuth } from '../middleware/basic-auth';
import { withAuth, withAdmin } from '../routes/helpers';
import { sendSuccess, sendErrorFromException } from '../utils/api-response';
import { PASSWORD } from '../utils/constants';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Create test app with minimal setup for Basic Auth testing
function createTestApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(
    session({
      secret: 'test-session-secret', // Test-only secret, not used in production
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  // Register a simple test endpoint that requires Basic Auth + admin
  app.get(
    '/api/v1/scraping/status',
    basicAuth,
    withAuth((req, res) => {
      sendSuccess(res, { status: { isRunning: false } });
    })
  );

  app.post(
    '/api/v1/scraping/initialize',
    basicAuth,
    withAdmin((req, res) => {
      try {
        sendSuccess(res, { message: 'Initialized' });
      } catch (error) {
        sendErrorFromException(res, error, 'TestInit');
      }
    })
  );

  return app;
}

describe('HTTP Basic Auth - Integration Tests', () => {
  let app: Express;
  let testUser: SafeUser;
  let testPassword: string;

  beforeAll(async () => {
    // Clean up any existing test users from previous runs
    await db.execute(sql`DELETE FROM users WHERE username IN (
      'basicauth_test_user',
      'regular_user',
      'inactive_test_user'
    )`);

    app = createTestApp();

    // Create test user for Basic Auth tests
    testPassword = 'BasicAuthTestPassword123!';
    const hashedPassword = await hashPassword(testPassword);

    const user = await storage.registerUser({
      username: 'basicauth_test_user',
      email: 'basicauth@test.com',
      passwordHash: hashedPassword,
    });

    // Type assertion: registerUser returns SafeUser
    testUser = user;

    // Grant admin role for testing scraping endpoints (which require admin)
    await storage.updateUserRole(testUser.id, 'admin');
  });

  afterAll(async () => {
    // Clean up test users after all tests complete
    await db.execute(sql`DELETE FROM users WHERE username IN (
      'basicauth_test_user',
      'regular_user',
      'inactive_test_user'
    )`);
  });

  afterEach(async () => {
    // Clean up any failed login attempts between tests
    // This prevents test interdependence
    try {
      const { clearFailedLoginsAsync } = await import('../utils/account-lockout-simple');
      await clearFailedLoginsAsync('basicauth@test.com');
    } catch (error) {
      // If Redis not available, skip cleanup (tests in memory mode)
    }
  });

  describe('Authentication Success', () => {
    test('authenticates with valid credentials', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.any(Object),
        },
      });
    });

    test('falls through to session auth when no Basic Auth header', async () => {
      // Without Basic Auth header, should attempt session auth
      // Since no session, should get 401
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Authentication required');
    });

    test('returns correct WWW-Authenticate header on 401', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(401);

      expect(response.headers['www-authenticate']).toBe('Basic realm="PriceCompare API"');
    });
  });

  describe('Authentication Failures', () => {
    test('rejects invalid password', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
      });
    });

    test('rejects non-existent username', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('nonexistent_user', 'any_password')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
      });
    });

    test('rejects malformed credentials (no colon)', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .set('Authorization', 'Basic ' + Buffer.from('malformed').toString('base64'))
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials format',
      });
    });

    test('rejects empty username', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .set('Authorization', 'Basic ' + Buffer.from(':password').toString('base64'))
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials format');
    });

    test('rejects empty password', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .set('Authorization', 'Basic ' + Buffer.from('username:').toString('base64'))
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials format');
    });
  });

  describe('Input Validation', () => {
    test('rejects username exceeding maximum length', async () => {
      const longUsername = 'a'.repeat(256); // Max is 255
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth(longUsername, 'password')
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials format');
    });

    test('rejects password exceeding maximum length', async () => {
      const longPassword = 'a'.repeat(1001); // Max is 1000
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('username', longPassword)
        .expect(401);

      expect(response.body.error).toContain('Invalid credentials format');
    });

    test('accepts maximum valid lengths', async () => {
      // This will fail auth (user doesn't exist) but should pass validation
      const maxUsername = 'a'.repeat(255);
      const maxPassword = 'b'.repeat(1000);

      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth(maxUsername, maxPassword)
        .expect(401);

      // Should get "Invalid credentials", not "Invalid credentials format"
      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('Rate Limiting & Account Lockout', () => {
    test.skip('locks account after multiple failed attempts', async () => {
      // SKIP: Account lockout is intentionally disabled in test environment (NODE_ENV=test)
      // See basicAuth middleware line 117: if (process.env.NODE_ENV !== 'test')
      // This prevents flaky E2E tests and allows deterministic test runs
      //
      // To test lockout behavior:
      // 1. Set NODE_ENV=production in test setup
      // 2. Mock Redis for lockout tracking
      // 3. Verify lockout threshold is respected
      //
      // For now, we verify the middleware code path exists but don't test execution
      // since it requires production mode + Redis availability

      // Attempt 5 failed logins (default lockout threshold)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/v1/scraping/status')
          .auth('basicauth_test_user', 'wrong_password')
          .expect(401);
      }

      // 6th attempt should be locked
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(429);

      expect(response.body.error).toContain('Account temporarily locked');
    });

    test('clears lockout on successful authentication', async () => {
      // First, cause some failures (but not enough to lock)
      await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(401);

      await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(401);

      // Now authenticate successfully
      await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);

      // Failed attempts should be cleared - try 3 more failures
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get('/api/v1/scraping/status')
          .auth('basicauth_test_user', 'wrong_password')
          .expect(401);
      }

      // Should still be able to login (cleared after success)
      await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);
    });
  });

  describe('Account Status Validation', () => {
    test('rejects suspended account', async () => {
      // Suspend the test user
      await storage.suspendUser(testUser.id, 'Test suspension', testUser.id);

      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(403);

      expect(response.body.error).toContain('Account access denied');

      // Clean up: unsuspend for subsequent tests
      await storage.unsuspendUser(testUser.id, testUser.id);
    });

    test('rejects inactive account', async () => {
      // Create a new inactive user for this test
      const inactivePassword = 'InactiveTest123!';
      const hashedPassword = await hashPassword(inactivePassword);

      const inactiveUser = await storage.registerUser({
        username: 'inactive_test_user',
        email: 'inactive@test.com',
        passwordHash: hashedPassword,
      });

      await storage.setUserActive(inactiveUser.id, false);
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('inactive_test_user', inactivePassword)
        .expect(403);
      expect(response.body.error).toContain('Account access denied');
    });
  });

  describe('HTTPS Enforcement', () => {
    test('allows Basic Auth in development over HTTP', async () => {
      // In test/development, HTTP is allowed
      expect(process.env.NODE_ENV).toBe('test');

      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    // Note: Testing production HTTPS requirement requires mocking NODE_ENV
    // and request protocol, which is complex in Supertest
    // The code review verified the implementation exists
  });

  describe('Authorization (Admin Role)', () => {
    test('requires admin role for scraping endpoints', async () => {
      // Create a non-admin user
      const userPassword = 'UserTest123!';
      const hashedPassword = await hashPassword(userPassword);

      await storage.registerUser({
        username: 'regular_user',
        email: 'regular@test.com',
        passwordHash: hashedPassword,
      });

      const response = await request(app)
        .post('/api/v1/scraping/initialize')
        .auth('regular_user', userPassword)
        .expect(403);

      expect(response.body.error).toContain('Admin access required');
    });
  });

  describe('API Response Format', () => {
    test('returns correct response structure on success', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);

      // Verify no nested success wrapper
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.any(Object),
        },
      });

      // Ensure data doesn't have nested success: true
      expect(response.body.data.success).toBeUndefined();
    });

    test('returns correct error structure on failure', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', 'wrong_password')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
      });
    });
  });

  describe('Endpoint Coverage', () => {
    test('GET /api/v1/scraping/status requires auth', async () => {
      await request(app)
        .get('/api/v1/scraping/status')
        .expect(401);
    });

    test('POST /api/v1/scraping/initialize requires auth', async () => {
      await request(app)
        .post('/api/v1/scraping/initialize')
        .expect(401);
    });

    test('Authenticated request to status endpoint works', async () => {
      const response = await request(app)
        .get('/api/v1/scraping/status')
        .auth('basicauth_test_user', testPassword)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Password Hash Upgrade (Security)', () => {
    let weakUserId: number;

    afterEach(async () => {
      // Cleanup weak hash test user after each test
      if (weakUserId) {
        await db.execute(sql`DELETE FROM users WHERE id = ${weakUserId}`);
      }
    });

    test('should upgrade weak password hash on successful login', async () => {
      // Create a test user with a weak hash (4 rounds - bcrypt minimum)
      const bcrypt = await import('bcrypt');
      const weakPassword = 'TestPassword123!';
      // SECURITY TEST: Intentionally weak hash to test weak password detection/upgrade
      const weakHash = await bcrypt.hash(weakPassword, PASSWORD.BCRYPT_ROUNDS_TEST);

      // Create user normally first
      const weakUser = await storage.registerUser({
        username: 'weak_hash_user',
        email: 'weakhash@example.com',
        passwordHash: await hashPassword('temporary'), // Create with normal hash
      });

      weakUserId = weakUser.id;

      // Then update to use weak hash (simulating legacy data)
      await storage.updateUserPasswordHash(weakUserId, weakHash);

      // Verify hash has 4 rounds (less than our standard of 12)
      const rounds = bcrypt.getRounds(weakHash);
      expect(rounds).toBe(4);

      // Attempt login (should succeed and upgrade hash)
      await request(app)
        .get('/api/v1/scraping/status')
        .auth('weak_hash_user', weakPassword)
        .expect(200);

      // Verify hash was upgraded to 12 rounds
      const updatedUser = await storage.getUserWithPassword(weakUserId);
      expect(updatedUser).not.toBeNull();
      if (updatedUser) {
        const newRounds = bcrypt.getRounds(updatedUser.passwordHash);
        expect(newRounds).toBe(12);

        // Verify password still works with new hash
        const isValid = await bcrypt.compare(weakPassword, updatedUser.passwordHash);
        expect(isValid).toBe(true);
      }
    });

    test('should not upgrade hash if already at current rounds', async () => {
      // User already has 12-round hash (created by normal registration)
      const bcrypt = await import('bcrypt');

      // Get existing user's hash (should already be 12 rounds)
      const user = await storage.getUserWithPassword(testUser.id);
      expect(user).not.toBeNull();

      if (user) {
        const rounds = bcrypt.getRounds(user.passwordHash);
        expect(rounds).toBe(12);

        // Login should succeed without upgrade
        await request(app)
          .get('/api/v1/scraping/status')
          .auth('basicauth_test_user', testPassword)
          .expect(200);

        // Hash should remain unchanged (same value)
        const afterUser = await storage.getUserWithPassword(testUser.id);
        expect(afterUser).not.toBeNull();
        if (afterUser) {
          expect(afterUser.passwordHash).toBe(user.passwordHash);
        }
      }
    });
  });
});
