# TODO 005: Optimize Database Queries and Add Performance Indexes

**Priority**: P2 (PERFORMANCE - HIGH IMPACT)
**File(s)**:
- `server/agents/coordinator-agent.ts` (Lines 537-544, 410-414)
- `migrations/0027_add_scraping_performance_indexes.sql` (NEW)

**Estimated Time**: 3-4 hours
**Status**: ✅ CLOSED - Work Already Complete (Closed: 2025-12-26)
**Resolution**: Investigation revealed optimizations were already implemented in migration 0026 and storage layer refactor

## Problem Statement

Two critical performance bottlenecks preventing scalability beyond 1,000 products/day:

### Issue 1: N+1 Query Pattern in Status Dashboard

**Location**: `coordinator-agent.ts:537-544`

**Current Implementation**: 8 separate full table scans
```typescript
const [totalJobs, pendingJobs, runningJobs, completedJobs, failedJobs, ...] = await Promise.all([
  db.select().from(scrapingJobs),                                     // Scan 1
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'pending')),   // Scan 2
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'running')),   // Scan 3
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'completed')), // Scan 4
  // ... 4 more full scans
]);
```

**Performance Impact**:
- **Current** (100 jobs): ~200ms
- **At 1,000 jobs**: ~2 seconds (10x slower)
- **At 10,000 jobs**: ~20 seconds (timeout risk)

**Problem**: Fetches entire tables just to count rows. With 10,000 jobs × 2KB avg = **20MB transferred for counts**.

### Issue 2: Missing Database Indexes

**Tables Affected**:
- `scraping_jobs.status` - Queried every 5-60 seconds (line 410)
- `scraping_jobs.scheduled_at` - Used in WHERE clauses
- `trending_products.status` - Filtered frequently
- `agent_sessions.agent_type` - No index found

**Performance Impact**:
| Records | Query Time (No Index) | Query Time (With Index) | Improvement |
|---------|----------------------|-------------------------|-------------|
| 100 | 50ms | 5ms | 10x faster |
| 1,000 | 500ms | 10ms | 50x faster |
| 10,000 | 5,000ms | 15ms | 333x faster |

**Query Example** (line 410-414):
```typescript
const pendingJobs = await db.select()
  .from(scrapingJobs)
  .where(and(
    eq(scrapingJobs.status, 'pending'),  // NO INDEX - full table scan
    lt(scrapingJobs.scheduledAt, new Date())
  ))
  .limit(this.coordinatorConfig.maxConcurrentJobs);
```

**Review Finding Reference**: Performance Oracle - Critical Issues #1 and #2

## Root Cause

1. **N+1 Queries**: Dashboard needs counts but code fetches full result sets
2. **Missing Indexes**: Tables created in migration 0026 without performance indexes
3. **No Query Optimization**: Initial implementation prioritized functionality over performance

## Solution Approach

### Part 1: Optimize Status Queries (N+1 Fix)

Replace 8 separate queries with **single aggregated query** using PostgreSQL COUNT filters:

```typescript
// ✅ SINGLE QUERY with aggregated counts
const stats = await db.select({
  totalJobs: sql<number>`COUNT(*)`,
  pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
  running: sql<number>`COUNT(*) FILTER (WHERE status = 'running')`,
  completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
  failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
}).from(scrapingJobs);
```

**Result**: O(8n) → O(1) index scan, ~20ms instead of 200ms.

### Part 2: Add Performance Indexes

Create migration 0027 with targeted indexes for hot query paths.

## Implementation Steps

### Step 1: Fix N+1 Query Pattern in Coordinator

- [ ] Locate `getSystemStatus()` method in `coordinator-agent.ts` (around line 525-555)
- [ ] Replace 8 separate queries with single aggregated query
- [ ] Apply same pattern for trending products stats
- [ ] Test performance improvement with benchmark

**Before (8 queries)**:
```typescript
const [totalJobs, pendingJobs, runningJobs, completedJobs, failedJobs,
       discoveredTrends, scrapedTrends, totalTrends] = await Promise.all([
  db.select().from(scrapingJobs),
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'pending')),
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'running')),
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'completed')),
  db.select().from(scrapingJobs).where(eq(scrapingJobs.status, 'failed')),
  db.select().from(trendingProducts).where(eq(trendingProducts.status, 'discovered')),
  db.select().from(trendingProducts).where(eq(trendingProducts.status, 'scraped')),
  db.select().from(trendingProducts),
]);

return {
  jobs: {
    total: totalJobs.length,
    pending: pendingJobs.length,
    running: runningJobs.length,
    completed: completedJobs.length,
    failed: failedJobs.length,
  },
  // ...
};
```

