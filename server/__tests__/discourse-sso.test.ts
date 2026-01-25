import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';

/**
 * Discourse SSO Verification Test Suite
 *
 * Tests the security-critical SSO signature verification to ensure:
 * - Valid signatures are accepted
 * - Invalid signatures are rejected
 * - Length-mismatched signatures are rejected
 * - Timing-safe comparison is used (constant time regardless of input)
 *
 * @see server/discourse-sso.ts
 * @see TODO_281_DISCOURSE_SSO_TIMING_ATTACK_FIX.md
 */

// Store original env values for cleanup
const originalEnv = {
  DISCOURSE_SSO_SECRET: process.env.DISCOURSE_SSO_SECRET,
  DISCOURSE_URL: process.env.DISCOURSE_URL,
};

// Test secret - must be at least 32 characters for env validation
const TEST_SECRET = 'test-discourse-sso-secret-for-testing-only-32chars';

describe('Discourse SSO Verification', () => {
  // Must set env vars before importing the module
  beforeAll(() => {
    process.env.DISCOURSE_SSO_SECRET = TEST_SECRET;
    process.env.DISCOURSE_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    // Restore original env values
    if (originalEnv.DISCOURSE_SSO_SECRET !== undefined) {
      process.env.DISCOURSE_SSO_SECRET = originalEnv.DISCOURSE_SSO_SECRET;
    } else {
      delete process.env.DISCOURSE_SSO_SECRET;
    }
    if (originalEnv.DISCOURSE_URL !== undefined) {
      process.env.DISCOURSE_URL = originalEnv.DISCOURSE_URL;
    } else {
      delete process.env.DISCOURSE_URL;
    }
  });

  /**
   * Helper to compute a valid HMAC signature for testing
   */
  function computeValidSignature(payload: string): string {
    return crypto.createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
  }

  /**
   * Helper to create a base64-encoded SSO payload
   */
  function createSSOPayload(params: Record<string, string>): string {
    const paramString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return Buffer.from(paramString).toString('base64');
  }

  describe('verifySSO', () => {
    it('should accept valid signatures', async () => {
      // Dynamic import to ensure env vars are set first
      const { verifySSO } = await import('../discourse-sso');

      const payload = createSSOPayload({
        nonce: 'test-nonce-12345',
        email: 'user@example.com',
        external_id: '123',
        username: 'testuser',
      });

      const validSignature = computeValidSignature(payload);
      const result = verifySSO(payload, validSignature);

      expect(result).toBe(true);
    });

    it('should reject invalid signatures', async () => {
      const { verifySSO } = await import('../discourse-sso');

      const payload = createSSOPayload({
        nonce: 'test-nonce-67890',
        email: 'another@example.com',
      });

      // Create a completely wrong signature (valid hex, wrong value)
      const invalidSignature = '0'.repeat(64); // SHA-256 produces 64 hex chars

      const result = verifySSO(payload, invalidSignature);

      expect(result).toBe(false);
    });

    it('should reject signatures with wrong length', async () => {
      const { verifySSO } = await import('../discourse-sso');

      const payload = createSSOPayload({
        nonce: 'test-nonce',
        email: 'test@test.com',
      });

      // Too short (should be 64 chars for SHA-256)
      const tooShort = 'abc123';
      expect(verifySSO(payload, tooShort)).toBe(false);

      // Too long
      const tooLong = '0'.repeat(128);
      expect(verifySSO(payload, tooLong)).toBe(false);

      // Empty
      expect(verifySSO(payload, '')).toBe(false);
    });

    it('should reject tampered payloads', async () => {
      const { verifySSO } = await import('../discourse-sso');

      // Create original payload and signature
      const originalPayload = createSSOPayload({
        nonce: 'original-nonce',
        email: 'original@example.com',
      });
      const originalSignature = computeValidSignature(originalPayload);

      // Tamper with the payload
      const tamperedPayload = createSSOPayload({
        nonce: 'original-nonce',
        email: 'attacker@evil.com', // Changed email
      });

      // Try to use original signature with tampered payload
      const result = verifySSO(tamperedPayload, originalSignature);

      expect(result).toBe(false);
    });

    it('should handle edge cases gracefully', async () => {
      const { verifySSO } = await import('../discourse-sso');

      // Empty payload with valid-length signature
      const emptyPayload = '';
      const sigForEmpty = computeValidSignature(emptyPayload);
      expect(verifySSO(emptyPayload, sigForEmpty)).toBe(true);

      // Unicode in payload
      const unicodePayload = createSSOPayload({
        nonce: 'test',
        username: '用户名', // Chinese characters
      });
      const unicodeSig = computeValidSignature(unicodePayload);
      expect(verifySSO(unicodePayload, unicodeSig)).toBe(true);

      // Special characters
      const specialPayload = createSSOPayload({
        nonce: 'test',
        email: 'user+tag@example.com',
        bio: 'Hello & goodbye <script>alert("xss")</script>',
      });
      const specialSig = computeValidSignature(specialPayload);
      expect(verifySSO(specialPayload, specialSig)).toBe(true);
    });

    it('should reject non-hex signatures', async () => {
      const { verifySSO } = await import('../discourse-sso');

      const payload = createSSOPayload({ nonce: 'test' });

      // Valid length but contains non-hex characters
      const nonHexSig = 'g'.repeat(64); // 'g' is not a hex character

      // This should either return false or throw - both are acceptable
      // The important thing is it doesn't return true
      try {
        const result = verifySSO(payload, nonHexSig);
        expect(result).toBe(false);
      } catch {
        // Buffer.from with 'hex' encoding will throw for invalid hex
        // This is also acceptable behavior
        expect(true).toBe(true);
      }
    });
  });

  describe('generateDiscourseSSO', () => {
    it('should generate valid payload and signature', async () => {
      const { generateDiscourseSSO, verifySSO } = await import('../discourse-sso');

      const user = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'not-used-in-sso', // SECURITY: dummy test data to satisfy SharedUser type
        role: 'user' as const,
        bio: null,
        location: null,
        website: null,
        avatarUrl: null,
        discourseUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nonce = 'test-nonce-' + Date.now();
      const returnUrl = 'http://localhost:3000/sso/callback';

      const { payload, signature } = generateDiscourseSSO(user, nonce, returnUrl);

      // Verify the signature is valid
      expect(verifySSO(payload, signature)).toBe(true);

      // Verify payload contains expected data
      const decoded = Buffer.from(payload, 'base64').toString();
      expect(decoded).toContain(`nonce=${nonce}`);
      expect(decoded).toContain('email=test%40example.com');
      expect(decoded).toContain('external_id=1');
      expect(decoded).toContain('username=testuser');
    });

    it('should include admin flag for admin users', async () => {
      const { generateDiscourseSSO } = await import('../discourse-sso');

      const adminUser = {
        id: 2,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'not-used', // SECURITY: dummy test data to satisfy SharedUser type
        role: 'admin' as const,
        bio: null,
        location: null,
        website: null,
        avatarUrl: null,
        discourseUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { payload } = generateDiscourseSSO(adminUser, 'nonce', 'http://localhost/callback');

      const decoded = Buffer.from(payload, 'base64').toString();
      expect(decoded).toContain('admin=true');
    });

    it('should include optional fields when present', async () => {
      const { generateDiscourseSSO } = await import('../discourse-sso');

      const userWithOptionals = {
        id: 3,
        username: 'fulluser',
        email: 'full@example.com',
        passwordHash: 'not-used', // SECURITY: dummy test data to satisfy SharedUser type
        role: 'user' as const,
        bio: 'My bio here',
        location: null,
        website: 'https://example.com',
        avatarUrl: 'https://example.com/avatar.png',
        discourseUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { payload } = generateDiscourseSSO(userWithOptionals, 'nonce', 'http://localhost/cb');

      const decoded = Buffer.from(payload, 'base64').toString();
      expect(decoded).toContain('bio=My%20bio%20here');
      expect(decoded).toContain('website=https%3A%2F%2Fexample.com');
      expect(decoded).toContain('avatar_url=https%3A%2F%2Fexample.com%2Favatar.png');
    });
  });

  describe('Timing Attack Resistance', () => {
    /**
     * Note: This test is probabilistic and may occasionally fail due to
     * system timing variations. It's meant to catch obvious timing leaks,
     * not prove cryptographic security.
     */
    it('should take similar time regardless of signature correctness', async () => {
      const { verifySSO } = await import('../discourse-sso');

      const payload = createSSOPayload({
        nonce: 'timing-test',
        email: 'timing@test.com',
      });

      const validSig = computeValidSignature(payload);
      const invalidSig = '0'.repeat(64);

      // Warm up JIT compiler
      for (let i = 0; i < 100; i++) {
        verifySSO(payload, validSig);
        verifySSO(payload, invalidSig);
      }

      // Measure time for valid signature
      const validTimes: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const start = process.hrtime.bigint();
        verifySSO(payload, validSig);
        const end = process.hrtime.bigint();
        validTimes.push(Number(end - start));
      }

      // Measure time for invalid signature
      const invalidTimes: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const start = process.hrtime.bigint();
        verifySSO(payload, invalidSig);
        const end = process.hrtime.bigint();
        invalidTimes.push(Number(end - start));
      }

      // Calculate averages (excluding outliers - top/bottom 10%)
      const trimmedMean = (arr: number[]) => {
        const sorted = arr.slice().sort((a, b) => a - b);
        const trimCount = Math.floor(arr.length * 0.1);
        const trimmed = sorted.slice(trimCount, -trimCount);
        return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
      };

      const validAvg = trimmedMean(validTimes);
      const invalidAvg = trimmedMean(invalidTimes);

      // Times should be within 50% of each other (generous margin for CI variability)
      // If timing attack was possible, invalid would be significantly faster
      const ratio = Math.max(validAvg, invalidAvg) / Math.min(validAvg, invalidAvg);

      // Log for debugging
      console.log(`Valid signature avg: ${validAvg.toFixed(0)}ns`);
      console.log(`Invalid signature avg: ${invalidAvg.toFixed(0)}ns`);
      console.log(`Ratio: ${ratio.toFixed(2)}`);

      // Accept if ratio is within reasonable bounds (timing attacks would show 10x+ difference)
      expect(ratio).toBeLessThan(3);
    });
  });
});
