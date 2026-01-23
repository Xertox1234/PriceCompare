# TODO 261: Add Caching for Country-Filtered Retailers Query

**Priority**: P2 - Important (Performance)
**Effort**: Small (~30 minutes)
**Category**: Performance / Caching
**Source**: Code Review - Architecture Strategist & Performance Oracle
**Branch**: add_scraping

## Problem Statement

The `getRetailersByCountry()` query bypasses the caching layer. Every country-filtered request hits the database directly. With the new country selector in the UI, this could significantly increase database load.

## Findings

### Direct Database Access (retailer-routes.ts:59-62)
```typescript
if (countryCode) {
  // Fetch retailers filtered by country (no cache layer for this yet)
  const retailers = await storage.getRetailersByCountry(countryCode);
  sendSuccess(res, retailers);
  return;
}
```

### storageCache Missing Method
The `storageCache` service does not have a `getRetailersByCountry` method.

## Impact

- Every user setting country preference hits database
- Static data (retailers) queried repeatedly
- Cache hit rate for retailers reduced

## Proposed Solution

Add country-keyed caching to `storage-cache.ts`:

```typescript
// In storage-cache.ts
async getRetailersByCountry(countryCode: string): Promise<Retailer[]> {
  const cacheKey = `retailers:country:${countryCode}`;
  return this.cacheWrapper(
    cacheKey,
    CACHE_TIERS.STATIC,  // 1 hour TTL - retailers rarely change
    () => storage.getRetailersByCountry(countryCode)
  );
}
```

Update route to use cached version:
```typescript
// In retailer-routes.ts
if (countryCode) {
  const retailers = await storageCache.getRetailersByCountry(countryCode);
  sendSuccess(res, retailers);
  return;
}
```

Add cache invalidation:
```typescript
// In cache-invalidation.ts
async onRetailerUpdate(retailerId: number): Promise<void> {
  // ...existing invalidation...

  // Invalidate country-specific caches
  await advancedCache.delete('retailers:country:US');
  await advancedCache.delete('retailers:country:CA');
}
```

## Acceptance Criteria

- [ ] `storageCache.getRetailersByCountry()` method added
- [ ] Uses STATIC tier caching (1 hour TTL)
- [ ] Route updated to use cached version
- [ ] Cache invalidated on retailer update
- [ ] Test: Second request for same country is cache hit

## Files to Modify

- `server/services/storage-cache.ts`
- `server/routes/retailer-routes.ts`
- `server/services/cache-invalidation.ts`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - architecture strategist |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Storage cache: `server/services/storage-cache.ts`
- Retailer routes: `server/routes/retailer-routes.ts`
- Cache tiers defined in: `server/services/advanced-cache.ts`
