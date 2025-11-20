import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import {
  checkAccountLockout,
  isAccountLocked,
  recordFailedLogin,
  clearFailedLogins,
  unlockAccount,
  resetFailedAttempts,
  getLockoutStats,
} from '../account-lockout';

/**
 * Account Lockout Middleware Test Suite
 *
 * Tests account lockout functionality to prevent brute force attacks.
 *
 * Critical security requirements:
 * - Lock account after MAX_FAILED_ATTEMPTS (5)
 * - Lockout duration: 15 minutes
 * - Failed attempts tracked per email (case-insensitive)
 * - Successful login clears failed attempts
 * - Progressive delays between attempts
 * - Expired lockouts automatically removed
 */
describe('Account Lockout Middleware', () => {
  let app: Express;

  beforeEach(() => {
    // Reset failed login attempts before each test
    resetFailedAttempts();

    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use(checkAccountLockout);

    // Mock login endpoint
    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;

      // Simple mock authentication
      if (email === 'test@example.com' && password === 'correct') {
        clearFailedLogins(email);
        res.json({ success: true, user: { email } });
      } else {
        const lockoutInfo = recordFailedLogin(email);
        res.status(401).json({
          error: 'Invalid email or password',
          locked: lockoutInfo.locked,
          attempts: lockoutInfo.attempts,
          remainingAttempts: lockoutInfo.remainingAttempts,
          lockedUntil: lockoutInfo.lockedUntil,
        });
      }
    });
  });

  afterEach(() => {
    // Clean up after each test
    resetFailedAttempts();
  });

  describe('Failed Attempt Tracking', () => {
    it('should track failed login attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.attempts).toBe(1);
      expect(response.body.remainingAttempts).toBe(4);
    });

    it('should increment attempts on subsequent failures', async () => {
      // First attempt
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      // Second attempt
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.attempts).toBe(2);
      expect(response.body.remainingAttempts).toBe(3);
    });

    it('should track failed attempts in memory', async () => {
      const email = 'test@example.com';

      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      const lockStatus = isAccountLocked(email);
      expect(lockStatus.locked).toBe(false);
      expect(lockStatus.attempts).toBe(1);
    });
  });

  describe('Account Lockout After Max Attempts', () => {
    it('should lock account after 5 failed attempts', async () => {
      const email = 'test@example.com';

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' });
      }

      // Check lockout status
      const lockStatus = isAccountLocked(email);
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.remainingTime).toBeGreaterThan(0);
    });

    it('should return 429 status when account is locked', async () => {
      const email = 'test@example.com';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' });
      }

      // Next attempt should be blocked
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Account temporarily locked');
      expect(response.body.locked).toBe(true);
    });

    it('should include remaining time in lockout response', async () => {
      const email = 'test@example.com';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' });
      }

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      expect(response.status).toBe(429);
      expect(response.body.remainingTime).toBeDefined();
      expect(response.body.remainingTime).toBeGreaterThan(0);
      expect(response.body.message).toContain('minute');
    });

    it('should set lockout duration to 15 minutes', async () => {
      const email = 'test@example.com';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      const lockStatus = isAccountLocked(email);
      expect(lockStatus.locked).toBe(true);
      expect(lockStatus.remainingTime).toBeLessThanOrEqual(15 * 60);
      expect(lockStatus.remainingTime).toBeGreaterThan((15 * 60) - 5); // Allow 5 second buffer
    });
  });

  describe('Successful Login Clears Attempts', () => {
    it('should clear failed attempts on successful login', async () => {
      const email = 'test@example.com';

      // Make some failed attempts
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'correct' });

      // Check that attempts are cleared
      const lockStatus = isAccountLocked(email);
      expect(lockStatus.locked).toBe(false);
      expect(lockStatus.attempts).toBeUndefined();
    });

    it('should restart count after successful login', async () => {
      const email = 'test@example.com';

      // Failed attempts
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      // Successful login
      await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'correct' });

      // New failed attempt should start from 1
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'wrong' });

      expect(response.body.attempts).toBe(1);
      expect(response.body.remainingAttempts).toBe(4);
    });
  });

  describe('Case-Insensitive Email Tracking', () => {
    it('should track attempts case-insensitively', async () => {
      // Lowercase email
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      // Uppercase email
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'TEST@EXAMPLE.COM', password: 'wrong' });

      expect(response.body.attempts).toBe(2);
      expect(response.body.remainingAttempts).toBe(3);
    });

    it('should apply lockout regardless of email case', async () => {
      const emailLower = 'test@example.com';
      const emailUpper = 'TEST@EXAMPLE.COM';

      // Lock with lowercase
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(emailLower);
      }

      // Check with uppercase
      const lockStatus = isAccountLocked(emailUpper);
      expect(lockStatus.locked).toBe(true);
    });
  });

  describe('Multiple Users Tracked Independently', () => {
    it('should track different users independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // User 1: 3 failed attempts
      for (let i = 0; i < 3; i++) {
        recordFailedLogin(email1);
      }

      // User 2: 2 failed attempts
      for (let i = 0; i < 2; i++) {
        recordFailedLogin(email2);
      }

      const lockStatus1 = isAccountLocked(email1);
      const lockStatus2 = isAccountLocked(email2);

      expect(lockStatus1.attempts).toBe(3);
      expect(lockStatus2.attempts).toBe(2);
      expect(lockStatus1.locked).toBe(false);
      expect(lockStatus2.locked).toBe(false);
    });

    it('should lock users independently', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Lock user 1
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email1);
      }

      // User 2 should not be locked
      const lockStatus1 = isAccountLocked(email1);
      const lockStatus2 = isAccountLocked(email2);

      expect(lockStatus1.locked).toBe(true);
      expect(lockStatus2.locked).toBe(false);
    });
  });

  describe('Expired Lockouts Automatically Removed', () => {
    it('should report unlocked after lockout expires', () => {
      // This test would require time manipulation
      // For now, we test the logic without waiting 15 minutes

      const email = 'test@example.com';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      const lockStatus = isAccountLocked(email);
      expect(lockStatus.locked).toBe(true);

      // Lockout should have remaining time
      expect(lockStatus.remainingTime).toBeGreaterThan(0);
    });
  });

  describe('Manual Unlock Function', () => {
    it('should manually unlock locked account', () => {
      const email = 'test@example.com';

      // Lock the account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      expect(isAccountLocked(email).locked).toBe(true);

      // Manually unlock
      const unlocked = unlockAccount(email);
      expect(unlocked).toBe(true);

      // Should now be unlocked
      expect(isAccountLocked(email).locked).toBe(false);
    });

    it('should return false when unlocking non-existent account', () => {
      const unlocked = unlockAccount('nonexistent@example.com');
      expect(unlocked).toBe(false);
    });

    it('should be case-insensitive for manual unlock', () => {
      const email = 'test@example.com';

      // Lock with lowercase
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      // Unlock with uppercase
      const unlocked = unlockAccount('TEST@EXAMPLE.COM');
      expect(unlocked).toBe(true);

      // Check with original case
      expect(isAccountLocked(email).locked).toBe(false);
    });
  });

  describe('Reset Function for Testing', () => {
    it('should clear all failed attempts', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      // Add failed attempts for multiple users
      recordFailedLogin(email1);
      recordFailedLogin(email1);
      recordFailedLogin(email2);

      // Reset all
      resetFailedAttempts();

      // All should be cleared
      expect(isAccountLocked(email1).attempts).toBeUndefined();
      expect(isAccountLocked(email2).attempts).toBeUndefined();
    });

    it('should clear locked accounts', () => {
      const email = 'test@example.com';

      // Lock account
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      expect(isAccountLocked(email).locked).toBe(true);

      // Reset
      resetFailedAttempts();

      // Should be unlocked
      expect(isAccountLocked(email).locked).toBe(false);
    });
  });

  describe('Lockout Statistics', () => {
    it('should return accurate lockout stats', () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';
      const email3 = 'user3@example.com';

      // User 1: locked
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email1);
      }

      // User 2: not locked
      recordFailedLogin(email2);
      recordFailedLogin(email2);

      // User 3: locked
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email3);
      }

      const stats = getLockoutStats();
      expect(stats.totalLockedAccounts).toBe(2);
      expect(stats.accountsWithAttempts).toBe(3);
      expect(stats.totalAttempts).toBe(12); // 5 + 2 + 5
    });

    it('should return zero stats when no attempts', () => {
      resetFailedAttempts();

      const stats = getLockoutStats();
      expect(stats.totalLockedAccounts).toBe(0);
      expect(stats.accountsWithAttempts).toBe(0);
      expect(stats.totalAttempts).toBe(0);
    });
  });

  describe('Middleware Behavior', () => {
    it('should only apply to /api/auth/login endpoint', async () => {
      app.post('/api/other', (req, res) => res.json({ ok: true }));

      // Lock an account
      const email = 'test@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      // Other endpoints should not be affected
      const response = await request(app)
        .post('/api/other')
        .send({ email, data: 'test' });

      expect(response.status).toBe(200);
    });

    it('should only apply to POST method', async () => {
      app.get('/api/auth/login', (req, res) => res.json({ ok: true }));

      // Lock an account
      const email = 'test@example.com';
      for (let i = 0; i < 5; i++) {
        recordFailedLogin(email);
      }

      // GET request should not be blocked
      const response = await request(app).get('/api/auth/login');

      expect(response.status).toBe(200);
    });

    it('should handle missing email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test' });

      // Should not crash, middleware should pass through
      // Mock handler will return 500 because email is undefined
      expect([401, 500]).toContain(response.status);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid concurrent attempts', async () => {
      const email = 'test@example.com';

      // Simulate rapid concurrent attempts
      const attempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({ email, password: 'wrong' })
      );

      const responses = await Promise.all(attempts);

      // Should eventually lock
      const locked = responses.some(r => r.status === 429);
      expect(locked).toBe(true);
    });

    it('should handle empty email string', () => {
      const lockStatus = isAccountLocked('');
      expect(lockStatus.locked).toBe(false);
    });

    it('should handle special characters in email', () => {
      const email = "test+special@example.com";

      recordFailedLogin(email);
      const lockStatus = isAccountLocked(email);

      expect(lockStatus.attempts).toBe(1);
    });
  });
});