**After (2 queries)**:
```typescript
const [jobStats, trendStats] = await Promise.all([
  db.select({
    total: sql<number>`COUNT(*)`,
    pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
    running: sql<number>`COUNT(*) FILTER (WHERE status = 'running')`,
    completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
    failed: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`,
  }).from(scrapingJobs),

  db.select({
    total: sql<number>`COUNT(*)`,
    discovered: sql<number>`COUNT(*) FILTER (WHERE status = 'discovered')`,
    scraped: sql<number>`COUNT(*) FILTER (WHERE status = 'scraped')`,
  }).from(trendingProducts),
]);

return {
  jobs: {
    total: jobStats[0].total,
    pending: jobStats[0].pending,
    running: jobStats[0].running,
    completed: jobStats[0].completed,
    failed: jobStats[0].failed,
  },
  trends: {
    total: trendStats[0].total,
    discovered: trendStats[0].discovered,
    scraped: trendStats[0].scraped,
  },
};
```

### Step 2: Create Migration 0027 with Performance Indexes

- [ ] Create `migrations/0027_add_scraping_performance_indexes.sql`
- [ ] Add indexes for hot query paths
- [ ] Include comments explaining each index purpose
- [ ] Test index creation on development database

**Migration Content**:
```sql
-- Migration 0027: Performance Indexes for Scraping System
-- Created: 2025-12-23
-- Description: Adds indexes to optimize job polling, status filtering, and dashboard queries

BEGIN;

-- Index 1: Job queue polling (CRITICAL - queried every 5-60 seconds)
-- Covers: status + scheduled_at for pending job selection
-- Query: SELECT * FROM scraping_jobs WHERE status = 'pending' AND scheduled_at <= NOW()
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status_scheduled
  ON scraping_jobs(status, scheduled_at)
  WHERE status = 'pending';

-- Index 2: Trending product status filtering
-- Covers: Discovery agent filtering by status
-- Query: SELECT * FROM trending_products WHERE status = 'discovered'
CREATE INDEX IF NOT EXISTS idx_trending_products_status
  ON trending_products(status);

-- Index 3: Agent session type lookup
-- Covers: Metrics aggregation by agent type
-- Query: SELECT * FROM agent_sessions WHERE agent_type = 'discovery'
CREATE INDEX IF NOT EXISTS idx_agent_sessions_type
  ON agent_sessions(agent_type);

-- Index 4: Search query by trending product
-- Covers: Finding queries for specific trending products
CREATE INDEX IF NOT EXISTS idx_search_queries_trending_product
  ON search_queries(trending_product_id);

-- Index 5: Price predictions by offer (for analytics)
CREATE INDEX IF NOT EXISTS idx_price_predictions_offer
  ON price_predictions(product_offer_id);

-- Index 6: Scraping sources by trending product
CREATE INDEX IF NOT EXISTS idx_scraping_sources_trending_product
  ON scraping_sources(trending_product_id);

-- Index 7: Price snapshots by offer + date (for ML training)
CREATE INDEX IF NOT EXISTS idx_price_snapshots_offer_date
  ON price_snapshots(product_offer_id, snapshot_date DESC);

-- Index 8: Session locks expiration (for cleanup job)
CREATE INDEX IF NOT EXISTS idx_session_locks_expires
  ON session_lock_statuses(expires_at)
  WHERE expires_at > NOW();

-- Index 9: Agent session start time (for metrics)
CREATE INDEX IF NOT EXISTS idx_agent_sessions_start_time
  ON agent_sessions(session_start DESC);

-- Index 10: Scraping jobs by agent session (for debugging)
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_session
  ON scraping_jobs(agent_session_id)
  WHERE agent_session_id IS NOT NULL;

COMMIT;
```

**Rollback** (`migrations/0027_rollback.sql`):
```sql
BEGIN;

