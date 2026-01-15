# TODO_207 WebSocket Race Conditions - Resolution Summary

**Status**: ✅ **RESOLVED**
**Resolution Date**: 2026-01-14
**Test Results**: 13/13 passing (100% success rate)

## Root Cause Analysis

WebSocket integration tests were failing due to a **race condition** where the server emitted the 'authenticated' event before test clients had set up their event listeners.

### The Problem Sequence

1. Test creates socket with `createAuthenticatedSocket(userId, port)`
2. Socket.IO client **immediately connects** (default behavior)
3. Server receives connection, authenticates, and **immediately emits 'authenticated' event**
4. Test calls `await waitForEvent(client, 'connect')` - sets up listener for 'connect'
5. Test calls `await waitForEvent(client, 'authenticated')` - **but event already fired!**
6. Test times out after 5000ms waiting for an event that will never come

## Technical Root Causes

1. **Socket.IO Auto-Connect**: By default, `ioClient()` starts connecting immediately upon creation
2. **Synchronous Event Emission**: Server emits 'authenticated' in the same event loop tick after authentication
3. **Late Listener Setup**: Tests were setting up listeners AFTER the socket had already connected and authenticated

## Solution Implemented

### 1. Disable Auto-Connect in Test Socket Creation

**File**: `server/websocket/__tests__/test-utils.ts` (lines 100-116)

