# TODO 251: Add Country/Currency Support to Retailers

**Priority**: P2
**File(s)**: `shared/schema.ts`, `server/storage/domains/retailer-storage.ts`, `client/src/context/country-context.tsx`
**Estimated Time**: 4-6 hours
**Status**: ✅ Complete
**Dependencies**: None

## Completed Work

### Phase 1: Backend Implementation (2026-01-21)

1. **Schema Updated** (`shared/schema.ts`):
   - Added `countryCode` (VARCHAR(2), NOT NULL, default 'US')
   - Added `currency` (VARCHAR(3), NOT NULL, default 'USD')

2. **Migration Created** (`migrations/0030_add_retailer_country_support.sql`):
   - Added columns with defaults
   - Created index `idx_retailers_country` for country filtering
   - Created unique constraint `idx_retailers_unique_per_country` (name + country_code)
   - Added CHECK constraints for valid country/currency codes (US/CA, USD/CAD)

3. **Storage Layer Updated** (`server/storage/domains/retailer-storage.ts`):
   - Added `getRetailersByCountry(countryCode: string)` method
   - Added country code and currency validation
   - Updated `VALID_COUNTRY_CODES` and `COUNTRY_CURRENCIES` constants

4. **API Routes Updated** (`server/routes/retailer-routes.ts`):
   - Added `GET /api/countries` endpoint (returns supported countries with currencies)
   - Updated `GET /api/retailers` to support `?country=XX` query parameter
   - Added validation for country code parameter

5. **IStorage Interface Updated** (`server/storage.ts`):
   - Added `getRetailersByCountry()` to interface
   - Updated MemStorage implementation

### Phase 2: Frontend Implementation (2026-01-22)

1. **Country Context Created** (`client/src/context/country-context.tsx`):
   - `CountryProvider` component wrapping app
   - `useCountry()` hook for accessing country state
   - `formatPrice()` function for currency-aware formatting
   - localStorage persistence of user's country preference
   - Fetches supported countries from `/api/countries`

2. **Country Selector Component** (`client/src/components/country-selector.tsx`):
   - Dropdown with country flags (🇺🇸 US, 🇨🇦 CA)
   - Compact and full variants
   - Shows currency code option

3. **Price Components** (`client/src/components/ui/price.tsx`):
   - `<Price>` component for currency-aware display
   - `<PriceWithDiscount>` for showing original/sale prices
   - Uses country context for formatting

4. **App Integration** (`client/src/App.tsx`):
   - Added `<CountryProvider>` to app wrapper

5. **Navigation Updated** (`client/src/components/shared-navigation.tsx`):
   - Added country selector to desktop nav (next to theme toggle)
   - Added country selector to mobile nav menu

## Problem Statement (Resolved)

Retailers like Amazon operate separate affiliate programs per country (Amazon.com, Amazon.ca, Amazon.com.mx). Currently, the schema treats all retailers as country-agnostic, which causes:

1. **Affiliate Attribution Loss**: Can't use US affiliate tag for Canadian purchases
2. **Price Confusion**: $99 CAD ≠ $99 USD displayed without context
3. **Inventory Mismatch**: Products may not exist across all country variants
4. **URL Conflicts**: Same retailer name but different domains (amazon.com vs amazon.ca)

## Solution Approach

Add `countryCode` and `currency` fields to the retailers table, allowing:
- Separate retailer entries per country (Amazon US, Amazon CA)
- Country-specific affiliate configurations
- Proper currency display
- User preference filtering

## Implementation Steps

### Step 1: Schema Migration

- [ ] Add columns to retailers table in `shared/schema.ts`
- [ ] Create migration file in `migrations/`

```typescript
// shared/schema.ts - Add to retailers table
countryCode: varchar('country_code', { length: 2 }).notNull().default('US'),
currency: varchar('currency', { length: 3 }).notNull().default('USD'),
```

**Supported Countries (Phase 1)**:
| Country | Code | Currency | Example Domain |
|---------|------|----------|----------------|
| USA | US | USD | amazon.com |
| Canada | CA | CAD | amazon.ca |

**Phase 2 (Future)**:
| Country | Code | Currency | Example Domain |
|---------|------|----------|----------------|
| Mexico | MX | MXN | amazon.com.mx |
| UK | GB | GBP | amazon.co.uk |

### Step 2: Update Retailer Storage

