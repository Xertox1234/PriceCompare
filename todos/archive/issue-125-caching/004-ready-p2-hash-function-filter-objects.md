# TODO: Create Hash Function for Complex Filter Objects

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 1, Task 4

---

## Problem Statement

Implement a deterministic hash function to generate cache keys for complex filter objects used in search queries. Product search accepts multiple filters (category, price range, keywords, retailer, etc.) that need to be converted to a stable, unique cache key.

**Current State:**
- No mechanism to generate cache keys from filter objects
- `searchProducts(filters)` cannot be cached without stable key generation
- Search queries are expensive (100-500ms with complex filters)
- Same search parameters should produce same cache key regardless of object key order

**Why This Matters:**
- **Cache Efficiency**: Same search = same cache key = cache reuse
- **Performance**: Search is one of the most expensive operations (100-500ms)
- **Cache Hit Rate**: Deterministic hashing maximizes cache hit rate
- **Key Stability**: Object key order shouldn't affect cache key

---

## Findings

**Location:** `server/services/storage-cache.ts` (new private utility method)

**Problem Scenario:**
```typescript
// Search with complex filters
const filters = {
  category: 'Electronics',
  minPrice: 100,
  maxPrice: 500,
  keyword: 'laptop',
  retailerId: 5,
  sortBy: 'price_asc'
};

// Need cache key like: "product:search:abc123def456..."
// But filters is an object - can't use directly as cache key
```

**Technical Challenges:**

1. **Order Dependence:**
   ```typescript
   JSON.stringify({a:1, b:2}) !== JSON.stringify({b:2, a:1})
   // But these should produce the same cache key!
   ```

2. **Nested Objects:**
   ```typescript
   const filters = {
     priceRange: { min: 100, max: 500 },
     retailers: [1, 2, 3]
   };
   // Must hash nested structures consistently
   ```

3. **Null/Undefined Handling:**
   ```typescript
   { keyword: null } vs { keyword: undefined } vs {}
   // Should these be different cache keys?
   ```

4. **Cache Key Length:**
   - SHA-256 produces 64-char hex string
   - Redis keys should be reasonably short
   - Need balance: uniqueness vs brevity

**Related Files:**
- `server/storage.ts:650-700` - `searchProducts()` filter interface
- Node.js `crypto` module - Built-in hashing
- `server/services/storage-cache.ts` - Implementation location

---

## Proposed Solutions

### Option 1: Crypto-Based Hash with Sorted Keys (Recommended)
```typescript
import { createHash } from 'crypto';

/**
 * Generate deterministic hash for filter objects to use as cache keys.
 * Sorts object keys recursively to ensure same filters produce same hash.
 *
 * @param filters - Filter object to hash
 * @returns 12-character alphanumeric hash
 */
private hashFilters(filters: Record<string, unknown>): string {
  // Recursively sort object keys for determinism
  const sortObjectKeys = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }
    if (typeof obj === 'object') {
      return Object.keys(obj as Record<string, unknown>)
        .sort()
        .reduce((sorted, key) => {
          sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
          return sorted;
        }, {} as Record<string, unknown>);
    }
    return obj;
  };

  const sorted = sortObjectKeys(filters);
  const str = JSON.stringify(sorted);
  const hash = createHash('sha256').update(str).digest('base64');

  // Take first 12 chars, make alphanumeric-only (Redis-safe)
  return hash.substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');
}
```

- **Pros**:
  - Deterministic (same input → same output)
  - Handles nested objects and arrays
  - Short keys (12 chars)
  - Collision-resistant (SHA-256 base)
  - No external dependencies (crypto is built-in)
- **Cons**:
  - Slightly more complex
  - Hashing has minimal CPU cost (~0.1ms)
- **Effort**: Small (1-2 hours)
- **Risk**: Low

### Option 2: Sorted JSON String (Simpler)
```typescript
private hashFilters(filters: Record<string, unknown>): string {
  const sorted = JSON.stringify(filters, Object.keys(filters).sort());
  return sorted; // Use full JSON string as cache key
}
```

- **Pros**:
  - Very simple
  - No hashing needed
  - Deterministic with sorted keys
- **Cons**:
  - Long cache keys (verbose JSON strings)
  - Doesn't handle nested objects well
  - Redis memory inefficiency
  - Potential key length limits
- **Effort**: Small (30 min)
- **Risk**: Medium (key length issues)