DROP INDEX IF EXISTS idx_scraping_jobs_status_scheduled;
DROP INDEX IF EXISTS idx_trending_products_status;
DROP INDEX IF EXISTS idx_agent_sessions_type;
DROP INDEX IF EXISTS idx_search_queries_trending_product;
DROP INDEX IF EXISTS idx_price_predictions_offer;
DROP INDEX IF EXISTS idx_scraping_sources_trending_product;
DROP INDEX IF EXISTS idx_price_snapshots_offer_date;
DROP INDEX IF EXISTS idx_session_locks_expires;
DROP INDEX IF EXISTS idx_agent_sessions_start_time;
DROP INDEX IF EXISTS idx_scraping_jobs_session;

COMMIT;
```

### Step 3: Benchmark Performance Improvements

- [ ] Create benchmark script: `server/__tests__/benchmarks/query-performance.test.ts`
- [ ] Measure before/after query times
- [ ] Test with various dataset sizes (100, 1000, 10000 records)
- [ ] Document results

**Benchmark Script**:
```typescript
import { describe, test, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('Query Performance Benchmarks', () => {
  test('status dashboard query performance', async () => {
    // Insert test data
    await insertTestScrapingJobs(10000);

    // Benchmark OLD query (8 separate queries)
    const startOld = performance.now();
    await getSystemStatusOld(); // 8 queries
    const timeOld = performance.now() - startOld;

    // Benchmark NEW query (2 aggregated queries)
    const startNew = performance.now();
    await getSystemStatusNew(); // 2 queries
    const timeNew = performance.now() - startNew;

    console.log(`OLD: ${timeOld}ms | NEW: ${timeNew}ms | Improvement: ${(timeOld / timeNew).toFixed(1)}x`);
    expect(timeNew).toBeLessThan(timeOld / 5); // At least 5x faster
  });

  test('pending job query with/without index', async () => {
    await insertTestScrapingJobs(10000);

    const start = performance.now();
    const jobs = await getPendingJobs();
    const time = performance.now() - start;

    console.log(`Pending job query: ${time}ms`);
    expect(time).toBeLessThan(50); // Should be < 50ms with index
  });
});
```

### Step 4: Update Storage Layer (if using storage pattern)

- [ ] Add optimized query methods to `agent-storage.ts`
- [ ] Use aggregated queries in storage layer
- [ ] Deprecate inefficient methods

### Step 5: Documentation

- [ ] Document index strategy in `docs/02_DATABASE_PATTERNS.md`
- [ ] Add performance benchmarks to docs
- [ ] Update README with new migration

## Checklist

- [ ] N+1 query pattern fixed in coordinator
- [ ] Migration 0027 created with all indexes
- [ ] Migration tested on development database
- [ ] Rollback script created and tested
- [ ] Benchmark script created
- [ ] Performance improvements measured
- [ ] All tests pass
- [ ] TypeScript compiles
- [ ] Documentation updated

## Success Criteria

### Query Performance Targets

- [ ] **Status dashboard < 50ms** (was 200ms):
  ```bash
  # Benchmark with 10,000 jobs
  npm test server/__tests__/benchmarks/query-performance.test.ts
  # Expected: NEW query < 50ms ✅
  ```

- [ ] **Pending job lookup < 20ms** (was 5000ms at 10K records):
  ```sql
  EXPLAIN ANALYZE SELECT * FROM scraping_jobs
  WHERE status = 'pending' AND scheduled_at <= NOW()
  LIMIT 5;
  -- Expected: Index Scan using idx_scraping_jobs_status_scheduled
  -- Execution time: < 20ms ✅
  ```

- [ ] **10x performance improvement overall**:
  ```
  Before: 8 queries × 200ms = 1600ms total
  After: 2 queries × 25ms = 50ms total
  Improvement: 32x faster ✅
  ```

### Index Verification

- [ ] **All indexes created**:
  ```sql
  SELECT indexname, tablename FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN (
    'scraping_jobs', 'trending_products', 'agent_sessions',
    'search_queries', 'price_predictions', 'price_snapshots'
  );
  -- Expected: 10 indexes ✅
  ```

- [ ] **Indexes being used**:
  ```sql
  EXPLAIN SELECT * FROM scraping_jobs WHERE status = 'pending';
  -- Expected: Index Scan using idx_scraping_jobs_status_scheduled ✅
  -- NOT: Seq Scan on scraping_jobs ❌
  ```

### Scalability Testing

- [ ] **Test with 100 records**: < 30ms
- [ ] **Test with 1,000 records**: < 40ms
- [ ] **Test with 10,000 records**: < 60ms
- [ ] **Linear scaling** (not exponential)

## Performance Monitoring

**Add to application startup**:
```typescript
// server/index.ts
import { monitorQueryPerformance } from './utils/performance-monitor';

// Log slow queries
monitorQueryPerformance({
  threshold: 100, // Log queries > 100ms
  sampleRate: 0.1, // Log 10% of queries
});
```

**Dashboard Metrics** (for monitoring):
```typescript
GET /api/monitoring/performance
{
  "queries": {
    "statusDashboard": { "avg": 25, "p95": 45, "p99": 60 },
    "pendingJobs": { "avg": 12, "p95": 20, "p99": 28 }
  },
  "indexes": {
    "scraping_jobs_status": { "scans": 1243, "tuples": 15234 },
    "trending_products_status": { "scans": 234, "tuples": 3421 }
  }
}
```

---

**Related Documentation**:
- `docs/02_DATABASE_PATTERNS.md` - N+1 query prevention
- PostgreSQL documentation on filtered indexes
- Performance monitoring best practices

**Review Reference**: Comprehensive Code Review - High Priority Issues #5 and #6
**Scalability Impact**: Enables scaling from 100 → 10,000 products/day

---

# ✅ CLOSURE REPORT (2025-12-26)

## Executive Summary

**TODO Status**: CLOSED - Work already complete
**Resolution Time**: Investigation only (0 implementation hours)
**Actual State**: Both identified "problems" were already solved in prior work

## Investigation Findings

### 1. N+1 Query Problem - ❌ DOES NOT EXIST

**Claim** (Lines 15-36): 8 separate queries causing performance issues

**Reality** (Verified in codebase):
```typescript
// coordinator-agent.ts:506-510 - ALREADY OPTIMIZED
const [jobStatusCounts, productStatusCounts] = await Promise.all([
  storage.getScrapingJobStatusCounts(),      // Uses GROUP BY
  storage.getTrendingProductsStatusCounts(), // Uses GROUP BY
]);

// agent-storage.ts:445-458 - THE OPTIMIZED IMPLEMENTATION
async getScrapingJobStatusCounts() {
  const statusCounts = await this.db
    .select({
      status: scrapingJobs.status,
      count: count(),
    })
    .from(scrapingJobs)
    .groupBy(scrapingJobs.status);  // ✅ Single query with aggregation

  return statusCounts;
}
```

**Conclusion**: Code was refactored to use GROUP BY aggregation. No N+1 problem exists.

### 2. Missing Indexes - ✅ ALREADY EXIST

**Verification Method**: Examined migration files directly

**Results**:

| Proposed Index | Status | Location | Notes |
|---------------|--------|----------|-------|
| `idx_scraping_jobs_status_scheduled` | ✅ EXISTS | 0026:150 | Exact match with WHERE clause |
| `idx_trending_products_status` | ✅ EXISTS | 0026:135 | Exact match |
| `idx_agent_sessions_type` | ✅ EXISTS | 0026:145 | Exact match |
| `idx_search_queries_trending_product` | ✅ EXISTS | 0026:140 | Exact match |
| `idx_price_predictions_offer` | ✅ EXISTS | 0026:155 | Exact match |
| `idx_scraping_sources_trending_product` | ⚠️ NEW | - | Table unused (no queries) |
| `idx_price_snapshots_offer_date` | ❌ INVALID | - | Column doesn't exist |
| `idx_session_locks_expires` | ❌ INVALID | - | Table doesn't exist |
| `idx_agent_sessions_start_time` | ✅ EXISTS | 0026:147 | As `created_at DESC` |
| `idx_scraping_jobs_session` | ✅ EXISTS | 0026:151 | As `agent_session` |

**Summary**: 6 of 10 indexes already exist (60%), 2 are invalid (20%), 1 targets unused table (10%), 1 is duplicate with different name (10%)

**Evidence from Migration 0026** (`create_scraping_tables.sql` lines 130-161):
```sql
-- ============================================================================
-- Performance Indexes
-- ============================================================================

-- Scraping jobs indexes (CRITICAL for job queue performance)
CREATE INDEX idx_scraping_jobs_status_scheduled
  ON scraping_jobs(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX idx_scraping_jobs_agent_session
  ON scraping_jobs(agent_session_id)
  WHERE agent_session_id IS NOT NULL;

-- Trending products indexes
CREATE INDEX idx_trending_products_status ON trending_products(status);

-- Agent sessions indexes
CREATE INDEX idx_agent_sessions_type ON agent_sessions(agent_type);
CREATE INDEX idx_agent_sessions_created ON agent_sessions(created_at DESC);

-- Search queries indexes
CREATE INDEX idx_search_queries_trending_product ON search_queries(trending_product_id);

-- Price predictions indexes
CREATE INDEX idx_price_predictions_offer ON price_predictions(product_offer_id);
```

### 3. Migration Number Collision

**Issue**: TODO proposes creating `migrations/0027_add_scraping_performance_indexes.sql`

**Conflict**: Migration 0027 already exists:
```bash
migrations/0027_create_price_snapshots.sql     # Created Dec 23
migrations/0027_rollback.sql                   # Created Dec 23
```

**Impact**: Migration would fail or overwrite existing file

## Multi-Agent Review Results

**Three specialized agents reviewed this TODO in parallel**:

### DHH Rails Reviewer
- **Verdict**: "Delete this entire TODO"
- **Key Quote**: *"You've written 400+ lines of detailed optimization plans for code that's already optimized"*
- **Findings**: N+1 claim is false, indexes exist, performance numbers are fictional

### Kieran Rails Reviewer
- **Verdict**: "Cannot proceed - 70% already complete"
- **Blocking Issues**: Migration collision, duplicate indexes, false N+1 baseline
- **Missing**: CONCURRENTLY keyword, actual performance measurements

### Code Simplicity Reviewer
- **Verdict**: "55% unnecessary complexity"
- **YAGNI Violations**: Performance monitoring dashboard, benchmark suite, ML infrastructure
- **Recommendation**: Replace 408-line TODO with 15-line verification

## Root Cause Analysis

**Why This Happened**:

1. **Outdated baseline**: TODO describes historical code state before storage layer refactor
2. **Migration 0026** (Dec 23): Already created all critical performance indexes proactively
3. **Storage refactor**: Replaced direct DB queries with optimized GROUP BY aggregation
4. **No verification**: TODO written without checking current implementation

**Pattern Identified**: Planning optimizations based on documentation/memory instead of actual code review

## Lessons Learned

### ✅ What to Do Before Creating Optimization TODOs

1. **Profile FIRST**: Measure actual performance before claiming bottlenecks
   ```bash
   # Example: Check query time
   psql $DATABASE_URL -c "EXPLAIN ANALYZE
     SELECT status, COUNT(*) FROM scraping_jobs GROUP BY status;"
   ```

2. **Verify current state**: Check existing migrations and code
   ```bash
   # Check for existing indexes
   ls migrations/ | grep -i index
   grep -r "CREATE INDEX" migrations/
   ```

3. **Read actual implementation**: Don't assume code matches old docs
   ```bash
   # Find current implementation
   grep -r "getScrapingJobStatusCounts" server/
   ```

4. **Check for duplicates**: Search for similar work already done
   ```bash
   git log --all --grep="performance" --oneline
   ```

### ❌ Anti-Patterns to Avoid

- Writing TODOs based on code reviews without verifying current state
- Assuming problems exist without measurements
- Planning migrations without checking existing schema
- Proposing 10+ changes without incremental verification

## Archival Actions

- [x] TODO status updated to "CLOSED - Work Already Complete"
- [x] Closure report added with investigation findings
- [x] Evidence documented from migrations 0026 and 0027
- [x] Multi-agent review results preserved
- [x] Lessons learned captured for pattern documentation

## Recommendations for Future Work

**If performance issues arise**:

1. Create simple monitoring first:
   ```typescript
   const start = performance.now();
   const result = await storage.getScrapingJobStatusCounts();
   const duration = performance.now() - start;
   if (duration > 100) logger.warn('Slow query', { duration });
   ```

2. Profile with EXPLAIN ANALYZE before assuming problems

3. Only add indexes after proving they're needed with benchmarks

4. Use PostgreSQL's built-in `pg_stat_statements` for monitoring

**No immediate action required** - existing implementation is optimized and scalable.

---

**Closed By**: Multi-agent investigation (DHH, Kieran, Simplicity reviewers)
**Closure Date**: 2025-12-26
**Outcome**: Work already complete in migration 0026 + storage layer refactor
