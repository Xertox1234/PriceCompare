---
status: pending
priority: p3
issue_id: "031"
tags: [code-review, performance, database]
dependencies: []
---

# Optimize Price History Query with Column Selection

## Problem Statement

Price history query selects all columns but only uses `price` for calculations.

## Findings

- Discovered by Performance Oracle agent
- Location: `server/storage.ts:919-926`

## Recommended Action

Select only needed columns:
```typescript
const history = await db
  .select({
    price: priceHistory.price,
    recordedAt: priceHistory.recordedAt,
  })
  .from(priceHistory)
  .where(...)
```

## Acceptance Criteria

- [ ] Query selects only required columns
- [ ] Index-only scans possible
- [ ] Query performance improved
