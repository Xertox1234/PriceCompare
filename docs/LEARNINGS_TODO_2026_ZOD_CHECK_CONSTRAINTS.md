# Learnings: Zod Validation for Database CHECK Constraints (TODO 2026)

**Date:** 2025-12-04
**GitHub Issue:** #160
**Pull Request:** #170
**Priority:** P0 (CRITICAL - Data Integrity)
**Status:** COMPLETED

---

## Summary

Added application-layer Zod validation to mirror database CHECK constraints from migration 0020, implementing defense-in-depth validation for price fields across three schemas.

---

## Problem Statement

### Original Issue
Database had CHECK constraints preventing invalid prices (from migration `0020_add_price_check_constraints.sql`), but Zod schemas did not validate at the application layer. This caused:

1. **Cryptic Error Messages**: Users saw database errors like:
   ```
   new row for relation "product_offers" violates check constraint "check_product_offers_price_positive"
   ```
   Instead of helpful messages like:
   ```
   Price must be non-negative
   ```

2. **Wasted Database Round Trips**: Invalid data traveled through the entire request pipeline before failing at the database layer.

3. **Defense-in-Depth Violation**: Single point of failure (database only) instead of layered validation.

---

## Solution Approach

### Schemas Modified

1. **insertProductOfferSchema**
   - `price >= 0` (non-negative)
   - `originalPrice >= 0` (when not null)
   - `price <= originalPrice` (sale price cannot exceed original)

2. **insertPriceAlertSchema**
   - `targetPrice > 0` (strictly positive)
   - `priceWhenCreated >= 0` (when not null)

3. **insertPriceHistorySchema**
   - `price >= 0` (non-negative)
   - `originalPrice >= 0` (when not null)

---

## Critical Technical Pattern: DECIMAL Field Validation with Drizzle ORM

### The Challenge

PostgreSQL DECIMAL columns are represented as `string` in Drizzle ORM (via drizzle-zod) to avoid JavaScript floating-point precision issues. This creates a critical decision point when adding validation.

### Anti-Pattern: Using `.coerce.number()`

```typescript
// ❌ WRONG - Changes the TypeScript type from string to number
export const insertProductOfferSchema = createInsertSchema(productOffers)
  .omit({ id: true, lastUpdated: true })
  .extend({
    price: z.coerce.number().min(0),  // Changes type to number!
    originalPrice: z.coerce.number().min(0).optional(),
  });
```

**Problems:**
- Changes `InsertProductOffer.price` from `string` to `number`
- Breaks type compatibility with Drizzle's database operations
- Causes TypeScript errors across the codebase wherever `InsertProductOffer` is used
- Drizzle expects `string` for DECIMAL columns; `number` will cause runtime errors

### Correct Pattern: Using `.refine()` with `parseFloat()`

```typescript
// ✅ CORRECT - Validates numeric value while preserving string type
export const insertProductOfferSchema = createInsertSchema(productOffers)
  .omit({
    id: true,
    lastUpdated: true,
  })
  .refine(
    (data) => {
      const price = parseFloat(data.price);
      return !isNaN(price) && price >= 0;
    },
    { message: "Price must be non-negative", path: ["price"] }
  )
  .refine(
    (data) => {
      if (!data.originalPrice) return true;  // null/undefined is valid
      const originalPrice = parseFloat(data.originalPrice);
      return !isNaN(originalPrice) && originalPrice >= 0;
    },
    { message: "Original price must be non-negative", path: ["originalPrice"] }
  )
  .refine(
    (data) => {
      if (!data.originalPrice) return true;  // No comparison if no original
      const price = parseFloat(data.price);
      const originalPrice = parseFloat(data.originalPrice);
      return price <= originalPrice;
    },
    { message: "Sale price cannot exceed original price", path: ["price"] }
  );
```

**Benefits:**
- Preserves `string` type for Drizzle ORM compatibility
- Validates the numeric value at application layer
- Provides clear, user-friendly error messages
- Includes field path for UI error highlighting
- Handles optional fields gracefully (null/undefined checks)

