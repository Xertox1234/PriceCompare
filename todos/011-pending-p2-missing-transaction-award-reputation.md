---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, data-integrity, transactions, race-condition]
dependencies: []
---

# Add Transaction to awardReputation Function

## Problem Statement

The `awardReputation` function in `community-service.ts:206-235` reads current reputation, calculates new value, then writes - without a transaction. Concurrent awards could cause lost updates.

## Findings

- Discovered by Data Integrity Guardian agent
- Location: `server/services/community-service.ts:206-235`
- Race condition: Two concurrent +10 awards on 100 points could both write 110 instead of 120

## Recommended Action

Use atomic SQL operation:
```typescript
await db.transaction(async (tx) => {
  const result = await tx.update(userReputation)
    .set({
      reputationPoints: sql`${userReputation.reputationPoints} + ${points}`,
    })
    .where(eq(userReputation.userId, userId))
    .returning();
  return result[0];
}, { isolationLevel: 'serializable' });
```

## Acceptance Criteria

- [ ] Reputation updates are atomic
- [ ] Concurrent updates don't lose data
- [ ] Tests verify race condition handling
