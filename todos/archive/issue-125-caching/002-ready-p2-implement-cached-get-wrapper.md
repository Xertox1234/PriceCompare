# TODO: Implement Generic cachedGet<T>() Wrapper

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 1, Task 2

---

## Problem Statement

Implement a generic `cachedGet<T>()` wrapper function that uses `advancedCache.getOrSet()` to provide type-safe, multi-tier caching for any storage method. This is the core caching primitive that all subsequent cached wrapper methods will use.

**Current State:**
- `StorageCacheService` class exists but has no caching methods
- Each cached method would require duplicate cache logic
- No standardized pattern for cache key generation, TTL management, and fallback handling
- Risk of inconsistent error handling across different cached methods

**Why This Matters:**
- Eliminates code duplication across all cached wrapper methods
- Ensures consistent cache behavior (keys, TTLs, tiers)
- Provides type-safe return values via generics
- Centralizes graceful fallback handling for Redis failures
- Makes testing easier with single point of cache logic

---

## Findings

**Location:** `server/services/storage-cache.ts` (add method to existing class)

**Key Requirements:**
- Generic function signature with `<T>` type parameter
- Accept cache key, fetch function, TTL, and tier as parameters
- Delegate to `advancedCache.getOrSet()` for actual caching
- Return type-safe `Promise<T>`
- Handle errors gracefully (fallback to storage layer)

**Cache Tier Definitions:**
- **HOT**: Frequently accessed, very short TTL (30s-1min)
- **WARM**: Regularly accessed, moderate TTL (5-15min)
- **COLD**: Occasionally accessed, longer TTL (30-60min)
- **STATIC**: Rarely changes, very long TTL (60min+)

**Related Files:**
- `server/services/advanced-cache.ts:322-343` - `getOrSet()` implementation
- `server/services/analytics-cache.ts:28-49` - Similar cached wrapper pattern
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Cache tier specifications

---

## Proposed Solutions

### Option 1: Private Generic Method (Recommended)
```typescript
private async cachedGet<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  tier: 'HOT' | 'WARM' | 'COLD' | 'STATIC'
): Promise<T> {
  return this.cache.getOrSet(cacheKey, fetchFn, ttl, tier);
}
```

- **Pros**:
  - Clean separation of concerns
  - Private method - internal implementation detail
  - Simple delegation to AdvancedCacheService
  - Type-safe via generics
  - Consistent with service patterns
- **Cons**:
  - Very thin wrapper (almost pass-through)
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Direct advancedCache.getOrSet() Usage
Skip wrapper, call `this.cache.getOrSet()` directly in each cached method.

- **Pros**:
  - No extra abstraction layer
  - Slightly less code
- **Cons**:
  - Less flexibility for future enhancements
  - Harder to add logging/monitoring later
  - More coupling to AdvancedCacheService API
- **Effort**: Small (30 min)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Private Generic Method**

This provides a clean abstraction point where we can add:
- Cache hit/miss logging in the future
- Custom error handling specific to storage layer
- Monitoring/metrics collection
- Any storage-specific cache behavior

**Implementation:**

```typescript
/**
 * Generic cached getter with multi-tier caching support.
 *
 * @template T - The type of data being cached
 * @param cacheKey - Unique cache key (e.g., 'product:full:123')
 * @param fetchFn - Function to fetch data on cache miss
 * @param ttl - Time-to-live in seconds
 * @param tier - Cache tier (HOT/WARM/COLD/STATIC)
 * @returns Cached or fresh data of type T
 */
private async cachedGet<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  tier: 'HOT' | 'WARM' | 'COLD' | 'STATIC'
): Promise<T> {
  try {
    return await this.cache.getOrSet(cacheKey, fetchFn, ttl, tier);
  } catch (error) {
    // Graceful degradation: on cache error, execute fetchFn directly
    console.error(`Cache error for key ${cacheKey}, falling back to storage:`, error);
    return await fetchFn();
  }
}
```

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (add method to StorageCacheService class)

**Related Components:**
- `AdvancedCacheService.getOrSet()` - Underlying cache engine
- Future cached wrapper methods (Tasks 003-007)

**Database Changes:** No

**TypeScript Considerations:**
- Use generic type parameter `<T>` for return type safety
- Literal union type for tier parameter: `'HOT' | 'WARM' | 'COLD' | 'STATIC'`
- Return type must be `Promise<T>` to match fetchFn signature
- JSDoc comments with `@template` tag for generic documentation

**Error Handling:**
- Wrap `getOrSet()` call in try-catch
- On cache failure, fall back to direct `fetchFn()` execution
- Log error but don't throw (graceful degradation)
- Application continues working even if Redis is down

---

## Acceptance Criteria

- [ ] `cachedGet<T>()` method added to `StorageCacheService` class
- [ ] Method signature matches specification (cacheKey, fetchFn, ttl, tier)
- [ ] Generic type parameter `<T>` used for type safety
- [ ] Delegates to `this.cache.getOrSet()` for caching logic
- [ ] Try-catch wrapper for graceful error handling
- [ ] Falls back to direct `fetchFn()` execution on cache errors
- [ ] JSDoc comment with `@template`, `@param`, `@returns` tags
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] No `any` types used (pre-commit hook enforced)
- [ ] Error logging added for cache failures

---

## Resources

**Internal References:**
- `server/services/advanced-cache.ts:322-343` - `getOrSet()` pattern
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Cache tier specifications
- `server/services/analytics-cache.ts:28-49` - Similar wrapper pattern

**TypeScript Generics:**
- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Generic Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html#generic-functions)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P2 (Important) - core infrastructure
- Estimated effort: Small (1 hour)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 1, Task 2 - core caching primitive
- All subsequent cached methods will use this wrapper
- Graceful degradation critical for production stability
- Generic type parameter ensures type safety across all cached methods

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 1 of 4 (Core Cache Infrastructure)
**Dependencies:** Task 001 (StorageCacheService class must exist)
**Blocks:** Tasks 006-010 (all cached wrapper methods need this primitive)
