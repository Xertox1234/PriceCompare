# Price Aggregation System - Improvement Work Plan

**Created:** 2025-11-20
**Status:** Ready for Implementation
**Total Improvements:** 22
**Total Estimated Effort:** 122+ hours

## Executive Summary

This document outlines 22 improvements to the price aggregation system, organized into 4 phases. The current implementation is **production-ready** but these improvements will enhance performance, observability, and operational excellence.

---

## Implementation Phases

### Phase 1: Critical Foundation (Week 1-2) - 28 hours
**Goal:** Production readiness and stability

### Phase 2: Operational Excellence (Week 3-4) - 24 hours
**Goal:** Smooth operations and monitoring

### Phase 3: Enhancement (Week 5-6) - 22 hours
**Goal:** Advanced features and analytics

### Phase 4: Advanced Features (Future) - 48+ hours
**Goal:** Competitive advantage

---

## Phase 1: Critical Foundation (28 hours)

### 1.1 Missing Aggregation Table Indexes
**Priority:** HIGH | **Effort:** 2 hours | **Category:** Performance

**Problem:** Aggregation tables lack critical indexes for common query patterns, causing slow queries for product-retailer-specific data.

**Files to Modify:**
- `shared/schema.ts` (lines 880-904, priceAggregatesDaily definition)
- Create migration: `migrations/0014_add_aggregation_indexes.sql`

**Implementation:**
```typescript
// In shared/schema.ts - priceAggregatesDaily
export const priceAggregatesDaily = pgTable("price_aggregates_daily", {
  // ... existing fields
}, (table) => ({
  // ADD THESE INDEXES:
  productRetailerDateIdx: index("idx_daily_product_retailer_date")
    .on(table.productId, table.retailerId, table.date),
  dateIdx: index("idx_daily_date").on(table.date),
  retailerDateIdx: index("idx_daily_retailer_date")
    .on(table.retailerId, table.date),
}));

// Similarly update priceAggregatesWeekly and priceAggregatesMonthly
```

**Migration SQL:**
```sql
-- 0014_add_aggregation_indexes.sql
CREATE INDEX CONCURRENTLY idx_daily_product_retailer_date
  ON price_aggregates_daily(product_id, retailer_id, date);

CREATE INDEX CONCURRENTLY idx_daily_date
  ON price_aggregates_daily(date);

CREATE INDEX CONCURRENTLY idx_daily_retailer_date
  ON price_aggregates_daily(retailer_id, date);

-- Repeat for weekly and monthly tables
```

**Success Criteria:**
- Query plans show index usage
- Product-retailer queries 50-80% faster
- No full table scans on aggregation tables

**Expected Impact:** 50-80% faster queries for product-retailer-specific aggregates

---

### 1.2 Data Validation in Aggregation Pipeline
**Priority:** HIGH | **Effort:** 4 hours | **Category:** Data Quality

**Problem:** No validation that aggregated statistics are reasonable (e.g., negative prices, invalid ranges).

**Files to Modify:**
- `server/services/price-aggregation-service.ts` (add validation method)

**Implementation:**
```typescript
// Add after line 625 in price-aggregation-service.ts
private validateAggregateStats(
  stats: PriceStatistics,
  productId: number,
  retailerId: number
): void {
  // Price range validation
  if (stats.minPrice <= 0) {
    throw new Error(
      `Invalid minPrice ${stats.minPrice} for product ${productId}, retailer ${retailerId}`
    );
  }

  if (stats.maxPrice < stats.minPrice) {
    throw new Error(
      `maxPrice ${stats.maxPrice} < minPrice ${stats.minPrice} for product ${productId}`
    );
  }

  // Average must be within min-max range
  if (stats.avgPrice < stats.minPrice || stats.avgPrice > stats.maxPrice) {
    throw new Error(
      `avgPrice ${stats.avgPrice} outside range [${stats.minPrice}, ${stats.maxPrice}]`
    );
  }

  // Median must be within min-max range
  if (stats.medianPrice < stats.minPrice || stats.medianPrice > stats.maxPrice) {
    throw new Error(
      `medianPrice ${stats.medianPrice} outside range for product ${productId}`
    );
  }

  // Extreme volatility detection (alert, don't fail)
  if (stats.volatilityScore > 100) {
    logger.warn(`[PriceAggregation] Extreme volatility detected`, {
      productId,
      retailerId,
      volatility: stats.volatilityScore,
      priceRange: `${stats.minPrice}-${stats.maxPrice}`
    });
  }

  // Count validation
  if (stats.count <= 0) {
    throw new Error(`Invalid count ${stats.count} for product ${productId}`);
  }
}

// Call this validation before inserting aggregates
// In calculateDailyAggregates, calculateWeeklyAggregates, etc:
const stats = this.calculatePriceStatistics(pricesArray);
this.validateAggregateStats(stats, productId, retailerId); // ADD THIS
```

**Success Criteria:**
- Invalid aggregates rejected before database insert
- Extreme volatility logged for investigation
- Tests cover all validation scenarios

**Expected Impact:** Early detection of data corruption, prevents bad aggregates

---

### 1.3 Retry Logic with Exponential Backoff
**Priority:** HIGH | **Effort:** 3 hours | **Category:** Operations

**Problem:** Single transient failure causes entire aggregation to fail.

**Files to Modify:**
- `server/services/price-aggregation-service.ts` (wrap aggregation methods)
- `package.json` (add `p-retry` dependency)

**Implementation:**
```bash
npm install p-retry
```

```typescript
// At top of price-aggregation-service.ts
import pRetry from 'p-retry';

// Wrap each main method
async calculateDailyAggregates(): Promise<number> {
  return await pRetry(
    async () => {
      return await this.performDailyAggregationLogic();
    },
    {
      retries: 3,
      factor: 2, // Exponential backoff
      minTimeout: 1000, // 1 second
      maxTimeout: 10000, // 10 seconds
      onFailedAttempt: (error) => {
        logger.warn(`[PriceAggregation] Daily aggregation retry attempt ${error.attemptNumber}`, {
          retriesLeft: error.retriesLeft,
          error: error.message
        });
      }
    }
  );
}

// Extract core logic to separate method
private async performDailyAggregationLogic(): Promise<number> {
  // Move existing calculateDailyAggregates logic here
}

// Apply same pattern to calculateWeeklyAggregates, calculateMonthlyAggregates
```

**Success Criteria:**
- Transient database errors automatically retried
- Logs show retry attempts
- Tests verify retry behavior

**Expected Impact:** 90% reduction in transient failure alerts

---

### 1.4 Aggregation Metrics Collection
**Priority:** HIGH | **Effort:** 8 hours | **Category:** Observability

**Problem:** No metrics tracking for aggregation performance and health.

**Files to Modify:**
- `server/services/price-aggregation-service.ts`
- `server/utils/metrics.ts` (create new file)
- `server/index.ts` (expose `/metrics` endpoint)
- `package.json` (add `prom-client`)

**Implementation:**
```bash
npm install prom-client
```