- [ ] Update `retailer-storage.ts` queries to include new fields
- [ ] Add `getRetailersByCountry(countryCode: string)` method
- [ ] Update insert/update schemas

```typescript
// New method in retailer-storage.ts
async getRetailersByCountry(countryCode: string): Promise<Retailer[]> {
  return await db
    .select()
    .from(retailers)
    .where(and(
      eq(retailers.countryCode, countryCode),
      eq(retailers.isActive, true)
    ))
    .orderBy(retailers.name);
}
```

### Step 3: Update Insert Schema

- [ ] Add validation for countryCode (ISO 3166-1 alpha-2)
- [ ] Add validation for currency (ISO 4217)

```typescript
// shared/schema.ts
export const insertRetailerSchema = createInsertSchema(retailers)
  .omit({ id: true })
  .extend({
    countryCode: z.string().length(2).default('US'),
    currency: z.string().length(3).default('USD'),
  });
```

### Step 4: Seed Data Updates

- [ ] Update seed data to create country-specific retailers
- [ ] Example entries for Amazon US + Amazon CA

```typescript
// Example seed data structure
const retailers = [
  {
    name: 'Amazon',
    website: 'https://www.amazon.com',
    countryCode: 'US',
    currency: 'USD',
    affiliateProgram: 'amazon-associates',
    affiliateId: 'pricecompare-20', // US tag
  },
  {
    name: 'Amazon',
    website: 'https://www.amazon.ca',
    countryCode: 'CA',
    currency: 'CAD',
    affiliateProgram: 'amazon-associates',
    affiliateId: 'pricecompareca-20', // CA tag
  },
];
```

### Step 5: API Updates

- [ ] Add `countryCode` query param to `GET /api/retailers`
- [ ] Return currency with price data in offer responses
- [ ] Add `GET /api/countries` endpoint for supported countries

### Step 6: Frontend Updates

- [ ] Add country selector to user preferences (or auto-detect)
- [ ] Display currency symbol with prices
- [ ] Filter retailers by selected country
- [ ] Store country preference in localStorage or user profile

### Step 7: Scraping Updates

- [ ] Update URL pattern matching to handle country-specific domains
- [ ] Map scraped URLs to correct country retailer

```typescript
// URL to country mapping
const AMAZON_DOMAINS: Record<string, string> = {
  'amazon.com': 'US',
  'amazon.ca': 'CA',
  'amazon.com.mx': 'MX',
};
```

## Database Migration

```sql
-- migrations/XXXX_add_retailer_country.sql
ALTER TABLE retailers 
ADD COLUMN country_code VARCHAR(2) NOT NULL DEFAULT 'US',
ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Create index for country filtering
CREATE INDEX idx_retailers_country ON retailers(country_code);

-- Add unique constraint: same retailer name per country is allowed, 
-- but same name+country+website should be unique
CREATE UNIQUE INDEX idx_retailers_unique_per_country 
ON retailers(name, country_code, website) 
WHERE is_active = true;
```

## Files to Update

1. `shared/schema.ts` - Add countryCode, currency columns
2. `migrations/XXXX_add_retailer_country.sql` - Migration file
3. `server/storage/domains/retailer-storage.ts` - Query updates
4. `server/retailer-routes.ts` - API endpoint updates
5. `client/src/hooks/use-retailers.ts` - Frontend hooks
6. `client/src/components/settings/` - Country preference UI
7. `server/services/url-parser.ts` - URL to country mapping

## Testing Checklist

- [ ] Migration runs successfully (up and down)
- [ ] Existing retailers default to US/USD
- [ ] Can create retailers for different countries
- [ ] API filters by country correctly
- [ ] Frontend displays correct currency
- [ ] Affiliate links use correct country-specific tags
- [ ] Unique constraint prevents duplicate retailer+country combinations

## Success Criteria

- [ ] Schema supports country-specific retailers
- [ ] US and CA retailers can coexist with same name
- [ ] Prices display with correct currency
- [ ] Affiliate attribution works per country
- [ ] User can filter by preferred country

## Future Considerations

- **Multi-currency comparison**: Convert prices to user's preferred currency for cross-border comparison
- **Geo-detection**: Auto-detect user country from IP/browser settings
- **Shipping awareness**: Some retailers ship cross-border, factor shipping costs
- **Tax handling**: Display prices with/without local taxes

## Related TODOs

- TODO 250: JSON Parsing (affiliateConfig may need country-specific configs)
