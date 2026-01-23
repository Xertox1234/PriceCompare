# TODO 253: Make Migration 0030 CHECK Constraints Idempotent

**Priority**: P1 - CRITICAL (Data Integrity)
**Effort**: Small (~15 minutes)
**Category**: Database
**Source**: Code Review - Data Integrity Guardian & Data Migration Expert
**Branch**: add_scraping

## Problem Statement

Migration `0030_add_retailer_country_support.sql` uses `ADD CONSTRAINT` statements that will fail if the migration is run a second time. This creates deployment risk:

1. Partial migration failure leaves database in inconsistent state
2. Re-running migration during recovery fails
3. CI/CD pipeline retries will fail

## Findings

### Non-Idempotent Constraints (Lines 36-45)
```sql
-- These will FAIL on re-run with "constraint already exists" error
ALTER TABLE retailers
ADD CONSTRAINT chk_retailers_country_code
CHECK (country_code IN ('US', 'CA'));

ALTER TABLE retailers
ADD CONSTRAINT chk_retailers_currency
CHECK (currency IN ('USD', 'CAD'));
```

## Proposed Solution

Wrap constraint additions in conditional logic:

```sql
-- Idempotent constraint for country_code
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_retailers_country_code'
  ) THEN
    ALTER TABLE retailers
    ADD CONSTRAINT chk_retailers_country_code
    CHECK (country_code IN ('US', 'CA'));
  END IF;
END $$;

-- Idempotent constraint for currency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_retailers_currency'
  ) THEN
    ALTER TABLE retailers
    ADD CONSTRAINT chk_retailers_currency
    CHECK (currency IN ('USD', 'CAD'));
  END IF;
END $$;
```

## Acceptance Criteria

- [ ] Migration can be run multiple times without error
- [ ] Constraints are created on first run
- [ ] Re-run is a no-op (skips existing constraints)
- [ ] Transaction boundary maintained (BEGIN/COMMIT)

## Files to Modify

- `migrations/0030_add_retailer_country_support.sql`

## Pre-Deployment Verification

```sql
-- Test by running migration twice on test database
-- First run: Creates constraints
-- Second run: Should succeed (no-op)
```

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - data integrity guardian |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- PostgreSQL: CREATE CONSTRAINT IF NOT EXISTS workaround
- Migration file: `migrations/0030_add_retailer_country_support.sql`
