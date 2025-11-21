# WebSocket Test Suite Documentation

Comprehensive test coverage for the WebSocket real-time notification system (Phase 2.1).

## Test Files Overview

### Backend Tests (server/websocket/__tests__/)

#### 1. **integration.test.ts** (15+ tests)
Tests end-to-end event flows across the WebSocket system.

**Coverage:**
- Watch list creation/update/deletion events
- Multi-tab synchronization (same user, multiple connections)
- Room isolation (users only receive their own events)
- Notification flow with unread counts
- Price alert delivery
- Product addition/removal events

**Key Test Scenarios:**
```typescript
// Watch list update flow
test('watch list creation emits WebSocket event to user')
test('watch list update in one tab reflects in another tab')
test('user only receives their own events')

// Notification flow
test('new notification emits to user with unread count')

// Price alert flow
test('price alert triggers WebSocket notification')
test('price alert only to targeted user')
```

#### 2. **reconnection.test.ts** (8+ tests)
Tests automatic reconnection behavior and connection stability.

**Coverage:**
- Network disconnect recovery
- Exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max)
- Maximum reconnection attempts (10)
- Subscription restoration after reconnection
- Connection state transitions
- Clean intentional disconnect

**Key Test Scenarios:**
```typescript
test('client reconnects after server disconnect')
test('should use exponential backoff for reconnection attempts')
test('should stop reconnecting after max attempts')
test('should restore subscriptions after reconnection')
test('should not reconnect after intentional disconnect')
```

#### 3. **load.test.ts** (10+ tests)
Tests performance under various load conditions.

**Coverage:**
- Concurrent connections (50, 100+)
- Message throughput (100+ msg/s, 500+ burst)
- Latency measurements (<100ms average, <300ms max)
- Connection stability over time
- Memory leak detection
- Rapid connect/disconnect cycles

**Performance Benchmarks:**
```typescript
50 connections:
- Connection latency: <5s
- Memory per connection: <10MB

100 connections:
- Total memory: <500MB
- Latency: <150ms average, <300ms max

Throughput:
- 100 msg/s sustained
- 500 msg burst in <5s
```

**Output Example:**
```
📊 Load Test Results (100 connections):
   Total memory used: 180MB
   Memory per connection: 1.80MB
   Connected sockets: 100

📊 Throughput Test Results:
   Messages sent: 100
   Duration: 845ms
   Throughput: 118 msg/s

📊 Latency Test Results:
   Average latency: 12.45ms
   Min latency: 8ms
   Max latency: 28ms
```

#### 4. **error-handling.test.ts** (12+ tests)
Tests error scenarios and recovery mechanisms.

**Coverage:**
- Authentication failures
- Event handler errors
- Redis connection loss (fail-open behavior)
- Malformed data handling
- Rate limit errors
- Server error recovery
- Production vs development error messages

**Key Test Scenarios:**
```typescript
test('should reject connection without valid session')
test('should sanitize error messages in production')
test('should continue operating when Redis is unavailable')
test('should handle Redis errors gracefully during operations')
test('should not crash server on unhandled event handler error')
```

#### 5. **websocket-server.test.ts** (3 tests - existing)
Basic server initialization and configuration tests.

#### 6. **handlers.test.ts** (17 tests - existing)
Tests for individual event handlers and middleware.

### Frontend Tests (client/src/hooks/__tests__/)

#### 1. **use-websocket.test.tsx** (11 tests)
Tests core WebSocket connection management hook.

**Coverage:**
- Connection initialization
- Auto-connect on authentication
- Auto-disconnect on logout
- Connection state tracking (disconnected, connecting, connected, reconnecting)
- State change subscriptions
- Cleanup on unmount

**Key Test Scenarios:**
```typescript
test('should connect when user is authenticated')
test('should disconnect when user logs out')
test('should update connection state when WebSocket state changes')
test('should cleanup subscription on unmount')
```

#### 2. **use-watchlist-updates.test.tsx** (14 tests)
Tests real-time watch list update handling.

**Coverage:**
- Event subscription/unsubscription
- React Query cache invalidation
- Toast notifications for different actions
- Product addition/removal handling
- Reconnection behavior
- Multiple events in sequence

**Key Test Scenarios:**
```typescript
test('should invalidate queries on watch list update')
test('should show toast on watch list created')
test('should handle product added event')
test('should not show toast for removals')
test('should resubscribe when connection state changes')
```

#### 3. **use-notification-updates.test.tsx** (16 tests)
Tests real-time notification handling and unread count tracking.

**Coverage:**
- Unread count initialization
- New notification handling
- Priority-based toast notifications
- High priority alerts (with sound)
- Price alert special handling
- Mark as read updates
- Count updates
- Concurrent notifications

**Key Test Scenarios:**
```typescript
test('should initialize unread count from subscription confirmation')
test('should show toast for high priority notifications')
test('should show custom toast for price alerts')
test('should track unread count through multiple events')
test('should handle concurrent notifications')
```

## Test Utilities (test-utils.ts)

Shared helper functions for WebSocket testing:

```typescript
// Server setup
createTestServer() - Creates Express + WebSocket test server
closeTestServer() - Cleanup

// Client helpers
createAuthenticatedSocket(userId) - Create test client
waitForEvent(socket, event) - Wait for specific event
disconnectSockets(sockets) - Cleanup multiple sockets

// Mocking
createMockSession(userId) - Mock Express session
createMockRedis() - Mock Redis client

// Utilities
spyOnSocketEvent(socket, event) - Spy on emissions
waitForCondition(condition) - Wait for boolean condition
emitServerEvent(userId, event, data) - Emit from server
```

