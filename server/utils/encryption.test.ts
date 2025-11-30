/**
 * Test suite for PII encryption utilities
 *
 * Tests AES-256-GCM encryption/decryption for GDPR compliance
 *
 * @module encryption.test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, isEncrypted, encryptIfNeeded, verifyEncryption } from './encryption';

describe('Encryption Utilities (GDPR Compliance)', () => {
  // Setup test encryption key
  beforeAll(() => {
    // Use a test key (32 bytes = 64 hex chars)
    process.env.ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  });

  describe('encrypt()', () => {
    it('should encrypt plaintext string', () => {
      const plaintext = 'user@example.com';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext format
    });

    it('should produce different ciphertext each time (due to random IV)', () => {
      const plaintext = 'user@example.com';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error for empty string', () => {
      expect(() => encrypt('')).toThrow('Cannot encrypt empty string');
    });

    it('should handle special characters', () => {
      const plaintext = 'test+email@example.com!@#$%^&*()';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '用户@example.com';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
    });
  });

  describe('decrypt()', () => {
    it('should decrypt encrypted string', () => {
      const plaintext = 'user@example.com';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'test+email@example.com!@#$%^&*()';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '用户@example.com';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for empty string', () => {
      expect(() => decrypt('')).toThrow('Cannot decrypt empty string');
    });

    it('should throw error for invalid format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted format');
      expect(() => decrypt('only:two')).toThrow('Invalid encrypted format');
    });

    it('should throw error for tampered data', () => {
      const plaintext = 'user@example.com';
      const encrypted = encrypt(plaintext);

      // Tamper with the ciphertext by changing last character
      const tampered = encrypted.slice(0, -1) + 'X';

      expect(() => decrypt(tampered)).toThrow('Decryption failed');
    });

    it('should throw error for invalid auth tag', () => {
      const invalidEncrypted = 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(32);
      expect(() => decrypt(invalidEncrypted)).toThrow();
    });
  });

  describe('isEncrypted()', () => {
    it('should return true for encrypted strings', () => {
      const plaintext = 'user@example.com';
      const encrypted = encrypt(plaintext);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plaintext strings', () => {
      expect(isEncrypted('user@example.com')).toBe(false);
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('123456')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for strings without colons', () => {
      expect(isEncrypted('abc123def456')).toBe(false);
    });

    it('should return false for strings with non-hex characters', () => {
      expect(isEncrypted('abc:def:ghi')).toBe(false);
      expect(isEncrypted('abc:123:xyz')).toBe(false);
    });

    it('should return false for strings with wrong number of parts', () => {
      expect(isEncrypted('abc')).toBe(false);
      expect(isEncrypted('abc:def')).toBe(false);
      expect(isEncrypted('abc:def:ghi:jkl')).toBe(false);
    });

    it('should return true for valid hex format with 3 parts', () => {
      // Create a properly formatted encrypted-looking string
      const fakeEncrypted = 'abcdef0123456789:fedcba9876543210:0123456789abcdef';
      expect(isEncrypted(fakeEncrypted)).toBe(true);
    });
  });

  describe('encryptIfNeeded()', () => {
    it('should encrypt plaintext', () => {
      const plaintext = 'user@example.com';
      const result = encryptIfNeeded(plaintext);

      expect(result).toBeDefined();
      expect(result).not.toBe(plaintext);
      expect(isEncrypted(result!)).toBe(true);
    });

    it('should not re-encrypt already encrypted data', () => {
      const plaintext = 'user@example.com';
      const encrypted = encrypt(plaintext);
      const result = encryptIfNeeded(encrypted);

      expect(result).toBe(encrypted);
    });

    it('should return null for null input', () => {
      expect(encryptIfNeeded(null)).toBe(null);
    });

    it('should handle empty string', () => {
      const result = encryptIfNeeded('');
      expect(result).toBe(null);
    });
  });

  describe('Encryption roundtrip', () => {
    const testCases = [
      'user@example.com',
      'admin@test.org',
      '192.168.1.1',
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334', // IPv6
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Private message content with special chars: @#$%^&*()',
      '用户的私人消息内容', // Chinese characters
      'Very long message: ' + 'a'.repeat(1000),
    ];

    testCases.forEach((testCase) => {
      it(`should handle roundtrip for: "${testCase.substring(0, 50)}${testCase.length > 50 ? '...' : ''}"`, () => {
        const encrypted = encrypt(testCase);
        const decrypted = decrypt(encrypted);

        expect(decrypted).toBe(testCase);
        expect(isEncrypted(encrypted)).toBe(true);
        expect(isEncrypted(testCase)).toBe(false);
      });
    });
  });

  describe('Key validation', () => {
    it('should throw error if ENCRYPTION_KEY is not set', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should throw error if ENCRYPTION_KEY is wrong length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 32 bytes');

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('verifyEncryption()', () => {
    it('should return true for valid encryption key', () => {
      const result = verifyEncryption();
      expect(result).toBe(true);
    });

    it('should return true for different but valid encryption key', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = '0'.repeat(64); // Different but valid format key

      // A different valid key still works for encrypting/decrypting NEW data
      const result = verifyEncryption();
      expect(result).toBe(true);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should return false when encryption key is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      const result = verifyEncryption();
      expect(result).toBe(false);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should return false when encryption key is invalid length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'tooshort';

      const result = verifyEncryption();
      expect(result).toBe(false);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('GDPR Compliance', () => {
    it('should encrypt sensitive PII fields', () => {
      // Test all PII fields that need encryption
      const piiFields = {
        email: 'user@example.com',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        privateMessageSubject: 'Important message',
        privateMessageContent: 'This is a private message',
        notificationContent: 'You have a new notification',
      };

      Object.entries(piiFields).forEach(([_field, value]) => {
        const encrypted = encrypt(value);
        const decrypted = decrypt(encrypted);

        expect(decrypted).toBe(value);
        expect(isEncrypted(encrypted)).toBe(true);
      });
    });

    it('should use AES-256-GCM (authenticated encryption)', () => {
      // This is verified by the encrypt/decrypt implementation
      // which uses crypto.createCipheriv('aes-256-gcm', ...)
      const plaintext = 'test@example.com';
      const encrypted = encrypt(plaintext);

      // Verify format includes auth tag (GCM provides this)
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // Verify tampered data fails (GCM authentication)
      const [iv, authTag, ciphertext] = parts;
      const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}XX`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });
});
