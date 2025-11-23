---
status: pending
priority: p2
issue_id: "038"
tags: [simplicity, architecture, yagni, code-review]
dependencies: []
---

# Unify 3 Watch/Wishlist Systems into Single System

## Problem Statement

Three separate systems exist for tracking products:
1. **community-routes.ts**: `/api/community/watch/*` and `/api/community/watch-lists/*`
2. **watchlist-routes.ts**: `/api/watchlists/*`
3. **wishlist-routes.ts**: `/api/wishlists/*`

All three do essentially the same thing - let users track products they care about.

**Total: ~1,845 lines across 3 systems**

**Impact:**
- API confusion for consumers
- Duplicate business logic
- Schema bloat (multiple tables for same purpose)
- Maintenance burden

## Findings

Discovered during code-simplicity audit on 2025-11-23.

**Schema duplication:**
- `watchLists` + `productWatches` tables
- `wishlists` + `wishlistItems` tables

## Proposed Solutions

### Option 1: Consolidate to Single Wishlist System (Recommended)

**Effort:** Large (2 days)

**Target state:**
- Single `wishlists` + `wishlistItems` tables
- Single `/api/wishlists/*` API
- Remove community watch and watchlist routes
- Migrate existing data

**Steps:**
1. Migrate watchlist/watch data to wishlist tables
2. Update all callers to use wishlist API
3. Remove redundant routes and schema
4. Update frontend components

**Estimated LOC reduction:** 400+ lines

### Option 2: Keep Separate but Document Purpose

If systems serve different purposes:
- Wishlist = Shopping intention
- Watch = Price monitoring
- Community = Social sharing

Document the distinction clearly.

## Acceptance Criteria

- [ ] Single product tracking system
- [ ] Clear API for users
- [ ] Data migrated
- [ ] Old systems removed
- [ ] Documentation updated

## Work Log

### 2025-11-23 - Code Simplicity Audit Discovery
**By:** Claude Code Review System (code-simplicity-reviewer agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
