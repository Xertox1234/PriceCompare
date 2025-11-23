---
status: pending
priority: p3
issue_id: "036"
tags: [code-review, architecture, typescript]
dependencies: []
---

# Consider Shared Types Package for Client-Server

## Problem Statement

WebSocket client imports server types directly, creating tight coupling:
```typescript
import type { ServerToClientEvents } from '../../../server/websocket/types';
```

## Findings

- Discovered by Architecture Strategist agent
- Location: `client/src/lib/websocket-client.ts:17`

## Recommended Action

Consider shared types package or move to `shared/` directory following existing `@shared/*` pattern.

## Acceptance Criteria

- [ ] WebSocket types moved to shared location
- [ ] Client uses `@shared/*` import
- [ ] Type safety maintained
