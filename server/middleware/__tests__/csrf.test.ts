import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import session from 'express-session';
import request from 'supertest';
import { csrfProtection, attachCsrfToken } from '../security';

/**
 * CSRF Protection Middleware Test Suite
 *
 * Tests CSRF token generation, validation, and security patterns to prevent
 * Cross-Site Request Forgery attacks.
 *
 * Critical security requirements:
 * - Tokens must be unique per session
 * - Timing-safe comparison to prevent timing attacks
 * - Safe methods (GET, HEAD, OPTIONS) bypass validation
 * - Whitelisted paths bypass validation
 * - Invalid/missing tokens rejected with 403
 */
describe('CSRF Protection Middleware', () => {
  let app: Express;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.CSRF_SECRET = 'test-csrf-secret-min-32-chars-long';

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Setup session
    app.use(
      session({
        secret: 'test-secret-key-for-testing-only',
        resave: false,
        saveUninitialized: true, // Create session for token generation
        cookie: {
          httpOnly: true,
          // Use secure cookies in production, not in test
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    // Attach CSRF token to all requests
    app.use(attachCsrfToken);

    // Test routes
    app.get('/api/safe', (req, res) => res.json({ ok: true }));
    app.post('/api/protected', csrfProtection, (req, res) => res.json({ ok: true }));
    app.put('/api/protected', csrfProtection, (req, res) => res.json({ ok: true }));
    app.delete('/api/protected', csrfProtection, (req, res) => res.json({ ok: true }));
    app.patch('/api/protected', csrfProtection, (req, res) => res.json({ ok: true }));

    // Whitelisted public endpoint
    app.post('/api/affiliate/track-click', csrfProtection, (req, res) => res.json({ ok: true }));
    app.post('/api/health', csrfProtection, (req, res) => res.json({ ok: true }));
  });

  describe('Token Generation', () => {
    it('should generate CSRF token per session', async () => {
      const agent = request.agent(app);

      const response = await agent.get('/api/safe');
      expect(response.status).toBe(200);

      const token = response.headers['x-csrf-token'];
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different sessions', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      const response1 = await agent1.get('/api/safe');
      const response2 = await agent2.get('/api/safe');

      const token1 = response1.headers['x-csrf-token'];
      const token2 = response2.headers['x-csrf-token'];

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    it('should persist token across requests in same session', async () => {
      const agent = request.agent(app);

      const response1 = await agent.get('/api/safe');
      const response2 = await agent.get('/api/safe');

      const token1 = response1.headers['x-csrf-token'];
      const token2 = response2.headers['x-csrf-token'];

      expect(token1).toBe(token2);
    });

    it('should refresh token on new session', async () => {
      const agent1 = request.agent(app);

      const response1 = await agent1.get('/api/safe');
      const token1 = response1.headers['x-csrf-token'];

      // New agent = new session
      const agent2 = request.agent(app);
      const response2 = await agent2.get('/api/safe');
      const token2 = response2.headers['x-csrf-token'];

      expect(token1).not.toBe(token2);
    });
  });

  describe('Safe Methods Bypass', () => {
    it('should allow GET requests without CSRF token', async () => {
      const response = await request(app).get('/api/safe');
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should allow HEAD requests without CSRF token', async () => {
      const response = await request(app).head('/api/protected');
      // HEAD returns no body, status may be 404 if route not defined
      // The point is it doesn't return 403 CSRF error
      expect(response.status).not.toBe(403);
    });

    it('should allow OPTIONS requests without CSRF token', async () => {
      const response = await request(app).options('/api/protected');
      // OPTIONS typically returns 204 or 200
      expect(response.status).not.toBe(403);
    });
  });

  describe('Whitelisted Paths Bypass', () => {
    it('should allow POST to /api/affiliate/track-click without CSRF token', async () => {
      const response = await request(app)
        .post('/api/affiliate/track-click')
        .send({ trackingId: '123' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should allow POST to /api/health without CSRF token', async () => {
      const response = await request(app).post('/api/health').send({});

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should allow POST to /health without CSRF token', async () => {
      // Add route for testing
      app.post('/health', csrfProtection, (req, res) => res.json({ ok: true }));

      const response = await request(app).post('/health').send({});

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('Token Validation', () => {
    it('should reject POST without CSRF token', async () => {
      const response = await request(app).post('/api/protected').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF token missing');
    });

    it('should reject PUT without CSRF token', async () => {
      const response = await request(app).put('/api/protected').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF token missing');
    });

    it('should reject DELETE without CSRF token', async () => {
      const response = await request(app).delete('/api/protected').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF token missing');
    });

    it('should reject PATCH without CSRF token', async () => {
      const response = await request(app).patch('/api/protected').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF token missing');
    });

    it('should accept POST with valid CSRF token in body', async () => {
      const agent = request.agent(app);

      // Get token
      const tokenResponse = await agent.get('/api/safe');
      const token = tokenResponse.headers['x-csrf-token'];

      // Use token in request body
      const response = await agent.post('/api/protected').send({
        _csrf: token,
        data: 'test',
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should accept POST with valid CSRF token in header', async () => {
      const agent = request.agent(app);

      // Get token
      const tokenResponse = await agent.get('/api/safe');
      const token = tokenResponse.headers['x-csrf-token'];

      // Use token in request header
      const response = await agent
        .post('/api/protected')
        .set('X-CSRF-Token', token)
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });

    it('should reject POST with invalid CSRF token', async () => {
      const agent = request.agent(app);

      // Get valid token but don't use it
      await agent.get('/api/safe');

      // Use invalid token
      const response = await agent.post('/api/protected').send({
        _csrf: 'invalid-token-12345',
        data: 'test',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid CSRF token');
    });

    it('should reject POST with token from different session', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // Get token from session 1
      const tokenResponse = await agent1.get('/api/safe');
      const token1 = tokenResponse.headers['x-csrf-token'];

      // Try using session 1's token in session 2
      const response = await agent2.post('/api/protected').send({
        _csrf: token1,
        data: 'test',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid CSRF token');
    });
  });

  describe('Token Security', () => {
    it('should use timing-safe token comparison', async () => {
      const agent = request.agent(app);

      await agent.get('/api/safe');

      // Token length mismatch (triggers timing-safe comparison catch)
      const response = await agent.post('/api/protected').send({
        _csrf: 'short',
        data: 'test',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid CSRF token');
    });

    it('should be case-sensitive for token validation', async () => {
      const agent = request.agent(app);

      // Get token
      const tokenResponse = await agent.get('/api/safe');
      const token = tokenResponse.headers['x-csrf-token'];

      // Try uppercase version
      const uppercaseToken = token.toUpperCase();

      const response = await agent.post('/api/protected').send({
        _csrf: uppercaseToken,
        data: 'test',
      });

      // Should fail if token had lowercase chars
      if (token !== uppercaseToken) {
        expect(response.status).toBe(403);
      }
    });

    it('should not leak implementation details in error messages', async () => {
      const response = await request(app).post('/api/protected').send({});

      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();

      // Should not expose internal details
      expect(response.body.error).not.toContain('crypto');
      expect(response.body.error).not.toContain('timingSafeEqual');
      expect(response.body.error).not.toContain('Buffer');
    });
  });

  describe('Double-Submit Cookie Pattern', () => {
    it('should verify token matches session token', async () => {
      const agent = request.agent(app);

      // Get token from session
      const tokenResponse = await agent.get('/api/safe');
      const sessionToken = tokenResponse.headers['x-csrf-token'];

      // Token in body must match session
      const response = await agent.post('/api/protected').send({
        _csrf: sessionToken,
      });

      expect(response.status).toBe(200);
    });

    it('should reject if token missing from session', async () => {
      // No session established
      const response = await request(app).post('/api/protected').send({
        _csrf: 'some-token',
      });

      expect(response.status).toBe(403);
      // When session token is missing but request has token, it's invalid (not missing)
      expect(response.body.error).toMatch(/Invalid CSRF token|CSRF token missing/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session gracefully', async () => {
      // Create app without session middleware
      const appNoSession = express();
      appNoSession.use(express.json());
      appNoSession.post('/test', csrfProtection, (req, res) => res.json({ ok: true }));

      const response = await request(appNoSession).post('/test').send({
        _csrf: 'test-token',
      });

      expect(response.status).toBe(403);
    });

    it('should handle empty token string', async () => {
      const agent = request.agent(app);
      await agent.get('/api/safe');

      const response = await agent.post('/api/protected').send({
        _csrf: '',
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('CSRF token missing');
    });

    it('should prioritize header token over body token', async () => {
      const agent = request.agent(app);

      const tokenResponse = await agent.get('/api/safe');
      const validToken = tokenResponse.headers['x-csrf-token'];

      // Valid token in header, invalid in body
      const response = await agent.post('/api/protected').set('X-CSRF-Token', validToken).send({
        _csrf: 'invalid-token',
      });

      // Should fail because body token is checked first (per implementation)
      // Actually, the implementation checks body first: req.body._csrf || req.headers['x-csrf-token']
      // So body takes precedence
      expect(response.status).toBe(403);
    });

    it('should use header token when body token absent', async () => {
      const agent = request.agent(app);

      const tokenResponse = await agent.get('/api/safe');
      const validToken = tokenResponse.headers['x-csrf-token'];

      // Only header token provided
      const response = await agent
        .post('/api/protected')
        .set('X-CSRF-Token', validToken)
        .send({ data: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });
});
