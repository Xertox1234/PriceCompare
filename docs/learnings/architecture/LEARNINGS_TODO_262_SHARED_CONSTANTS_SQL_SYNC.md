# Learning: Shared Constants with SQL Constraint Synchronization

**Date**: 2026-01-23
**Source**: TODO 262 - Country Constants Consolidation
**Category**: Architecture / Database
**Severity**: Important (silent data integrity risk)

## Problem Encountered

Country/currency constants were duplicated in 4+ locations:
- `server/storage/domains/retailer-storage.ts`
- `server/routes/retailer-routes.ts`
- `client/src/components/country-selector.tsx`
- `shared/schema.ts` (Zod validation)
- `migrations/0030_add_retailer_country_support.sql` (CHECK constraints)

Adding a new country (e.g., Mexico) required updating all 5 files. The first 4 are TypeScript and can share a module, but **SQL migrations cannot import TypeScript**.

## The Hidden Coupling

```
┌─────────────────────────────────────────────────────────────────┐
│                    TypeScript (can share)                        │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ retailer-storage │───▶│ shared/country-  │◀─── retailer-routes│
│  │                  │    │ constants.ts     │◀─── country-selector│
│  │                  │    │                  │◀─── schema.ts      │
│  └──────────────────┘    └────────┬─────────┘                   │
│                                   │                              │
│                          MANUAL SYNC REQUIRED                    │
│                                   │                              │
│  ┌────────────────────────────────▼─────────────────────────────┐
│  │              SQL Migration (cannot import TS)                 │
│  │  CHECK (country_code IN ('US', 'CA'))                        │
│  │  CHECK (currency IN ('USD', 'CAD'))                          │
│  │  CHECK ((country_code = 'US' AND currency = 'USD') OR ...)   │
│  └──────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

## Risk Scenario

1. Developer adds Mexico to `shared/country-constants.ts`
2. TypeScript code now accepts `MX` / `MXN`
3. API validation passes (uses TypeScript constants)
4. **Database INSERT fails** with CHECK constraint violation
5. User sees cryptic "constraint violation" error

## Solution Implemented

### 1. Single Source of Truth for TypeScript

Created `shared/country-constants.ts`:

```typescript
export const COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', flag: '🇺🇸', locale: 'en-US' },
  { code: 'CA', name: 'Canada', currency: 'CAD', flag: '🇨🇦', locale: 'en-CA' },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]['code'];
export const VALID_COUNTRY_CODES = COUNTRIES.map((c) => c.code);

// Type guard for validation
export function isValidCountryCode(code: string): code is CountryCode {
  return VALID_COUNTRY_CODES.includes(code as CountryCode);
}
```

### 2. Documentation in Migration File

Added comment at top of `migrations/0030_add_retailer_country_support.sql`:

```sql
-- IMPORTANT: Country/currency values in CHECK constraints below must stay in sync with:
--   shared/country-constants.ts - Single source of truth for TypeScript code
-- When adding new countries, update BOTH this migration AND the shared constants file.
```

### 3. Documentation in Constants File

Added header comment in `shared/country-constants.ts`:

```typescript
/**
 * IMPORTANT: Database CHECK constraints (migrations/0030_add_retailer_country_support.sql)
 * cannot import TypeScript. When adding new countries, you must ALSO update:
 * - chk_retailers_country_code
 * - chk_retailers_currency
 * - chk_retailers_country_currency_match
 */
```

## Prevention Checklist

When adding a new country/currency:

- [ ] Add to `COUNTRIES` array in `shared/country-constants.ts`
- [ ] Create new migration to ALTER CHECK constraints:
  ```sql
  -- migrations/00XX_add_country_mexico.sql
  ALTER TABLE retailers DROP CONSTRAINT chk_retailers_country_code;
  ALTER TABLE retailers ADD CONSTRAINT chk_retailers_country_code
    CHECK (country_code IN ('US', 'CA', 'MX'));

  ALTER TABLE retailers DROP CONSTRAINT chk_retailers_currency;
  ALTER TABLE retailers ADD CONSTRAINT chk_retailers_currency
    CHECK (currency IN ('USD', 'CAD', 'MXN'));

  ALTER TABLE retailers DROP CONSTRAINT chk_retailers_country_currency_match;
  ALTER TABLE retailers ADD CONSTRAINT chk_retailers_country_currency_match
    CHECK (
      (country_code = 'US' AND currency = 'USD') OR
      (country_code = 'CA' AND currency = 'CAD') OR
      (country_code = 'MX' AND currency = 'MXN')
    );
  ```
- [ ] Run `npm run db:push` to apply migration
- [ ] Verify with test INSERT

## Future Improvement Ideas

1. **Pre-commit hook**: Parse TypeScript constants and SQL constraints, fail if mismatched
2. **Generated migration**: Script that reads constants and generates ALTER statements
3. **Runtime validation**: On app startup, query `pg_constraint` and compare to TypeScript constants

## Related Patterns

- `docs/01_TYPESCRIPT_PATTERNS.md` - Shared Constants with Type Guards
- `docs/02_DATABASE_PATTERNS.md` - Migration Idempotency Pattern
- `CLAUDE.md` - Test Schema Synchronization requirement

## Key Takeaway

> **When TypeScript constants have a database counterpart (CHECK constraints, ENUM types),
> document the coupling in BOTH files and create a checklist for updates.**

This is a form of "documentation as code" - the comments serve as the only enforcement mechanism when automated validation isn't feasible.
