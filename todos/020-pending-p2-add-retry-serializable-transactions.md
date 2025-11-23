---
status: pending
priority: p2
issue_id: "020"
tags: [code-review, performance, database, transactions]
dependencies: []
---

# Add Retry Logic Around SERIALIZABLE Transactions

## Problem Statement

SERIALIZABLE transactions can fail with serialization errors under concurrent load, but retry logic is not consistently applied.

## Findings

- Discovered by Performance Oracle agent
- Locations using SERIALIZABLE without retry:
  - `server/storage.ts:1429-1431`
  - `server/services/notification-service.ts:226-228, 372-374`
- `price-aggregation-service.ts` has good retry pattern to follow

## Recommended Action

Wrap SERIALIZABLE transactions with retry:
```typescript
import { retryWithBackoff } from '../utils/retry-with-backoff';

await retryWithBackoff(async () => db.transaction(async (tx) => {
  // transaction logic
}), { maxRetries: 3, initialDelay: 100 });
```

## Acceptance Criteria

- [ ] All SERIALIZABLE transactions have retry wrapper
- [ ] Retry with exponential backoff on serialization failures
- [ ] Logging for retry attempts
