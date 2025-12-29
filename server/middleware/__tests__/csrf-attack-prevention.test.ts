/**
 * CSRF Attack Prevention Tests
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VULNERABILITY BEING TESTED: CSRF Bypass via basicAuth Fallthrough
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * OLD SYSTEM (VULNERABLE):
 * ------------------------
 * Problem: basicAuth middleware would silently call next() if Authorization header missing
 *
 * Attack Flow:
 * 1. Victim logs in via browser → session cookie created (connect.sid)
 * 2. Attacker crafts malicious request to /api/v1/* endpoint from attacker.com
 * 3. Request includes victim's session cookie (browser auto-sends), but NO Authorization header
 * 4. basicAuth middleware sees no header → calls next() (FALLTHROUGH)
 * 5. Request silently uses victim's session auth WITHOUT CSRF protection
 * 6. Mutation succeeds (creates/updates/deletes data as victim)
 * 7. ❌ ATTACK SUCCEEDS - CSRF bypass!
 *
 * Why it was vulnerable:
 * - basicAuth had implicit fallthrough behavior (no explicit flag)
 * - Session requests with no CSRF token were not blocked
 * - No way to distinguish "Basic Auth failed" from "no Basic Auth header"
 * - CSRF protection couldn't tell which auth method was used
 *
 * NEW SYSTEM (FIXED):
 * -------------------
 * Solution: flexibleAuth explicitly marks authentication method via req.isBasicAuth flag
 *
 * Fixed Flow:
 * 1. Victim logs in via browser → session cookie created
 * 2. Attacker crafts malicious request (no Authorization header)
 * 3. flexibleAuth detects session auth (req.isAuthenticated() true, no Basic Auth header)
 * 4. Sets req.isBasicAuth = false (EXPLICIT MARKER)
 * 5. csrfProtection middleware checks flag → req.isBasicAuth !== true
 * 6. Requires CSRF token for session requests
 * 7. No CSRF token in attacker's request → 403 Forbidden
 * 8. ✅ ATTACK BLOCKED!
 *
 * Why it's secure now:
 * - flexibleAuth sets explicit flag for BOTH auth methods
 * - Session requests (isBasicAuth=false) ALWAYS require CSRF token
 * - Basic Auth requests (isBasicAuth=true) are exempt (stateless, CSRF-safe)
 * - No more silent fallthrough to unprotected session auth
 * - csrfProtection can reliably check which auth method was used
 *
 * Test Coverage:
 * - Attack scenarios (session + no CSRF → blocked)
 * - Legitimate flows (session + valid CSRF → allowed, Basic Auth → allowed)
 * - Token validation (invalid/reused/cross-session tokens → blocked)
 * - Cross-origin attacks (CSRF from attacker.com → blocked)
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

describe('CSRF Attack Prevention (Security Tests)', () => {
  let app: Express;
  let testUser: {
    id: number;
    username: string;
    email: string;
    password: string;
  };

  beforeAll(async () => {
    // Create test user (potential victim)
    const password = 'VictimPassword123!'; // Test fixture password
    const passwordHash = await hashPassword(password); // SECURITY: Test data only
    const email = 'csrf-victim@example.com';

    const [user] = await db
      .insert(users)
      .values({
        username: 'csrfvictim',
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

    // Session middleware (victim's browser has session)
    app.use(
      session({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false },
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    // Login endpoint
    app.post('/auth/login', (req: Request, res: Response) => {
      const { email, password } = req.body;

      if (email === testUser.email && password === testUser.password) {
        req.login({ id: testUser.id, username: testUser.username, email: testUser.email } as Express.User, (err) => {
          if (err) {
            return sendError(res, 'Login failed', 500);
          }

          const csrfToken = generateCsrfToken(req);
          res.setHeader('X-CSRF-Token', csrfToken);
          sendSuccess(res, { message: 'Logged in' });
        });
      } else {
        sendError(res, 'Invalid credentials', 401);
      }
    });

    // Logout endpoint
    app.post('/auth/logout', (req: Request, res: Response) => {
      req.logout((err) => {
        if (err) {
          return sendError(res, 'Logout failed', 500);
        }
        sendSuccess(res, { message: 'Logged out' });
      });
    });

    // Vulnerable endpoint: Mutates data (requires CSRF protection)
    app.post(
      '/api/sensitive-action',
      flexibleAuth,
      csrfProtection,
      withAuth((req, res) => {
        // This simulates a sensitive operation (e.g., delete account, transfer money)
        sendSuccess(res, {
          message: 'Sensitive action completed',
          userId: req.user.id,
          action: req.body.action,
        });
      })
    );

    // Another endpoint: DELETE operation
    app.delete(
      '/api/user/account',
      flexibleAuth,
      csrfProtection,
      withAuth((req, res) => {
        sendSuccess(res, { message: 'Account deleted', userId: req.user.id });
      })
    );
  });

  describe('Attack Scenario 1: Session-Based CSRF (Should be BLOCKED)', () => {
    it('blocks CSRF attack via session without CSRF token', async () => {
      const agent = request.agent(app);

      // Step 1: Victim logs in (creates session)
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Step 2: Attacker crafts malicious request
      // Attacker's website makes a request using victim's session cookie
      // (agent maintains session cookie automatically)
      const attackRes = await agent
        .post('/api/sensitive-action')
        .send({ action: 'delete_account' });
      // ⚠️ Note: No Authorization header, No CSRF token

      // Verify: Attack should be BLOCKED
      expect(attackRes.status).toBe(403);
      expect(attackRes.body.success).toBe(false);
      expect(attackRes.body.error).toContain('CSRF');
    });

    it('blocks DELETE request via session without CSRF token', async () => {
      const agent = request.agent(app);

      // Victim logs in
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Attacker attempts DELETE via CSRF
      const attackRes = await agent.delete('/api/user/account');

      // Should be blocked
      expect(attackRes.status).toBe(403);
      expect(attackRes.body.error).toContain('CSRF');
    });

    it('allows legitimate request with valid CSRF token', async () => {
      const agent = request.agent(app);

      // Victim logs in
      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const csrfToken = loginRes.headers['x-csrf-token'];

      // Legitimate request with CSRF token
      const res = await agent
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', csrfToken)
        .send({ action: 'legitimate_action' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Attack Scenario 2: Invalid CSRF Token (Should be BLOCKED)', () => {
    it('blocks request with wrong CSRF token', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Attempt with wrong token
      const attackRes = await agent
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', 'attacker-forged-token')
        .send({ action: 'malicious_action' });

      expect(attackRes.status).toBe(403);
      expect(attackRes.body.error).toContain('CSRF');
    });

    it('blocks request with expired/reused CSRF token from different session', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // Agent 1 logs in
      const loginRes1 = await agent1.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      const csrfToken1 = loginRes1.headers['x-csrf-token'];

      // Agent 2 logs in (different session)
      await agent2.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Agent 2 tries to use Agent 1's CSRF token (should fail)
      const attackRes = await agent2
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', csrfToken1) // Wrong session
        .send({ action: 'steal_token_attack' });

      expect(attackRes.status).toBe(403);
    });
  });

  describe('Attack Scenario 3: Basic Auth Bypass Attempt (Should be BLOCKED)', () => {
    it('blocks attempt to bypass CSRF by omitting Authorization header', async () => {
      const agent = request.agent(app);

      // Victim has session
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Attacker tries to make request without Authorization header
      // expecting it to fall through to session (OLD VULNERABILITY)
      const attackRes = await agent
        .post('/api/sensitive-action')
        .send({ action: 'csrf_bypass_attempt' });
      // No Authorization header, No CSRF token

      // NEW SYSTEM: flexibleAuth detects session → requires CSRF → blocks
      expect(attackRes.status).toBe(403);
      expect(attackRes.body.error).toContain('CSRF');
    });

    it('blocks request with malformed Basic Auth header and session', async () => {
      const agent = request.agent(app);

      // Victim has session
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Attacker sends malformed Authorization header (not "Basic ")
      const attackRes = await agent
        .post('/api/sensitive-action')
        .set('Authorization', 'Bearer some-token') // Not Basic Auth
        .send({ action: 'malformed_auth_attack' });

      // Should fall back to session auth → require CSRF → block
      expect(attackRes.status).toBe(403);
      expect(attackRes.body.error).toContain('CSRF');
    });
  });

  describe('Attack Scenario 4: Cross-Origin CSRF (Should be BLOCKED)', () => {
    it('blocks CSRF from different origin', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Simulate cross-origin request (attacker's site)
      const attackRes = await agent
        .post('/api/sensitive-action')
        .set('Origin', 'https://attacker.com')
        .send({ action: 'cross_origin_attack' });

      // Should be blocked (no CSRF token)
      expect(attackRes.status).toBe(403);
    });
  });

  describe('Legitimate Use Cases (Should be ALLOWED)', () => {
    it('allows Basic Auth request without CSRF token', async () => {
      // Legitimate API client using Basic Auth
      const res = await request(app)
        .post('/api/sensitive-action')
        .auth(testUser.username, testUser.password)
        .send({ action: 'legitimate_api_call' });

      // Basic Auth is stateless → CSRF exempt → allowed
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows session request with valid CSRF token', async () => {
      const agent = request.agent(app);

      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const csrfToken = loginRes.headers['x-csrf-token'];

      const res = await agent
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', csrfToken)
        .send({ action: 'legitimate_session_call' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows GET request with session (safe method, no CSRF needed)', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Add GET endpoint for testing
      app.get(
        '/api/data',
        flexibleAuth,
        withAuth((req, res) => {
          sendSuccess(res, { userId: req.user.id });
        })
      );

      const res = await agent.get('/api/data');

      // GET is safe method → no CSRF required
      expect(res.status).toBe(200);
    });
  });

  describe('Edge Cases', () => {
    it('handles CSRF token in request body instead of header', async () => {
      const agent = request.agent(app);

      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const csrfToken = loginRes.headers['x-csrf-token'];

      // Send CSRF token in body (alternative to header)
      const res = await agent.post('/api/sensitive-action').send({
        _csrf: csrfToken,
        action: 'csrf_in_body',
      });

      expect(res.status).toBe(200);
    });

    it('rejects empty CSRF token', async () => {
      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const res = await agent
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', '') // Empty token
        .send({ action: 'empty_token_attack' });

      expect(res.status).toBe(403);
    });

    it('handles logout and subsequent CSRF attack', async () => {
      const agent = request.agent(app);

      // Login
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // Simulate logout (destroy session)
      await agent.post('/auth/logout');

      // Attempt CSRF after logout (session destroyed)
      const res = await agent.post('/api/sensitive-action').send({
        action: 'post_logout_attack',
      });

      // Should be rejected (no valid session)
      expect(res.status).toBe(401);
    });
  });

  describe('Security Audit: Verify All Safeguards', () => {
    it('verifies auth method detection works correctly', async () => {
      // Instead of checking implementation details (isBasicAuth flag),
      // verify that CSRF behavior differs correctly between auth methods

      const agent = request.agent(app);

      // Test 1: Basic Auth should bypass CSRF protection
      const basicAuthRes = await request(app)
        .post('/api/sensitive-action')
        .auth(testUser.username, testUser.password)
        .send({ action: 'test' });

      expect(basicAuthRes.status).toBe(200); // ✅ No CSRF required

      // Test 2: Session auth should require CSRF protection
      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const sessionWithoutCsrfRes = await agent
        .post('/api/sensitive-action')
        .send({ action: 'test' });

      expect(sessionWithoutCsrfRes.status).toBe(403); // ❌ CSRF required
      expect(sessionWithoutCsrfRes.body.error).toContain('CSRF');

      // Test 3: Session with CSRF should succeed
      const loginRes = await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      const csrfToken = loginRes.headers['x-csrf-token'];

      const sessionWithCsrfRes = await agent
        .post('/api/sensitive-action')
        .set('X-CSRF-Token', csrfToken)
        .send({ action: 'test' });

      expect(sessionWithCsrfRes.status).toBe(200); // ✅ CSRF validated
    });

    it('verifies CSRF protection runs after flexibleAuth', async () => {
      // Ensure middleware order is correct
      // flexibleAuth MUST run before csrfProtection to set isBasicAuth flag

      const agent = request.agent(app);

      await agent.post('/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      // CSRF should see the isBasicAuth=false flag set by flexibleAuth
      const res = await agent.post('/api/sensitive-action').send({
        action: 'order_test',
      });

      // If order is wrong, CSRF won't check flag → attack succeeds
      // Correct order: flexibleAuth → csrfProtection → attack blocked
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('CSRF');
    });
  });
});
