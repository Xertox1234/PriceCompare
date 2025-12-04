/**
 * Schema Validation Tests for CHECK Constraint Enforcement
 *
 * Tests Zod validation rules that mirror database CHECK constraints.
 * Ensures application-layer validation catches invalid data before database operations.
 *
 * Related:
 * - migrations/0020_add_price_check_constraints.sql - Database constraints
 * - shared/schema.ts - Zod schema definitions
 * - GitHub Issue #160 - Add Zod validation for database CHECK constraints
 */

import { describe, it, expect } from "vitest";
import {
  insertProductOfferSchema,
  insertPriceAlertSchema,
  insertPriceHistorySchema,
} from "@shared/schema";

describe("Schema Validation - CHECK Constraint Enforcement", () => {
  describe("insertProductOfferSchema", () => {
    describe("price validation", () => {
      it("should reject negative price", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "-10.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Price must be non-negative");
          expect(result.error.issues[0].path).toEqual(["price"]);
        }
      });

      it("should accept zero price (free products)", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "0.00",
        });

        expect(result.success).toBe(true);
      });

      it("should accept positive price", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "49.99",
        });

        expect(result.success).toBe(true);
      });
    });

    describe("originalPrice validation", () => {
      it("should reject negative originalPrice", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: "-10.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Original price must be non-negative");
          expect(result.error.issues[0].path).toEqual(["originalPrice"]);
        }
      });

      it("should accept null originalPrice", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: null,
        });

        expect(result.success).toBe(true);
      });

      it("should accept positive originalPrice", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: "99.99",
        });

        expect(result.success).toBe(true);
      });
    });

    describe("price logic validation (sale price <= original price)", () => {
      it("should reject sale price > original price", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "100.00",
          originalPrice: "50.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Sale price cannot exceed original price");
          expect(result.error.issues[0].path).toEqual(["price"]);
        }
      });

      it("should accept sale price = original price (no discount)", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "50.00",
          originalPrice: "50.00",
        });

        expect(result.success).toBe(true);
      });

      it("should accept sale price < original price (discounted)", () => {
        const result = insertProductOfferSchema.safeParse({
          productId: 1,
          retailerId: 1,
          price: "30.00",
          originalPrice: "50.00",
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("insertPriceAlertSchema", () => {
    describe("targetPrice validation", () => {
      it("should reject zero targetPrice", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "0.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Target price must be positive");
          expect(result.error.issues[0].path).toEqual(["targetPrice"]);
        }
      });

      it("should reject negative targetPrice", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "-10.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Target price must be positive");
        }
      });

      it("should accept positive targetPrice", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "49.99",
        });

        expect(result.success).toBe(true);
      });

      it("should accept minimum valid targetPrice (0.01)", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "0.01",
        });

        expect(result.success).toBe(true);
      });
    });

    describe("priceWhenCreated validation", () => {
      it("should reject negative priceWhenCreated", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "49.99",
          priceWhenCreated: "-10.00",
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Price when created must be non-negative");
          expect(result.error.issues[0].path).toEqual(["priceWhenCreated"]);
        }
      });

      it("should accept null priceWhenCreated", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "49.99",
          priceWhenCreated: null,
        });

        expect(result.success).toBe(true);
      });

      it("should accept positive priceWhenCreated", () => {
        const result = insertPriceAlertSchema.safeParse({
          userId: 1,
          productId: 1,
          targetPrice: "49.99",
          priceWhenCreated: "59.99",
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("insertPriceHistorySchema", () => {
    describe("price validation", () => {
      it("should reject negative price", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "-10.00",
          recordedAt: new Date(),
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Price must be non-negative");
          expect(result.error.issues[0].path).toEqual(["price"]);
        }
      });

      it("should accept zero price", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "0.00",
          recordedAt: new Date(),
        });

        expect(result.success).toBe(true);
      });

      it("should accept positive price", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "49.99",
          recordedAt: new Date(),
        });

        expect(result.success).toBe(true);
      });
    });

    describe("originalPrice validation", () => {
      it("should reject negative originalPrice", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: "-10.00",
          recordedAt: new Date(),
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Original price must be non-negative");
          expect(result.error.issues[0].path).toEqual(["originalPrice"]);
        }
      });

      it("should accept null originalPrice", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: null,
          recordedAt: new Date(),
        });

        expect(result.success).toBe(true);
      });

      it("should accept positive originalPrice", () => {
        const result = insertPriceHistorySchema.safeParse({
          productOfferId: 1,
          productId: 1,
          retailerId: 1,
          price: "49.99",
          originalPrice: "99.99",
          recordedAt: new Date(),
        });

        expect(result.success).toBe(true);
      });
    });
  });

  describe("Defense in Depth - Database vs Application Validation", () => {
    it("should provide helpful error messages at application layer", () => {
      // Before: Database would reject with cryptic error
      // "new row for relation \"product_offers\" violates check constraint \"check_product_offers_price_positive\""

      // After: Application rejects with helpful error
      const result = insertProductOfferSchema.safeParse({
        productId: 1,
        retailerId: 1,
        price: "-10.00",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        // User sees friendly error message
        expect(result.error.issues[0].message).toBe("Price must be non-negative");
        // Error includes field path for UI highlighting
        expect(result.error.issues[0].path).toEqual(["price"]);
      }
    });

    it("should validate before database round trip", () => {
      // Application-layer validation is faster and provides better UX
      // No need to wait for database constraint violation
      const start = Date.now();

      const result = insertProductOfferSchema.safeParse({
        productId: 1,
        retailerId: 1,
        price: "-10.00",
      });

      const duration = Date.now() - start;

      expect(result.success).toBe(false);
      expect(duration).toBeLessThan(10); // Validation is instant
    });
  });
});
