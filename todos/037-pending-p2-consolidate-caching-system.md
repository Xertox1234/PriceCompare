---
status: pending
priority: p2
issue_id: "037"
tags: [simplicity, architecture, cache, yagni, code-review]
dependencies: []
---

# Consolidate 5 Caching Implementations to Single Service

## Problem Statement

The codebase has **5 separate caching implementations** with overlapping functionality:
- `server/services/advanced-cache.ts` (573 lines)
- `server/services/analytics-cache.ts` (148 lines)
- `server/services/redis-cache.ts` (370 lines)
- `server/services/cache-invalidation.ts` (323 lines)
- `server/middleware/redis-cache.ts` (248 lines)

**Total: 1,662 lines of caching code**

**Impact:**
- Maintenance nightmare
- Inconsistent cache behavior
- Confusion about which cache to use
- Custom LRU implementation when npm packages exist

## Findings

Discovered during code-simplicity audit on 2025-11-23.

**YAGNI Violations:**
- CacheTier enum (HOT/WARM/COLD/STATIC/COMPUTED) with 5 tiers is premature optimization
- Multi-tier L1/L2 caching with pub/sub invalidation is over-engineered
- `analytics-cache.ts` is mostly a thin wrapper around `advanced-cache.ts`

## Proposed Solutions

### Option 1: Consolidate to Single Service (Recommended)

**Effort:** Large (2 days)

**Target state:**
```
server/services/cache.ts  (~500 lines)
├── L1: Simple in-memory Map with TTL
├── L2: Redis with TTL
├── getOrSet(key, fn, ttl)
├── invalidate(key)
├── invalidatePattern(pattern)
└── close() for cleanup
```

**Steps:**
1. Create new unified `cache.ts`
2. Migrate callers one file at a time
3. Remove old cache files
4. Update tests

**Estimated LOC reduction:** 800+ lines (70%)

## Acceptance Criteria

- [ ] Single caching service
- [ ] Simple TTL-based caching (no tiers)
- [ ] All callers migrated
- [ ] Old cache files deleted
- [ ] Tests pass

## Work Log

### 2025-11-23 - Code Simplicity Audit Discovery
**By:** Claude Code Review System (code-simplicity-reviewer agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
