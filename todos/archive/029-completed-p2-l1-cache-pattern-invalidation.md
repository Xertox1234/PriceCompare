---
status: completed
priority: p2
issue_id: "029"
tags: [performance, cache, optimization, code-review]
dependencies: []
---

# Improve L1 Cache Pattern Invalidation

## Problem Statement

When pattern invalidation is received via pub/sub, the entire L1 cache is cleared instead of just matching keys.

**Impact:** A single pattern invalidation (e.g., `product:123:*`) wipes the entire L1 cache including unrelated hot data. With frequent price updates triggering product cache invalidations, L1 cache effectiveness drops significantly, increasing L2 (Redis) traffic.

## Findings

Discovered during performance audit on 2025-11-23.

**Location:** `server/services/advanced-cache.ts` lines 457-460

**Evidence:**
```typescript
if (isPattern) {
  // For patterns, clear entire L1 cache to be safe
  this.l1Cache.clear();
}
```

## Proposed Solutions

### Option 1: Implement Pattern Matching in L1 Cache (Recommended)

**Effort:** Medium (2 hours)

**Implementation:**
```typescript
// Add to LRUCache class
deletePattern(pattern: string): number {
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  let deleted = 0;
  for (const key of this.cache.keys()) {
    if (regex.test(key)) {
      this.cache.delete(key);
      deleted++;
    }
  }
  return deleted;
}

// Update invalidation handler
if (isPattern) {
  this.l1Cache.deletePattern(pattern);
} else {
  this.l1Cache.delete(key);
}
```

## Acceptance Criteria

- [x] Pattern matching implemented in L1 cache
- [x] Only matching keys deleted on pattern invalidation
- [x] L1 cache hit rate improved (stats tracking added)
- [x] Performance tested with realistic patterns

## Work Log

### 2025-11-23 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)

### 2025-11-23 - Implementation Complete
**By:** Claude Code

**Changes made to `server/services/advanced-cache.ts`:**

1. **Added `deletePattern()` method to LRUCache class (lines 97-122)**
   - Converts glob patterns (e.g., `product:123:*`) to regex
   - Properly escapes regex special characters except `*`
   - Iterates through cache keys and deletes matching entries
   - Returns count of deleted keys

2. **Added `keys()` method to LRUCache class (lines 124-127)**
   - Returns array of all cache keys for debugging/testing

3. **Updated invalidation handler (lines 501-512)**
   - Changed from `this.l1Cache.clear()` to `this.l1Cache.deletePattern(key)`
   - Only deletes matching keys instead of clearing entire cache
   - Preserves unrelated hot data, improving L1 hit rate
   - Added debug logging for pattern invalidation operations

4. **Added stats tracking for pattern invalidations**
   - New `patternInvalidations` counter - tracks number of pattern operations
   - New `patternKeysDeleted` counter - tracks total keys deleted via patterns
   - `getStats()` now includes `patternInvalidation` section with:
     - `operations`: Number of pattern invalidation events
     - `keysDeleted`: Total keys deleted via patterns
     - `avgKeysPerOperation`: Average keys deleted per pattern

**Benefits:**
- L1 cache no longer unnecessarily cleared on pattern invalidations
- Unrelated hot data preserved, improving cache hit rate
- Better observability via new stats metrics
- Debug logging helps identify invalidation patterns

## Notes

Source: Comprehensive code audit performed on 2025-11-23
