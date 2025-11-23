---
status: pending
priority: p2
issue_id: "033"
tags: [architecture, refactoring, patterns, code-review]
dependencies: []
---

# Split Storage.ts God Object into Domain Modules

## Problem Statement

The main storage file has grown to 3,057 lines with 150+ methods spanning multiple domains. This is a "God Object" anti-pattern.

**Impact:**
- Difficult to navigate and understand
- Merge conflicts when multiple developers work on different features
- Harder to test individual domains
- Poor separation of concerns

## Findings

Discovered during pattern-recognition audit on 2025-11-23.

**Location:** `server/storage.ts` (3,057 lines, 150+ methods)

**Domains mixed in single file:**
- User management (~20 methods)
- Product management (~25 methods)
- Price history (~15 methods)
- Forum/community (~30 methods)
- Alerts/notifications (~20 methods)
- Wishlists (~15 methods)
- Watch lists (~10 methods)
- Retailers (~10 methods)
- Categories (~5 methods)

## Proposed Solutions

### Option 1: Extract Types First (Quick Win)

**Effort:** Small (1-2 hours)

Move type definitions to separate file:
```
server/storage/types.ts    # All interfaces and types
server/storage.ts          # Methods only (2,500 lines)
```

### Option 2: Domain-Specific Storage Modules (Recommended)

**Effort:** Large (2-3 days)

```
server/storage/
├── index.ts              # Re-exports everything, IStorage interface
├── user-storage.ts       # User CRUD, profiles, auth
├── product-storage.ts    # Products, offers, search
├── price-storage.ts      # Price history, snapshots, trends
├── forum-storage.ts      # Topics, posts, likes
├── alert-storage.ts      # Price alerts, notifications
├── wishlist-storage.ts   # Wishlists, items
├── watch-storage.ts      # Watch lists, product watches
├── retailer-storage.ts   # Retailers, categories
└── types.ts              # Shared types
```

Each module exports methods used by the main `storage` object.

## Acceptance Criteria

- [ ] Storage split into domain modules
- [ ] No circular dependencies
- [ ] All imports updated
- [ ] Tests continue to pass
- [ ] IStorage interface maintained for compatibility

## Work Log

### 2025-11-23 - Pattern Recognition Audit Discovery
**By:** Claude Code Review System (pattern-recognition-specialist agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
