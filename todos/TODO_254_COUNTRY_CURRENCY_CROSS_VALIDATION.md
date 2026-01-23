# TODO 254: Add Cross-Column CHECK Constraint for Country/Currency Match

**Priority**: P1 - CRITICAL (Data Integrity)
**Effort**: Small (~15 minutes)
**Category**: Database
**Source**: Code Review - Data Integrity Guardian
**Branch**: add_scraping

## Problem Statement

The migration adds separate CHECK constraints for `country_code` and `currency`, but does NOT enforce the logical relationship between them. A retailer could have:

- `country_code='US'` with `currency='CAD'` ❌ INVALID but accepted!
- `country_code='CA'` with `currency='USD'` ❌ INVALID but accepted!

While the storage layer validates this in code, a direct database insert or admin update could bypass this validation.

## Risk Assessment

- **Impact**: Data corruption with invalid country/currency combinations
- **Likelihood**: Low (admin-only direct DB access)
- **Severity**: Medium (business logic violation)

## Findings

### Current Constraints (Lines 36-45)
```sql
-- Validates country and currency SEPARATELY
CHECK (country_code IN ('US', 'CA'));
CHECK (currency IN ('USD', 'CAD'));

-- Missing: Cross-column validation
```

### Application Layer Validation (retailer-storage.ts:93-100)
```typescript
// This validates correctly but can be bypassed by direct DB access
const expectedCurrency = COUNTRY_CURRENCIES[data.countryCode];
if (data.currency && data.currency !== expectedCurrency) {
  throw new Error(`Currency mismatch...`);
}
```

## Proposed Solution

Add a cross-column CHECK constraint to migration 0030:

```sql
-- Add after existing CHECK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_retailers_country_currency_match'
  ) THEN
    ALTER TABLE retailers
    ADD CONSTRAINT chk_retailers_country_currency_match
    CHECK (
      (country_code = 'US' AND currency = 'USD') OR
      (country_code = 'CA' AND currency = 'CAD')
    );
  END IF;
END $$;
```

## Acceptance Criteria

- [ ] Cross-column constraint added to migration
- [ ] Constraint is idempotent (IF NOT EXISTS pattern)
- [ ] Test: INSERT with US/CAD fails
- [ ] Test: INSERT with CA/USD fails
- [ ] Test: INSERT with US/USD succeeds
- [ ] Test: INSERT with CA/CAD succeeds

## Files to Modify

- `migrations/0030_add_retailer_country_support.sql`

## Verification Query

```sql
-- Test constraint enforcement
INSERT INTO retailers (name, country_code, currency, is_active)
VALUES ('Test', 'US', 'CAD', true);
-- Expected: ERROR violates check constraint "chk_retailers_country_currency_match"
```

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - data integrity guardian |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Migration file: `migrations/0030_add_retailer_country_support.sql`
- Storage validation: `server/storage/domains/retailer-storage.ts:93-100`
