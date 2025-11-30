/**
 * Integration tests for storage layer validation helpers
 * Tests the validation logic added in Phase 1 of Storage Layer Improvement Roadmap
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseStorage } from '../storage';

describe('Storage Layer Validation Helpers', () => {
  let storage: DatabaseStorage;

  beforeAll(() => {
    storage = new DatabaseStorage();
  });

  describe('User Validation Helpers', () => {
    describe('validateUserId', () => {
      it('should reject non-positive user IDs', async () => {
        await expect(
          storage.getUserByIdSafe(0)
        ).rejects.toThrow('Invalid userId: 0. Must be a positive integer.');

        await expect(
          storage.getUserByIdSafe(-5)
        ).rejects.toThrow('Invalid userId: -5. Must be a positive integer.');
      });

      it('should reject decimal user IDs', async () => {
        await expect(
          storage.getUserByIdSafe(3.5)
        ).rejects.toThrow('Invalid userId: 3.5. Must be a positive integer.');
      });

      it('should reject NaN user IDs', async () => {
        await expect(
          storage.getUserByIdSafe(NaN)
        ).rejects.toThrow(/Invalid userId.*Must be a positive integer/);
      });

      it('should accept valid positive integers', async () => {
        // This will return null if user doesn't exist, but validation should pass
        const result = await storage.getUserByIdSafe(99999);
        expect(result).toBeNull();
      });
    });

    describe('validateTrustLevel', () => {
      it('should reject trust level below minimum', async () => {
        await expect(
          storage.updateUserTrustLevel(1, -1)
        ).rejects.toThrow('Trust level must be between 0 and 4');
      });

      it('should reject trust level above maximum', async () => {
        await expect(
          storage.updateUserTrustLevel(1, 5)
        ).rejects.toThrow('Trust level must be between 0 and 4');
      });
    });

    describe('validateProfileField', () => {
      it('should reject bio exceeding max length', async () => {
        const longBio = 'a'.repeat(501); // MAX_BIO_LENGTH is 500
        await expect(
          storage.updateUserProfile(1, { bio: longBio })
        ).rejects.toThrow('Bio cannot exceed 500 characters');
      });

      it('should reject location exceeding max length', async () => {
        const longLocation = 'a'.repeat(101); // MAX_LOCATION_LENGTH is 100
        await expect(
          storage.updateUserProfile(1, { location: longLocation })
        ).rejects.toThrow('Location cannot exceed 100 characters');
      });

      it('should reject website exceeding max length', async () => {
        const longWebsite = 'a'.repeat(256); // MAX_WEBSITE_LENGTH is 255
        await expect(
          storage.updateUserProfile(1, { website: longWebsite })
        ).rejects.toThrow('Website cannot exceed 255 characters');
      });

      it('should reject avatarUrl exceeding max length', async () => {
        const longAvatarUrl = 'a'.repeat(501); // MAX_AVATAR_URL_LENGTH is 500
        await expect(
          storage.updateUserProfile(1, { avatarUrl: longAvatarUrl })
        ).rejects.toThrow('Avatar URL cannot exceed 500 characters');
      });
    });
  });

  describe('Product Validation Helpers', () => {
    describe('validateProductId', () => {
      it('should reject non-positive product IDs', async () => {
        await expect(
          storage.getProductById(0)
        ).rejects.toThrow('Invalid productId: 0. Must be a positive integer.');

        await expect(
          storage.getProductById(-10)
        ).rejects.toThrow('Invalid productId: -10. Must be a positive integer.');
      });

      it('should reject decimal product IDs', async () => {
        await expect(
          storage.getProductById(2.7)
        ).rejects.toThrow('Invalid productId: 2.7. Must be a positive integer.');
      });

      it('should reject NaN product IDs', async () => {
        await expect(
          storage.getProductById(NaN)
        ).rejects.toThrow(/Invalid productId.*Must be a positive integer/);
      });

      it('should accept valid positive integers', async () => {
        // This will return undefined if product doesn't exist, but validation should pass
        const result = await storage.getProductById(99999);
        expect(result).toBeUndefined();
      });
    });

    describe('validateProductOffers', () => {
      it('should validate product ID in getProductOffers', async () => {
        await expect(
          storage.getProductOffers(0)
        ).rejects.toThrow('Invalid productId: 0. Must be a positive integer.');

        await expect(
          storage.getProductOffers(-5)
        ).rejects.toThrow('Invalid productId: -5. Must be a positive integer.');
      });
    });
  });

  describe('Integration: Validation prevents database queries with invalid inputs', () => {
    it('should throw validation error before reaching database', async () => {
      // These should fail fast at validation, not at database level
      const invalidInputs = [
        { method: 'getUserByIdSafe', args: [0] },
        { method: 'getProductById', args: [-1] },
        { method: 'getProductOffers', args: [3.14] },
      ];

      for (const { method, args } of invalidInputs) {
        await expect(
          (storage as any)[method](...args)
        ).rejects.toThrow(/Invalid.*Must be a positive integer/);
      }
    });
  });
});
