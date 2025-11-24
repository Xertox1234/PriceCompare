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
6. ~~`server/services/notification-service.ts`~~ ✅ **MIGRATED (Phase 2)**
7. ~~`server/services/smart-notification-service.ts`~~ ✅ **MIGRATED (Phase 2)**
8. ~~`server/services/smart-alerts-service.ts`~~ ✅ **MIGRATED (Phase 2)**
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

### Phase 2 - COMPLETED ✅ (PR #104)
**Migrated 3 notification services:**
- `notification-service.ts` - 11 new storage methods
  - getUserNotifications, getNotificationStats, markNotificationsAsRead
  - markAllNotificationsAsRead, deleteNotification, deleteAllNotifications
  - createNotificationWithLimitCheck, getUserNotificationPreferences
  - createDefaultNotificationPreferences, updateUserNotificationPreferences
  - getRecentNotificationsByType
- `smart-notification-service.ts` - Uses notification-service + storage.getProductById
- `smart-alerts-service.ts` - 6 new storage methods
  - getProductOfferIdsByProductId, getPriceHistoryByOfferIds
  - getUserActivePriceAlerts, getUserPriceAlertsSortedByTriggers
  - getProductOffersWithPriceByProductIds, createSuggestedPriceAlert

**Total: ~17 new storage methods added (Phase 2)**
**Cumulative: 34 storage methods added**

### Phase 3 - COMPLETED ✅ (PR #115)
**Migrated 3 price analytics services:**
- `price-history-service.ts` - 7 new storage methods
  - getProductOfferWithProduct, getLatestPriceForOffer, insertPriceHistory
  - getPriceHistoryByQuery, getExistingSnapshotsForDate
  - insertPriceSnapshots, updatePriceSnapshot
- `price-snapshot-service.ts` - 2 new storage methods
  - getProductOffersForSnapshot, getPriceHistoryForOffers
- `trend-analysis-service.ts` - 4 new storage methods
  - getPriceDataGroupedForTrend, upsertPriceTrends
  - getPriceTrendWithRetailer, getPriceTrendsForProduct

**Total: ~23 new storage methods added (Phase 3)**
**Cumulative: ~57 storage methods added**

**Note:** `price-aggregation-service.ts` uses complex internal transactions with
transaction context passing (`db.transaction(async (tx) => {...})`) which doesn't
fit well with the storage layer pattern. It remains with direct db access for now.

### Phase 4-6 - PENDING
**Remaining 6+ services to migrate:**
- Community: community-service
- Search/monitoring: advanced-search, monitoring-service, hybrid-data-collector
- Routes: price-analytics-routes
- Discovery: price-drop-detection, product-discovery-fallback

## Acceptance Criteria

- [x] Phase 1: Foundation services migrated (job-lock, password-reset, affiliate-link)
- [x] Phase 2: Notification services migrated (notification, smart-notification, smart-alerts)
- [x] Phase 3: Price analytics services migrated (price-history, price-snapshot, trend-analysis)
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

### 2025-11-24 - Phase 2 Migration Completed
**By:** Claude Code
**PR:** #104 (refactor/storage-layer-phase-2)
**Changes:**
- Migrated 3 notification services to storage layer
- Added ~17 new storage methods to IStorage interface
- Implemented methods in DatabaseStorage with:
  - SERIALIZABLE transactions for race condition prevention
  - Retry logic with retryWithBackoff for transient errors
  - ON CONFLICT handling for concurrent operations
  - Batch queries to avoid N+1 patterns
- Updated MemStorage with stub implementations
- Preserved all business logic in services (preference checks, quiet hours, WebSocket events)
- No TypeScript errors in migrated files

### 2025-11-24 - Phase 3 Migration Completed
**By:** Claude Code
**PR:** #115 (refactor/storage-layer-phase-3)
**Changes:**
- Migrated 3 price analytics services to storage layer
- Added ~23 new storage methods to IStorage interface
- Added 17 new type definitions for price analytics data
- Implemented methods in DatabaseStorage with:
  - Complex aggregation queries (array_agg, json_agg)
  - Batch operations for price history and snapshots
  - Upsert operations with onConflictDoUpdate
- Updated MemStorage with stub implementations
- Fixed Set iteration issue (Array.from instead of spread)
- No TypeScript errors in migrated files
- price-aggregation-service.ts remains with db access (complex transaction context)

## Next Steps (Phase 4+)

When continuing this TODO:
1. Work in a new branch: `git checkout -b refactor/storage-layer-phase-4`
2. Focus on community-service.ts next
3. Follow patterns established in Phases 1-3

## Notes

Source: Comprehensive code audit performed on 2025-11-23
Pattern documentation: docs/STORAGE_MIGRATION_PATTERNS.md