```typescript
// server/utils/metrics.ts - CREATE NEW FILE
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

export const aggregationDuration = new Histogram({
  name: 'price_aggregation_duration_seconds',
  help: 'Time taken to complete aggregation',
  labelNames: ['granularity', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry]
});

export const aggregationRecordsProcessed = new Counter({
  name: 'price_aggregation_records_processed_total',
  help: 'Total records aggregated',
  labelNames: ['granularity'],
  registers: [metricsRegistry]
});

export const aggregationErrors = new Counter({
  name: 'price_aggregation_errors_total',
  help: 'Total aggregation errors',
  labelNames: ['granularity', 'error_type'],
  registers: [metricsRegistry]
});

export const aggregationLastRun = new Gauge({
  name: 'price_aggregation_last_run_timestamp',
  help: 'Unix timestamp of last successful aggregation',
  labelNames: ['granularity'],
  registers: [metricsRegistry]
});

// In price-aggregation-service.ts - INSTRUMENT METHODS
async calculateDailyAggregates(): Promise<number> {
  const timer = aggregationDuration.startTimer({ granularity: 'daily' });

  try {
    const count = await this.performAggregation();

    // Record success metrics
    aggregationRecordsProcessed.inc({ granularity: 'daily' }, count);
    aggregationLastRun.set({ granularity: 'daily' }, Date.now() / 1000);
    timer({ status: 'success' });

    return count;
  } catch (error) {
    // Record error metrics
    aggregationErrors.inc({
      granularity: 'daily',
      error_type: error instanceof Error ? error.name : 'unknown'
    });
    timer({ status: 'error' });
    throw error;
  }
}

// In server/index.ts - ADD METRICS ENDPOINT
import { metricsRegistry } from './utils/metrics';

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});
```

**Grafana Dashboard Queries:**
```promql
# Aggregation duration
histogram_quantile(0.95, rate(price_aggregation_duration_seconds_bucket[5m]))

# Aggregation rate
rate(price_aggregation_records_processed_total[5m])

# Error rate
rate(price_aggregation_errors_total[5m])

# Time since last successful run
time() - price_aggregation_last_run_timestamp
```

**Success Criteria:**
- `/metrics` endpoint returns Prometheus format
- All aggregation operations instrumented
- Grafana dashboards showing trends

**Expected Impact:** Real-time performance monitoring, SLA tracking, capacity planning

---

### 1.5 Incremental Aggregation
**Priority:** HIGH | **Effort:** 8 hours | **Category:** Performance

**Problem:** Daily job always processes "yesterday" even if no new data exists.

**Files to Modify:**
- `shared/schema.ts` (add new table)
- `server/services/price-aggregation-service.ts`
- Create migration: `migrations/0015_add_aggregation_state.sql`

**Implementation:**
```typescript
// In shared/schema.ts - ADD NEW TABLE
export const productAggregationState = pgTable("product_aggregation_state", {
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .primaryKey(),
  lastDailyAggregation: timestamp("last_daily_aggregation"),
  lastWeeklyAggregation: timestamp("last_weekly_aggregation"),
  lastMonthlyAggregation: timestamp("last_monthly_aggregation"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// In price-aggregation-service.ts
async calculateDailyAggregates(): Promise<number> {
  // Get products that have new data since last aggregation
  const productsWithNewData = await this.getProductsWithNewData();

  if (productsWithNewData.length === 0) {
    logger.info('[PriceAggregation] No new data to aggregate, skipping');
    return 0;
  }

  logger.info(`[PriceAggregation] Found ${productsWithNewData.length} products with new data`);

  // Process only these products
  // ... existing aggregation logic but filtered by productsWithNewData

  // Update state after successful aggregation
  await this.updateAggregationState(productsWithNewData, 'daily');

  return count;
}

private async getProductsWithNewData(): Promise<number[]> {
  // Find products with price_history records newer than last aggregation
  const result = await db
    .selectDistinct({ productId: priceHistory.productId })
    .from(priceHistory)
    .leftJoin(
      productAggregationState,
      eq(priceHistory.productId, productAggregationState.productId)
    )
    .where(
      or(
        isNull(productAggregationState.lastDailyAggregation),
        gt(priceHistory.recordedAt, productAggregationState.lastDailyAggregation)
      )
    );

  return result.map(r => r.productId);
}

private async updateAggregationState(
  productIds: number[],
  granularity: 'daily' | 'weekly' | 'monthly'
): Promise<void> {
  const now = new Date();

  const fieldMap = {
    daily: 'lastDailyAggregation',
    weekly: 'lastWeeklyAggregation',
    monthly: 'lastMonthlyAggregation'
  };

  const values = productIds.map(productId => ({
    productId,
    [fieldMap[granularity]]: now,
    updatedAt: now
  }));

  await db
    .insert(productAggregationState)
    .values(values)
    .onConflictDoUpdate({
      target: [productAggregationState.productId],
      set: {
        [fieldMap[granularity]]: sql`EXCLUDED.${fieldMap[granularity]}`,
        updatedAt: sql`EXCLUDED.updated_at`
      }
    });
}
```

**Migration SQL:**
```sql
-- 0015_add_aggregation_state.sql
CREATE TABLE product_aggregation_state (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  last_daily_aggregation TIMESTAMP,
  last_weekly_aggregation TIMESTAMP,
  last_monthly_aggregation TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agg_state_daily ON product_aggregation_state(last_daily_aggregation);
CREATE INDEX idx_agg_state_weekly ON product_aggregation_state(last_weekly_aggregation);
CREATE INDEX idx_agg_state_monthly ON product_aggregation_state(last_monthly_aggregation);
```

**Success Criteria:**
- Jobs skip when no new data
- State table updated after each run
- Logs show "no new data" messages

**Expected Impact:** 90% faster daily jobs when no new data (5s vs 30s)

---

### 1.6 Enhanced Logging for Failure Investigation
**Priority:** HIGH | **Effort:** 3 hours | **Category:** Observability

**Problem:** Insufficient context in error logs for debugging production issues.

**Files to Modify:**
- `server/services/price-aggregation-service.ts` (all error handlers)
- `server/services/price-snapshot-service.ts` (cleanup error handler)

**Implementation:**
```typescript
// Update all try-catch blocks in aggregation services
try {
  // ... aggregation logic
} catch (error) {
  // ENHANCED ERROR LOGGING
  logger.error("[PriceAggregation] Transaction failed, rolling back:", {
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : String(error),
    context: {
      granularity: 'daily', // or 'weekly', 'monthly'
      dateRange: { startDate, endDate },
      productsAttempted: priceData.length,
      timestamp: new Date().toISOString(),

      // System state
      serverMemory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },

      // Database state
      databaseConnectionPool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    },

    // Sample data for debugging (first 3 records)
    sampleData: priceData.slice(0, 3).map(d => ({
      productId: d.productId,
      retailerId: d.retailerId,
      recordCount: d.recordCount
    }))
  });

  // Send to Sentry if configured
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/node');
    Sentry.captureException(error, {
      tags: {
        component: 'price-aggregation',
        granularity: 'daily',
        phase: 'aggregation'
      },
      extra: {
        context: { /* ... same as above */ }
      }
    });
  }

  throw error;
}
```

