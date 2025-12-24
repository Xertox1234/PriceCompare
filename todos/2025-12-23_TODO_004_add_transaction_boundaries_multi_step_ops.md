# TODO 004: Add Transaction Boundaries to Multi-Step Database Operations

**Priority**: P1 (DATA INTEGRITY - HIGH)
**File(s)**:
- `server/agents/coordinator-agent.ts` (Lines 196-249)
- `server/agents/extraction-agent.ts` (Lines 309-381)
- `server/agents/monitoring-agent.ts` (Lines 266-272)
- `server/storage/domains/agent-storage.ts` (NEW methods needed)

**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

Multiple database operations that should be atomic are **NOT wrapped in transactions**, creating data consistency risks:

**Example 1**: Product Creation from Trending Product
```typescript
// coordinator-agent.ts:229-249
// ❌ NOT ATOMIC - If step 2 fails, step 1 already committed
const [createdProduct] = await db.insert(products).values(productData).returning();

// Separately (elsewhere in code):
await db.update(trendingProducts).set({
  productId: createdProduct.id,
  status: 'scraped'
});
```

**Risks**:
- **Orphaned products**: Product created but never linked to trending_product
- **Inconsistent state**: trending_products.status = 'discovered' but product exists
- **Race conditions**: Multiple agents could create duplicate products
- **Partial failures**: No rollback if second operation fails

**Review Finding Reference**: Architecture Strategist - Critical Issue #2

## Root Cause

The codebase follows the transaction pattern in **some** places (price aggregation service) but not consistently in agent operations. The multi-step workflows were built incrementally without transaction wrappers.

Per CLAUDE.md:
> "ALL multi-step operations MUST use transactions"

## Solution Approach

1. Identify all multi-step database operations in agents
2. Wrap each in `db.transaction()` or create storage methods with transactions
3. Use `SERIALIZABLE` isolation level for race condition scenarios
4. Add proper error handling and rollback

**Strategy**: Create transaction-wrapped storage methods to maintain storage layer pattern.

## Implementation Steps

### Step 1: Identify Multi-Step Operations

**Coordinator Agent**:
- [ ] Product creation + trending product link (lines 196-249)
- [ ] Job creation + status update (lines 434-498)

**Extraction Agent**:
- [ ] Product offer creation + product link (lines 309-381)

**Monitoring Agent**:
- [ ] Alert creation + offer deactivation (lines 266-272)

### Step 2: Create Transaction-Wrapped Storage Methods

Add to `server/storage/domains/agent-storage.ts`:

- [ ] `createProductFromTrendingProduct(trendingProduct, productData)` - Atomic product creation
- [ ] `claimScrapingJob(jobId, workerId)` - Atomic job claiming (prevents race conditions)
- [ ] `createProductOfferLinked(offerData, productId)` - Atomic offer creation
- [ ] `triggerPriceAlert(alertData, offerId)` - Atomic alert + deactivation

### Step 3: Migrate Coordinator Agent Operations

**Operation**: Product Creation from Trending Product

- [ ] Create storage method with transaction:
  ```typescript
  async createProductFromTrendingProduct(
    trendingProduct: TrendingProduct,
    productData: InsertProduct
  ): Promise<Product> {
    return await db.transaction(async (tx) => {
      // Step 1: Create product
      const [product] = await tx
        .insert(products)
        .values(productData)
        .returning();

      // Step 2: Link to trending product
      await tx
        .update(trendingProducts)
        .set({ productId: product.id, status: 'scraped' })
        .where(eq(trendingProducts.id, trendingProduct.id));

      return product;
    });
  }
  ```

- [ ] Replace coordinator-agent.ts lines 229-249 with storage call
- [ ] Test atomic behavior (rollback on failure)

**Operation**: Atomic Job Claiming (with optimistic locking)

- [ ] Create storage method:
  ```typescript
  async claimScrapingJob(jobId: number, workerId: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const result = await tx
        .update(scrapingJobs)
        .set({
          status: 'running',
          startedAt: new Date(),
          workerId,
        })
        .where(
          and(
            eq(scrapingJobs.id, jobId),
            eq(scrapingJobs.status, 'pending'), // ✅ Only claim if still pending
            lte(scrapingJobs.scheduledAt, new Date())
          )
        )
        .returning({ id: scrapingJobs.id });

      return result.length > 0; // true = claimed, false = another worker claimed it
    }, { isolationLevel: 'serializable' }); // Prevent race conditions
  }
  ```

- [ ] Replace coordinator job claiming logic
- [ ] Add retry logic if claim fails (another worker claimed it)

### Step 4: Migrate Extraction Agent Operations

**Operation**: Product Offer Creation + Link

- [ ] Create storage method with transaction
- [ ] Handle foreign key constraints
- [ ] Replace extraction-agent.ts lines 309-381

### Step 5: Migrate Monitoring Agent Operations

**Operation**: Alert Triggering + Offer Deactivation

- [ ] Create storage method with transaction
- [ ] Ensure alert created even if deactivation fails (decide on strategy)
- [ ] Replace monitoring-agent.ts lines 266-272

### Step 6: Add Error Handling

- [ ] Catch transaction errors and log appropriately
- [ ] Retry on deadlock/serialization errors (PostgreSQL specific)
- [ ] Add metrics for transaction failures

### Step 7: Testing

- [ ] Unit tests for each transaction method
- [ ] Integration tests with actual database
- [ ] Test rollback behavior (force errors mid-transaction)
- [ ] Test race condition prevention (concurrent job claiming)

## Technical Details

