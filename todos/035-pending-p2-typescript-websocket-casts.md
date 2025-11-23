---
status: pending
priority: p2
issue_id: "035"
tags: [typescript, type-safety, websocket, code-review]
dependencies: []
---

# Fix TypeScript `as any` Casts in WebSocket Client

## Problem Statement

WebSocket client uses `as any` casts to bypass TypeScript type checking for Socket.io event handlers.

**Impact:** Type errors slip through at compile time, potential runtime bugs.

## Findings

Discovered during TypeScript audit on 2025-11-23.

**Location:** `client/src/lib/websocket-client.ts` lines 149, 165, 184

**Evidence:**
```typescript
socket.on('price_alert', (data: any) => {
  // Handler bypasses type checking
});

socket.on('notification', (data: any) => {
  // Handler bypasses type checking
});
```

## Proposed Solutions

### Option 1: Define Proper Event Types (Recommended)

**Effort:** Small (1 hour)

**Implementation:**
```typescript
// Define event payload types
interface PriceAlertEvent {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
}

interface NotificationEvent {
  id: number;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

// Type-safe event map
interface ServerToClientEvents {
  price_alert: (data: PriceAlertEvent) => void;
  notification: (data: NotificationEvent) => void;
  connection_error: (error: { message: string }) => void;
}

// Use typed socket
const socket: Socket<ServerToClientEvents> = io(url);

socket.on('price_alert', (data) => {
  // data is now typed as PriceAlertEvent
  console.log(data.productName); // TypeScript knows this exists
});
```

## Acceptance Criteria

- [ ] All socket events have proper type definitions
- [ ] No `as any` casts in websocket-client.ts
- [ ] TypeScript compilation passes without errors
- [ ] Event handlers have proper parameter types

## Work Log

### 2025-11-23 - TypeScript Audit Discovery
**By:** Claude Code Review System (kieran-typescript-reviewer agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