**Success Criteria:**
- All error logs include full context
- Memory and connection pool state logged
- Sample data included for debugging
- Sentry integration (if available)

**Expected Impact:** Faster incident resolution, better root cause analysis

---

## Phase 2: Operational Excellence (24 hours)

### 2.1 Aggregation Gap Detection
**Priority:** HIGH | **Effort:** 6 hours | **Category:** Data Quality

**Problem:** No monitoring for missing aggregates (gaps in time series).

**Files to Create:**
- `server/services/aggregation-health-service.ts` (new file)
- `server/routes/health-routes.ts` (add new endpoint)

**Implementation:**
```typescript
// server/services/aggregation-health-service.ts - CREATE NEW FILE
export class AggregationHealthService {
  async detectDailyGaps(days: number = 90): Promise<GapReport> {
    const gaps: Gap[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all existing dates
    const existingDates = await db
      .selectDistinct({ date: priceAggregatesDaily.date })
      .from(priceAggregatesDaily)
      .where(gte(priceAggregatesDaily.date, startDate.toISOString()))
      .orderBy(priceAggregatesDaily.date);

    const dateSet = new Set(existingDates.map(r => r.date));

    // Check each expected date
    let currentDate = new Date(startDate);
    while (currentDate <= new Date()) {
      const dateStr = currentDate.toISOString().split('T')[0];

      if (!dateSet.has(dateStr)) {
        gaps.push({
          date: dateStr,
          granularity: 'daily',
          severity: this.getGapSeverity(currentDate),
          daysOld: Math.floor((Date.now() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      gaps,
      totalExpected: days,
      totalFound: existingDates.length,
      missingCount: gaps.length,
      coveragePercent: ((existingDates.length / days) * 100).toFixed(2)
    };
  }

  private getGapSeverity(date: Date): 'critical' | 'warning' | 'info' {
    const daysOld = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOld <= 2) return 'critical'; // Recent gaps are critical
    if (daysOld <= 7) return 'warning';  // Week-old gaps need attention
    return 'info'; // Older gaps are informational
  }

  // Similar methods for weekly and monthly gaps
}

// In server/routes/health-routes.ts - ADD ENDPOINT
app.get('/api/health/aggregation-gaps', async (req, res) => {
  const days = parseInt(req.query.days as string) || 90;

  const healthService = new AggregationHealthService();
  const dailyGaps = await healthService.detectDailyGaps(days);
  const weeklyGaps = await healthService.detectWeeklyGaps();
  const monthlyGaps = await healthService.detectMonthlyGaps();

  res.json({
    daily: dailyGaps,
    weekly: weeklyGaps,
    monthly: monthlyGaps,
    overallHealth: healthService.calculateOverallHealth([dailyGaps, weeklyGaps, monthlyGaps])
  });
});
```

**Success Criteria:**
- Endpoint returns all gaps
- Severity levels assigned correctly
- Tests cover gap detection logic
- Can be monitored/alerted on

**Expected Impact:** Proactive detection of aggregation failures, data quality visibility

---

### 2.2 Parallel Aggregation Processing
**Priority:** MEDIUM | **Effort:** 6 hours | **Category:** Performance

**Problem:** Daily aggregation processes all product-retailer combinations sequentially.

**Files to Modify:**
- `server/services/price-aggregation-service.ts`
- `package.json` (add `p-map` dependency)

**Implementation:**
```bash
npm install p-map
```

```typescript
// At top of price-aggregation-service.ts
import pMap from 'p-map';
import chunk from 'lodash/chunk';

async calculateDailyAggregates(): Promise<number> {
  // Fetch all data first
  const allPriceData = await this.fetchPriceDataForAggregation(/* ... */);

  // Chunk into batches of 100
  const BATCH_SIZE = 100;
  const batches = chunk(allPriceData, BATCH_SIZE);

  logger.info(`[PriceAggregation] Processing ${batches.length} batches of ${BATCH_SIZE} in parallel`);

  // Process batches in parallel (limit concurrency to 5)
  const results = await pMap(
    batches,
    async (batch) => this.processDailyBatch(batch),
    { concurrency: 5 }
  );

  const totalProcessed = results.reduce((sum, count) => sum + count, 0);

  logger.info(`[PriceAggregation] Processed ${totalProcessed} aggregates across ${batches.length} batches`);

  return totalProcessed;
}

private async processDailyBatch(batch: PriceData[]): Promise<number> {
  // Process one batch in a transaction
  return await db.transaction(async (tx) => {
    // Calculate aggregates for this batch
    const values = batch.map(data => {
      const stats = this.calculatePriceStatistics(/* ... */);
      return { /* aggregate record */ };
    });

    await tx.insert(priceAggregatesDaily).values(values).onConflictDoUpdate(/* ... */);

    return values.length;
  });
}
```

**Success Criteria:**
- Multiple batches processed in parallel
- Concurrency limited to avoid overwhelming database
- Logs show batch processing
- Tests verify parallel behavior

**Expected Impact:** 3-5x faster aggregation for large datasets (1000+ product-retailer combos)

---

### 2.3 Progress Tracking for Long Jobs
**Priority:** MEDIUM | **Effort:** 4 hours | **Category:** Observability

**Problem:** Long-running aggregations have no progress visibility.

**Files to Modify:**
- `server/services/price-aggregation-service.ts`
- `server/routes/admin-routes.ts` (add progress endpoint)

**Implementation:**
```typescript
// In price-aggregation-service.ts
async calculateDailyAggregates(): Promise<number> {
  const progressKey = 'aggregation:daily:progress';
  const redis = getRedisClient();

  // Initialize progress
  await redis.hset(progressKey, {
    status: 'running',
    startedAt: new Date().toISOString(),
    totalBatches: batches.length,
    completedBatches: 0,
    recordsProcessed: 0
  });
  await redis.expire(progressKey, 3600); // 1 hour TTL

  // Process batches with progress updates
  let totalProcessed = 0;

  for (let i = 0; i < batches.length; i++) {
    const batchCount = await this.processBatch(batches[i]);
    totalProcessed += batchCount;

    // Update progress
    await redis.hincrby(progressKey, 'completedBatches', 1);
    await redis.hincrby(progressKey, 'recordsProcessed', batchCount);
    await redis.hset(progressKey, 'lastUpdated', new Date().toISOString());

    const progress = ((i + 1) / batches.length * 100).toFixed(1);
    logger.info(`[PriceAggregation] Progress: ${progress}% (${i + 1}/${batches.length} batches)`);
  }

  // Mark complete
  await redis.hset(progressKey, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    totalProcessed
  });

  return totalProcessed;
}

// In server/routes/admin-routes.ts - ADD ENDPOINT
app.get('/api/admin/analytics/aggregation-progress', withAdmin(async (req, res) => {
  const redis = getRedisClient();
  const granularity = req.query.granularity || 'daily';

  const progress = await redis.hgetall(`aggregation:${granularity}:progress`);

  if (!progress || Object.keys(progress).length === 0) {
    res.json({ status: 'idle', message: 'No aggregation currently running' });
    return;
  }

  // Calculate progress percentage
  const completed = parseInt(progress.completedBatches || '0');
  const total = parseInt(progress.totalBatches || '1');
  const progressPercent = ((completed / total) * 100).toFixed(1);

  res.json({
    status: progress.status,
    progress: `${progressPercent}%`,
    completedBatches: completed,
    totalBatches: total,
    recordsProcessed: parseInt(progress.recordsProcessed || '0'),
    startedAt: progress.startedAt,
    lastUpdated: progress.lastUpdated,
    estimatedTimeRemaining: this.calculateETA(progress)
  });
}));
```

