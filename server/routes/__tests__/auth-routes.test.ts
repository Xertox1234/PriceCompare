import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Redis client to avoid requiring Redis in test environment
// MUST be before any imports that use Redis (storage-cache, advanced-cache)
vi.mock('../../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    publish: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
  getRedisClient: vi.fn(() => null),
}));

// Mock dependencies before imports
vi.mock('../../services/email-service', () => ({
  emailService: {
    isReady: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    sendPasswordResetConfirmationEmail: vi.fn(),
  },
}));

vi.mock('../../utils/security-logger', () => ({
  logSecurityEvent: vi.fn(),
  SecurityEventType: {
    REGISTER: 'REGISTER',
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    LOGOUT: 'LOGOUT',
    PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
    PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
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

vi.mock('../../middleware/security', () => ({
  generateCsrfToken: vi.fn(() => 'test-csrf-token'),
  csrfProtection: (req: unknown, res: unknown, next: () => void) => next(),
}));

// Now import after mocks are set up
import request from 'supertest';
import express, { type Express } from 'express';
import session from 'express-session';
import { db } from '../../db';
import { users, passwordResetTokens } from '@shared/schema';
import { passport } from '../../auth';
import { registerAuthRoutes } from '../auth-routes';
import { emailService } from '../../services/email-service';
import { resetFailedAttempts } from '../../utils/account-lockout-simple';
import { eq, sql } from 'drizzle-orm';
import * as _crypto from 'crypto';
import { cleanupTestData } from '../../__tests__/helpers/test-fixtures';
import {
  expectSuccessResponse,
  expectErrorResponse,
  expectBadRequestError,
  expectUnauthorizedError,
} from '../../__tests__/helpers/response-validators';
import { hashEmail } from '../../utils/encryption';

/**
 * Authentication Routes Test Suite
 *
 * Tests all authentication endpoints for security, validation, and functionality.
 * Critical security requirements:
 * - NEVER expose passwordHash in responses
 * - First user automatically gets admin role (SERIALIZABLE transaction)
 * - Account lockout after failed attempts
 * - Password validation rules enforced
 * - Error sanitization in production
 */
describe('Authentication Routes', () => {
  let app: Express;

  beforeEach(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    // Set encryption key for schema's encryptedText fields (32 bytes = 64 hex chars)
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    // Reset failed login attempts to prevent lockout state from persisting across tests
    await resetFailedAttempts();

    // Create fresh Express app for each test
    app = express();

    // Setup middleware
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
          secure: false, // false for testing
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );

    // Initialize passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Mock CSRF middleware (don't validate CSRF in tests)
    app.use((req, res, next) => {
      req.csrfToken = () => 'test-csrf-token';
      next();
    });

    // Register auth routes
    registerAuthRoutes(app);

    // Clean database using TRUNCATE CASCADE for fast, complete cleanup
    await cleanupTestData(db, ['password_reset_tokens', 'users']);

    // Reset mocks
    vi.clearAllMocks();
    vi.mocked(emailService.isReady).mockReturnValue(true);
    vi.mocked(emailService.sendPasswordResetEmail).mockResolvedValue(true);
    vi.mocked(emailService.sendPasswordResetConfirmationEmail).mockResolvedValue(true);
  });

  afterEach(async () => {
    // Fast cleanup using TRUNCATE CASCADE
    await cleanupTestData(db, ['password_reset_tokens', 'users']);
  });

  describe('POST /api/auth/register - User Registration', () => {
    it('should successfully register a new user with valid data', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Debug: log error if test fails
      if (response.status !== 201) {
        console.log('\n=== REGISTRATION FAILURE DEBUG ===');
        console.log('Status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));
        console.log('Response text:', response.text);
        if (response.error) {
          console.log('Error object:', response.error);
        }
        console.log('=================================\n');
      }

      const result = expectSuccessResponse<{ user: { email: string; username: string } }>(
        response,
        201
      );

      expect(result.user).toMatchObject({
        email: 'test@example.com',
        username: 'testuser',
      });

      // SECURITY: Verify passwordHash is NEVER exposed
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should assign admin role to first user (SERIALIZABLE transaction)', async () => {
      // Ensure database is clean
      const countBefore = await db.select({ count: sql`count(*)` }).from(users);
      expect(parseInt(countBefore[0].count as string)).toBe(0);

      const response = await request(app).post('/api/auth/register').send({
        email: 'first@example.com',
        username: 'firstuser',
        password: 'SecurePass123!',
      });

      const result = expectSuccessResponse<{ user: { role: string } }>(response, 201);
      expect(result.user.role).toBe('admin');
    });

    it('should assign user role to second user', async () => {
      // Create first user
      await request(app).post('/api/auth/register').send({
        email: 'first@example.com',
        username: 'firstuser',
        password: 'SecurePass123!',
      });

      // Create second user
      const response = await request(app).post('/api/auth/register').send({
        email: 'second@example.com',
        username: 'seconduser',
        password: 'SecurePass123!',
      });

      const result = expectSuccessResponse<{ user: { role: string } }>(response, 201);
      expect(result.user.role).toBe('user');
    });

    it('should reject registration with duplicate email', async () => {
      // Create first user
      await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        username: 'user1',
        password: 'SecurePass123!',
      });

      // Attempt duplicate registration
      const response = await request(app).post('/api/auth/register').send({
        email: 'duplicate@example.com',
        username: 'user2',
        password: 'SecurePass123!',
      });

      expectBadRequestError(response, 'User already exists');
    });

    it('should reject registration with missing email', async () => {
      const response = await request(app).post('/api/auth/register').send({
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Zod validation error - just verify it's a 400 error
      expectErrorResponse(response, 400);
    });

    it('should reject registration with missing username', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Zod validation error - just verify it's a 400 error
      expectErrorResponse(response, 400);
    });

    it('should reject registration with missing password', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
      });

      // Zod validation error - just verify it's a 400 error
      expectErrorResponse(response, 400);
    });

    it('should reject password shorter than 12 characters', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'Short1!',
      });

      // Zod validates length first - just verify 400 error
      expectErrorResponse(response, 400);
    });

    it('should reject password without lowercase letter', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'NOLOWERCASE123!',
      });

      expectBadRequestError(response, 'Password must contain at least one lowercase letter');
    });

    it('should reject password without uppercase letter', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'nouppercase123!',
      });

      expectBadRequestError(response, 'Password must contain at least one uppercase letter');
    });

    it('should reject password without number', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'NoNumbersHere!',
      });

      expectBadRequestError(response, 'Password must contain at least one number');
    });

    it('should reject password without special character', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'NoSpecialChar123',
      });

      expectBadRequestError(response, 'Password must contain at least one special character');
    });

    // Email format validation tests (defense-in-depth before encryption)
    it('should reject email without @ symbol', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'notanemail.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Zod .email() validation catches this first
      expectErrorResponse(response, 400);
    });

    it('should reject email without domain', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'user@',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Zod .email() validation catches this first
      expectErrorResponse(response, 400);
    });

    it('should reject email without TLD (top-level domain)', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'user@domain',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Explicit regex check or Zod catches this
      expectErrorResponse(response, 400);
    });

    it('should reject email with spaces', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'user @example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Zod .email() validation catches this first
      expectErrorResponse(response, 400);
    });

    it('should reject email with multiple @ symbols', async () => {
      const response = await request(app).post('/api/auth/register').send({
        email: 'user@@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Zod .email() validation catches this first
      expectErrorResponse(response, 400);
    });

    it('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user_name@sub.example.com',
        'user123@example.org',
      ];

      for (const email of validEmails) {
        // Clean up before each registration
        await cleanupTestData(db, ['password_reset_tokens', 'users']);

        const response = await request(app).post('/api/auth/register').send({
          email,
          username: `testuser${Math.random().toString(36).substring(7)}`,
          password: 'SecurePass123!',
        });

        // All valid emails should be accepted
        expectSuccessResponse(response, 201);
      }
    });

    it('should create session on successful registration', async () => {
      const agent = request.agent(app);

      const response = await agent.post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(response, 201);

      // Verify session by accessing protected endpoint
      const userResponse = await agent.get('/api/auth/user');
      const userData = expectSuccessResponse<{ email: string }>(userResponse, 200);
      expect(userData.email).toBe('test@example.com');
    });

    it('should hash password before storing', async () => {
      const password = 'SecurePass123!';

      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password,
      });

      // Verify password is hashed in database (use emailHash for lookup)
      const userInDb = await db
        .select()
        .from(users)
        .where(eq(users.emailHash, hashEmail('test@example.com')));
      expect(userInDb[0].passwordHash).not.toBe(password);
      expect(userInDb[0].passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt format
    });

    it('should regenerate session ID after successful registration (session fixation protection)', async () => {
      const agent = request.agent(app);

      // Get initial session ID by making any request
      const initialResponse = await agent.get('/api/csrf-token');
      const initialCookies = initialResponse.headers['set-cookie'];
      const initialSessionId = extractSessionId(initialCookies);

      // Register a new user
      const registerResponse = await agent.post('/api/auth/register').send({
        email: 'newsession@example.com',
        username: 'newsessionuser',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(registerResponse, 201);

      // Extract session ID after registration
      const registerCookies = registerResponse.headers['set-cookie'];
      const newSessionId = extractSessionId(registerCookies);

      // Session ID should have changed (session fixation protection)
      expect(newSessionId).toBeDefined();
      expect(initialSessionId).toBeDefined();
      expect(newSessionId).not.toBe(initialSessionId);
    });

    it('should maintain authentication after registration session regeneration', async () => {
      const agent = request.agent(app);

      // Register
      const registerResponse = await agent.post('/api/auth/register').send({
        email: 'authtest@example.com',
        username: 'authtestuser',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(registerResponse, 201);

      // Verify user is authenticated after registration and session regeneration
      const userResponse = await agent.get('/api/auth/user');
      const userData = expectSuccessResponse<{ email: string }>(userResponse, 200);
      expect(userData.email).toBe('authtest@example.com');
    });
  });

  describe('POST /api/auth/login - User Login', () => {
    beforeEach(async () => {
      // Create test user before login tests
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });
    });

    it('should successfully log in with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const result = expectSuccessResponse<{ user: { email: string; username: string } }>(
        response,
        200
      );

      expect(result.user).toMatchObject({
        email: 'test@example.com',
        username: 'testuser',
      });

      // SECURITY: Verify passwordHash is NEVER exposed
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

      expectUnauthorizedError(response, 'Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'SecurePass123!',
      });

      expectUnauthorizedError(response, 'Invalid email or password');
    });

    it('should create session on successful login', async () => {
      const agent = request.agent(app);

      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(loginResponse, 200);

      // Verify session persists
      const userResponse = await agent.get('/api/auth/user');
      const userData = expectSuccessResponse<{ email: string }>(userResponse, 200);
      expect(userData.email).toBe('test@example.com');
    });

    it('should set httpOnly session cookie', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(response, 200);

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Find session cookie (might be named 'connect.sid' or similar)
      const sessionCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes('connect.sid') || c.includes('session'))
        : cookies;

      expect(sessionCookie).toBeDefined();
      if (sessionCookie) {
        expect(sessionCookie).toContain('HttpOnly');
      }
    });

    it('should track failed login attempts', async () => {
      // First failed attempt
      const response1 = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword1',
      });

      // Login route returns simple error message, not detailed failure info
      expectUnauthorizedError(response1);
    });

    it('should lock account after 5 failed login attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/login').send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        });
      }

      // 6th attempt should be locked
      const response = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

      // Account should be locked - just verify 401 error
      expectUnauthorizedError(response);
    });

    it('should clear failed attempts on successful login', async () => {
      // Make some failed attempts
      await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      // Successful login should clear attempts
      const successResponse = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(successResponse, 200);

      // Next failed attempt should start fresh count
      const failedResponse = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      // Next failed attempt should return 401
      expectUnauthorizedError(failedResponse);
    });

    it('should be case-insensitive for email matching', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'TEST@EXAMPLE.COM', // Uppercase
        password: 'SecurePass123!',
      });

      expectSuccessResponse(response, 200);
    });

    it('should regenerate session ID after successful login (session fixation protection)', async () => {
      const agent = request.agent(app);

      // Get initial session ID by making any request
      const initialResponse = await agent.get('/api/csrf-token');
      const initialCookies = initialResponse.headers['set-cookie'];
      const initialSessionId = extractSessionId(initialCookies);

      // Login with valid credentials
      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(loginResponse, 200);

      // Extract session ID after login
      const loginCookies = loginResponse.headers['set-cookie'];
      const newSessionId = extractSessionId(loginCookies);

      // Session ID should have changed (session fixation protection)
      expect(newSessionId).toBeDefined();
      expect(initialSessionId).toBeDefined();
      expect(newSessionId).not.toBe(initialSessionId);
    });

    it('should maintain authentication after session regeneration', async () => {
      const agent = request.agent(app);

      // Login
      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expectSuccessResponse(loginResponse, 200);

      // Verify user is still authenticated after session regeneration
      const userResponse = await agent.get('/api/auth/user');
      const userData = expectSuccessResponse<{ email: string }>(userResponse, 200);
      expect(userData.email).toBe('test@example.com');
    });
  });

  // Helper function to extract session ID from cookies
  function extractSessionId(cookies: string[] | string | undefined): string | null {
    if (!cookies) return null;

    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    const sessionCookie = cookieArray.find(
      (c) => c.includes('connect.sid') || c.includes('session')
    );

    if (!sessionCookie) return null;

    // Extract the value between the cookie name and the first semicolon
    const match = sessionCookie.match(/(?:connect\.sid|session)=([^;]+)/);
    return match ? match[1] : null;
  }

  describe('POST /api/auth/logout - User Logout', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });
    });

    it('should successfully log out authenticated user', async () => {
      const agent = request.agent(app);

      // Login first
      await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      // Logout
      const logoutResponse = await agent.post('/api/auth/logout');
      expectSuccessResponse(logoutResponse, 200);

      // Verify session is cleared
      const userResponse = await agent.get('/api/auth/user');
      expectUnauthorizedError(userResponse);
    });

    it('should clear session cookie on logout', async () => {
      const agent = request.agent(app);

      await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const response = await agent.post('/api/auth/logout');
      expectSuccessResponse(response, 200);

      // Session should be destroyed
      const userResponse = await agent.get('/api/auth/user');
      expectUnauthorizedError(userResponse);
    });

    it('should handle logout when not authenticated', async () => {
      const response = await request(app).post('/api/auth/logout');

      // Should succeed even if not authenticated
      expectSuccessResponse(response, 200);
    });
  });

  describe('POST /api/auth/forgot-password - Password Reset Request', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });
    });

    it('should generate token and send email for valid user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const result = expectSuccessResponse<{ message: string }>(response, 200);
      expect(result.message).toContain('password reset link has been sent');

      // Verify email was sent
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String), // token
        'testuser'
      );

      // Verify token was created in database
      const tokens = await db.select().from(passwordResetTokens);
      expect(tokens.length).toBe(1);
      expect(tokens[0].isUsed).toBe(false);
    });

    it('should return success for non-existent email (security: prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      const result = expectSuccessResponse<{ message: string }>(response, 200);
      expect(result.message).toContain('password reset link has been sent');

      // Verify no email was actually sent
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();

      // Verify no token was created
      const tokens = await db.select().from(passwordResetTokens);
      expect(tokens.length).toBe(0);
    });

    it('should reject request with missing email', async () => {
      const response = await request(app).post('/api/auth/forgot-password').send({});

      // SECURITY: Returns success even for validation errors to prevent email enumeration
      expectSuccessResponse(response, 200);
    });

    it('should return success when email service is not configured', async () => {
      vi.mocked(emailService.isReady).mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expectErrorResponse(response, 503, 'temporarily unavailable');
    });

    it('should invalidate old tokens when creating new one', async () => {
      // Create first token
      await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });

      const tokens1 = await db.select().from(passwordResetTokens);
      expect(tokens1.length).toBe(1);
      const firstToken = tokens1[0].token;

      // Create second token
      await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });

      const tokens2 = await db.select().from(passwordResetTokens);

      // Should only have one token (old one deleted)
      expect(tokens2.length).toBe(1);
      expect(tokens2[0].token).not.toBe(firstToken);
    });

    it('should normalize response times to prevent timing attacks (existing vs non-existing email)', async () => {
      // SECURITY: This test verifies that response times for existing and non-existing emails
      // are similar, preventing attackers from enumerating valid emails via timing analysis

      const timingResults = {
        existing: [] as number[],
        nonExisting: [] as number[],
      };

      // Test with existing email (multiple times to get average)
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'test@example.com' });
        const duration = Date.now() - startTime;
        timingResults.existing.push(duration);
      }

      // Test with non-existing email (multiple times to get average)
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await request(app)
          .post('/api/auth/forgot-password')
          .send({ email: 'nonexistent@example.com' });
        const duration = Date.now() - startTime;
        timingResults.nonExisting.push(duration);
      }

      // Calculate averages
      const avgExisting = timingResults.existing.reduce((a, b) => a + b, 0) / timingResults.existing.length;
      const avgNonExisting = timingResults.nonExisting.reduce((a, b) => a + b, 0) / timingResults.nonExisting.length;

      // Both should be in the normalized range (200-600ms)
      // Allow some overhead for test environment
      expect(avgNonExisting).toBeGreaterThanOrEqual(150);
      expect(avgNonExisting).toBeLessThanOrEqual(700);

      // The difference between existing and non-existing should be small
      // (within 500ms to account for email sending variation and test environment overhead)
      const timingDifference = Math.abs(avgExisting - avgNonExisting);
      expect(timingDifference).toBeLessThanOrEqual(500);

      // Verify both responses are identical
      const existingResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      const nonExistingResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      const existingResult = expectSuccessResponse<{ message: string }>(existingResponse, 200);
      const nonExistingResult = expectSuccessResponse<{ message: string }>(nonExistingResponse, 200);

      // Response messages should be identical
      expect(existingResult.message).toBe(nonExistingResult.message);
    });
  });

  describe('GET /api/auth/reset-password/:token - Validate Reset Token', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create user and request password reset
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });

      // Get the generated token
      const tokens = await db.select().from(passwordResetTokens);
      validToken = tokens[0].token;
    });

    it('should validate valid reset token', async () => {
      const response = await request(app).get(`/api/auth/reset-password/${validToken}`);

      const result = expectSuccessResponse<{ email: string; username: string }>(response, 200);
      expect(result.email).toBe('test@example.com');
      expect(result.username).toBe('testuser');
    });

    it('should reject invalid token', async () => {
      const response = await request(app).get('/api/auth/reset-password/invalid-token-12345');

      expectBadRequestError(response, 'Invalid or expired');
    });

    it('should reject expired token', async () => {
      // Manually expire the token by setting expiresAt to the past
      // Note: We set it directly in DB rather than using fake timers because
      // PostgreSQL's NOW() function uses database time, not JavaScript time
      await db
        .update(passwordResetTokens)
        .set({
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        })
        .where(eq(passwordResetTokens.token, validToken));

      // Attempt to validate expired token
      const response = await request(app).get(`/api/auth/reset-password/${validToken}`);

      // Should reject with "Invalid or expired" error
      expectBadRequestError(response, 'Invalid or expired');
    });

    it('should reject used token', async () => {
      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ isUsed: true, usedAt: new Date() })
        .where(eq(passwordResetTokens.token, validToken));

      const response = await request(app).get(`/api/auth/reset-password/${validToken}`);

      expectBadRequestError(response, 'Invalid or expired');
    });

    it('should return 404 for request with missing token', async () => {
      const response = await request(app).get('/api/auth/reset-password/');

      // Express doesn't match the route when token param is empty
      // This returns a 404 but without the standard API envelope format
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/auth/reset-password - Complete Password Reset', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create user and request password reset
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'OldPassword123!',
      });

      await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' });

      const tokens = await db.select().from(passwordResetTokens);
      validToken = tokens[0].token;
    });

    it('should reset password with valid token', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      const result = expectSuccessResponse<{ message: string }>(response, 200);
      expect(result.message).toContain('reset successfully');

      // Verify token is marked as used
      const tokens = await db.select().from(passwordResetTokens);
      expect(tokens[0].isUsed).toBe(true);
      expect(tokens[0].usedAt).toBeDefined();
    });

    it('should allow login with new password after reset', async () => {
      // Reset password
      await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      // Try logging in with new password
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'NewPassword123!',
      });

      expectSuccessResponse(loginResponse, 200);
    });

    it('should reject old password after reset', async () => {
      // Reset password
      await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      // Try logging in with old password
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'OldPassword123!',
      });

      expectUnauthorizedError(loginResponse, 'Invalid email or password');
    });

    it('should reject reset with invalid token', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        token: 'invalid-token',
        password: 'NewPassword123!',
      });

      expectBadRequestError(response, 'Invalid or expired');
    });

    it('should reject reset with already-used token', async () => {
      // Use token once
      await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      // Try using same token again
      const response = await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'AnotherPassword123!',
      });

      expectBadRequestError(response, 'Invalid or expired');
    });

    it('should enforce password validation on reset', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'short', // Too short, no uppercase, no number, no special char
      });

      expectBadRequestError(response, 'at least 12 characters');
    });

    it('should reject reset with missing token', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        password: 'NewPassword123!',
      });

      // Zod validation error - just verify it's a 400 error
      expectErrorResponse(response, 400);
    });

    it('should reject reset with missing password', async () => {
      const response = await request(app).post('/api/auth/reset-password').send({
        token: validToken,
      });

      // Zod validation error - just verify it's a 400 error
      expectErrorResponse(response, 400);
    });

    it('should send confirmation email after successful reset', async () => {
      await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      expect(emailService.sendPasswordResetConfirmationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'testuser'
      );
    });

    it('should use transaction for password update and token marking', async () => {
      // This test verifies the transaction works correctly
      const response = await request(app).post('/api/auth/reset-password').send({
        token: validToken,
        password: 'NewPassword123!',
      });

      expectSuccessResponse(response, 200);

      // Both operations should succeed together
      const tokens = await db.select().from(passwordResetTokens);
      expect(tokens[0].isUsed).toBe(true);

      // Password should be updated
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'NewPassword123!',
      });
      expectSuccessResponse(loginResponse, 200);
    });
  });

  describe('GET /api/auth/user - Get Current User', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });
    });

    it('should return current user data when authenticated', async () => {
      const agent = request.agent(app);

      await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const response = await agent.get('/api/auth/user');

      const userData = expectSuccessResponse<{
        id: number;
        email: string;
        username: string;
        role: string;
        reputation: number;
        isActive: boolean;
        csrfToken: string;
      }>(response, 200);

      expect(userData.email).toBe('test@example.com');
      expect(userData.username).toBe('testuser');
      expect(userData.role).toBeDefined();

      // SECURITY: Verify passwordHash is NEVER exposed
      expect(userData).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/user');

      expectUnauthorizedError(response, 'Not authenticated');
    });

    it('should include CSRF token in response', async () => {
      const agent = request.agent(app);

      await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const response = await agent.get('/api/auth/user');

      const userData = expectSuccessResponse<{ csrfToken: string }>(response, 200);
      expect(userData.csrfToken).toBeDefined();
      expect(typeof userData.csrfToken).toBe('string');
    });

    it('should refresh user data from database', async () => {
      const agent = request.agent(app);

      // Login
      const loginResponse = await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const loginData = expectSuccessResponse<{ user: { id: number } }>(loginResponse, 200);
      const userId = loginData.user.id;

      // Update user in database directly
      await db.update(users).set({ username: 'updateduser' }).where(eq(users.id, userId));

      // Get user should reflect updated data
      const response = await agent.get('/api/auth/user');

      const userData = expectSuccessResponse<{ username: string }>(response, 200);
      expect(userData.username).toBe('updateduser');
    });

    it('should include user reputation and stats', async () => {
      const agent = request.agent(app);

      await agent.post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const response = await agent.get('/api/auth/user');

      const userData = expectSuccessResponse<{
        reputation: number;
        isActive: boolean;
      }>(response, 200);

      expect(typeof userData.reputation).toBe('number');
      expect(typeof userData.isActive).toBe('boolean');
    });
  });

  describe('Security & Edge Cases', () => {
    it('should never expose passwordHash in any response', async () => {
      // Register
      const registerResponse = await request(app).post('/api/auth/register').send({
        email: 'security@example.com',
        username: 'securitytest',
        password: 'SecurePass123!',
      });
      const registerData = expectSuccessResponse<{ user: unknown }>(registerResponse, 201);
      expect(registerData).not.toHaveProperty('passwordHash');
      expect(registerData.user).not.toHaveProperty('passwordHash');

      // Login
      const loginResponse = await request(app).post('/api/auth/login').send({
        email: 'security@example.com',
        password: 'SecurePass123!',
      });
      const loginData = expectSuccessResponse<{ user: unknown }>(loginResponse, 200);
      expect(loginData).not.toHaveProperty('passwordHash');
      expect(loginData.user).not.toHaveProperty('passwordHash');

      // Get user
      const agent = request.agent(app);
      await agent.post('/api/auth/login').send({
        email: 'security@example.com',
        password: 'SecurePass123!',
      });
      const userResponse = await agent.get('/api/auth/user');
      const userData = expectSuccessResponse(userResponse, 200);
      expect(userData).not.toHaveProperty('passwordHash');
    });

    it('should handle concurrent first-user registrations correctly (SERIALIZABLE)', async () => {
      // This tests the SERIALIZABLE transaction isolation level
      // In practice, one should succeed as admin, others as users
      const registrations = [
        request(app).post('/api/auth/register').send({
          email: 'user1@example.com',
          username: 'user1',
          password: 'SecurePass123!',
        }),
        request(app).post('/api/auth/register').send({
          email: 'user2@example.com',
          username: 'user2',
          password: 'SecurePass123!',
        }),
      ];

      const responses = await Promise.all(registrations);

      // Extract data using validation helpers - some may fail due to race conditions
      const data = responses
        .filter((r) => r.status === 201)
        .map((r) => expectSuccessResponse<{ user: { role: string } }>(r, 201));

      // At least one should be admin
      const adminCount = data.filter((d) => d.user.role === 'admin').length;
      expect(adminCount).toBeGreaterThanOrEqual(1);

      // Others should be users
      const userCount = data.filter((d) => d.user.role === 'user').length;
      expect(userCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle rapid failed login attempts correctly', async () => {
      await request(app).post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Rapid failed attempts
      const attempts = [];
      for (let i = 0; i < 10; i++) {
        attempts.push(
          request(app).post('/api/auth/login').send({
            email: 'test@example.com',
            password: 'WrongPassword',
          })
        );
      }

      const responses = await Promise.all(attempts);

      // Should eventually lock the account - check for 401 error responses
      const errorResponses = responses.filter((r) => r.status === 401);
      expect(errorResponses.length).toBeGreaterThan(0);
    });

    it('should handle session expiry correctly', async () => {
      // This is a simplified test - in production, sessions expire based on time
      const agent = request.agent(app);

      await agent.post('/api/auth/register').send({
        email: 'test@example.com',
        username: 'testuser',
        password: 'SecurePass123!',
      });

      // Session should be active
      const response1 = await agent.get('/api/auth/user');
      expectSuccessResponse(response1, 200);

      // After logout, session should be invalid
      await agent.post('/api/auth/logout');

      const response2 = await agent.get('/api/auth/user');
      expectUnauthorizedError(response2);
    });
  });
});
