---
status: pending
priority: p2
issue_id: "031"
tags: [architecture, database, patterns, code-review]
dependencies: []
---

# Remove Direct DB Access in Services - Use Storage Layer

## Problem Statement

14 services import `db` directly and execute queries, bypassing the storage abstraction pattern established in `server/storage.ts`.

**Impact:**
- Inconsistent data access patterns
- Harder to mock for testing
- Duplicated query logic
- Violates single responsibility principle

## Findings

Discovered during architecture audit on 2025-11-23.

**Affected Services (14 files):**
1. `server/services/price-aggregation-service.ts`
2. `server/services/price-history-service.ts`
3. `server/services/price-snapshot-service.ts`
4. `server/services/trend-analysis-service.ts`
5. `server/services/community-service.ts`
6. `server/services/notification-service.ts`
7. `server/services/smart-notification-service.ts`
8. `server/services/smart-alerts-service.ts`
9. `server/services/alert-service.ts`
10. `server/services/affiliate-link-service.ts`
11. `server/services/advanced-search.ts`
12. `server/services/monitoring-service.ts`
13. `server/services/hybrid-data-collector.ts`
14. `server/routes/price-analytics-routes.ts` (route with direct db)

**Current Pattern (Wrong):**
```typescript
// In service file
import { db } from '../db';
const results = await db.select().from(products)...
```

**Correct Pattern:**
```typescript
// In service file
import { storage } from '../storage';
const results = await storage.getProducts(...);

// In storage.ts - add method if missing
async getProducts(...) {
  return db.select().from(products)...
}
```

## Proposed Solutions

### Option 1: Migrate Queries to Storage Layer (Recommended)

**Effort:** Large (2-3 days)

For each affected service:
1. Identify all direct db queries
2. Create corresponding method in storage.ts (or use existing)
3. Replace direct db call with storage method call
4. Update tests to mock storage instead of db

### Option 2: Create Domain-Specific Storage Modules

**Effort:** Large (3-4 days)

Split storage.ts into domain modules:
- `server/storage/price-storage.ts`
- `server/storage/forum-storage.ts`
- `server/storage/user-storage.ts`
- `server/storage/index.ts` (re-exports all)

## Acceptance Criteria

- [ ] No direct db imports in services
- [ ] All queries go through storage layer
- [ ] Services import storage, not db
- [ ] Tests updated to mock storage

## Work Log

### 2025-11-23 - Architecture Audit Discovery
**By:** Claude Code Review System (architecture-strategist agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