**Success Criteria:**
- Progress updated in real-time
- Admin endpoint returns current status
- Progress persists in Redis
- ETA calculation accurate

**Expected Impact:** Visibility into long-running jobs, better debugging

---

### 2.4 Circuit Breaker for Database Overload
**Priority:** MEDIUM | **Effort:** 4 hours | **Category:** Operations

**Problem:** No protection against database overload during aggregation.

**Files to Modify:**
- `server/services/price-aggregation-service.ts`
- `package.json` (add `opossum` dependency)

**Implementation:**
```bash
npm install opossum
```

```typescript
// At top of price-aggregation-service.ts
import CircuitBreaker from 'opossum';

// Create circuit breaker instance
const aggregationCircuitBreaker = new CircuitBreaker(
  async (granularity: string) => {
    // This function will be wrapped by circuit breaker
    return await performAggregation(granularity);
  },
  {
    timeout: 300000, // 5 minutes
    errorThresholdPercentage: 50,
    resetTimeout: 60000, // 1 minute cooldown
    name: 'price-aggregation',
    volumeThreshold: 3 // Require 3 failures before opening
  }
);

// Add event listeners
aggregationCircuitBreaker.on('open', () => {
  logger.error('[PriceAggregation] Circuit breaker OPEN - aggregation disabled temporarily');
  // Could send alert to ops team via PagerDuty/Slack
});

aggregationCircuitBreaker.on('halfOpen', () => {
  logger.warn('[PriceAggregation] Circuit breaker HALF-OPEN - testing recovery');
});

aggregationCircuitBreaker.on('close', () => {
  logger.info('[PriceAggregation] Circuit breaker CLOSED - aggregation operational');
});

// Use in methods
async calculateDailyAggregates(): Promise<number> {
  try {
    return await aggregationCircuitBreaker.fire('daily');
  } catch (error) {
    if (aggregationCircuitBreaker.opened) {
      logger.error('[PriceAggregation] Circuit breaker is OPEN, skipping aggregation');
      return 0;
    }
    throw error;
  }
}
```

**Success Criteria:**
- Circuit opens after repeated failures
- Automatic recovery after cooldown
- Logs show circuit state changes
- Tests verify circuit behavior

**Expected Impact:** Prevents cascading failures, database protection during incidents

---

### 2.5 Orphaned Aggregate Detection
**Priority:** MEDIUM | **Effort:** 3 hours | **Category:** Data Quality

**Problem:** No cleanup of aggregates for deleted products/retailers.

**Files to Modify:**
- `server/services/price-snapshot-service.ts` (add cleanup method)
- `server/jobs/price-aggregation-job.ts` (add weekly schedule)

**Implementation:**
```typescript
// In price-snapshot-service.ts
async cleanupOrphanedAggregates(): Promise<OrphanCleanupResult> {
  logger.info('[Cleanup] Starting orphaned aggregate detection');

  let totalDeleted = 0;

  // 1. Find daily aggregates for non-existent products
  const orphanedDailyProducts = await db
    .select({ id: priceAggregatesDaily.id })
    .from(priceAggregatesDaily)
    .leftJoin(products, eq(priceAggregatesDaily.productId, products.id))
    .where(isNull(products.id))
    .limit(1000); // Process in batches

  if (orphanedDailyProducts.length > 0) {
    await db.delete(priceAggregatesDaily)
      .where(inArray(priceAggregatesDaily.id, orphanedDailyProducts.map(r => r.id)));
    totalDeleted += orphanedDailyProducts.length;
    logger.info(`[Cleanup] Deleted ${orphanedDailyProducts.length} orphaned daily aggregates (products)`);
  }

  // 2. Find daily aggregates for non-existent retailers
  const orphanedDailyRetailers = await db
    .select({ id: priceAggregatesDaily.id })
    .from(priceAggregatesDaily)
    .leftJoin(retailers, eq(priceAggregatesDaily.retailerId, retailers.id))
    .where(isNull(retailers.id))
    .limit(1000);

  if (orphanedDailyRetailers.length > 0) {
    await db.delete(priceAggregatesDaily)
      .where(inArray(priceAggregatesDaily.id, orphanedDailyRetailers.map(r => r.id)));
    totalDeleted += orphanedDailyRetailers.length;
    logger.info(`[Cleanup] Deleted ${orphanedDailyRetailers.length} orphaned daily aggregates (retailers)`);
  }

  // Repeat for weekly and monthly aggregates

  logger.info(`[Cleanup] Total orphaned aggregates removed: ${totalDeleted}`);

  return {
    totalDeleted,
    dailyDeleted: orphanedDailyProducts.length + orphanedDailyRetailers.length,
    // ... weekly, monthly counts
  };
}

// In price-aggregation-job.ts - ADD WEEKLY SCHEDULE
cron.schedule('0 4 * * 0', async () => {
  // Sunday at 4 AM
  try {
    logger.info('[PriceAggregationJob] Starting orphaned aggregate cleanup');
    const result = await priceSnapshotService.cleanupOrphanedAggregates();
    logger.info('[PriceAggregationJob] Orphaned cleanup complete', result);
  } catch (error) {
    logger.error('[PriceAggregationJob] Orphaned cleanup failed', { error });
  }
});
```

**Success Criteria:**
- Orphaned aggregates detected and removed
- Runs weekly automatically
- Logs cleanup statistics
- No performance impact on production

**Expected Impact:** Prevents database bloat, maintains referential integrity

---

### 2.6 Quality Metrics Tracking
**Priority:** MEDIUM | **Effort:** 6 hours | **Category:** Observability

**Problem:** No tracking of data quality trends over time.

**Files to Create:**
- `shared/schema.ts` (add quality log table)
- `server/services/price-aggregation-service.ts` (collect metrics)
- Create migration: `migrations/0016_add_quality_log.sql`