**Transaction Pattern** (from CLAUDE.md):
```typescript
// ✅ CORRECT - Atomic multi-step operation
await db.transaction(async (tx) => {
  const [product] = await tx.insert(products).values(data).returning();
  await tx.insert(productOffers).values({ productId: product.id, ...offer });
  await tx.update(retailers)
    .set({ productCount: sql`${retailers.productCount} + 1` })
    .where(eq(retailers.id, offer.retailerId));
});
```

**Serializable Isolation for Race Conditions**:
```typescript
await db.transaction(async (tx) => {
  // Verify job still pending
  const job = await tx.select().from(scrapingJobs).where(eq(scrapingJobs.id, jobId));

  if (job[0].status !== 'pending') {
    throw new Error('Job already claimed');
  }

  // Claim it
  await tx.update(scrapingJobs).set({ status: 'running', workerId }).where(eq(scrapingJobs.id, jobId));
}, { isolationLevel: 'serializable' });
```

**Error Handling**:
```typescript
try {
  await storage.createProductFromTrendingProduct(trendProduct, productData);
} catch (error) {
  if (error.code === '40001') {
    // Serialization failure - retry
    logger.warn('Transaction conflict, retrying...', { error });
    await retry(() => storage.createProductFromTrendingProduct(...));
  } else {
    throw error;
  }
}
```

## Checklist

- [ ] All multi-step operations identified
- [ ] Storage methods created with transactions
- [ ] Coordinator agent migrated
- [ ] Extraction agent migrated
- [ ] Monitoring agent migrated
- [ ] Error handling added
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Rollback behavior tested
- [ ] Race condition tests written
- [ ] Documentation updated

## Success Criteria

- [ ] **No multi-step operations without transactions**:
  ```bash
  # Check for pattern: multiple awaits in sequence without transaction
  grep -A 10 "await.*insert.*returning" server/agents/*.ts | grep -A 5 "await.*update"
  # Should find: 0 instances (all wrapped in transactions)
  ```

- [ ] **Transaction tests pass**:
  ```bash
  npm test server/__tests__/storage/agent-storage.test.ts
  # Expected: All transaction tests ✅
  ```

- [ ] **Rollback behavior verified**:
  ```typescript
  test('rolls back on failure', async () => {
    // Force error in step 2
    await expect(
      storage.createProductFromTrendingProduct(trendProduct, invalidData)
    ).rejects.toThrow();

    // Verify nothing was committed
    const products = await db.select().from(products).where(...);
    expect(products).toHaveLength(0);
  });
  ```

- [ ] **Race condition prevented**:
  ```typescript
  test('prevents duplicate job claims', async () => {
    const jobId = 123;

    // Two workers try to claim simultaneously
    const [claim1, claim2] = await Promise.allSettled([
      storage.claimScrapingJob(jobId, 'worker-1'),
      storage.claimScrapingJob(jobId, 'worker-2'),
    ]);

    // Only one should succeed
    const successful = [claim1, claim2].filter(r => r.status === 'fulfilled' && r.value === true);
    expect(successful).toHaveLength(1);
  });
  ```

## What NOT to Include in Transactions

Per CLAUDE.md, transactions should **NOT** include:
- ❌ External API calls (HTTP, email)
- ❌ Long-running operations (scraping, file I/O)
- ❌ Read-only operations (SELECT queries)
- ❌ Independent operations (can succeed/fail independently)

**Example**:
```typescript
// ❌ WRONG - External API in transaction
await db.transaction(async (tx) => {
  await tx.insert(products).values(data);
  await openai.chat.completions.create(...); // EXTERNAL API - NO!
});

// ✅ CORRECT - External API outside transaction
const aiResult = await openai.chat.completions.create(...);
await db.transaction(async (tx) => {
  await tx.insert(products).values({ ...data, aiAnalysis: aiResult });
});
```

## Testing Strategy

**Unit Tests**:
```typescript
describe('Agent Storage - Transactions', () => {
  test('createProductFromTrendingProduct is atomic', async () => {
    const trendProduct = await createTestTrendingProduct();
    const productData = { name: 'Test', category: 'Electronics' };

    const product = await storage.createProductFromTrendingProduct(trendProduct, productData);

    // Verify both operations succeeded
    expect(product.id).toBeDefined();

    const linkedTrend = await storage.getTrendingProductById(trendProduct.id);
    expect(linkedTrend.productId).toBe(product.id);
    expect(linkedTrend.status).toBe('scraped');
  });

  test('rolls back if trending product update fails', async () => {
    const trendProduct = { id: 999999 }; // Non-existent ID

    await expect(
      storage.createProductFromTrendingProduct(trendProduct, productData)
    ).rejects.toThrow();

    // Verify product was NOT created
    const products = await db.select().from(products).where(eq(products.name, 'Test'));
    expect(products).toHaveLength(0);
  });
});
```

**Integration Tests**:
```typescript
describe('Concurrent Job Claiming', () => {
  test('only one worker claims each job', async () => {
    // Create 10 pending jobs
    const jobIds = await Promise.all(
      Array.from({ length: 10 }, () => storage.createScrapingJob({ ... }))
    );

    // 5 workers try to claim jobs concurrently
    const workers = ['w1', 'w2', 'w3', 'w4', 'w5'];
    const claims = await Promise.allSettled(
      jobIds.flatMap(jobId =>
        workers.map(workerId => storage.claimScrapingJob(jobId, workerId))
      )
    );

    // Each job claimed by exactly one worker
    const successful = claims.filter(r => r.status === 'fulfilled' && r.value === true);
    expect(successful).toHaveLength(10); // 10 jobs, 10 successful claims
  });
});
```

---

**Related Documentation**:
- `docs/02_DATABASE_PATTERNS.md` - Transaction patterns
- CLAUDE.md - Transaction boundaries section

**Review Reference**: Comprehensive Code Review - Critical Blocker #4
**Data Integrity Impact**: Prevents orphaned records, race conditions, partial state
