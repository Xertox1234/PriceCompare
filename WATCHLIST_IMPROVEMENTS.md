# Watchlist Improvements Plan

## Overview
This document tracks planned improvements to the PriceCompare watchlist and community features system.

## Current Implementation Summary

### Existing Features
- ✅ Product watching/unwatching (`server/community-routes.ts`)
- ✅ Watch counts and user's watched list
- ✅ Most-watched products (trending)
- ✅ Reputation system with automatic point awards
- ✅ Deal spotting with automatic forum posting
- ✅ Leaderboard and badges (7 types)
- ✅ React Query hooks with polling (30s-2m intervals)
- ✅ Database schema: `product_watches`, `user_reputation`, `deal_spottings`

### Architecture
- **Frontend**: 5 components (WatchButton, MostWatchedWidget, ReputationCard, Leaderboard)
- **Backend**: 9 API endpoints in community-routes.ts
- **Database**: PostgreSQL with triggers for auto-calculation
- **Updates**: Polling-based real-time updates

## Planned Improvements

### Phase 1: Enhanced Watch List Management 🚧 IN PROGRESS
**Priority**: High
**Estimated Effort**: Medium

#### 1.1 Watch List Organization ✅ BACKEND & HOOKS COMPLETE
- [x] Add categories/tags for watched products (backend complete)
- [x] Create custom watch lists (backend complete - name, description, color, icon)
- [x] Bulk operations (backend complete - move, delete)
- [x] Import/export watch lists (backend complete - JSON format)
- [x] Database migration (0008_add_watch_lists.sql)
- [x] Backend service functions (14 new functions in community-service.ts)
- [x] API endpoints (11 new routes in community-routes.ts)
- [x] React Query hooks (11 new hooks in use-community.ts)
- [ ] UI Components (pending - watch list manager, product cards, bulk actions)
- [ ] Integration testing

#### 1.2 Advanced Search & Filtering
- [ ] Search within watched products
- [ ] Filter by category, price range, deal status
- [ ] Sort by: added date, price, discount percentage, last price change
- [ ] Quick filters: "Active deals", "Price increased", "Back in stock"

#### 1.3 Watch List UI Enhancements
- [ ] Grid/list view toggle
- [ ] Compact mode for large watch lists
- [ ] Product comparison view (select multiple from watch list)
- [ ] Price history chart inline view

### Phase 2: Real-time Notifications & Alerts 🔔
**Priority**: High
**Estimated Effort**: High

#### 2.1 WebSocket Implementation
- [ ] Replace polling with WebSocket connections
- [ ] Real-time price drop notifications
- [ ] Live leaderboard updates
- [ ] Watch count updates without refresh

#### 2.2 Notification Delivery System
- [ ] In-app notification center
- [ ] Browser push notifications (with permission)
- [ ] Email notifications (digest options: instant, daily, weekly)
- [ ] Notification preferences per product

#### 2.3 Custom Alert Rules
- [ ] Price drop thresholds (percentage or absolute)
- [ ] Target price alerts
- [ ] Stock availability alerts
- [ ] Competitor price matching alerts

### Phase 3: Performance & Scalability 🚀
**Priority**: Medium
**Estimated Effort**: Medium

#### 3.1 Database Optimization
- [ ] Materialized views for most-watched products
- [ ] Indexed views for leaderboard queries
- [ ] Pagination for all list endpoints
- [ ] Caching layer for reputation calculations

#### 3.2 Frontend Optimization
- [ ] Virtual scrolling for large watch lists
- [ ] Lazy loading for product images
- [ ] Optimistic updates for watch/unwatch
- [ ] Service worker for offline support

### Phase 4: Enhanced Reputation System 🏆
**Priority**: Low
**Estimated Effort**: Medium

#### 4.1 Reputation Decay & Balance
- [ ] Time-based reputation decay mechanism
- [ ] Activity multipliers (engagement bonus)
- [ ] Seasonal events with bonus points
- [ ] Reputation transfer prevention (anti-gaming measures)

#### 4.2 Enhanced Gamification
- [ ] Achievement system beyond badges
- [ ] Monthly/seasonal challenges
- [ ] User profiles with stats
- [ ] Social features (follow users, share watch lists)

#### 4.3 Advanced Badge System
- [ ] Time-limited badges
- [ ] Combo badges (multiple conditions)
- [ ] Rarity tiers (common, rare, epic, legendary)
- [ ] Badge showcase on profile

### Phase 5: Analytics & Insights 📊
**Priority**: Low
**Estimated Effort**: Low

#### 5.1 User Analytics Dashboard
- [ ] Savings tracker (total saved through deals)
- [ ] Watch list value tracker
- [ ] Deal spotting success rate
- [ ] Personalized insights

