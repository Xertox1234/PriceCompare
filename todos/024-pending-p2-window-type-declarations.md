---
status: pending
priority: p2
issue_id: "024"
tags: [code-review, typescript, types]
dependencies: []
---

# Create Proper Window Type Declarations

## Problem Statement

Window object extensions use `as any` instead of proper type declarations.

## Findings

- Discovered by TypeScript Reviewer agent
- Locations:
  - `client/src/lib/websocket-client.ts:311` - `(window as any).websocketClient`
  - `client/src/utils/sanitize.ts:47,124,129` - `(window as any).DOMPurify`
  - `client/src/hooks/use-notification-updates.ts:31` - `webkitAudioContext`

## Recommended Action

Create `client/src/types/global.d.ts`:
```typescript
declare global {
  interface Window {
    websocketClient?: WebSocketClient;
    DOMPurify?: typeof import('dompurify');
    webkitAudioContext?: typeof AudioContext;
  }
}
```

## Acceptance Criteria

- [ ] Global type declarations file created
- [ ] No `window as any` in production code
- [ ] TypeScript recognizes window extensions
