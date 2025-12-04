# TODO 2026: Add Zod validation for database CHECK constraints

**Priority**: P0 (CRITICAL - Data Integrity)
**File(s)**: `shared/schema.ts:555-606`
**Estimated Time**: 1 hour
**Status**: Ready
**Related Issue**: #160

## Problem Statement

Database has CHECK constraints preventing negative prices and invalid price ranges (added in migration 0020), but Zod schemas don't validate this at the application layer. This results in cryptic PostgreSQL errors instead of clean validation errors with helpful messages.

**Impact**: Users see database errors like `new row for relation "product_offers" violates check constraint` instead of helpful validation messages like `Price must be non-negative`.

## Root Cause

Migration 0020 added database-level CHECK constraints for data integrity:
- `check_product_offers_price_positive` - Prevents negative prices
- `check_product_offers_price_logical` - Prevents sale price > original price
- `check_price_alerts_target_price_positive` - Prevents invalid alert targets

However, the corresponding Zod schemas (`insertProductOfferSchema`, `insertPriceAlertSchema`, etc.) were not updated to include application-layer validation. This violates the "defense in depth" principle.

## Solution Approach

Add Zod validation rules that mirror the database CHECK constraints:
1. Extend `insertProductOfferSchema` with price validation (min: 0) and price logic validation
2. Extend `insertPriceAlertSchema` with targetPrice validation (min: 0.01)
3. Extend other price-related schemas as needed
4. Use `.refine()` for complex validations (sale price ≤ original price)

## Implementation Steps

### Step 1: Update insertProductOfferSchema

- [ ] Add `.extend()` with price validation: `z.coerce.number().min(0, "Price must be non-negative")`
- [ ] Add originalPrice validation: `z.coerce.number().min(0, "Original price must be non-negative").optional().nullable()`
- [ ] Add `.refine()` for price ≤ originalPrice logic
- [ ] Test with negative price → expect ZodError
- [ ] Test with sale price > original → expect ZodError

### Step 2: Update insertPriceAlertSchema

- [ ] Add `.extend()` with targetPrice validation: `z.coerce.number().min(0.01, "Target price must be positive")`
- [ ] Test with zero/negative targetPrice → expect ZodError
- [ ] Test with valid targetPrice → expect success

### Step 3: Update other price-related schemas

- [ ] Check `insertPriceHistorySchema` - add price validation if needed
- [ ] Check `updateProductOfferSchema` - add price validation if needed
- [ ] Check any other schemas with price fields

### Step 4: Testing

- [ ] Run TypeScript type check: `npm run check`
- [ ] Run ESLint: `npm run lint`
- [ ] Run existing test suite
- [ ] Manual testing with various invalid inputs

## Technical Details

**Current State** (❌ NO VALIDATION):
```typescript
// shared/schema.ts:555-560
export const insertProductOfferSchema = createInsertSchema(productOffers).omit({
  id: true,
  lastUpdated: true,
});
// Missing: .extend({ price: z.number().min(0), ... })
```

**Proposed Solution** (✅ WITH VALIDATION):
```typescript
export const insertProductOfferSchema = createInsertSchema(productOffers)
  .omit({ id: true, lastUpdated: true })
  .extend({
    price: z.coerce.number().min(0, "Price must be non-negative"),
    originalPrice: z.coerce
      .number()
      .min(0, "Original price must be non-negative")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => !data.originalPrice || data.price <= data.originalPrice,
    { message: "Sale price cannot exceed original price", path: ["price"] }
  );

export const insertPriceAlertSchema = createInsertSchema(priceAlerts)
  .omit({ id: true, createdAt: true })
  .extend({
    targetPrice: z.coerce.number().min(0.01, "Target price must be positive"),
  });
```