#### 5.2 Community Analytics
- [ ] Trending categories
- [ ] Peak deal spotting times
- [ ] Community savings impact
- [ ] Popular watch list patterns

## Technical Debt & Maintenance

### Security
- [ ] Rate limiting for watch/unwatch operations
- [ ] CSRF protection for all endpoints
- [ ] Input validation enhancements
- [ ] Audit logging for reputation changes

### Testing
- [ ] Unit tests for community-service.ts
- [ ] Integration tests for watch list operations
- [ ] E2E tests for notification flows
- [ ] Load testing for WebSocket connections

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User guide for watchlist features
- [ ] Admin guide for reputation management
- [ ] Architecture decision records (ADRs)

## Implementation Priority

1. **Phase 1.1 & 1.2** - Watch list management (most user-requested)
2. **Phase 2.1 & 2.2** - WebSocket & notifications (high impact)
3. **Phase 3.1** - Database optimization (scalability)
4. **Phase 1.3** - UI enhancements
5. **Phase 4.1** - Reputation improvements
6. **Remaining phases** - As resources allow

## Success Metrics

- User engagement: % of users with active watch lists
- Notification effectiveness: CTR on price drop alerts
- Performance: Page load time for watch list page
- System health: WebSocket connection stability
- Community growth: Active users, deal spottings per week

## Notes

- All phases should maintain backward compatibility
- Consider mobile responsiveness for all UI changes
- Ensure accessibility (WCAG 2.1 AA compliance)
- Monitor performance impact of new features

---

## Implementation Progress

### Completed (2025-11-14)

#### Phase 1.1 Backend Infrastructure ✅
**Commits**: 8b34f6f, bb53565

**Database Schema** (`migrations/0008_add_watch_lists.sql`):
- Created `watch_lists` table with customization fields
- Extended `product_watches` table with watchListId, category, notes, priority, targetPrice
- Added materialized view for statistics
- Implemented triggers for auto-creation and updates
- Updated constraints for multi-list support

**Backend Services** (`server/services/community-service.ts`):
- `createWatchList()` - Create custom lists with auto-ordering
- `getUserWatchLists()` - Fetch with stats (watch count, high priority count)
- `getWatchListById()` - Get specific list details
- `updateWatchList()` - Update list properties
- `deleteWatchList()` - Delete with default list protection
- `getWatchListProducts()` - Get products with full details
- `updateProductWatch()` - Update watch metadata
- `moveProductsToWatchList()` - Bulk move operation
- `bulkRemoveProductWatches()` - Bulk delete operation
- `getUserDefaultWatchList()` - Get default list
- `exportWatchLists()` - Export to JSON
- `importWatchLists()` - Import from JSON

**API Endpoints** (`server/community-routes.ts`):
- POST `/api/community/watch-lists` - Create list
- GET `/api/community/watch-lists` - List all
- GET `/api/community/watch-lists/:id` - Get one
- PATCH `/api/community/watch-lists/:id` - Update
- DELETE `/api/community/watch-lists/:id` - Delete
- GET `/api/community/watch-lists/:id/products` - Get products
- PATCH `/api/community/product-watches/:id` - Update watch
- POST `/api/community/product-watches/bulk-move` - Bulk move
- POST `/api/community/product-watches/bulk-delete` - Bulk delete
- GET `/api/community/watch-lists/export` - Export
- POST `/api/community/watch-lists/import` - Import

**Frontend Hooks** (`client/src/hooks/use-community.ts`):
- `useCreateWatchList()` - Create list mutation
- `useWatchLists()` - Query all lists with auto-refresh
- `useWatchList(id)` - Query specific list
- `useUpdateWatchList()` - Update mutation
- `useDeleteWatchList()` - Delete mutation
- `useWatchListProducts(id)` - Query products with auto-refresh
- `useUpdateProductWatch()` - Update watch mutation
- `useMoveProductsToWatchList()` - Bulk move mutation
- `useBulkRemoveProductWatches()` - Bulk delete mutation
- `useExportWatchLists()` - Export with auto-download
- `useImportWatchLists()` - Import mutation

**Types** (`shared/schema.ts`):
- Added `WatchList` and `InsertWatchList` types
- Extended `ProductWatch` with new fields
- Exported all types for frontend usage

### Next Steps

1. **UI Components** (Remaining for Phase 1.1):
   - Watch list management page/component
   - Product card with watch metadata editor
   - Bulk selection and action toolbar
   - Import/export UI
   - Watch list selector/switcher

2. **Phase 1.2** - Advanced Search & Filtering
3. **Phase 1.3** - UI Enhancements

---

**Last Updated**: 2025-11-14
**Status**: Phase 1.1 Backend & Hooks Complete
**Current Branch**: `claude/watchlist-improvements-01MvMzDgH3n5iEzGN6GYYpS7`
