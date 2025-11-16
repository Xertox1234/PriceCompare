# Code Patterns & Best Practices

This document codifies proven patterns used in the PriceCompare application.

---

## Database Query Patterns

### 1. Counting Records

#### ✅ DO: Use SQL COUNT(*)
```typescript
// Efficient: Database counts, returns single integer
const result = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(myTable);

const count = result[0]?.count || 0;
```

**Benefits**:
- Database-level counting (extremely fast)
- Minimal data transfer (single integer)
- Constant memory usage O(1)

#### ❌ DON'T: Fetch IDs and count in memory
```typescript
// Inefficient: Fetches all IDs, transfers to app, counts in memory
const records = await db
  .select({ id: myTable.id })
  .from(myTable);

const count = records.length; // BAD!
```

**Problems**:
- Transfers all IDs over network (slow)
- Linear memory usage O(n)
- Slow for large tables

**When to use COUNT(*)**:
- ✅ Pagination totals
- ✅ Analytics dashboards
- ✅ Any time you only need the count, not the data

---

### 2. Aggregation Queries

#### ✅ DO: Use SQL GROUP BY
```typescript
// Efficient: Database groups and counts in single query
const stats = await db
  .select({
    category: myTable.category,
    count: sql<number>`count(*)::int`,
    avgValue: sql<number>`avg(${myTable.value})::numeric`,
    maxValue: sql<number>`max(${myTable.value})::numeric`
  })
  .from(myTable)
  .groupBy(myTable.category);

// Result: [
//   { category: 'A', count: 100, avgValue: 45.5, maxValue: 99 },
//   { category: 'B', count: 200, avgValue: 52.3, maxValue: 95 }
// ]
```

**Benefits**:
- Single query returns aggregated results
- Database engine optimized for aggregation
- Minimal data transfer

#### ❌ DON'T: Fetch all records and aggregate in memory
```typescript
// Inefficient: Fetches everything, groups in memory
const records = await db.select().from(myTable);

const stats = records.reduce((acc, record) => {
  if (!acc[record.category]) {
    acc[record.category] = { count: 0, sum: 0, max: 0 };
  }
  acc[record.category].count++;
  acc[record.category].sum += record.value;
  acc[record.category].max = Math.max(acc[record.category].max, record.value);
  return acc;
}, {});
```

**Problems**:
- Transfers entire table over network
- O(n) memory usage
- Slower than database aggregation

---

### 3. Batch Data Fetching

#### ✅ DO: Use array_agg() or json_agg()
```typescript
// Efficient: Fetch grouped data in single query
const priceData = await db
  .select({
    productId: priceHistory.productId,
    retailerId: priceHistory.retailerId,
    prices: sql<Array<{price: number, date: string}>>`
      json_agg(
        json_build_object(
          'price', ${priceHistory.price}::numeric,
          'date', ${priceHistory.recordedAt}
        ) ORDER BY ${priceHistory.recordedAt}
      )`
  })
  .from(priceHistory)
  .groupBy(priceHistory.productId, priceHistory.retailerId);
```

**Benefits**:
- Reduces N+1 query problems to 1 query
- Preserves data relationships
- Efficient JSON parsing

#### ❌ DON'T: Loop with individual queries
```typescript
// Inefficient: N+1 query problem
const products = await db.select().from(products);

for (const product of products) {
  const prices = await db
    .select()
    .from(priceHistory)
    .where(eq(priceHistory.productId, product.id)); // N queries!
}
```

**Problems**:
- Makes N+1 database queries
- Slow for large datasets
- Network latency multiplied by N

---

## Distributed Systems Patterns

### 4. Distributed Job Locking

#### ✅ DO: Use database-level locks for scheduled jobs
```typescript
import { jobLockService } from '../services/job-lock-service';

export function startMyScheduledJobs(): void {
  cron.schedule('0 2 * * *', async () => {
    const result = await jobLockService.withLock(
      'my-service:daily-job',
      async () => {
        // Job implementation
        const count = await performDailyTask();
        return count;
      },
      3600 // TTL: 1 hour
    );

    if (result === null) {
      logger.info('Job skipped - already running on another server');
    }
  });
}
```

**Benefits**:
- Prevents duplicate execution across servers
- Automatic lock expiration (handles crashes)
- Database-level atomicity (no race conditions)

**Configuration**:
- TTL: Should be longer than max expected job duration
- Job name: Use format `service:job-type` for clarity
- Weekly/monthly jobs: 3600s (1 hour)
- Long-running jobs: 7200s+ (2 hours)

#### ❌ DON'T: Run jobs without locks in multi-server setups
```typescript
// Dangerous: Will run on ALL servers simultaneously!
cron.schedule('0 2 * * *', async () => {
  await performDailyTask(); // Duplicate execution!
});
```

**Problems**:
- Duplicate data processing
- Wasted resources
- Potential data corruption
- Race conditions

**When to use job locking**:
- ✅ Jobs that modify data (INSERT, UPDATE, DELETE)
- ✅ Expensive jobs (aggregations, analysis)
- ✅ Multi-server deployments
- ❌ Read-only jobs
- ❌ Per-server jobs (e.g., local cache warming)

---

### 5. Manual vs Automatic Lock Management

#### Option 1: Automatic (Recommended)
```typescript
// withLock() handles acquire, execute, release automatically
const result = await jobLockService.withLock(
  'job-name',
  async () => {
    // Job code here
    return jobResult;
  },
  ttlSeconds
);
```

**Use when**: Standard job execution

