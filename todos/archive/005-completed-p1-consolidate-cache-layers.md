---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, simplification, architecture, caching, redis]
dependencies: []
---

# Consolidate Multiple Cache Layers

## Problem Statement

Four separate cache files exist with redundant logic and separate Redis connections:
- `advanced-cache.ts` (530 lines) - L1/L2 cache management
- `redis-cache.ts` (393 lines) - Creates its OWN Redis connection
- `analytics-cache.ts` (276 lines) - Thin wrapper over advanced-cache
- `cache-invalidation.ts` (324 lines) - Own pub/sub channel

This creates multiple Redis connections, inconsistent behavior, and ~600 lines of redundant code.

## Findings

- Discovered during comprehensive code review by Code Simplicity Reviewer and Performance Oracle agents
- `redis-cache.ts:74` creates a brand new `ioredis` client - app already has `getRedisClient()` in config
- `analytics-cache.ts` lines 27-49 is just a pass-through to `advancedCache.get/set`
- `CacheInvalidationService` subscribes to its OWN pub/sub channel (line 43)
- `AdvancedCacheService` subscribes to a DIFFERENT channel (line 148)

## Proposed Solutions

### Option 1: Consolidate to single CacheService (RECOMMENDED)
- **Change:** Merge all cache logic into `advanced-cache.ts`, remove others
- **Pros:** Single source of truth, shared Redis connection, clearer API
- **Cons:** Requires careful migration of all cache usages
- **Effort:** Large
- **Risk:** Medium (caching is critical path)

### Option 2: Refactor to use shared Redis client only
- **Change:** Modify `redis-cache.ts` to use `getRedisClient()` from config
- **Pros:** Fixes connection waste, smaller change
- **Cons:** Still have multiple cache implementations
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1 for long-term, Option 2 as quick win first.

## Technical Details

- **Files to DELETE:**
  - `server/services/redis-cache.ts` (merge into advanced-cache)
  - `server/services/analytics-cache.ts` (inline into callers or advanced-cache)

- **Files to MODIFY:**
  - `server/services/advanced-cache.ts` - Use shared Redis client
  - `server/services/cache-invalidation.ts` - Use same pub/sub channel
  - All files importing deleted services

- **Database Changes:** No

### Consolidation Steps:
1. First: Change `redis-cache.ts` to use `getRedisClient()` (quick win)
2. Merge `analytics-cache.ts` methods into `advanced-cache.ts`
3. Unify pub/sub channels for cache invalidation
4. Update all imports
5. Delete redundant files

## Acceptance Criteria

- [ ] Single Redis connection pool for all caching
- [ ] Single cache service API
- [ ] Cache invalidation works across all cache layers
- [ ] No orphaned Redis connections
- [ ] Performance not degraded
- [ ] Tests pass

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Code Simplicity Reviewer and Performance Oracle agents
- Identified connection waste and code duplication

**Learnings:**
- Organic growth led to multiple cache solutions
- Each solution added its own Redis connection
- analytics-cache.ts is essentially dead code (just wrapper methods)

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
Estimated LOC reduction: ~600 lines