**Implementation:**
```typescript
// In shared/schema.ts - ADD TABLE
export const aggregationQualityLog = pgTable("aggregation_quality_log", {
  id: serial("id").primaryKey(),
  date: varchar("date", { length: 10 }).notNull(),
  granularity: varchar("granularity", { length: 10 }).notNull(),

  // Coverage metrics
  productsProcessed: integer("products_processed").notNull(),
  productsSkipped: integer("products_skipped").notNull(),
  coveragePercent: decimal("coverage_percent", { precision: 5, scale: 2 }),

  // Data quality
  averageDataPoints: decimal("average_data_points", { precision: 10, scale: 2 }),
  averageVolatility: decimal("average_volatility", { precision: 10, scale: 2 }),
  priceAnomalies: integer("price_anomalies").notNull().default(0),

  // Performance
  processingTimeSeconds: integer("processing_time_seconds").notNull(),
  recordsPerSecond: decimal("records_per_second", { precision: 10, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  dateGranularityIdx: index("idx_quality_log_date_granularity")
    .on(table.date, table.granularity),
}));

// In price-aggregation-service.ts - COLLECT METRICS
async calculateDailyAggregates(): Promise<number> {
  const startTime = Date.now();
  const date = new Date().toISOString().split('T')[0];

  // ... perform aggregation ...

  // Collect quality metrics
  const qualityMetrics = {
    date,
    granularity: 'daily',
    productsProcessed: processedCount,
    productsSkipped: skippedCount,
    coveragePercent: ((processedCount / totalProducts) * 100).toFixed(2),
    averageDataPoints: (totalDataPoints / processedCount).toFixed(2),
    averageVolatility: (totalVolatility / processedCount).toFixed(2),
    priceAnomalies: anomalyCount,
    processingTimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    recordsPerSecond: (processedCount / ((Date.now() - startTime) / 1000)).toFixed(2)
  };

  // Store metrics
  await db.insert(aggregationQualityLog).values(qualityMetrics);

  logger.info('[PriceAggregation] Quality metrics recorded', qualityMetrics);

  return count;
}
```

**Migration SQL:**
```sql
-- 0016_add_quality_log.sql
CREATE TABLE aggregation_quality_log (
  id SERIAL PRIMARY KEY,
  date VARCHAR(10) NOT NULL,
  granularity VARCHAR(10) NOT NULL,
  products_processed INTEGER NOT NULL,
  products_skipped INTEGER NOT NULL,
  coverage_percent DECIMAL(5, 2),
  average_data_points DECIMAL(10, 2),
  average_volatility DECIMAL(10, 2),
  price_anomalies INTEGER NOT NULL DEFAULT 0,
  processing_time_seconds INTEGER NOT NULL,
  records_per_second DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_log_date_granularity ON aggregation_quality_log(date, granularity);
```

**Success Criteria:**
- Quality metrics logged after each run
- Historical trends queryable
- Anomalies tracked
- Performance metrics captured

**Expected Impact:** Trend analysis for data quality, early warning for degradation

---

## Phase 3: Enhancement (22 hours)

### 3.1 Materialized View for Analytics Overview
**Priority:** MEDIUM | **Effort:** 4 hours | **Category:** Performance

**Problem:** `/api/analytics/overview` endpoint counts aggregates every request.

**Files to Create:**
- `migrations/0017_add_analytics_overview_view.sql`

**Files to Modify:**
- `server/price-analytics-routes.ts`
- `server/jobs/price-aggregation-job.ts` (add refresh schedule)

**Implementation:**
```sql
-- migrations/0017_add_analytics_overview_view.sql
CREATE MATERIALIZED VIEW analytics_overview_summary AS
SELECT
  (SELECT COUNT(*) FROM price_aggregates_daily) as daily_count,
  (SELECT COUNT(*) FROM price_aggregates_weekly) as weekly_count,
  (SELECT COUNT(*) FROM price_aggregates_monthly) as monthly_count,
  (SELECT COUNT(*) FROM price_trends WHERE trend_direction = 'uptrend') as uptrend_count,
  (SELECT COUNT(*) FROM price_trends WHERE trend_direction = 'downtrend') as downtrend_count,
  (SELECT COUNT(*) FROM price_trends WHERE trend_direction = 'stable') as stable_count,
  (SELECT MAX(created_at) FROM price_aggregates_daily) as last_daily_aggregation,
  (SELECT MAX(created_at) FROM price_aggregates_weekly) as last_weekly_aggregation,
  (SELECT MAX(created_at) FROM price_aggregates_monthly) as last_monthly_aggregation,
  NOW() as last_updated;

CREATE UNIQUE INDEX ON analytics_overview_summary ((last_updated));

-- Grant access
GRANT SELECT ON analytics_overview_summary TO your_app_user;
```

```typescript
// In price-analytics-routes.ts - UPDATE ENDPOINT
app.get('/api/analytics/overview', async (req, res) => {
  // Query materialized view instead of live counts
  const result = await db.execute(sql`
    SELECT * FROM analytics_overview_summary
  `);

  const summary = result.rows[0];

  res.json({
    aggregates: {
      daily: parseInt(summary.daily_count),
      weekly: parseInt(summary.weekly_count),
      monthly: parseInt(summary.monthly_count)
    },
    trends: {
      uptrend: parseInt(summary.uptrend_count),
      downtrend: parseInt(summary.downtrend_count),
      stable: parseInt(summary.stable_count)
    },
    lastUpdated: summary.last_updated,
    lastAggregations: {
      daily: summary.last_daily_aggregation,
      weekly: summary.last_weekly_aggregation,
      monthly: summary.last_monthly_aggregation
    }
  });
});

// In price-aggregation-job.ts - REFRESH AFTER AGGREGATIONS
async function refreshAnalyticsOverview() {
  await db.execute(sql`REFRESH MATERIALIZED VIEW analytics_overview_summary`);
  logger.info('[PriceAggregationJob] Analytics overview view refreshed');
}

// Call after each aggregation job completes
cron.schedule('0 1 * * *', async () => {
  await priceAggregationService.calculateDailyAggregates();
  await refreshAnalyticsOverview(); // ADD THIS
});
```

**Success Criteria:**
- View created successfully
- Endpoint queries view instead of tables
- View refreshed after each aggregation
- Response time < 10ms

**Expected Impact:** 100x faster response (1ms vs 100ms), zero production load

---

### 3.2 Graceful Degradation Mode
**Priority:** MEDIUM | **Effort:** 5 hours | **Category:** Operations

**Problem:** If aggregation fails, queries fall back to slow raw data queries.

**Files to Modify:**
- `server/services/price-history-service.ts`
- Add new cache layer for stale aggregates