**Database Constraints to Mirror**:
```sql
-- From migration 0020
ALTER TABLE product_offers
  ADD CONSTRAINT check_product_offers_price_positive
    CHECK (CAST(price AS DECIMAL) >= 0);

ALTER TABLE product_offers
  ADD CONSTRAINT check_product_offers_price_logical
    CHECK (original_price IS NULL OR
           CAST(price AS DECIMAL) <= CAST(original_price AS DECIMAL));

ALTER TABLE price_alerts
  ADD CONSTRAINT check_price_alerts_target_price_positive
    CHECK (CAST(target_price AS DECIMAL) > 0);
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
- [ ] Documentation updated (if needed)
- [ ] Related files checked

## Success Criteria

### Before (Current Behavior):
```typescript
const offer = { price: '-10.00', ... };
const validated = insertProductOfferSchema.parse(offer);
await storage.createProductOffer(validated);
// ❌ Results in: PostgresError: new row for relation "product_offers" violates check constraint
```

### After (Expected Behavior):
```typescript
const offer = { price: '-10.00', ... };
const validated = insertProductOfferSchema.parse(offer);
// ✅ Throws ZodError with message: "Price must be non-negative"

// User sees helpful JSON response:
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "price": ["Price must be non-negative"]
  }
}
```

**Acceptance Criteria**:
- [ ] Negative prices rejected with ZodError "Price must be non-negative"
- [ ] Sale price > original rejected with ZodError "Sale price cannot exceed original price"
- [ ] Zero/negative price alerts rejected with ZodError "Target price must be positive"
- [ ] Valid data continues to pass validation
- [ ] Error messages are user-friendly
- [ ] All tests pass
- [ ] No TypeScript errors

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm schema extensions exist
  ```bash
  grep -A 10 "insertProductOfferSchema.*extend" shared/schema.ts
  # Should show: price validation, originalPrice validation, refine()

  grep -A 5 "insertPriceAlertSchema.*extend" shared/schema.ts
  # Should show: targetPrice validation
  ```

- [ ] **File inspection**: Manually inspect changed schemas
  ```bash
  cat shared/schema.ts | grep -A 15 "export const insertProductOfferSchema"
  # Should include .extend() and .refine()
  ```

### Testing
- [ ] **Run affected tests**: Execute schema validation tests
  ```bash
  npm test -- --grep "schema|validation"
  ```

- [ ] **Verify test results**: Confirm validation works
  - Test negative price → ZodError
  - Test sale > original → ZodError
  - Test valid data → Success

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  # Should complete with no errors
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  # Should pass with no errors or warnings
  ```

### Diagnostics
- [ ] **Check IDE diagnostics**: No new errors in shared/schema.ts
- [ ] **Verify imports**: Zod imports resolve correctly
- [ ] **Check for unused variables**: No new warnings

### Documentation Alignment
- [ ] **File changes match claims**: Verify schema modifications
  ```bash
  git diff shared/schema.ts
  # Should show .extend() and .refine() additions
  ```

### Integration
- [ ] **Test with API endpoints**: Verify validation works end-to-end
  ```bash
  # POST /api/products with negative price should return 400 with helpful error
  ```

### Final Verification
- [ ] **Run full test suite**: Ensure no regressions
  ```bash
  npm test
  # All tests should pass
  ```

- [ ] **Manual testing**: Test with various invalid inputs
  - Negative prices
  - Sale price > original
  - Zero target price

---

## Related Documentation

- `migrations/0020_add_price_check_constraints.sql` - Database CHECK constraints
- `docs/02_DATABASE_PATTERNS.md` - Validation patterns
- `docs/01_TYPESCRIPT_PATTERNS.md` - Zod usage patterns
- GitHub Issue #160 - Original issue description

## Benefits

- ✅ **Better UX**: Helpful validation errors instead of database errors
- ✅ **Faster feedback**: No database round trip for invalid data
- ✅ **Defense in depth**: Application + database validation layers
- ✅ **Consistent errors**: Standard JSON error format across all endpoints
- ✅ **Easier debugging**: Clear error messages for developers

---

**Created by**: Claude Triage System
**Creation Date**: 2025-12-04
**Source**: GitHub Issue #160
