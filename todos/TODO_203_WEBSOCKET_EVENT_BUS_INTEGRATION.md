# TODO 203: WebSocket Event Bus Integration Tests

**Priority**: P3
**File(s)**:
- `server/websocket/__tests__/integration.test.ts`
- `server/websocket/handlers/notification-handler.ts`
- `server/websocket/handlers/watch-list-handler.ts`
- `server/utils/event-bus.ts`

**Estimated Time**: 4-6 hours
**Status**: Not Started

## Problem Statement

8 integration tests fail due to event bus emissions not reaching WebSocket clients in the test environment. Tests that use the event bus pattern (notifications, product events) timeout waiting for events, while tests using direct function calls work fine.

**Failing Tests:**
- Notification Flow (2 tests)
- Price Alert Flow (2 tests)
- Product Addition/Removal Flow (2 tests)
- Room Isolation (2 tests)

## Root Cause

Module isolation in Vitest may be creating separate instances of the event bus:
- Test code imports `eventBus` from `../../utils/event-bus`
- Handler setup code imports `eventBus` from the same path
- With module mocking, these may be different instances
- Events emitted in tests don't trigger handlers that listen on a different instance

## Solution Approach

### Option 1: Event Bus Instance Verification
Verify that test and handler code use the same event bus instance:
- Add debug logging to event bus
- Check listener count before/after setup
- Verify event emissions are received by handlers

### Option 2: Module Mock Refinement
Ensure Vitest doesn't create separate module instances:
- Use `vi.mock()` with factory function that returns singleton
- Import event bus before applying mocks
- Use `vi.importActual()` for event bus module

### Option 3: Test Pattern Change
Bypass event bus in tests, test handlers directly:
- Call handler functions directly instead of emitting events
- Add integration tests at E2E level instead of unit level
- Accept that event bus integration requires different testing approach

## Implementation Steps

### Step 1: Diagnose Event Bus Instance Issue

- [ ] Add debug logging to event bus `on()` and `emit()` methods
- [ ] Log listener count in test setup
- [ ] Verify event bus setup is called
- [ ] Check if emitted events have any listeners

### Step 2: Fix Module Isolation

- [ ] Update test mocks to preserve event bus singleton
- [ ] Use `vi.importActual()` for event bus
- [ ] Verify handlers register listeners on correct instance
- [ ] Add assertion to verify listener count > 0

### Step 3: Test Pattern Adjustment

- [ ] If event bus isolation can't be fixed, refactor tests
- [ ] Call handler functions directly with mock io instance
- [ ] Document why event bus integration requires E2E tests
- [ ] Update test documentation with patterns

## Technical Details

```typescript
// Example: Verify event bus instance
import { eventBus } from '../../utils/event-bus';

beforeAll(() => {
  // Check listener count before setup
  const listenersBefore = eventBus.listenerCount(AppEvents.NOTIFICATION_CREATED);

  // Setup handlers
  setupNotificationEventSubscriptions(io);

  // Verify listeners registered
  const listenersAfter = eventBus.listenerCount(AppEvents.NOTIFICATION_CREATED);
  expect(listenersAfter).toBeGreaterThan(listenersBefore);
});

// Example: Direct handler testing instead of event bus
it('should emit notification via handler', async () => {
  const io = getSocketIO();
  const notification = { /* ... */ };

  // Call handler directly instead of event bus
  await emitNewNotificationInternal(io, userId, notification, 3);

  // Verify socket received event
  await waitForEvent(client, 'notification:new');
});
```

## Checklist

- [ ] Diagnose event bus instance separation issue
- [ ] Implement fix (module mocking or test pattern change)
- [ ] All 8 failing event bus tests pass
- [ ] No regressions in passing tests
- [ ] Documentation updated with learnings

## Success Criteria

- [ ] All 8 event bus integration tests pass
- [ ] Test pattern documented for future event bus tests
- [ ] WebSocket test coverage reaches 50%+ (38/66 tests)
- [ ] No regressions in currently passing tests

## Related Context

**Current Status:**
- 30/66 WebSocket tests passing (45%)
- Event bus tests are the largest remaining failure category
- Core WebSocket functionality verified by passing tests
- Production WebSocket works correctly (E2E tests pass)

**Previous Work:**
- Fixed test authentication (header-based)
- Fixed room join race conditions (await + setImmediate)
- Fixed event subscriptions flag reset
- Fixed storage layer mocking

**Why This Matters:**
- Event bus is critical infrastructure for decoupled communication
- Tests verify handlers respond to service layer events
- Pattern applies to other event-driven features
- Increases confidence in event bus reliability

---

## Notes

This is an **optional improvement** with **low production impact**. The event bus works correctly in production (verified by E2E tests). These unit tests would provide faster feedback and better isolation, but are not critical for shipping.

**Alternatives to consider:**
- Accept E2E-only coverage for event bus integration
- Focus effort on higher-priority features
- Revisit when adding new event bus features

**Difficulty Assessment:**
- **Easy**: If it's just a module mocking configuration issue
- **Hard**: If Vitest fundamentally can't preserve singleton across mocked modules
- **Moderate**: If requires refactoring test patterns