## Running Tests

### All WebSocket Tests
```bash
npm test -- server/websocket/__tests__/ --run
```

### Specific Test Suites
```bash
# Integration tests
npm test -- server/websocket/__tests__/integration.test.ts --run

# Reconnection tests
npm test -- server/websocket/__tests__/reconnection.test.ts --run

# Load tests (longer running)
npm test -- server/websocket/__tests__/load.test.ts --run

# Error handling tests
npm test -- server/websocket/__tests__/error-handling.test.ts --run

# Frontend tests
npm test -- client/src/hooks/__tests__/use-websocket.test.tsx --run
npm test -- client/src/hooks/__tests__/use-watchlist-updates.test.tsx --run
npm test -- client/src/hooks/__tests__/use-notification-updates.test.tsx --run
```

### Watch Mode (for development)
```bash
npm test -- server/websocket/__tests__/integration.test.ts
```

### Coverage Report
```bash
npm run test:coverage -- server/websocket/
```

## Test Statistics

**Total Tests:** 72+ tests
- Backend: 50+ tests
  - Integration: 15 tests
  - Reconnection: 8 tests
  - Load: 10 tests
  - Error handling: 12 tests
  - Existing: 20 tests
- Frontend: 41 tests
  - useWebSocket: 11 tests
  - useWatchListUpdates: 14 tests
  - useNotificationUpdates: 16 tests

**Expected Coverage:** >85% for WebSocket code

## Common Test Patterns

### Testing Event Emission
```typescript
const spy = spyOnSocketEvent(client, 'watchlist:update');

// Emit from server
const io = getSocketIO();
emitWatchListUpdate(io, userId, 'created', watchListData);

// Verify received
await waitForEvent(client, 'watchlist:update');
expect(spy).toHaveBeenCalledWith(expect.objectContaining({
  watchListId: 1,
  action: 'created'
}));
```

### Testing Multi-Tab Sync
```typescript
const client1 = createAuthenticatedSocket(userId, port);
const client2 = createAuthenticatedSocket(userId, port);

// Both subscribe
client1.emit('subscribe:watchlists');
client2.emit('subscribe:watchlists');

// Emit to user
emitWatchListUpdate(io, userId, 'created', data);

// Both receive
await Promise.all([
  waitForEvent(client1, 'watchlist:update'),
  waitForEvent(client2, 'watchlist:update')
]);
```

### Testing Room Isolation
```typescript
const clientA = createAuthenticatedSocket(userA, port);
const clientB = createAuthenticatedSocket(userB, port);

const spyA = spyOnSocketEvent(clientA, 'watchlist:update');
const spyB = spyOnSocketEvent(clientB, 'watchlist:update');

// Emit only to User A
emitWatchListUpdate(io, userA, 'created', data);

await waitForEvent(clientA, 'watchlist:update');
await new Promise(resolve => setTimeout(resolve, 500));

// Only User A received
expect(spyA).toHaveBeenCalled();
expect(spyB).not.toHaveBeenCalled();
```

### Testing React Hooks
```typescript
const { result } = renderHook(() => useWatchListUpdates(), { wrapper });

// Simulate event
handlers['watchlist:update'](eventData);

await waitFor(() => {
  expect(result.current.someValue).toBe(expected);
});
```

## Known Issues & Limitations

1. **Act() Warnings**: React Testing Library emits act() warnings for async state updates. These are expected and harmless.

2. **Port Conflicts**: Integration tests use port 5556. Ensure it's available.

3. **Timing Sensitivity**: Some reconnection tests are sensitive to timing. If tests flake, increase timeouts.

4. **Redis Mocking**: Tests use in-memory Redis mock. Real Redis behavior may differ slightly.

5. **Authentication**: Tests use simplified authentication. Real session middleware is more complex.

## Production Readiness Checklist

Based on test results:

- [x] End-to-end event flows working
- [x] Multi-tab synchronization verified
- [x] Room isolation enforced
- [x] Reconnection with exponential backoff
- [x] 100+ concurrent connections supported
- [x] <100ms average latency
- [x] Redis failover handling
- [x] Error sanitization in production
- [x] Rate limiting enforced
- [x] Frontend hooks tested
- [x] Memory leak prevention verified

## Next Steps

1. **E2E Tests (Optional)**: Add Playwright E2E tests for full user workflows
2. **Artillery Load Tests**: Use Artillery for more realistic load testing
3. **Redis Integration Tests**: Test with real Redis instance
4. **Monitoring Integration**: Add tests for Sentry/monitoring integration
5. **WebSocket Scaling**: Test with multiple server instances (Redis adapter)

## Troubleshooting

### Tests Timeout
- Increase timeout in test files: `vi.timeout(30000)`
- Check server is starting properly
- Verify port 5556 is available

### Connection Refused
- Server may not be fully initialized
- Add longer wait after `createTestServer()`
- Check error logs for startup issues

### Tests Flaky
- Add more explicit `waitFor()` calls
- Increase timeouts for slow operations
- Use `waitForCondition()` for complex checks

### Memory Issues
- Run tests sequentially: `npm test -- --no-threads`
- Ensure cleanup functions are called
- Check for event listener leaks