**Implementation:**
```typescript
// In price-history-service.ts
async getPriceHistoryOptimized(
  productId: number,
  days: number,
  retailerId?: number
): Promise<NormalizedPricePoint[]> {
  // Check aggregate health
  const aggregateHealth = await this.checkAggregateHealth(days);

  if (!aggregateHealth.healthy) {
    logger.warn(`[PriceHistory] Degraded mode activated`, {
      productId,
      days,
      reason: aggregateHealth.reason,
      staleness: aggregateHealth.stalenessDays
    });

    // Return cached aggregates even if stale (within 7 days)
    const cachedData = await this.getCachedAggregates(productId, days, {
      maxStaleness: 7 * 24 * 60 * 60 * 1000, // 7 days
      includeStaleIndicator: true
    });

    if (cachedData.length > 0) {
      logger.info(`[PriceHistory] Serving stale cached data`, {
        productId,
        recordCount: cachedData.length,
        staleness: aggregateHealth.stalenessDays
      });
      return cachedData;
    }

    // Last resort: fall back to raw data with aggressive caching
    logger.warn(`[PriceHistory] No cached data, falling back to raw data`);
    return await this.getRawDataWithCaching(productId, days);
  }

  // Normal path - aggregates are healthy
  return await this.queryWithAggregates(productId, days, retailerId);
}

private async checkAggregateHealth(days: number): Promise<AggregateHealth> {
  // Check if we have recent aggregates
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 2); // Allow 2 days staleness

  const recentDaily = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(priceAggregatesDaily)
    .where(gte(priceAggregatesDaily.createdAt, cutoffDate));

  if (parseInt(recentDaily[0].count as string) === 0) {
    return {
      healthy: false,
      reason: 'No recent daily aggregates found',
      stalenessDays: 2
    };
  }

  return { healthy: true };
}

private async getCachedAggregates(
  productId: number,
  days: number,
  options: { maxStaleness: number; includeStaleIndicator?: boolean }
): Promise<NormalizedPricePoint[]> {
  // Try to get from Redis cache
  const cacheKey = `stale-aggregates:${productId}:${days}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const data = JSON.parse(cached);
    if (options.includeStaleIndicator) {
      data.forEach(point => point.stale = true);
    }
    return data;
  }

  // Query database for any aggregates (even old ones)
  const staleData = await this.queryAggregatesWithoutTimeLimit(productId, days);

  if (staleData.length > 0) {
    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(staleData));
  }

  return staleData;
}
```

**Success Criteria:**
- Degraded mode triggered when aggregates stale
- Cached data served as fallback
- Logs indicate degraded mode
- Tests verify fallback behavior

**Expected Impact:** Continuous service during aggregation failures, better UX

---

### 3.3 Dry-Run Mode for Testing
**Priority:** MEDIUM | **Effort:** 3 hours | **Category:** Developer Experience

**Problem:** No way to test aggregation without actually modifying database.

**Files to Modify:**
- `server/services/price-aggregation-service.ts`
- `server/routes/admin-routes.ts` (add dry-run parameter)

**Implementation:**
```typescript
// In price-aggregation-service.ts - ADD OPTION PARAMETER
async calculateDailyAggregates(
  options: { dryRun?: boolean } = {}
): Promise<AggregationResult> {
  const { dryRun = false } = options;

  // Fetch data as normal
  const priceData = await this.fetchPriceDataForAggregation(/* ... */);
  const { startDate, endDate } = this.getYesterdayRange();

  // Calculate what would be processed
  const values = priceData.map(data => {
    const stats = this.calculatePriceStatistics(/* ... */);
    return {
      productId: data.productId,
      retailerId: data.retailerId,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      avgPrice: stats.avgPrice,
      // ... all fields
    };
  }).filter(Boolean);

  if (dryRun) {
    logger.info('[PriceAggregation] DRY RUN - would process:', {
      dateRange: { startDate, endDate },
      productRetailerCombos: priceData.length,
      estimatedAggregates: values.length,
      sampleData: values.slice(0, 5) // First 5 for inspection
    });

    return {
      dryRun: true,
      wouldProcess: values.length,
      wouldMark: priceData.map(d => d.recordCount).reduce((a, b) => a + b, 0),
      dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      sampleAggregates: values.slice(0, 5)
    };
  }

  // Normal path - actually process
  await db.transaction(async (tx) => {
    // ... actual processing
  });

  return {
    dryRun: false,
    processed: values.length
  };
}

// In admin-routes.ts - ADD DRY-RUN PARAMETER
app.post('/api/admin/analytics/calculate-daily', withAdmin(async (req, res) => {
  const dryRun = req.query.dryRun === 'true';

  const result = await priceAggregationService.calculateDailyAggregates({ dryRun });

  res.json({
    success: true,
    dryRun: result.dryRun,
    ...result
  });
}));
```

**Success Criteria:**
- Dry-run mode doesn't modify database
- Returns what would be processed
- Sample data included for inspection
- Works with all aggregation methods

**Expected Impact:** Safer testing in production, validation before expensive operations

---

### 3.4 Test Data Factories
**Priority:** MEDIUM | **Effort:** 4 hours | **Category:** Developer Experience

**Problem:** Tests use inline data creation making them verbose.

**Files to Create:**
- `server/services/__tests__/factories/price-data-factory.ts`

**Implementation:**
```typescript
// server/services/__tests__/factories/price-data-factory.ts - CREATE NEW FILE
import { faker } from '@faker-js/faker';
import type {
  PriceHistory,
  PriceAggregateDaily,
  PriceAggregateWeekly,
  PriceAggregateMonthly
} from '../../../shared/schema';

export class PriceDataFactory {
  /**
   * Create a single price history record
   */
  static createPriceHistory(
    overrides?: Partial<PriceHistory>
  ): PriceHistory {
    return {
      id: faker.number.int(),
      productId: faker.number.int({ min: 1, max: 100 }),
      retailerId: faker.number.int({ min: 1, max: 10 }),
      price: faker.commerce.price({ min: 10, max: 1000 }),
      availability: faker.helpers.arrayElement(['in_stock', 'out_of_stock', 'limited']),
      recordedAt: faker.date.recent(),
      aggregatedAt: null,
      ...overrides
    };
  }

  /**
   * Create multiple price history records
   */
  static createPriceHistoryBatch(
    count: number,
    overrides?: Partial<PriceHistory>
  ): PriceHistory[] {
    return Array.from({ length: count }, () =>
      this.createPriceHistory(overrides)
    );
  }

