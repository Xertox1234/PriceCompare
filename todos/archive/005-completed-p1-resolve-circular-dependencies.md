---
status: completed
priority: p1
issue_id: "005"
tags: [code-review, architecture, technical-debt]
dependencies: []
source: code-review-2025-11-30
completed_date: 2025-01-25
---

# Resolve 7 Circular Dependencies ✅ COMPLETED

## Problem Statement

**CRITICAL ARCHITECTURE ISSUE:** 7 circular dependencies detected that violate layered architecture:

```
Storage → Service → Storage (SEVERE)
Storage → WebSocket → Service → Storage (SEVERE)
Service ↔ Service (MODERATE)
```

**Impact:**
- Difficult to test in isolation
- Impossible to tree-shake unused code
- Tight coupling between layers
- Refactoring becomes dangerous
- Module load order issues

## Solution Implemented

All 7 circular dependencies were resolved using an **Event Bus Pattern** and **Dependency Injection**.

### Changes Made

#### 1. Created Event Bus Infrastructure (`server/utils/event-bus.ts`)

Created a typed event emitter system with the following events:
- `NOTIFICATION_CREATED` - For notification broadcasts
- `NOTIFICATION_MARKED_READ` - For notification read state updates
- `NOTIFICATION_MARKED_ALL_READ` - For bulk read operations
- `WATCHLIST_UPDATED` - For watchlist changes
- `PRODUCT_ADDED` - For product additions to watchlists
- `PRODUCT_REMOVED` - For product removals from watchlists
- `METRICS_UPDATED` - For monitoring metrics
- `ALERT_TRIGGERED` - For alert broadcasts

#### 2. Created Event Subscription Initializer (`server/services/event-subscriptions.ts`)

Centralized cross-service event wiring that initializes at server startup.

#### 3. Updated Services to Emit Events Instead of Direct Calls

**`server/services/alert-service.ts`**:
- Removed import of `websocketService`
- Now emits `AppEvents.ALERT_TRIGGERED` via event bus

**`server/services/notification-service.ts`**:
- Removed dynamic imports of websocket handlers
- Now emits `AppEvents.NOTIFICATION_CREATED` via event bus

**`server/services/websocket-service.ts`**:
- Removed import of `alertService`
- Subscribes to `ALERT_TRIGGERED` events and broadcasts to clients

#### 4. Updated WebSocket Handlers to Subscribe to Events

**`server/websocket/handlers/notification-handler.ts`**:
- Created `setupNotificationEventSubscriptions()` function
- Subscribes to `NOTIFICATION_CREATED` events from storage
- Internal `emitNewNotification` function (no longer exported)

**`server/websocket/handlers/watch-list-handler.ts`**:
- Created `setupWatchListEventSubscriptions()` function  
- Subscribes to `WATCHLIST_UPDATED`, `PRODUCT_ADDED`, `PRODUCT_REMOVED` events
- Emit functions now internal (no longer exported)

#### 5. Updated Storage Domains to Emit Events

**`server/storage/domains/watchlist-storage.ts`**:
- Replaced all dynamic WebSocket imports with `eventBus.emit()` calls
- Emits events for create, update, delete, product add/remove operations

**`server/storage/domains/price-storage.ts`**:
- Added `GetProductOffersCallback` type for dependency injection
- Added `setGetProductOffersCallback()` method
- Replaced dynamic imports of `storage.ts` with injected callback
- Moved `getPriceHistoryOptimized` logic from service layer

#### 6. Updated Server Initialization

**`server/index.ts`**:
- Added `initializeEventSubscriptions()` call after WebSocket init
- Added `cleanupEventSubscriptions()` in graceful shutdown

**`server/websocket/index.ts`**:
- Added calls to `setupNotificationEventSubscriptions()` and `setupWatchListEventSubscriptions()`

**`server/storage.ts`**:
- Wired up cross-domain dependencies in constructor
- PriceStorage receives ProductStorage.getProductOffers callback

### Storage Layer Type Updates

**`server/storage/types.ts`**:
- Added `NormalizedPricePoint` interface

**`server/storage.ts`**:
- Added `getPriceHistoryOptimized()` to `IStorage` interface
- Added implementation in `DatabaseStorage` and stub in `MemStorage`

### Test Updates

**`server/websocket/__tests__/handlers.test.ts`**:
- Removed test for `emitNewNotification` (now internal)
- Added comment explaining event-based notification emission

**`server/websocket/__tests__/integration.test.ts`**:
- Updated to use `eventBus.emit(AppEvents.NOTIFICATION_CREATED, ...)` 
- Updated assertions to match new event format

## Verification

```bash
# Before: 7 circular dependencies
npx madge --circular --extensions ts server/
# ✖ Found 7 circular dependencies!

# After: 0 circular dependencies  
npx madge --circular --extensions ts server/
# ✔ No circular dependency found!
```

TypeScript compilation: ✅ Passes
Handler unit tests: ✅ 16/16 passing

## Architecture After Fix

```
✅ CORRECT FLOW NOW:
Routes → Services → Storage → Database
                ↓
            Event Bus
                ↓
        WebSocket Handlers → Clients
```

**Event Flow:**
1. Storage/Service performs operation
2. Emits typed event to Event Bus
3. WebSocket handlers subscribe and broadcast to clients
4. No reverse dependencies

## Acceptance Criteria - All Met

- [x] All storage → service imports removed
- [x] Event bus implemented for WebSocket ↔ service communication
- [x] Service ↔ service cycles resolved via DI or shared utils
- [x] `madge --circular server/` returns zero cycles
- [x] Handler unit tests pass
- [x] TypeScript compiles successfully

## Work Log

### 2025-01-25 - Resolution Completed

**Actions:**
1. Created `server/utils/event-bus.ts` with typed event emitter
2. Created `server/services/event-subscriptions.ts` for cross-service wiring
3. Updated `alert-service.ts` to use event bus instead of websocketService import
4. Updated `websocket-service.ts` to subscribe to alert events
5. Updated `notification-service.ts` to emit events instead of calling handlers
6. Updated `notification-handler.ts` to subscribe to events
7. Updated `watch-list-handler.ts` to subscribe to events
8. Updated `watchlist-storage.ts` to emit events instead of calling websocket
9. Updated `price-storage.ts` with dependency injection for product offers
10. Moved `getPriceHistoryOptimized` from service to storage layer
11. Updated storage.ts to wire up cross-domain dependencies
12. Updated server/index.ts for event subscription initialization
13. Fixed test files to work with new event-based architecture
14. Verified 0 circular dependencies with madge

**Files Modified:**
- `server/utils/event-bus.ts` (NEW)
- `server/services/event-subscriptions.ts` (NEW)
- `server/services/alert-service.ts`
- `server/services/websocket-service.ts`
- `server/services/notification-service.ts`
- `server/services/price-history-service.ts`
- `server/websocket/handlers/notification-handler.ts`
- `server/websocket/handlers/watch-list-handler.ts`
- `server/storage/domains/watchlist-storage.ts`
- `server/storage/domains/price-storage.ts`
- `server/storage/types.ts`
- `server/storage.ts`
- `server/index.ts`
- `server/websocket/index.ts`
- `server/websocket/__tests__/handlers.test.ts`
- `server/websocket/__tests__/integration.test.ts`

## Notes

**Pattern Used:** Event Bus with typed events for service-to-websocket communication, Dependency Injection for cross-domain storage dependencies.

**Benefits:**
- Clean separation of concerns
- Easier testing (mock event bus or callbacks)
- Decoupled modules
- Enables pub/sub patterns for future features
- No module load order issues
