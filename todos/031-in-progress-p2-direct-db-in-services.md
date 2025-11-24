---
status: in-progress
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
9. ~~`server/services/alert-service.ts`~~ (No db import - N/A)
10. ~~`server/services/affiliate-link-service.ts`~~ ✅ **MIGRATED (Phase 1)**
11. `server/services/advanced-search.ts`
12. `server/services/monitoring-service.ts`
13. `server/services/hybrid-data-collector.ts`
14. `server/routes/price-analytics-routes.ts` (route with direct db)

**Additional services discovered:**
- ~~`server/services/job-lock-service.ts`~~ ✅ **MIGRATED (Phase 1)**
- ~~`server/services/password-reset-service.ts`~~ ✅ **MIGRATED (Phase 1)**
- `server/services/price-drop-detection.ts`
- `server/services/product-discovery-fallback.ts`

## Progress

### Phase 1 - COMPLETED ✅ (PR #103)
**Migrated 3 foundation services:**
- `job-lock-service.ts` - 7 new storage methods
- `password-reset-service.ts` - 5 new storage methods
- `affiliate-link-service.ts` - 5 new storage methods

**Total: 17 new storage methods added**

### Phase 2-6 - PENDING
**Remaining 14 services to migrate (~80 new storage methods needed)**

## Acceptance Criteria

- [x] Phase 1: Foundation services migrated (job-lock, password-reset, affiliate-link)
- [ ] Phase 2: Notification services migrated
- [ ] Phase 3: Price analytics services migrated
- [ ] Phase 4: Community services migrated
- [ ] Phase 5: Search & monitoring services migrated
- [ ] All queries go through storage layer
- [ ] Services import storage, not db
- [ ] Tests updated to mock storage

## Work Log

### 2025-11-23 - Architecture Audit Discovery
**By:** Claude Code Review System (architecture-strategist agent)

### 2025-11-23 - Phase 1 Migration Completed
**By:** Claude Code
**PR:** #103 (refactor/storage-layer-migration)
**Changes:**
- Migrated 3 services to storage layer
- Added 17 new storage methods
- Fixed SQL injection vulnerability in extendJobLock()
- Added getUserByIdSafe() for secure user retrieval
- Optimized getPasswordResetAttemptCount() query
- Codified patterns into reviewer agents

## Notes

Source: Comprehensive code audit performed on 2025-11-23
Pattern documentation: docs/STORAGE_MIGRATION_PATTERNS.md
