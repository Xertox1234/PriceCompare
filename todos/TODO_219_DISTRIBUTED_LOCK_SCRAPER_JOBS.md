# TODO 219: Missing Distributed Lock for Concurrent Scraper Jobs

**Priority**: P2 - MEDIUM
**File(s)**: `server/jobs/price-scraper-job.ts`, `server/services/job-lock-service.ts`
**Estimated Time**: 45 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

The same URL can be scraped simultaneously by multiple workers, causing:

1. **Wasted resources**: Multiple browsers scraping the same page
2. **Rate limit abuse**: Hitting retailer rate limits faster
3. **Duplicate data**: Same price recorded multiple times
4. **Anti-bot triggers**: Rapid repeated requests from same IP

**Operational Impact**: Inefficient resource usage, potential IP bans, inconsistent data.

## Root Cause

No distributed locking mechanism to prevent concurrent scraping of the same URL across multiple job workers.

## Solution Approach

1. Use Redis-based distributed locks
2. Acquire lock before starting scrape
3. Skip job if lock already held (another worker is scraping)
4. Release lock after scrape completes (or on timeout)

## Implementation Steps

### Step 1: Verify Job Lock Service Exists

- [ ] Check if `server/services/job-lock-service.ts` already exists
- [ ] If not, create Redis-based distributed lock service
- [ ] Implement `withLock()` wrapper function

### Step 2: Apply Locking to Scraper Jobs

- [ ] Generate lock key from URL (normalized)
- [ ] Acquire lock before scraping
- [ ] Skip gracefully if lock held by another worker
- [ ] Release lock in finally block

### Step 3: Configure Lock TTL

- [ ] Set appropriate TTL (5 minutes for typical scrape)
- [ ] Handle lock expiration for long-running scrapes
- [ ] Add lock extension for very slow pages

### Step 4: Add Tests

- [ ] Test concurrent jobs for same URL
- [ ] Test lock release on success
- [ ] Test lock release on failure
- [ ] Test lock timeout/expiration

## Technical Details

**Current Implementation (NO LOCKING):**
```typescript
export async function processPriceScrapeJob(job: Job<PriceScrapeData>) {
  const { productId, url } = job.data;
  
  // ❌ No lock - same URL can be scraped by multiple workers
  const result = await scrapeProductPrice(url);
  await storage.savePriceHistory(productId, result.price);
}
```

**Job Lock Service (if not exists):**
```typescript
// server/services/job-lock-service.ts
import { redisClient } from '../redis';

export interface LockOptions {
  ttlSeconds: number;
  retryDelayMs?: number;
  maxRetries?: number;
}

class JobLockService {
  private readonly prefix = 'lock:';
  
  /**
   * Execute function with distributed lock
   * Returns null if lock could not be acquired
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T | null> {
    const lockKey = this.prefix + key;
    const lockValue = `${process.pid}:${Date.now()}`;
    
    // Try to acquire lock with NX (only if not exists)
    const acquired = await redisClient.set(lockKey, lockValue, {
      NX: true,
      EX: ttlSeconds,
    });
    
    if (!acquired) {
      // Lock held by another worker
      return null;
    }
    
    try {
      return await fn();
    } finally {
      // Release lock (only if we still own it)
      await this.releaseLock(lockKey, lockValue);
    }
  }
  
  /**
   * Release lock only if we own it (Lua script for atomicity)
   */
  private async releaseLock(key: string, expectedValue: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redisClient.eval(script, {
      keys: [key],
      arguments: [expectedValue],
    });
    
    return result === 1;
  }
  
  /**
   * Extend lock TTL (for long-running operations)
   */
  async extendLock(key: string, additionalSeconds: number): Promise<boolean> {
    const lockKey = this.prefix + key;
    const result = await redisClient.expire(lockKey, additionalSeconds);
    return result === 1;
  }
  
  /**
   * Check if lock is held
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.prefix + key;
    const exists = await redisClient.exists(lockKey);
    return exists === 1;
  }
}

export const jobLockService = new JobLockService();
```

**Fixed Job Implementation:**
```typescript
// server/jobs/price-scraper-job.ts
import { jobLockService } from '../services/job-lock-service';
import { logger } from '../utils/logger';

// Normalize URL for consistent lock keys
function normalizeUrlForLock(url: string): string {
  const parsed = new URL(url);
  // Remove tracking params, normalize case
  parsed.searchParams.delete('utm_source');
  parsed.searchParams.delete('utm_medium');
  parsed.searchParams.delete('ref');
  return parsed.toString().toLowerCase();
}

export async function processPriceScrapeJob(job: Job<PriceScrapeData>) {
  const { productId, url } = job.data;
  const lockKey = `scrape:${normalizeUrlForLock(url)}`;
  
  // ✅ Acquire distributed lock before scraping
  const result = await jobLockService.withLock(
    lockKey,
    async () => {
      logger.info({ jobId: job.id, productId, url }, 'Starting price scrape');
      
      const scraped = await withRetry(
        () => scrapeProductPrice(url),
        { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000 }
      );
      
      await storage.savePriceHistory(productId, scraped.price);
      
      return scraped;
    },
    300 // 5 minute TTL
  );
  
  if (result === null) {
    // Lock held by another worker - skip this job
    logger.info(
      { jobId: job.id, productId, url },
      'Scrape already in progress on another worker, skipping'
    );
    return; // Job completes successfully (no retry needed)
  }
  
  logger.info(
    { jobId: job.id, productId, price: result.price },
    'Price scrape completed successfully'
  );
}
```

**Bull Queue Deduplication (Alternative/Complementary):**
```typescript
// Prevent duplicate jobs from being added to queue
const priceScraperQueue = new Queue('price-scraper', {
  defaultJobOptions: {
    // Use URL as job ID to prevent duplicates in queue
    jobId: (data) => `scrape:${normalizeUrlForLock(data.url)}`,
  },
});

// When adding jobs, duplicates are automatically rejected
await priceScraperQueue.add('scrape', { productId, url }, {
  jobId: `scrape:${normalizeUrlForLock(url)}`,
});
```

## Checklist

- [ ] Job lock service exists/created
- [ ] Scraper jobs use distributed locks
- [ ] Lock key derived from normalized URL
- [ ] Graceful skip when lock held
- [ ] Lock released on success and failure
- [ ] Tests verify locking behavior

## Success Criteria

- [ ] Same URL not scraped concurrently by multiple workers
- [ ] Jobs skip gracefully when lock held (no error)
- [ ] Locks released after scrape completes
- [ ] Locks expire if worker crashes (TTL)
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Lock not released on crash | Low | Medium | TTL ensures eventual release |
| Lock TTL too short | Medium | Low | Use generous TTL (5 min), extend if needed |
| Redis unavailable | Low | High | Fallback to in-memory lock (single server) |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm locking is implemented
  ```bash
  # Verify withLock is used in scraper jobs
  grep -n "withLock" server/jobs/price-scraper-job.ts
  
  # Verify job lock service exists
  ls server/services/job-lock-service.ts
  
  # Verify lock key includes URL
  grep -n "lockKey" server/jobs/price-scraper-job.ts
  ```

- [ ] **File inspection**: Review locking implementation
  ```bash
  cat server/services/job-lock-service.ts
  grep -A 20 "withLock" server/jobs/price-scraper-job.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute job locking tests
  ```bash
  npm test -- job-lock
  npm test -- price-scraper-job
  ```

- [ ] **Concurrent job test**: Verify locking prevents duplicates
  ```bash
  # Add same URL to queue twice simultaneously
  # Only one should actually scrape, other should skip
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