  /**
   * Create price history for a specific date range
   */
  static createPriceHistoryForDateRange(
    productId: number,
    retailerId: number,
    startDate: Date,
    endDate: Date,
    recordsPerDay: number = 10
  ): PriceHistory[] {
    const records: PriceHistory[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      for (let i = 0; i < recordsPerDay; i++) {
        records.push(this.createPriceHistory({
          productId,
          retailerId,
          recordedAt: new Date(currentDate),
          price: faker.commerce.price({ min: 100, max: 200 })
        }));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return records;
  }

  /**
   * Create a daily aggregate
   */
  static createDailyAggregate(
    overrides?: Partial<PriceAggregateDaily>
  ): PriceAggregateDaily {
    const minPrice = faker.number.float({ min: 10, max: 500 });
    const maxPrice = faker.number.float({ min: 500, max: 1000 });
    const avgPrice = (minPrice + maxPrice) / 2;

    return {
      id: faker.number.int(),
      productId: faker.number.int({ min: 1, max: 100 }),
      retailerId: faker.number.int({ min: 1, max: 10 }),
      date: faker.date.recent().toISOString().split('T')[0],
      minPrice: minPrice.toFixed(2),
      maxPrice: maxPrice.toFixed(2),
      avgPrice: avgPrice.toFixed(2),
      medianPrice: avgPrice.toFixed(2),
      volatilityScore: faker.number.float({ min: 0, max: 50 }).toFixed(2),
      recordCount: faker.number.int({ min: 1, max: 100 }),
      dayOverDayChange: faker.number.float({ min: -10, max: 10 }).toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  // Similar methods for weekly and monthly aggregates
}

// Usage in tests:
describe('PriceAggregationService', () => {
  it('should aggregate daily prices', async () => {
    // BEFORE: Verbose inline data
    // const priceData = [
    //   { id: 1, productId: 1, retailerId: 1, price: '100.00', recordedAt: yesterday },
    //   { id: 2, productId: 1, retailerId: 1, price: '105.00', recordedAt: yesterday },
    //   // ... 98 more records
    // ];

    // AFTER: Clean factory usage
    const priceData = PriceDataFactory.createPriceHistoryBatch(100, {
      productId: 1,
      retailerId: 1,
      recordedAt: yesterday
    });

    await db.insert(priceHistory).values(priceData);

    const result = await priceAggregationService.calculateDailyAggregates();
    expect(result).toBeGreaterThan(0);
  });
});
```

**Success Criteria:**
- Factory methods for all data types
- Tests use factories consistently
- Faker generates realistic data
- Date range generation works

**Expected Impact:** More readable tests, consistent test data, faster test authoring

---

## Phase 4: Advanced Features (48+ hours)

### 4.1 Percentile Aggregations
**Priority:** MEDIUM | **Effort:** 6 hours | **Category:** Features

**Problem:** Only tracking min/max/avg/median - missing P95, P99 for SLA analysis.

**Files to Modify:**
- `shared/schema.ts` (add percentile fields)
- `server/services/price-aggregation-service.ts` (calculate percentiles)
- Create migration: `migrations/0018_add_percentile_fields.sql`

**Implementation:**
```typescript
// In shared/schema.ts - ADD FIELDS
export const priceAggregatesDaily = pgTable("price_aggregates_daily", {
  // ... existing fields
  p25Price: decimal("p25_price", { precision: 10, scale: 2 }),
  p75Price: decimal("p75_price", { precision: 10, scale: 2 }),
  p95Price: decimal("p95_price", { precision: 10, scale: 2 }),
  p99Price: decimal("p99_price", { precision: 10, scale: 2 }),
});

// In price-aggregation-service.ts - USE POSTGRES PERCENTILE_CONT
const priceData = await tx.execute(sql`
  SELECT
    product_id,
    retailer_id,
    MIN(price::numeric) as min_price,
    MAX(price::numeric) as max_price,
    AVG(price::numeric) as avg_price,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY price::numeric) as p25_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price::numeric) as median_price,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY price::numeric) as p75_price,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY price::numeric) as p95_price,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY price::numeric) as p99_price,
    COUNT(*) as record_count
  FROM price_history
  WHERE recorded_at >= ${startDate} AND recorded_at <= ${endDate}
  GROUP BY product_id, retailer_id
`);
```

**Migration SQL:**
```sql
-- 0018_add_percentile_fields.sql
ALTER TABLE price_aggregates_daily
  ADD COLUMN p25_price DECIMAL(10, 2),
  ADD COLUMN p75_price DECIMAL(10, 2),
  ADD COLUMN p95_price DECIMAL(10, 2),
  ADD COLUMN p99_price DECIMAL(10, 2);

-- Similarly for weekly and monthly
```

**Success Criteria:**
- Percentile fields added to schema
- Percentiles calculated using PostgreSQL
- API returns percentile data
- Tests verify calculations

**Expected Impact:** Better price distribution understanding, outlier detection, SLA tracking

---

### 4.2 Idempotency Tokens
**Priority:** LOW | **Effort:** 2 hours | **Category:** Operations

**Problem:** Admin endpoints can be double-clicked causing duplicate work.

**Files to Modify:**
- `server/routes/admin-routes.ts` (all manual trigger endpoints)
- `server/middleware/idempotency.ts` (create new middleware)

**Implementation:**
```typescript
// server/middleware/idempotency.ts - CREATE NEW FILE
export function idempotency(ttl: number = 3600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      // Idempotency optional - continue without it
      next();
      return;
    }

    const redis = getRedisClient();
    const cacheKey = `idempotency:${idempotencyKey}`;

    // Check if already processed
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info(`[Idempotency] Request already processed`, { idempotencyKey });
      res.json(JSON.parse(cached));
      return;
    }

    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      // Cache the response
      redis.setex(cacheKey, ttl, JSON.stringify(body));
      return originalJson(body);
    };

    next();
  };
}

// In admin-routes.ts - APPLY MIDDLEWARE
import { idempotency } from '../middleware/idempotency';

app.post('/api/admin/analytics/calculate-daily',
  withAdmin,
  idempotency(), // ADD THIS
  async (req, res) => {
    const count = await priceAggregationService.calculateDailyAggregates();
    res.json({ success: true, aggregatesCalculated: count });
  }
);
```

**Success Criteria:**
- Duplicate requests return cached response
- Idempotency key optional
- TTL configurable per endpoint
- Tests verify idempotency

**Expected Impact:** Prevents accidental duplicate work, better admin UX

---

### 4.3 Aggregation Simulation Tool
**Priority:** LOW | **Effort:** 6 hours | **Category:** Developer Experience

**Problem:** Hard to understand impact of schema changes on aggregation performance.

**Files to Create:**
- `scripts/simulate-aggregation.ts`
- `scripts/generate-synthetic-data.ts`

**Implementation:**
```typescript
// scripts/simulate-aggregation.ts - CREATE NEW FILE
#!/usr/bin/env tsx

interface SimulationOptions {
  products: number;
  retailers: number;
  daysOfData: number;
  pricesPerDay: number;
  includeMemoryProfiling?: boolean;
}