### Option 3: Fast-Hash Library
```typescript
import hash from 'object-hash';

private hashFilters(filters: Record<string, unknown>): string {
  return hash(filters, { algorithm: 'sha256' });
}
```

- **Pros**:
  - Battle-tested library
  - Handles edge cases automatically
  - Very short implementation
- **Cons**:
  - External dependency (adds to bundle)
  - Overkill for simple use case
  - Already have crypto module built-in
- **Effort**: Small (30 min + dependency install)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Crypto-Based Hash with Sorted Keys**

This provides the best balance of:
- Key brevity (12 chars)
- Determinism (sorted keys)
- No external dependencies
- Production-ready collision resistance

**Implementation Notes:**

1. **Helper Function:**
   - Make `sortObjectKeys()` a separate private method for testability
   - Add JSDoc with examples

2. **Hash Length:**
   - 12 chars provides ~68 billion combinations (base64: 64^12)
   - Collision probability negligible for expected query volume
   - Can increase to 16 chars if needed

3. **Edge Cases:**
   - `null` and `undefined` treated as distinct values
   - Empty object `{}` produces consistent hash
   - Arrays maintain order (don't sort array elements)

4. **Testing:**
   ```typescript
   // Same filters, different order → same hash
   const hash1 = hashFilters({ a: 1, b: 2 });
   const hash2 = hashFilters({ b: 2, a: 1 });
   // hash1 === hash2 ✓

   // Different filters → different hash
   const hash3 = hashFilters({ a: 1, b: 3 });
   // hash3 !== hash1 ✓
   ```

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (add hashFilters method)

**Related Components:**
- `searchProducts()` cached wrapper (Task 007) - Will use this hash function
- Node.js `crypto` module - Built-in hashing utilities

**Database Changes:** No

**TypeScript Considerations:**
- Use `Record<string, unknown>` for filter type (flexible)
- Return type: `string` (12-char alphanumeric)
- Recursive type handling for nested objects
- JSDoc with `@example` for clarity

**Performance:**
- Hashing overhead: ~0.1ms per call (negligible)
- Key length: 12 chars vs 100+ for JSON strings
- Memory savings: 88% reduction in Redis key size

---

## Acceptance Criteria

- [ ] `hashFilters()` private method added to `StorageCacheService`
- [ ] Uses `crypto.createHash('sha256')` for hashing
- [ ] Recursively sorts object keys before hashing
- [ ] Handles nested objects and arrays correctly
- [ ] Returns 12-character alphanumeric string
- [ ] Same filters (different order) produce same hash
- [ ] Different filters produce different hashes
- [ ] Handles null/undefined values consistently
- [ ] JSDoc comment with description and example
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] No external dependencies added

**Manual Testing:**
```typescript
// Test in Node.js REPL or test file
const service = new StorageCacheService();

// Test 1: Order independence
const h1 = service['hashFilters']({ a: 1, b: 2 });
const h2 = service['hashFilters']({ b: 2, a: 1 });
console.assert(h1 === h2, 'Same filters should produce same hash');

// Test 2: Uniqueness
const h3 = service['hashFilters']({ a: 1, b: 3 });
console.assert(h3 !== h1, 'Different filters should produce different hash');

// Test 3: Nested objects
const h4 = service['hashFilters']({ filters: { price: { min: 100, max: 500 } } });
console.assert(h4.length === 12, 'Hash should be 12 characters');
```

---

## Resources

**Internal References:**
- `server/storage.ts:650-700` - `searchProducts()` filter interface
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Cache key specifications

**Node.js Documentation:**
- [crypto.createHash()](https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options)
- [Buffer.toString('base64')](https://nodejs.org/api/buffer.html#buftostringencoding-start-end)

**Hashing Best Practices:**
- [Cache Key Design Patterns](https://redis.io/docs/manual/patterns/cache/)
- [Deterministic JSON Serialization](https://www.npmjs.com/package/json-stable-stringify)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P2 (Important) - cache infrastructure
- Estimated effort: Small (1-2 hours)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 1, Task 4 - search caching foundation
- Object key order must not affect cache keys
- 12-char hash provides good collision resistance for expected volume
- Built-in crypto module sufficient, no external dependencies needed

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 1 of 4 (Core Cache Infrastructure)
**Dependencies:** Task 001 (StorageCacheService class must exist)
**Blocks:** Task 007 (searchProducts caching needs this hash function)
**Production Impact:** Critical for search cache hit rates
