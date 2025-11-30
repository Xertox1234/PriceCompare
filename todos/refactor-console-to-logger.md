# TODO: Refactor console.log to Logger Utility

## Priority: Low
## Status: Pending
## Created: 2025-11-30

## Description

There are 33 remaining ESLint `no-console` errors that should be refactored to use the project's `createLogger()` utility for consistent logging.

## Files to Update

### Client-side (use `@/utils/logger`)

1. **`client/src/lib/websocket-client.ts`** (16 instances)
   - WebSocket connection/disconnection logging
   - Event handler debug logging

2. **`client/src/hooks/useSmartNotifications.ts`** (3 instances)
   - Notification debugging

3. **`client/src/hooks/use-notification-updates.ts`** (1 instance)
   - Update logging

4. **`client/src/hooks/use-auth.ts`** (3 instances)
   - Authentication state logging

5. **`client/src/context/shop-context.tsx`** (2 instances)
   - Shop context state logging

6. **`client/src/main.tsx`** (5 instances)
   - App initialization and error boundary logging

7. **`client/src/pages/home.tsx`** (1 instance)
   - Page-level logging

8. **`client/src/components/flash-deals-section.tsx`** (1 instance)
   - Component debug logging

9. **`client/src/components/retailer-spotlight.tsx`** (1 instance)
   - Component debug logging

### Server-side (already fixed)

Server-side console.log statements have already been addressed with eslint-disable comments where appropriate (e.g., build scripts in `openapi-generator.ts`).

## Implementation Pattern

```typescript
// Before
console.log('Connected to WebSocket');
console.error('WebSocket error:', error);

// After
import { createLogger } from '@/utils/logger';
const log = createLogger('WebSocketClient');

log.info('Connected to WebSocket');
log.error('WebSocket error:', error);
```

## Logger Utility Location

- Client: `client/src/utils/logger.ts`
- Server: `server/utils/logger.ts`

## Acceptance Criteria

- [ ] All 33 `no-console` ESLint errors resolved
- [ ] TypeScript compilation passes
- [ ] Logging behavior preserved (same information logged)
- [ ] Production builds don't include debug logs (handled by logger utility)

## Notes

- The `createLogger()` utility provides namespaced logging with log levels
- In production, debug logs are suppressed automatically
- Error logs should always be preserved for monitoring
