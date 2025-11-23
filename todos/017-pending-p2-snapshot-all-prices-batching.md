---
status: pending
priority: p2
issue_id: "017"
tags: [code-review, performance, memory, batching]
dependencies: []
---

# Add Batch Processing to snapshotAllPrices

## Problem Statement

`snapshotAllPrices` loads all product offers into memory at once, causing memory spikes at scale.

## Findings

- Discovered by Performance Oracle agent
- Location: `server/services/price-snapshot-service.ts:14-50`
- At 10,000+ offers: ~50MB+ memory spike, potential OOM on constrained servers

## Recommended Action

Implement batch processing:
```typescript
async snapshotAllPrices(): Promise<number> {
  const BATCH_SIZE = 500;
  let offset = 0;
  let totalCount = 0;

  while (true) {
    const batch = await db.select().from(productOffers)
      .limit(BATCH_SIZE).offset(offset);
    if (batch.length === 0) break;

    const snapshots = batch.map(offer => ({ ... }));
    await db.insert(priceHistory).values(snapshots);

    totalCount += batch.length;
    offset += BATCH_SIZE;
  }
  return totalCount;
}
```

## Acceptance Criteria

- [ ] Batch processing implemented with configurable batch size
- [ ] Memory usage stable regardless of offer count
- [ ] Snapshot functionality unchanged