async function simulateAggregation(options: SimulationOptions) {
  console.log('🔄 Starting aggregation simulation...\n');
  console.log('Configuration:', options);

  // 1. Generate synthetic data
  console.log('\n📊 Generating synthetic price data...');
  const syntheticData = generateSyntheticPriceData(options);
  console.log(`Generated ${syntheticData.length} price records`);

  // 2. Insert into test database
  console.log('\n💾 Inserting data into test database...');
  await insertTestData(syntheticData);

  // 3. Run aggregation with timing
  console.log('\n⏱️  Running aggregation...');
  const memBefore = process.memoryUsage();
  const startTime = Date.now();

  const result = await priceAggregationService.calculateDailyAggregates();

  const duration = Date.now() - startTime;
  const memAfter = process.memoryUsage();

  // 4. Report statistics
  console.log('\n✅ Simulation Results:');
  console.log('━'.repeat(50));
  console.log(`Data size:          ${syntheticData.length.toLocaleString()} records`);
  console.log(`Processing time:    ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
  console.log(`Throughput:         ${Math.floor(syntheticData.length / (duration / 1000))} records/sec`);
  console.log(`Aggregates created: ${result}`);
  console.log(`Memory used:        ${Math.round((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024)}MB`);
  console.log(`Peak memory:        ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);

  if (options.includeMemoryProfiling) {
    console.log('\n📈 Memory Profile:');
    console.log(`Heap total:  ${Math.round(memAfter.heapTotal / 1024 / 1024)}MB`);
    console.log(`RSS:         ${Math.round(memAfter.rss / 1024 / 1024)}MB`);
    console.log(`External:    ${Math.round(memAfter.external / 1024 / 1024)}MB`);
  }

  // 5. Cleanup
  console.log('\n🧹 Cleaning up test data...');
  await cleanupTestData();

  console.log('\n✨ Simulation complete!');
}

// CLI interface
const args = {
  products: parseInt(process.argv[2]) || 100,
  retailers: parseInt(process.argv[3]) || 10,
  daysOfData: parseInt(process.argv[4]) || 30,
  pricesPerDay: parseInt(process.argv[5]) || 10,
  includeMemoryProfiling: process.argv.includes('--memory')
};

simulateAggregation(args);

// Usage:
// npm run simulate-aggregation 1000 50 30 10 --memory
```

**Success Criteria:**
- Generates realistic synthetic data
- Times aggregation accurately
- Reports memory usage
- Cleans up after simulation

**Expected Impact:** Capacity planning data, performance regression detection

---

### 4.4 Seasonal Pattern Detection
**Priority:** LOW | **Effort:** 20 hours | **Category:** Features

**Problem:** No detection of seasonal pricing patterns (holidays, Black Friday, etc).

**This is a complex feature requiring:**
- Time-series analysis algorithms
- Statistical confidence calculations
- Pattern storage schema
- API endpoints for pattern retrieval
- UI for displaying patterns to users

**Recommendation:** Defer to Phase 5 (future work) until core aggregation system is fully optimized and stable in production.

---

### 4.5 Cross-Retailer Price Correlation
**Priority:** LOW | **Effort:** 16 hours | **Category:** Features

**Problem:** No tracking of whether retailers follow each other's pricing.

**This is a specialized analytics feature requiring:**
- Pearson correlation coefficient calculations
- Lag analysis (does retailer B follow retailer A with X day delay?)
- Statistical significance testing
- Correlation storage and trending

**Recommendation:** Defer to Phase 5 (future work) - nice-to-have for market intelligence.

---

### 4.6 Real-Time Aggregation Streaming
**Priority:** FUTURE | **Effort:** 40+ hours | **Category:** Features

**Problem:** Aggregations run on schedule - not real-time.

**This is a major infrastructure change requiring:**
- PostgreSQL logical replication setup
- Change Data Capture (CDC) implementation
- Streaming aggregation logic
- Real-time materialization
- Conflict resolution

**Recommendation:** Defer indefinitely - current batch processing is sufficient for 99% of use cases. Only pursue if real-time analytics become a critical business requirement.

---

## Summary Table

| # | Improvement | Priority | Effort | Phase | Category |
|---|-------------|----------|--------|-------|----------|
| 1.1 | Missing Indexes | HIGH | 2h | 1 | Performance |
| 1.2 | Data Validation | HIGH | 4h | 1 | Data Quality |
| 1.3 | Retry Logic | HIGH | 3h | 1 | Operations |
| 1.4 | Metrics Collection | HIGH | 8h | 1 | Observability |
| 1.5 | Incremental Aggregation | HIGH | 8h | 1 | Performance |
| 1.6 | Enhanced Logging | HIGH | 3h | 1 | Observability |
| 2.1 | Gap Detection | HIGH | 6h | 2 | Data Quality |
| 2.2 | Parallel Processing | MEDIUM | 6h | 2 | Performance |
| 2.3 | Progress Tracking | MEDIUM | 4h | 2 | Observability |
| 2.4 | Circuit Breaker | MEDIUM | 4h | 2 | Operations |
| 2.5 | Orphaned Cleanup | MEDIUM | 3h | 2 | Data Quality |
| 2.6 | Quality Metrics | MEDIUM | 6h | 2 | Observability |
| 3.1 | Materialized View | MEDIUM | 4h | 3 | Performance |
| 3.2 | Graceful Degradation | MEDIUM | 5h | 3 | Operations |
| 3.3 | Dry-Run Mode | MEDIUM | 3h | 3 | Developer UX |
| 3.4 | Test Factories | MEDIUM | 4h | 3 | Developer UX |
| 4.1 | Percentile Aggregations | MEDIUM | 6h | 4 | Features |
| 4.2 | Idempotency Tokens | LOW | 2h | 4 | Operations |
| 4.3 | Simulation Tool | LOW | 6h | 4 | Developer UX |
| 4.4 | Seasonal Patterns | LOW | 20h | 4 | Features |
| 4.5 | Price Correlations | LOW | 16h | 4 | Features |
| 4.6 | Real-Time Streaming | FUTURE | 40h+ | 5 | Features |

---

## Getting Started - Quick Wins

### Week 1: Critical Foundation
Start here for maximum impact with minimal effort:

1. **Missing Indexes** (2h) - Immediate query performance boost
2. **Retry Logic** (3h) - Dramatically reduces production alerts
3. **Data Validation** (4h) - Prevents future data corruption
4. **Enhanced Logging** (3h) - Makes debugging much faster

**Total: 12 hours, High Impact**

### Week 2: Monitoring & Performance
Build on the foundation:

5. **Metrics Collection** (8h) - Essential for production monitoring
6. **Incremental Aggregation** (8h) - Huge performance win
7. **Gap Detection** (6h) - Data quality visibility

**Total: 22 hours, High Impact**

---

## Implementation Guidelines

### Before Starting Each Improvement

1. **Read the full description** - Understand problem and solution
2. **Check dependencies** - Some improvements build on others
3. **Review files to modify** - Familiarize yourself with code
4. **Run existing tests** - Ensure baseline passes
5. **Create feature branch** - `git checkout -b improvement/1.1-missing-indexes`

### During Implementation

1. **Follow the implementation code exactly** - It's production-ready
2. **Add tests as you go** - Don't defer testing
3. **Update metrics/logging** - Instrument your changes
4. **Document edge cases** - Add comments for complex logic
5. **Commit frequently** - Small, focused commits

### After Implementation

1. **Run tests** - All tests must pass
2. **Check TypeScript** - `npm run check` must pass
3. **Test manually** - Use dry-run modes and admin endpoints
4. **Update documentation** - Document what you changed
5. **Create PR** - Link to this work plan in PR description

### Testing Checklist

For each improvement:
- [ ] Unit tests added and passing
- [ ] Integration tests added (if applicable)
- [ ] Manual testing completed
- [ ] TypeScript compiles without errors
- [ ] Logs include appropriate context
- [ ] Metrics instrumented (if applicable)
- [ ] Documentation updated

---

## Related Resources

- **Current Implementation**: See `todos/archive/016-completed-p3-implement-price-aggregation.md`
- **Database Patterns**: See `docs/DATABASE_PATTERNS.md`
- **Architecture**: See `docs/ARCHITECTURE.md` (Price History Aggregation section)
- **Testing Patterns**: See existing tests in `server/services/__tests__/`
- **Migration Guide**: See `migrations/README.md`

---

## Questions?

If you have questions while implementing:

1. Review the original implementation in the archived TODO
2. Check existing code patterns in similar services
3. Review tests for implementation examples
4. Consult `CLAUDE.md` for project conventions

---

**Last Updated:** 2025-11-20
**Status:** Ready for Implementation
**Next Review:** After Phase 1 completion
