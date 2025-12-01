---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, architecture, technical-debt]
dependencies: []
source: code-review-2025-11-30
---

# Resolve 7 Circular Dependencies

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

**Architecture Violation:**
```
✅ CORRECT: Routes → Services → Storage → Database
❌ ACTUAL: Routes → Services ↔ Storage ↔ WebSocket ↔ Services
```

## Findings

**Discovery:** Architecture Strategist identified 7 circular dependency cycles

**Critical Cycles:**

1. **storage.ts → price-storage.ts → price-history-service.ts → storage.ts**
   - Severity: SEVERE
   - Storage domain imports service (wrong direction!)

2. **storage.ts → watchlist-storage.ts → websocket → monitoring-service.ts → storage.ts**
   - Severity: SEVERE
   - Storage → WebSocket → Service creates 3-way cycle

3. **websocket → notification-service.ts → websocket**
   - Severity: MODERATE
   - WebSocket and notification service are tightly coupled

4. **websocket-service.ts → alert-service.ts → websocket-service.ts**
   - Severity: MODERATE
   - Services should not import each other directly

## Proposed Solutions

### Solution 1: Break Storage → Service Dependencies (CRITICAL)

**Root Cause:** Storage domains import service logic instead of extracting shared code.

**Fix for price-storage.ts:**

```typescript
// ❌ WRONG - Storage importing service
// server/storage/domains/price-storage.ts
import { priceHistoryService } from "../../services/price-history-service";

// ✅ CORRECT - Extract shared logic to utils
// server/utils/price-calculations.ts
export function calculatePriceTrend(prices: number[]): TrendDirection {
  // Shared calculation logic
}

// server/storage/domains/price-storage.ts
import { calculatePriceTrend } from "../../utils/price-calculations";

// server/services/price-history-service.ts
import { calculatePriceTrend } from "../utils/price-calculations";
```

**Alternative:** Use dependency injection if service feature is optional:

```typescript
// server/storage/domains/price-storage.ts
export class PriceStorage {
  constructor(
    private db: Database,
    private priceHistoryService?: PriceHistoryService // Optional DI
  ) {}

  async getPrice(id: number) {
    const price = await this.db.select()...;

    // Only call service if injected
    if (this.priceHistoryService) {
      await this.priceHistoryService.recordLookup(id);
    }

    return price;
  }
}
```

### Solution 2: Break WebSocket ↔ Service Cycles

**Root Cause:** WebSocket handlers and services directly call each other.

**Fix:** Use event emitter pattern for decoupling:

```typescript
// server/utils/event-bus.ts
import { EventEmitter } from 'events';
export const eventBus = new EventEmitter();

// server/websocket/handlers/notification-handler.ts
import { eventBus } from '../../utils/event-bus';

// Emit event instead of calling service
eventBus.emit('notification:send', { userId, message });

// server/services/notification-service.ts
import { eventBus } from '../utils/event-bus';

// Listen to events
eventBus.on('notification:send', async (data) => {
  await sendNotification(data);
});
```

**Benefits:**
- Breaks direct dependency
- Easier to test (mock event emitter)
- Decouples modules
- Enables pub/sub patterns

### Solution 3: Service-to-Service Dependencies

**Root Cause:** Services import each other instead of shared utilities.

**Fix:** Extract shared logic or use composition:

```typescript
// ❌ WRONG
// server/services/websocket-service.ts
import { alertService } from "./alert-service";

// ✅ CORRECT - Pass as constructor dependency
export class WebSocketService {
  constructor(
    private alertService: AlertService,
    private notificationService: NotificationService
  ) {}
}

// OR extract shared logic
// server/utils/alert-utils.ts
export function formatAlertMessage(alert: Alert): string {
  // Shared formatting logic
}
```

## Recommended Action

**Phase 1: Break Storage → Service Cycles (Week 1)**

1. Audit `server/storage/domains/*.ts` for service imports
2. Extract shared business logic to `server/utils/`
3. Update storage domains to use util functions
4. Verify with: `madge --circular server/`

**Files to fix:**
- `server/storage/domains/price-storage.ts`
- `server/storage/domains/watchlist-storage.ts`

**Phase 2: Break WebSocket ↔ Service Cycles (Week 2)**

5. Create `server/utils/event-bus.ts`
6. Replace direct service calls with event emissions
7. Update services to listen for events
8. Test WebSocket functionality

**Files to fix:**
- `server/websocket/handlers/notification-handler.ts`
- `server/websocket/handlers/watch-list-handler.ts`
- `server/services/notification-service.ts`
- `server/services/monitoring-service.ts`

**Phase 3: Resolve Service ↔ Service Cycles (Week 3)**

9. Extract shared utilities from services
10. Use dependency injection for service composition
11. Update service constructors
12. Verify no circular imports remain

**Files to fix:**
- `server/services/websocket-service.ts`
- `server/services/alert-service.ts`

## Technical Details

- **Detection Tool:** `madge --circular server/`
- **Validation:** Run after each fix to ensure cycle broken
- **Testing:** Unit tests should still pass (better: add module import tests)

### Verification Command:
```bash
# Install madge
npm install -D madge

# Detect circular dependencies
madge --circular --extensions ts server/

# Expected output after fix: "No circular dependencies found!"
```

## Acceptance Criteria

- [ ] All storage → service imports removed
- [ ] Event bus implemented for WebSocket ↔ service communication
- [ ] Service ↔ service cycles resolved via DI or shared utils
- [ ] `madge --circular server/` returns zero cycles
- [ ] All unit tests pass
- [ ] Manual testing of affected features (WebSocket, alerts, notifications)
- [ ] Architecture diagram updated to show correct layer flow

## Work Log

### 2025-11-30 - Code Review Discovery
**By:** Architecture Strategist Agent
**Actions:**
- Ran madge circular dependency detection
- Identified 7 circular dependency cycles
- Categorized by severity (SEVERE vs MODERATE)
- Traced import chains to find root causes

**Learnings:**
- Circular dependencies indicate architectural boundary violations
- Storage layer should never import services
- Event-driven patterns prevent tight coupling
- Dependency injection enables testability

## Resources

- madge tool: https://github.com/pahen/madge
- Event-driven architecture: https://martinfowler.com/articles/201701-event-driven.html
- Dependency injection: https://en.wikipedia.org/wiki/Dependency_injection

## Notes

**Estimated Effort:** 2-3 weeks (phased)
- Storage → Service cycles: 1 week
- WebSocket cycles: 1 week
- Service cycles: 3-5 days
- Testing + verification: 2-3 days

**Risk Level:** Medium
- Breaking changes possible
- Requires careful testing
- Event bus adds new pattern (team training needed)

**Urgency:** HIGH
- Blocks clean architecture
- Makes refactoring dangerous
- Hinders testability

**Success Metric:** Zero circular dependencies detected by madge