```typescript
export function createAuthenticatedSocket(
  userId: number,
  port: number = TEST_PORT
): ClientSocket<ServerToClientEvents, ClientToServerEvents> {
  const client = ioClient(`http://localhost:${port}`, {
    path: '/ws',
    transports: ['websocket'],
    reconnection: false,
    autoConnect: false, // ✅ NEW: Don't connect immediately
    extraHeaders: {
      'x-test-user-id': String(userId),
    },
  });

  return client;
}
```

### 2. Create Helper Function to Connect with Both Listeners

**File**: `server/websocket/__tests__/test-utils.ts` (lines 191-242)

```typescript
export async function connectAndAuthenticate(
  socket: ClientSocket,
  timeout = 5000
): Promise<{ userId: number }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Connection/authentication timeout'));
    }, timeout);

    let connected = false;
    let authenticated = false;
    let authData: { userId: number } | null = null;

    const checkComplete = () => {
      if (connected && authenticated && authData) {
        clearTimeout(timer);
        resolve(authData);
      }
    };

    // ✅ CRITICAL: Set up BOTH listeners BEFORE connecting
    socket.once('connect', () => {
      connected = true;
      checkComplete();
    });

    socket.once('authenticated', (data: { userId: number }) => {
      authenticated = true;
      authData = data;
      checkComplete();
    });

    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    // ✅ Now connect - both listeners are already in place
    socket.connect();
  });
}
```

### 3. Update All Tests to Use New Helper

**File**: `server/websocket/__tests__/integration.test.ts`

**Before (❌ Race Condition)**:
```typescript
const client = createAuthenticatedSocket(userId, port);
try {
  await waitForEvent(client, 'connect');      // Listener set up AFTER connection
  await waitForEvent(client, 'authenticated'); // Listener set up AFTER event fires
  // ... test code
}
```

**After (✅ Fixed)**:
```typescript
const client = createAuthenticatedSocket(userId, port);
try {
  await connectAndAuthenticate(client); // Listeners set up BEFORE connecting
  // ... test code
}
```

**Changes Applied**:
- Updated 8 single-client tests to use `connectAndAuthenticate()`
- Updated 5 multi-client tests to use `connectAndAuthenticate()` for each client
- Updated `createMultipleSockets()` helper to use `connectAndAuthenticate()`

### 4. Disable Rate Limiting in Test Mode

**File**: `server/websocket/index.ts` (lines 254-258)

```typescript
async function rateLimitMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  // ✅ NEW: Disable rate limiting in test mode to allow rapid connections
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const ip = socket.handshake.address;
  // ... rate limiting logic
}
```

**Why Needed**: Tests create multiple sockets rapidly from localhost (same IP), triggering rate limit (10 connections/minute per IP).

## Files Modified

1. **server/websocket/__tests__/test-utils.ts**
   - Line 107: Added `autoConnect: false` to `createAuthenticatedSocket()`
   - Lines 191-242: Added `connectAndAuthenticate()` helper function
   - Line 339: Updated `createMultipleSockets()` to use `connectAndAuthenticate()`

2. **server/websocket/__tests__/integration.test.ts**
   - Line 23: Added `connectAndAuthenticate` import
   - Lines 101, 142, 177: Updated watch list tests (3 tests)
   - Lines 214, 266, 313, 357, 526: Updated multi-client tests (5 tests)
   - Lines 401, 447, 481, 568, 612: Updated notification/alert/product tests (5 tests)
   - **Total**: 13 tests updated

3. **server/websocket/index.ts**
   - Lines 255-258: Added test mode bypass for rate limiting

## Test Results

### Before Fix
- **Status**: 7/13 integration tests failing (in `integration.test.ts`)
- **Error**: `Error: Timeout waiting for event: authenticated`
- **Symptom**: Tests consistently timing out at 5000ms

### After Fix
- **Status**: ✅ **13/13 integration tests passing** (100% success rate)
- **Duration**: ~3.3 seconds (down from 26+ seconds with timeouts)
- **No timeouts, no race conditions**

### Scope Note

This fix addresses the 7 failing tests in `integration.test.ts` that were identified in TODO_207.

**Out of Scope**: The `error-handling.test.ts` and `load.test.ts` files have pre-existing authentication mocking issues (see comment on line 62 of error-handling.test.ts: "SKIP: Same authentication mocking issue"). These tests were not part of the original 7 failing tests and require separate investigation.

## Key Learnings

### 1. **Socket.IO Client Auto-Connect Behavior**
Socket.IO clients connect immediately by default. For tests that need to set up listeners before connection, use `autoConnect: false` and manually call `socket.connect()`.

### 2. **Event Listener Timing**
When server emits events synchronously during connection setup, test listeners must be attached BEFORE connecting, not after.

### 3. **Test Mode Rate Limiting**
Integration tests that create many connections rapidly need rate limiting disabled or adjusted for test mode.

### 4. **Consistent Test Patterns**
Using helper functions like `connectAndAuthenticate()` ensures all tests handle async connection setup consistently.

## Pattern for Future WebSocket Tests

```typescript
// ✅ CORRECT: Set up listeners before connecting
const client = createAuthenticatedSocket(userId, port);
try {
  await connectAndAuthenticate(client); // Handles both 'connect' and 'authenticated'

  // Now safe to emit events and set up test-specific listeners
  client.emit('some:event');
  await waitForEvent(client, 'some:response');

  // ... test assertions
} finally {
  disconnectSockets([client]);
}
```

## Related Files

- `server/websocket/__tests__/integration.test.ts` - All WebSocket integration tests
- `server/websocket/__tests__/test-utils.ts` - WebSocket test utilities
- `server/websocket/index.ts` - WebSocket server initialization and middleware
- `server/websocket/handlers/notification-handler.ts` - Notification event handlers
- `server/websocket/handlers/watch-list-handler.ts` - Watch list event handlers

## References

- **Original Issue**: TODO_207_FIX_WEBSOCKET_RACE_CONDITIONS.md
- **Related**: TODO_206 (Authentication test failures - already resolved)
- **Pattern Documentation**: This resolution should be added to WebSocket testing patterns

## Time Investment

- **Investigation**: ~2 hours
- **Implementation**: ~1 hour
- **Testing & Validation**: ~30 minutes
- **Total**: ~3.5 hours

## Prevention

To prevent similar race conditions in future tests:

1. **Always use `autoConnect: false`** for test sockets when event timing matters
2. **Set up ALL expected event listeners BEFORE calling `socket.connect()`**
3. **Use helper functions** (`connectAndAuthenticate()`) for consistent patterns
4. **Disable or adjust rate limiting** for test mode
5. **Document timing-sensitive patterns** in test utilities

---

**Resolution Validated**: 2026-01-14 08:32:07
**Final Test Run**: ✅ 13/13 tests passing in 3.32 seconds
