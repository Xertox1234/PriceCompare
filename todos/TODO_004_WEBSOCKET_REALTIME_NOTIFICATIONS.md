# TODO 004: WebSocket Real-Time Notification Testing (Phase 2.2)

**Priority**: P3
**File(s)**: `e2e/notifications.spec.ts`
**Line**: 725
**Estimated Time**: 4-6 hours
**Status**: Not Started (Phase 2.2 Backlog)

## Problem Statement

Real-time WebSocket notification testing is reserved for Phase 2.2:

```typescript
/**
 * TODO: Reserved for Phase 2.2 WebSocket real-time notification testing
 */
```

Currently notifications are tested via HTTP polling, not real-time WebSocket delivery.

## Root Cause

WebSocket infrastructure was deprioritized for Phase 2.2 roadmap.

## Solution Approach

Implement E2E tests for WebSocket notification delivery once WebSocket service is production-ready.

## Implementation Steps

### Step 1: Verify WebSocket Infrastructure

- [ ] Confirm `server/services/websocket-service.ts` is complete
- [ ] Verify WebSocket connection handling in production

### Step 2: Add E2E Test Helpers

- [ ] Create WebSocket test client helper in `e2e/helpers/`
- [ ] Add connection, message, and disconnect utilities

### Step 3: Implement WebSocket Tests

- [ ] Test connection establishment
- [ ] Test real-time notification delivery
- [ ] Test reconnection handling
- [ ] Test notification filtering by user

### Step 4: Test Scenarios

- [ ] Price drop notification arrives in real-time
- [ ] Multiple concurrent connections
- [ ] Connection recovery after disconnect

## Technical Details

```typescript
// Example E2E WebSocket test pattern
test('receives real-time price drop notification', async ({ page }) => {
  // Setup WebSocket listener
  const wsMessages: any[] = [];
  await page.evaluate(() => {
    const ws = new WebSocket('ws://localhost:5000/ws/notifications');
    ws.onmessage = (e) => window.__wsMessages.push(JSON.parse(e.data));
  });
  
  // Trigger price drop
  await triggerPriceDropForUser(userId);
  
  // Verify notification received via WebSocket
  await expect.poll(() => wsMessages.length).toBeGreaterThan(0);
  expect(wsMessages[0].type).toBe('price_drop');
});
```

## Checklist

- [ ] WebSocket service production-ready
- [ ] E2E helpers created
- [ ] Core notification tests implemented
- [ ] Edge cases covered

## Success Criteria

- [ ] WebSocket notifications tested end-to-end
- [ ] Tests are stable (no flakiness from timing)
- [ ] Coverage for connection, delivery, and recovery