### Validation Pattern Details

#### 1. Non-Negative Validation (>= 0)
```typescript
.refine(
  (data) => {
    const value = parseFloat(data.fieldName);
    return !isNaN(value) && value >= 0;
  },
  { message: "Field must be non-negative", path: ["fieldName"] }
)
```

**Use for:** Prices that can be zero (free products, $0.00 offers)

#### 2. Strictly Positive Validation (> 0)
```typescript
.refine(
  (data) => {
    const value = parseFloat(data.fieldName);
    return !isNaN(value) && value > 0;
  },
  { message: "Field must be positive", path: ["fieldName"] }
)
```

**Use for:** Values that must have a positive amount (target prices for alerts)

#### 3. Nullable Field Validation
```typescript
.refine(
  (data) => {
    if (!data.fieldName) return true;  // null/undefined is valid
    const value = parseFloat(data.fieldName);
    return !isNaN(value) && value >= 0;
  },
  { message: "Field must be non-negative", path: ["fieldName"] }
)
```

**Use for:** Optional price fields that are valid when null but must be non-negative when present

#### 4. Cross-Field Validation
```typescript
.refine(
  (data) => {
    if (!data.originalPrice) return true;  // No comparison if no original
    const price = parseFloat(data.price);
    const originalPrice = parseFloat(data.originalPrice);
    return price <= originalPrice;
  },
  { message: "Sale price cannot exceed original price", path: ["price"] }
)
```

**Use for:** Business rules involving multiple fields (sale price must be <= original)

---

## Schema-Database Constraint Mapping

### Documentation Pattern

Add comments above table definitions linking to constraints:

```typescript
// Product offers with price constraints (migration 0020)
// DB CHECK CONSTRAINTS:
//   - check_product_offers_price_positive: price >= 0
//   - check_product_offers_original_price_positive: original_price >= 0 (when not NULL)
//   - check_product_offers_price_logical: price <= original_price (when original_price is set)
export const productOffers = pgTable("product_offers", {
  // ...
});
```

Add comments above schema definitions:

```typescript
// Mirrors migration 0020 CHECK constraints:
// - price >= 0
// - originalPrice >= 0 (when not null)
// - price <= originalPrice (when originalPrice set)
export const insertProductOfferSchema = createInsertSchema(productOffers)
  // ...
```

---

## Defense-in-Depth Validation Strategy

### Architecture Layers

```
Layer 1: Frontend Validation (Optional - React Hook Form + Zod)
    ↓
Layer 2: API Route Validation (Zod schema.parse())
    ↓
Layer 3: Storage Layer (Business logic validation)
    ↓
Layer 4: Database Constraints (CHECK constraints in PostgreSQL)
```

### Layer Responsibilities

| Layer | Purpose | Error Type | User Experience |
|-------|---------|------------|-----------------|
| **Frontend** | Immediate feedback | Inline form errors | Instant, specific |
| **API Route** | Catch invalid requests | 400 with Zod errors | Clear validation message |
| **Storage** | Business rules | Application error | Contextual message |
| **Database** | Final safety net | 500 (constraint violation) | Generic error |

### Why Both Application AND Database Validation?

1. **Early Rejection**: Application layer rejects invalid data immediately (milliseconds)
2. **Better Messages**: Zod provides user-friendly, field-specific errors
3. **Database Safety**: Constraints catch edge cases (direct DB access, race conditions)
4. **Audit Trail**: Database constraints leave permanent validation record
5. **Trust But Verify**: Never assume upstream validation ran correctly

---

## Testing Strategy

### Test Categories (24 tests total)

#### 1. Basic Validation Tests
```typescript
describe("price validation", () => {
  it("should reject negative price", () => {
    const result = insertProductOfferSchema.safeParse({
      productId: 1,
      retailerId: 1,
      price: "-10.00",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe("Price must be non-negative");
    expect(result.error.issues[0].path).toEqual(["price"]);
  });
});
```