#### Option 2: Manual (Advanced)
```typescript
// Manual lock management for complex scenarios
const acquired = await jobLockService.acquireLock('job-name', ttlSeconds);

if (!acquired) {
  logger.info('Could not acquire lock');
  return;
}

try {
  // Job code here

  // Extend lock if job is taking longer
  if (needMoreTime) {
    await jobLockService.extendLock('job-name', 3600);
  }

} finally {
  await jobLockService.releaseLock('job-name');
}
```

**Use when**:
- Need to extend lock for long-running jobs
- Complex conditional logic
- Want explicit control over lock lifecycle

---

## Error Handling Patterns

### 6. Database Transaction Patterns

#### ✅ DO: Use transactions for multi-step operations
```typescript
async function performMultiStepOperation() {
  return await db.transaction(async (tx) => {
    // Step 1: Insert data
    const newRecords = await tx
      .insert(table1)
      .values(data)
      .returning();

    // Step 2: Update related records
    await tx
      .update(table2)
      .set({ relatedId: newRecords[0].id })
      .where(eq(table2.id, someId));

    // Step 3: Cleanup
    await tx
      .delete(table3)
      .where(eq(table3.status, 'temp'));

    // All succeed or all roll back
    return newRecords;
  });
}
```

**Benefits**:
- ACID guarantees (all-or-nothing)
- Automatic rollback on error
- Data consistency

#### ❌ DON'T: Run multi-step operations without transactions
```typescript
// Dangerous: Partial completion if any step fails
async function performMultiStepOperation() {
  const newRecords = await db.insert(table1).values(data).returning();
  // If this fails, table1 insert is NOT rolled back!
  await db.update(table2).set({ relatedId: newRecords[0].id });
  // If this fails, previous operations are NOT rolled back!
  await db.delete(table3).where(eq(table3.status, 'temp'));
}
```

---

## Performance Patterns

### 7. Parallel Query Execution

#### ✅ DO: Use Promise.all() for independent queries
```typescript
// Efficient: Queries run in parallel
const [users, products, orders] = await Promise.all([
  db.select().from(users).where(eq(users.id, userId)),
  db.select().from(products).where(eq(products.sellerId, sellerId)),
  db.select().from(orders).where(eq(orders.status, 'pending'))
]);
```

**Benefits**:
- Reduced total time (parallelization)
- Better resource utilization

#### ❌ DON'T: Run independent queries sequentially
```typescript
// Inefficient: Queries run one after another
const users = await db.select().from(users);     // Wait...
const products = await db.select().from(products); // Wait...
const orders = await db.select().from(orders);    // Wait...
```

**Important**: Only parallelize independent queries. If query B depends on query A's results, run them sequentially.

---

### 8. Batch Processing

#### ✅ DO: Process large datasets in chunks
```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);

  await db
    .insert(myTable)
    .values(batch)
    .onConflictDoUpdate({
      target: myTable.id,
      set: { updated: sql`CURRENT_TIMESTAMP` }
    });
}
```

**Benefits**:
- Respects PostgreSQL parameter limits (~65,535)
- Better memory management
- Progress visibility

#### ❌ DON'T: Insert all records at once
```typescript
// Dangerous: May exceed parameter limits or cause OOM
await db.insert(myTable).values(allItems); // Could be 10,000+ items!
```

**Recommended Batch Sizes**:
- Simple inserts: 500-1000 records
- Complex data: 100-200 records
- Bulk updates: 50-100 records

---

## Naming Conventions

### 9. Job Lock Names
```
Format: service:operation-type
Examples:
  ✅ price-analytics:weekly-aggregation
  ✅ price-analytics:monthly-aggregation
  ✅ price-analytics:trend-analysis
  ✅ price-history:daily-snapshots
  ✅ price-history:cleanup

  ❌ weeklyAgg
  ❌ analytics_job
  ❌ job1
```

### 10. Cron Schedules
```typescript
// Always include timezone for consistency
cron.schedule('0 2 * * *', handler, {
  timezone: 'America/New_York'
});

// Use comments to explain schedule
// Daily at 2:00 AM EST
cron.schedule('0 2 * * *', handler, { timezone: 'America/New_York' });

// Weekly on Sunday at 11:00 PM EST
cron.schedule('0 23 * * 0', handler, { timezone: 'America/New_York' });

// Last day of month at 11:30 PM EST
cron.schedule('30 23 28-31 * *', handler, { timezone: 'America/New_York' });
```

---

## Logging Patterns

### 11. Job Execution Logging

#### ✅ DO: Log start, completion, and metrics
```typescript
cron.schedule('schedule', async () => {
  const result = await jobLockService.withLock('job-name', async () => {
    logger.info('Starting job...');
    const startTime = Date.now();

    const count = await performJob();

    const duration = Date.now() - startTime;
    logger.info(`Job completed: ${count} items processed in ${duration}ms`);

    return count;
  });

  if (result === null) {
    logger.info('Job skipped - already running elsewhere');
  }
});
```

**Log levels**:
- `info`: Job start, completion, skip due to lock
- `warn`: Job took longer than expected, partial failures
- `error`: Job failed, database errors

---

## Summary

**Core Principles**:
1. **Push work to the database** (COUNT, GROUP BY, array_agg)
2. **Use distributed locks** for scheduled jobs in multi-server setups
3. **Use transactions** for multi-step operations
4. **Process in batches** for large datasets
5. **Parallelize independent operations** with Promise.all()
6. **Log comprehensively** for debugging and monitoring

**References**:
- Audit Report: `docs/AUDIT_2025-11-16.md`
- Job Lock Service: `server/services/job-lock-service.ts`
- Migration: `migrations/0010_add_job_locks.sql`
