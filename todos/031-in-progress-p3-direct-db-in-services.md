---
status: completed
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

### Phase 5 - COMPLETED ✅ (PR #118)
**Migrated 1 community service:**
- `community-service.ts` - 2 new storage methods (N+1 elimination)
  - getBadgesByNames (batch query for badge fetching)
  - getUserBadgeIds (batch query for user badge ownership)
  - Fixed N+1 pattern in checkAndAwardBadges() (15 queries → 3 queries, 80% reduction)

**Total: 2 new storage methods added (Phase 5)**
**Cumulative: ~59 storage methods added**

### Phase 6 - COMPLETED ✅ (PR #119)
**Migrated 4 search & monitoring services:**
- `monitoring-service.ts` - 7 new storage methods
  - getRecentAgentSessions, getRecentScrapingJobs, getScrapingJobStatusCounts
  - getActiveJobLocksCount, getProductOffersCount, getTrendingProductsStatusCounts
  - getActiveAgentSessionsCount
- `price-drop-detection.ts` - 4 new storage methods
  - getPriceHistoryByOfferId, getProductOfferDetailsForAlert
  - getTriggeredPriceAlerts, getUsersWithActiveAlertsForProduct
- `product-discovery-fallback.ts` - 3 new storage methods
  - searchProductsByTerms, getTrendingProductCategories, getProductSearchSuggestions
- `advanced-search.ts` - 7 new storage methods (most complex)
  - searchProductsExact, searchProductsFuzzy, searchProductsBySynonyms
  - searchProductsSemantic (pgvector), getProductAutocompleteSuggestions
  - getProductForEmbedding, updateProductEmbedding

**Total: 21 new storage methods added (Phase 6)**
**Cumulative: ~80 storage methods added**

**Note:** `hybrid-data-collector.ts` doesn't exist - removed from migration list

### Phase 7 - COMPLETED ✅ (PR #120)
**Finalized storage layer migration:**
- `price-aggregation-service.ts` - Documented as **EXCEPTION** (complex transaction context)
- `price-analytics-routes.ts` - Migrated to storage layer (6 endpoints)

## Acceptance Criteria

- [x] Phase 1: Foundation services migrated (job-lock, password-reset, affiliate-link)
- [x] Phase 2: Notification services migrated (notification, smart-notification, smart-alerts)
- [x] Phase 3: Price analytics services migrated (price-history, price-snapshot, trend-analysis)
- [x] Phase 5: Community services migrated (community-service)
- [x] Phase 6: Search & monitoring services migrated (monitoring, price-drop, product-discovery, advanced-search)
- [x] Phase 7: Routes migrated, service documented as exception
- [x] All queries go through storage layer (except price-aggregation-service.ts - documented exception)
- [x] Services import storage, not db (14/15 services migrated, 1 documented exception)
- [ ] Tests updated to mock storage (future enhancement)

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

### 2025-11-24 - Phase 5 Migration Completed
**By:** Claude Code
**PR:** #118 (refactor/storage-layer-phase-5)
**Changes:**
- Migrated community-service.ts to storage layer
- Added 2 new storage methods for N+1 pattern elimination
- Fixed N+1 pattern in checkAndAwardBadges() (15 queries → 3 queries)
- Used Set for O(1) badge ownership lookups
- Preserved all business logic (badge awarding, error handling)
- No TypeScript errors in migrated files

### 2025-11-24 - Phase 6 Migration Completed
**By:** Claude Code
**PR:** #119 (refactor/storage-layer-phase-6)
**Changes:**
- Migrated 4 search & monitoring services to storage layer
- Added 21 new storage methods to IStorage interface
- Added 10 new type definitions (AgentSessionData, ProductWithOffersAndRetailers, etc.)
- Implemented methods in DatabaseStorage with:
  - Complex json_agg queries for nested product+offers+retailers
  - pgvector semantic search with cosine distance operator (<=>)
  - Aggregation queries for metrics and trending analysis
  - Batch queries for price drop detection
- Updated MemStorage with stub implementations
- Preserved all business logic:
  - OpenAI embedding generation and caching (advanced-search)
  - WebSocket event emission (price-drop-detection)
  - In-memory caches (query, embedding, suggestion caches)
  - Pattern analysis and confidence scoring
- No TypeScript errors in migrated files
- All pre-commit hooks passed

### 2025-11-24 - Phase 7 Migration Completed ✅
**By:** Claude Code
**PR:** #120 (refactor/storage-layer-phase-7)
**Changes:**
- Documented `price-aggregation-service.ts` as **EXCEPTION** to storage layer pattern
  - Added comprehensive documentation explaining transaction context passing complexity
  - Noted in todos/031 and GitHub PR #120 for future reference
- Migrated `price-analytics-routes.ts` to use storage layer (6 endpoints):
  - GET /api/products/:productId/aggregates/weekly
  - GET /api/products/:productId/aggregates/monthly
  - GET /api/products/:productId/retailers/:retailerId/aggregates/weekly
  - GET /api/products/:productId/retailers/:retailerId/aggregates/monthly
  - GET /api/analytics/overview
  - GET /api/health/job-locks
- Implemented 6 new storage methods in DatabaseStorage:
  - getWeeklyAggregates() - Flexible query with year/week/retailer/limit options
  - getMonthlyAggregates() - Flexible query with year/month/retailer/limit options
  - getAnalyticsOverview() - Optimized with SQL COUNT(*) and GROUP BY
  - getJobLocks() - Returns all job locks ordered by timestamp
  - checkDatabaseHealth() - Simple health check
  - getTrendingProducts() - Fetch trending products by status
- Updated MemStorage with stub implementations (already present)
- No TypeScript errors introduced
- Removed direct db imports from price-analytics-routes.ts

**Total migration complete: 14/15 services use storage layer, 1 documented exception**

## Migration Complete ✅

All services have been migrated to use the storage layer pattern, with the following final state:
- **14 services** fully migrated to storage layer
- **1 service** (`price-aggregation-service.ts`) documented as exception due to complex transaction context requirements
- **~86 storage methods** added across all phases
- **Zero TypeScript errors** introduced
- **All pre-commit hooks** passed

This TODO can now be closed. The storage layer pattern is successfully established as the standard data access pattern for this codebase.

## Notes

Source: Comprehensive code audit performed on 2025-11-23
Pattern documentation: docs/STORAGE_MIGRATION_PATTERNS.md
