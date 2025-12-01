---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, simplification, technical-debt, performance]
dependencies: []
source: code-review-2025-11-30
---

# Consolidate Cache System (5 Files → 1)

## Problem Statement

**EXCESSIVE COMPLEXITY:** 5 separate cache implementations doing essentially the same thing (Redis + optional L1 memory cache):

- `advanced-cache.ts` (679 LOC) - L1 LRU + L2 Redis + pub/sub
- `redis-cache.ts` (371 LOC) - L1 in-memory + L2 Redis (DUPLICATE)
- `analytics-cache.ts` (149 LOC) - Thin wrapper around advanced-cache
- `cache-invalidation.ts` (335 LOC) - Invalidation logic (already in advanced-cache)
- Middleware: 2 separate cache files (279 LOC combined)

**Total:** 1,813 LOC doing the same job

**Impact:**
- Confusion about which cache to use
- Duplicate connection pools (3 Redis connections!)
- Inconsistent cache key patterns
- Maintenance burden (bugs must be fixed in multiple places)
- No unified metrics/monitoring

## Findings

**Discovery:** Code Simplicity Reviewer + Pattern Recognition Specialist

**Evidence of Duplication:**

1. **redis-cache.ts duplicates advanced-cache.ts:**
   - Both have L1 in-memory fallback
   - Both have L2 Redis
   - Both have get/set/delete/invalidate methods
   - Different implementations, same functionality

2. **analytics-cache.ts is a thin wrapper:**
   ```typescript
   // Line 28-49: getCachedAnalytics() just calls advancedCache.get()
   // Line 54-75: invalidateProductAnalytics() just calls advancedCache.invalidatePattern()
   // 149 LOC providing almost no value
   ```

3. **cache-invalidation.ts duplicates advanced-cache.ts:**
   - Lines 512-554 in advanced-cache.ts already have invalidation
   - cache-invalidation.ts re-implements pattern invalidation
   - Both use Redis SCAN for pattern matching

## Proposed Solutions

### Option 1: Keep Only advanced-cache.ts (RECOMMENDED)

**Consolidate everything into single cache abstraction:**

```
KEEP: server/services/advanced-cache.ts (679 LOC)
DELETE: server/services/redis-cache.ts (371 LOC)
DELETE: server/services/analytics-cache.ts (149 LOC)
DELETE: server/services/cache-invalidation.ts (335 LOC)
MERGE: middleware/cache.ts + middleware/redis-cache.ts → middleware/cache.ts (50 LOC)
```

**Result:** 1,813 LOC → ~730 LOC (60% reduction)

**Migration:**

```typescript
// Before: Multiple cache choices
import { redisCache } from './services/redis-cache';
import { analyticsCacheService } from './services/analytics-cache';
import { cacheInvalidation } from './services/cache-invalidation';

// After: One unified cache
import { advancedCache, CacheTier } from './services/advanced-cache';

// Usage remains similar
await advancedCache.getOrSet(key, fetchFn, CacheTier.WARM);
await advancedCache.invalidatePattern('product:*');
```

**Why advanced-cache.ts wins:**
- Most feature-complete (L1+L2, pub/sub, tiers, metrics)
- Best documented
- Most actively maintained
- Has pub/sub for multi-server invalidation

## Recommended Action

### Phase 1: Migrate Usages (Week 1)

1. **Find all cache imports:**
   ```bash
   grep -r "from.*redis-cache" server/ client/
   grep -r "from.*analytics-cache" server/
   grep -r "from.*cache-invalidation" server/
   ```

2. **Create migration guide:**
   ```
   redis-cache.get(key) → advancedCache.get(key, CacheTier.WARM)
   analyticsCacheService.getCachedAnalytics() → advancedCache.getOrSet()
   cacheInvalidation.invalidateProduct() → advancedCache.invalidatePattern()
   ```

3. **Migrate usage files one by one** (estimate: 15-20 files)

4. **Test each migration:** Ensure cache still works

### Phase 2: Delete Files (Week 2)

5. **Remove deprecated files:**
   ```bash
   git rm server/services/redis-cache.ts
   git rm server/services/analytics-cache.ts
   git rm server/services/cache-invalidation.ts
   ```

6. **Update package exports** if any

7. **Run full test suite**

### Phase 3: Simplify Middleware (Week 2)

8. **Merge middleware cache files:**
   ```bash
   # Combine middleware/cache.ts + middleware/redis-cache.ts
   # Keep simpler in-memory middleware for routes that don't need Redis
   ```

9. **Update route imports**

10. **Verify caching behavior in production**

## Technical Details

- **Redis Connections Before:** 3 (advanced-cache, redis-cache, cache-invalidation)
- **Redis Connections After:** 1 (advanced-cache only)
- **LOC Reduction:** 1,083 LOC (60%)
- **Files Deleted:** 3
- **Import Changes:** ~20 files

### Migration Safety:

- All cache interfaces are similar (get/set/delete)
- Test coverage exists for advanced-cache
- Can migrate incrementally (file by file)
- Easy rollback (keep old files until migration complete)

## Acceptance Criteria

- [ ] All usages of `redis-cache.ts` migrated to `advanced-cache.ts`
- [ ] All usages of `analytics-cache.ts` migrated to `advanced-cache.ts`
- [ ] All usages of `cache-invalidation.ts` migrated to `advanced-cache.ts`
- [ ] Files deleted: `redis-cache.ts`, `analytics-cache.ts`, `cache-invalidation.ts`
- [ ] Middleware cache files merged
- [ ] All tests pass
- [ ] Cache hit/miss metrics still working
- [ ] Redis connection count reduced from 3 → 1
- [ ] Documentation updated (`ARCHITECTURE.md`)

## Work Log

### 2025-11-30 - Code Review Discovery
**By:** Code Simplicity Reviewer + Pattern Recognition Specialist
**Actions:**
- Identified 5 cache implementations
- Analyzed each for unique functionality
- Determined 80% overlap between implementations
- Calculated 1,813 total LOC doing same job

**Learnings:**
- Multiple implementations indicate lack of clear ownership
- "Analytics cache" is premature abstraction (thin wrapper)
- Consolidation reduces maintenance burden
- Single cache = unified monitoring

## Resources

- Advanced Cache Implementation: `server/services/advanced-cache.ts`
- Cache Architecture Docs: `ARCHITECTURE.md` (section 5)
- Redis Connection Management: `server/config/redis.ts`

## Notes

**Estimated Effort:** 1-2 weeks
- Usage migration: 4-6 hours (20 files × 15 min each)
- Testing: 2-3 hours
- File deletion: 30 minutes
- Middleware merge: 2-3 hours
- Documentation: 1-2 hours

**Risk Level:** Low-Medium
- Incremental migration reduces risk
- Cache misses worst case (not data loss)
- Easy to revert individual files

**Urgency:** MEDIUM
- Not blocking features
- Reduces technical debt
- Improves maintainability

**Success Metric:** Single cache abstraction, 60% LOC reduction, unified metrics
