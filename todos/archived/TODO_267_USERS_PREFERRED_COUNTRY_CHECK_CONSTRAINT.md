# TODO 267: Add CHECK Constraint to users.preferred_country

**Priority**: P1 (CRITICAL - Data Integrity Risk)
**File(s)**: `migrations/0031_add_user_preferences.sql`, `server/storage/domains/user-storage.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The `users.preferred_country` column (migration 0031) lacks a CHECK constraint to validate country codes, unlike the `retailers` table which has `chk_retailers_country_code`. This creates a data integrity gap where invalid country codes can be stored in the database.

## Root Cause

Migration 0031 was added without the same CHECK constraint pattern used in migration 0030 for retailers. The TypeScript validation in `auth-routes.ts:834` catches invalid codes at the API level, but direct SQL operations (admin tools, migrations, backups) can bypass this.

## Evidence

**Migration 0030 (retailers) - CORRECT:**
```sql
ADD CONSTRAINT chk_retailers_country_code
CHECK (country_code IN ('US', 'CA'));
```

**Migration 0031 (users) - MISSING:**
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(2) DEFAULT NULL;
-- No CHECK constraint!
```

## Solution Approach

Create migration 0032 to add the CHECK constraint to users.preferred_country.

## Implementation Steps

### Step 1: Create Migration

- [ ] Create `migrations/0032_add_users_preferred_country_constraint.sql`
- [ ] Add idempotent CHECK constraint using same pattern as migration 0030

### Step 2: Fix Storage Layer Validation

- [ ] Update `user-storage.ts:956-961` to use `isValidCountryCode()` from shared constants
- [ ] Match pattern used in `retailer-storage.ts:108-114`

## Technical Details

**New Migration (0032):**
```sql
-- Migration 0032: Add CHECK constraint to users.preferred_country
-- Ensures consistency with retailers.country_code validation

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_preferred_country'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT chk_users_preferred_country
    CHECK (preferred_country IS NULL OR preferred_country IN ('US', 'CA'));
  END IF;
END $$;

-- Update constraint comment
COMMENT ON CONSTRAINT chk_users_preferred_country ON users IS
  'Validates preferred_country matches supported countries (sync with shared/country-constants.ts)';
```

**Storage Layer Fix:**
```typescript
// user-storage.ts - Replace regex-only validation
import { isValidCountryCode, VALID_COUNTRY_CODES } from '@shared/country-constants';

// Line 958-961: Replace format-only check with value validation
if (!isValidCountryCode(preferences.preferredCountry)) {
  throw new Error(
    `Invalid country code: ${preferences.preferredCountry}. Must be one of: ${VALID_COUNTRY_CODES.join(', ')}`
  );
}
```

## Checklist

- [ ] Migration 0032 created with idempotent pattern
- [ ] Storage layer validation updated
- [ ] Tests verify constraint blocks invalid codes
- [ ] E2E helpers.ts updated with new migration
- [ ] Documentation updated (country-constants.ts comments)

## Success Criteria

- [ ] `INSERT INTO users (preferred_country) VALUES ('XX')` fails with CHECK constraint error
- [ ] `INSERT INTO users (preferred_country) VALUES ('US')` succeeds
- [ ] `INSERT INTO users (preferred_country) VALUES (NULL)` succeeds
- [ ] Storage layer throws descriptive error for invalid codes
- [ ] All existing tests pass

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: data-migration-expert, data-integrity-guardian, security-sentinel
