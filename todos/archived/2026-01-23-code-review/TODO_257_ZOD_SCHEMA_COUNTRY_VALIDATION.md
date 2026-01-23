# TODO 257: Add Zod Validation for Country/Currency in Retailer Schema

**Priority**: P2 - Important (Data Integrity)
**Effort**: Small (~30 minutes)
**Category**: Validation
**Source**: Code Review - Data Integrity Guardian & Architecture Strategist
**Branch**: add_scraping

## Problem Statement

The `insertRetailerSchema` in `shared/schema.ts` does not include Zod refinements for `countryCode` and `currency`. Invalid country codes could pass API validation and only fail at the database level, causing:

1. Less informative error messages
2. Potential data inconsistency during partial operations
3. Inconsistent validation between API and database layers

## Findings

### Current Schema (shared/schema.ts:760-762)
```typescript
// NO validation for countryCode/currency
export const insertRetailerSchema = createInsertSchema(retailers).omit({
  id: true,
});
```

### Expected (From TODO 251 Plan)
```typescript
export const insertRetailerSchema = createInsertSchema(retailers)
  .omit({ id: true })
  .extend({
    countryCode: z.string().length(2).default('US'),
    currency: z.string().length(3).default('USD'),
  });
```

## Proposed Solution

Update `shared/schema.ts` with proper validation:

```typescript
export const insertRetailerSchema = createInsertSchema(retailers)
  .omit({ id: true })
  .extend({
    countryCode: z.enum(['US', 'CA']).default('US'),
    currency: z.enum(['USD', 'CAD']).default('USD'),
  })
  .refine(
    (data) => {
      const validPairs: Record<string, string> = { US: 'USD', CA: 'CAD' };
      return validPairs[data.countryCode] === data.currency;
    },
    { message: 'Currency must match country (US→USD, CA→CAD)' }
  );
```

## Acceptance Criteria

- [x] Schema validates `countryCode` as enum `['US', 'CA']`
- [x] Schema validates `currency` as enum `['USD', 'CAD']`
- [x] Schema enforces country/currency matching via `refine()`
- [x] Invalid combinations return clear error message
- [x] Defaults applied correctly (US/USD)

## Files to Modify

- `shared/schema.ts`

## Verification

```typescript
// Should pass
insertRetailerSchema.parse({ name: 'Test', countryCode: 'US', currency: 'USD' });
insertRetailerSchema.parse({ name: 'Test', countryCode: 'CA', currency: 'CAD' });
insertRetailerSchema.parse({ name: 'Test' }); // Defaults to US/USD

// Should fail
insertRetailerSchema.parse({ name: 'Test', countryCode: 'US', currency: 'CAD' });
// Error: "Currency must match country (US→USD, CA→CAD)"
```

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - data integrity guardian |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |
| 2026-01-23 | **IMPLEMENTED** | Added refine() validation for country/currency enum and cross-column matching |

## Resources

- Schema file: `shared/schema.ts`
- TODO 251: Retailer Country Support
