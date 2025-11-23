---
status: pending
priority: p3
issue_id: "033"
tags: [code-review, performance, jobs, bull]
dependencies: []
---

# Set Explicit Bull Queue Concurrency

## Problem Statement

Bull queue processor doesn't specify concurrency limit, using default.

## Findings

- Discovered by Performance Oracle agent
- Location: `server/jobs/price-snapshot-queue.ts:21`

## Recommended Action

Set explicit concurrency:
```typescript
priceSnapshotQueue.process(5, async (job) => {
  // Process up to 5 jobs concurrently
});
```

## Acceptance Criteria

- [ ] Explicit concurrency limit set
- [ ] Job processing appropriately parallelized
- [ ] Resource usage controlled
