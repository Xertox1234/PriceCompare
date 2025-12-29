/**
 * Integration Tests for Flexible Authentication
 *
 * Tests the complete middleware chain:
 * flexibleAuth → csrfProtection → withAuth → handler
 *
 * Validates:
 * - Session auth + CSRF protection
 * - Basic Auth + CSRF exemption
 * - Error scenarios
 * - Real Express app behavior
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express, Request, Response } from 'express';
import session from 'express-session';
import passport from 'passport';
import { flexibleAuth } from '../flexible-auth';
import { csrfProtection, generateCsrfToken } from '../security';
import { withAuth } from '../../routes/helpers';
import { sendSuccess, sendError } from '../../utils/api-response';
import { hashPassword } from '../../auth';
import { db } from '../../db';
import { users } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { hashEmail } from '../../utils/encryption';

describe('Flexible Auth Integration Tests', () => {
  let app: Express;
  let testUser: {
    id: number;
    username: string;
    email: string;
    password: string;
  };

  beforeAll(async () => {
    // Create test user
    const password = 'TestPassword123!'; // Test fixture password
    const passwordHash = await hashPassword(password); // SECURITY: Test data only
    const email = 'flexauth-test@example.com';

    const [user] = await db
      .insert(users)
      .values({
        username: 'flexauthtest',
        email,
        emailHash: hashEmail(email),
        passwordHash, // SECURITY: Test data - intentional use for database record
        role: 'user',
      })
      .returning();

    testUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      password,
    };
  });

  afterAll(async () => {
    // Cleanup test user
    if (testUser?.id) {
      await db.delete(users).where(eq(users.id, testUser.id));
    }
  });

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());

    // Session middleware (required for session auth)
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false }, // Allow HTTP in tests
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Test login endpoint (creates session)
    app.post('/auth/login', (req: Request, res: Response) => {
      const { email, password } = req.body;

      if (email === testUser.email && password === testUser.password) {
        // Simulate successful Passport authentication
        req.login({ id: testUser.id, username: testUser.username, email: testUser.email } as Express.User, (err) => {
          if (err) {
            return sendError(res, 'Login failed', 500);
          }

          // Generate CSRF token for session
          const csrfToken = generateCsrfToken(req);
          res.setHeader('X-CSRF-Token', csrfToken);

          sendSuccess(res, { message: 'Logged in' });
        });
      } else {
        sendError(res, 'Invalid credentials', 401);
      }
    });

    // Test endpoint: GET /api/data (read-only, no CSRF required)
    app.get(
      '/api/data',
      flexibleAuth,
      withAuth((req, res) => {
        sendSuccess(res, {
          userId: req.user.id,
          authMethod: req.isBasicAuth ? 'basic' : 'session',
        });
      })
    );

    // Test endpoint: POST /api/data (mutation, CSRF required for session)
    app.post(
      '/api/data',
      flexibleAuth,
      csrfProtection,
      withAuth((req, res) => {
        sendSuccess(res, {
          userId: req.user.id,
          authMethod: req.isBasicAuth ? 'basic' : 'session',
          data: req.body,
        });
      })
    );
  });

  describe('Session Authentication', () => {
    it('allows GET request with session (no CSRF required)', async () => {
      const agent = request.agent(app);

      // Login to create session
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Make authenticated GET request
      const res = await agent.get('/api/data');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authMethod).toBe('session');
      expect(res.body.data.userId).toBe(testUser.id);
    });

    it('allows POST request with session + CSRF token', async () => {
      const agent = request.agent(app);

      // Login to get CSRF token
      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const csrfToken = loginRes.headers['x-csrf-token'];
      expect(csrfToken).toBeDefined();

      // Make authenticated POST with CSRF token
      const res = await agent
        .post('/api/data')
        .set('X-CSRF-Token', csrfToken)
        .send({ test: 'data' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authMethod).toBe('session');
      expect(res.body.data.data.test).toBe('data');
    });

    it('blocks POST request with session but no CSRF token', async () => {
      const agent = request.agent(app);

      // Login (but don't get CSRF token)
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Attempt POST without CSRF token
      const res = await agent.post('/api/data').send({ test: 'data' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('CSRF');
    });

    it('blocks request with no session', async () => {
      const res = await request(app).get('/api/data');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Authentication required');
    });
  });

  describe('HTTP Basic Authentication', () => {
    it('allows GET request with Basic Auth', async () => {
      const res = await request(app)
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authMethod).toBe('basic');
      expect(res.body.data.userId).toBe(testUser.id);
    });

    it('allows POST request with Basic Auth (no CSRF required)', async () => {
      const res = await request(app)
        .post('/api/data')
        .auth(testUser.username, testUser.password)
        .send({ test: 'data' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.authMethod).toBe('basic');
      expect(res.body.data.data.test).toBe('data');
    });

    it('blocks request with invalid Basic Auth credentials', async () => {
      const res = await request(app)
        .get('/api/data')
        .auth(testUser.username, 'wrongpassword');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('blocks request with malformed Basic Auth header', async () => {
      const res = await request(app)
        .get('/api/data')
        .set('Authorization', 'Basic invalid-base64');

      // Should reject (invalid base64 or credential format)
      expect(res.status).toBe(401);
    });
  });

  describe('Authentication Priority', () => {
    it('prefers Basic Auth over session when both present', async () => {
      const agent = request.agent(app);

      // Login to create session
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Make request with both session cookie AND Basic Auth header
      const res = await agent
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(res.status).toBe(200);
      expect(res.body.data.authMethod).toBe('basic'); // Basic Auth takes priority
    });

    it('uses session when only session available', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const res = await agent.get('/api/data');

      expect(res.status).toBe(200);
      expect(res.body.data.authMethod).toBe('session');
    });

    it('uses Basic Auth when only Basic Auth available', async () => {
      // No session - just Basic Auth
      const res = await request(app)
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(res.status).toBe(200);
      expect(res.body.data.authMethod).toBe('basic');
    });
  });

  describe('CSRF Protection Integration', () => {
    it('exempts Basic Auth from CSRF on POST', async () => {
      // POST with Basic Auth should NOT require CSRF token
      const res = await request(app)
        .post('/api/data')
        .auth(testUser.username, testUser.password)
        .send({ test: 'data' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('requires CSRF for session POST', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // POST without CSRF token should fail
      const res = await agent.post('/api/data').send({ test: 'data' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('CSRF');
    });

    it('does not require CSRF for GET even with session', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // GET with session, no CSRF token - should succeed
      const res = await agent.get('/api/data');

      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('returns 401 with WWW-Authenticate header when no auth', async () => {
      const res = await request(app).get('/api/data');

      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Basic realm="PriceCompare API"');
    });

    it('handles suspended user account', async () => {
      // Suspend test user
      await db.update(users).set({ isSuspended: true }).where(eq(users.id, testUser.id));

      const res = await request(app)
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('denied');

      // Restore user
      await db.update(users).set({ isSuspended: false }).where(eq(users.id, testUser.id));
    });

    it('handles inactive user account', async () => {
      // Deactivate test user
      await db.update(users).set({ isActive: false }).where(eq(users.id, testUser.id));

      const res = await request(app)
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(res.status).toBe(403);

      // Restore user
      await db.update(users).set({ isActive: true }).where(eq(users.id, testUser.id));
    });
  });

  describe('Real-World Scenarios', () => {
    it('handles browser client workflow (login + CSRF + request)', async () => {
      const agent = request.agent(app);

      // 1. Login
      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(loginRes.status).toBe(200);
      const csrfToken = loginRes.headers['x-csrf-token'];

      // 2. Read data (no CSRF needed)
      const getRes = await agent.get('/api/data');
      expect(getRes.status).toBe(200);

      // 3. Mutate data (CSRF needed)
      const postRes = await agent
        .post('/api/data')
        .set('X-CSRF-Token', csrfToken)
        .send({ action: 'create' });

      expect(postRes.status).toBe(200);
    });

    it('handles API client workflow (Basic Auth only)', async () => {
      // 1. Read data
      const getRes = await request(app)
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(getRes.status).toBe(200);

      // 2. Mutate data (no CSRF needed for Basic Auth)
      const postRes = await request(app)
        .post('/api/data')
        .auth(testUser.username, testUser.password)
        .send({ action: 'create' });

      expect(postRes.status).toBe(200);
    });

    it('handles agent switching between auth methods', async () => {
      const agent = request.agent(app);

      // 1. Use Basic Auth
      const basicRes = await agent
        .get('/api/data')
        .auth(testUser.username, testUser.password);

      expect(basicRes.body.data.authMethod).toBe('basic');

      // 2. Login to create session
      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      const csrfToken = loginRes.headers['x-csrf-token'];

      // 3. Use session (no Basic Auth header)
      const sessionRes = await agent.get('/api/data');
      expect(sessionRes.body.data.authMethod).toBe('session');

      // 4. POST with session requires CSRF
      const postRes = await agent
        .post('/api/data')
        .set('X-CSRF-Token', csrfToken)
        .send({ test: 'data' });

      expect(postRes.status).toBe(200);
    });
  });
});
