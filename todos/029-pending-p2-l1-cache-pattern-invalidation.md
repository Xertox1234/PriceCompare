---
status: pending
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

- [ ] Pattern matching implemented in L1 cache
- [ ] Only matching keys deleted on pattern invalidation
- [ ] L1 cache hit rate improved
- [ ] Performance tested with realistic patterns

## Work Log

### 2025-11-23 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
