# TODO 283: Fix Duplicate WebSocket Connections

**Priority**: P1
**File(s)**: `client/src/hooks/useSmartNotifications.ts`, `client/src/lib/websocket-client.ts`
**Estimated Time**: 2 hours
**Status**: Not Started
**Tags**: `code-review`, `performance`, `architecture`

## Problem Statement

The frontend creates **two separate WebSocket connections** per authenticated user:
1. `websocketClient` singleton (used by `use-websocket.ts`, `use-watchlist-updates.ts`, `use-notification-updates.ts`)
2. A completely independent Socket.io connection created in `useSmartNotifications.ts:151-159`

This doubles server WebSocket resource usage and creates potential event duplication.

## Root Cause

`useSmartNotifications.ts` was implemented without awareness of the existing `websocketClient` singleton pattern. It creates its own Socket.io connection with different configuration.

## Evidence

**File**: `client/src/hooks/useSmartNotifications.ts:151-159`
```typescript
useEffect(() => {
  // Initialize Socket.IO connection - CREATES NEW CONNECTION
  const socketInstance = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    // ...
  });
```

**File**: `client/src/lib/websocket-client.ts`
- Already provides singleton connection at `/ws` path
- Has reconnection, event handling, cleanup

## Solution Approach

Refactor `useSmartNotifications` to use the shared `websocketClient` singleton instead of creating its own connection.

## Implementation Steps

### Step 1: Update useSmartNotifications.ts

- [ ] Import `websocketClient` singleton from `@/lib/websocket-client`
- [ ] Replace the `io()` connection creation with `websocketClient` subscription
- [ ] Remove redundant connection configuration
- [ ] Update event listeners to use singleton's event system

### Step 2: Verify Event Compatibility

- [ ] Ensure smart notification events are handled by singleton
- [ ] Verify no duplicate event emissions
- [ ] Test notification delivery in both patterns

## Technical Details

```typescript
// BEFORE (useSmartNotifications.ts:151-159)
const socketInstance = io({
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

// AFTER
import { websocketClient } from '@/lib/websocket-client';

useEffect(() => {
  const socket = websocketClient.getSocket();
  if (!socket) return;

  socket.on('smart-notification', handleNotification);
  return () => {
    socket.off('smart-notification', handleNotification);
  };
}, []);
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
- [ ] Only ONE WebSocket connection exists per user
- [ ] All notification types still work

## Success Criteria

- [ ] Single WebSocket connection per authenticated user
- [ ] 50% reduction in WebSocket server connections
- [ ] All smart notifications delivered correctly
- [ ] No event duplication

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: architecture-strategist, performance-oracle