#### 2. Edge Case Tests
```typescript
it("should accept zero price (free products)", () => {
  const result = insertProductOfferSchema.safeParse({
    productId: 1,
    retailerId: 1,
    price: "0.00",
  });
  expect(result.success).toBe(true);
});
```

#### 3. Cross-Field Validation Tests
```typescript
it("should reject sale price > original price", () => {
  const result = insertProductOfferSchema.safeParse({
    productId: 1,
    retailerId: 1,
    price: "100.00",
    originalPrice: "50.00",
  });
  expect(result.success).toBe(false);
  expect(result.error.issues[0].message).toBe("Sale price cannot exceed original price");
});
```

#### 4. Defense-in-Depth Documentation Tests
```typescript
describe("Defense in Depth - Database vs Application Validation", () => {
  it("should provide helpful error messages at application layer", () => {
    // Before: Database error - cryptic
    // "new row for relation \"product_offers\" violates check constraint..."

    // After: Application error - helpful
    const result = insertProductOfferSchema.safeParse({
      productId: 1,
      retailerId: 1,
      price: "-10.00",
    });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe("Price must be non-negative");
    expect(result.error.issues[0].path).toEqual(["price"]);
  });
});
```

---

## Integration Guide

### Routes Using These Schemas

```typescript
// POST /api/product-offers (create)
// PUT /api/product-offers/:id (update)
import { insertProductOfferSchema } from '@shared/schema';

app.post('/api/product-offers', withAuth(async (req, res) => {
  try {
    const data = insertProductOfferSchema.parse(req.body);
    // If we get here, price fields are validated
    const offer = await storage.createProductOffer(data);
    sendSuccess(res, offer, 201);
  } catch (error) {
    // Zod errors automatically handled by sendErrorFromException
    sendErrorFromException(res, error, 'CreateProductOffer');
  }
}));

// POST /api/price-alerts (create)
import { insertPriceAlertSchema } from '@shared/schema';

// POST /api/price-history (add history)
import { insertPriceHistorySchema } from '@shared/schema';
```

---

## Key Takeaways

### 1. Preserve ORM Type Compatibility
When adding validation to schemas generated by `drizzle-zod`, use `.refine()` with type-preserving logic rather than `.extend()` with type-changing transformations.

### 2. Decimal Fields Are Strings in Drizzle
PostgreSQL DECIMAL columns map to TypeScript `string` to avoid floating-point precision issues. Validation must parse strings but preserve the string type.

### 3. Document Constraint Relationships
Always comment both the table definition (linking to migration) and the schema definition (listing what constraints are mirrored).

### 4. Test Error Messages and Paths
Verify not just that validation fails, but that the error message is user-friendly and the path correctly identifies the field.

### 5. Handle Nullable Fields Gracefully
Use early-return patterns (`if (!data.field) return true`) for nullable fields to avoid parseFloat errors on null/undefined.

---

## Related Documentation

- **Migration:** `migrations/0020_add_price_check_constraints.sql`
- **Schema:** `shared/schema.ts` (lines 555-673)
- **Tests:** `server/__tests__/schema-validation-check-constraints.test.ts`
- **Pattern Docs:** `docs/01_TYPESCRIPT_PATTERNS.md` (Zod Schema Patterns section)
- **Database Docs:** `docs/02_DATABASE_PATTERNS.md`

---

## Checklist for Future CHECK Constraint Mirroring

When adding new database CHECK constraints:

- [ ] Add CHECK constraint in migration SQL
- [ ] Document constraint in table definition comments
- [ ] Add `.refine()` validation to corresponding insert schema
- [ ] Use `parseFloat()` for DECIMAL fields (preserves string type)
- [ ] Handle nullable fields with early-return
- [ ] Include descriptive error message
- [ ] Include field path for UI highlighting
- [ ] Write tests for: valid cases, invalid cases, edge cases (0, null)
- [ ] Document the constraint relationship in schema comments

---

**Maintained By:** Claude Code / Development Team
**Next Review:** When adding new price-related tables or constraints
