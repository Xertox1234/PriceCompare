# TODO 262: Consolidate Country/Currency Constants

**Priority**: P3 - Nice-to-Have (Code Quality)
**Effort**: Small (~30 minutes)
**Category**: Code Quality / DRY
**Source**: Code Review - Pattern Recognition Specialist
**Branch**: add_scraping

## Problem Statement

Country/currency constants are duplicated in multiple locations:

1. `server/storage/domains/retailer-storage.ts` - `VALID_COUNTRY_CODES`, `COUNTRY_CURRENCIES`
2. `server/routes/retailer-routes.ts` - `SUPPORTED_COUNTRIES`, `VALID_COUNTRY_CODES`
3. `client/src/components/country-selector.tsx` - `countryFlags`
4. `migrations/0030_add_retailer_country_support.sql` - CHECK constraint values

This creates maintenance burden - adding a new country (e.g., Mexico) requires updating 4+ files.

## Findings

### Duplication Locations

**retailer-storage.ts:21-28**
```typescript
const VALID_COUNTRY_CODES = ['US', 'CA'] as const;
const COUNTRY_CURRENCIES: Record<CountryCode, string> = {
  US: 'USD',
  CA: 'CAD',
};
```

**retailer-routes.ts:11-16**
```typescript
const SUPPORTED_COUNTRIES = [
  { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$' },
  { code: 'CA', name: 'Canada', currency: 'CAD', currencySymbol: 'C$' },
];
const VALID_COUNTRY_CODES = ['US', 'CA'];
```

**country-selector.tsx:30-35**
```typescript
const countryFlags: Record<string, string> = {
  US: '🇺🇸',
  CA: '🇨🇦',
};
```

## Proposed Solution

Create a shared constants file:

```typescript
// shared/country-constants.ts
export const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    flag: '🇺🇸',
    locale: 'en-US'
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    currencySymbol: 'C$',
    flag: '🇨🇦',
    locale: 'en-CA'
  },
] as const;

export type CountryCode = typeof COUNTRIES[number]['code'];
export type CurrencyCode = typeof COUNTRIES[number]['currency'];

export const VALID_COUNTRY_CODES = COUNTRIES.map(c => c.code);
export const COUNTRY_CURRENCIES: Record<CountryCode, CurrencyCode> =
  Object.fromEntries(COUNTRIES.map(c => [c.code, c.currency]));
```

## Acceptance Criteria

- [ ] Single source of truth for country data in `shared/country-constants.ts`
- [ ] Server imports from shared module
- [ ] Client imports from shared module
- [ ] Remove duplicate definitions
- [ ] Document that database CHECK constraints must be updated separately
- [ ] Add TODO comment near CHECK constraints referencing shared constants

## Files to Modify

- `shared/country-constants.ts` (new)
- `server/storage/domains/retailer-storage.ts`
- `server/routes/retailer-routes.ts`
- `client/src/components/country-selector.tsx`

## Notes

Database CHECK constraints (`migrations/0030`) cannot import from TypeScript files. Document this coupling and add a comment in the migration referencing the shared constants file.

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - pattern recognition specialist |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Pattern recognition finding: Country constant duplication
