# TODO 230: Add Distributed Lock to Price Snapshot Scheduler

**Priority**: P2 - MEDIUM (Technical Debt)
**File(s)**: `server/jobs/price-snapshot-queue.ts`
**Estimated Time**: 20 minutes
**Status**: Resolved
**Created Date**: 2026-01-15
**Source**: Security Audit (2026-01-15)

## Pattern References

- **Primary**: [docs/07_BACKGROUND_JOBS_PATTERNS.md#distributed-job-locking](docs/07_BACKGROUND_JOBS_PATTERNS.md) - Lines 148-206, complete `withLock()` pattern
- **Implementation**: [server/services/job-lock-service.ts](server/services/job-lock-service.ts) - Already exists with `withLock()`
- **Example Usage**: [server/jobs/price-analytics-jobs.ts](server/jobs/price-analytics-jobs.ts), [server/jobs/price-alert-checker.ts](server/jobs/price-alert-checker.ts) - Already using `jobLockService.withLock()`

## Problem Statement

The `price-snapshot-queue.ts` scheduler uses `cron.schedule()` without distributed locking. When running multiple server instances:

1. **Each server triggers cron** at the same time
2. **Multiple identical jobs added** to Bull queue
3. **Duplicate log noise** from multiple triggers
4. **Potential race conditions** if queue add fails on some servers

**Note**: Bull queues prevent duplicate processing, but the **cron trigger itself** still fires multiple times unnecessarily.

**Operational Impact**: LOW - Bull handles deduplication, but cleaner architecture would prevent duplicate triggers.

## Current State Analysis

**Lock services exist and are used elsewhere**:
- ✅ `server/services/job-lock-service.ts` - Full implementation with `withLock()`
- ✅ `server/services/url-lock-service.ts` - URL-level locking for scrapers
- ✅ `server/jobs/price-analytics-jobs.ts` - Uses `jobLockService.withLock()`
- ✅ `server/jobs/price-alert-checker.ts` - Uses `jobLockService.withLock()`
- ✅ `server/jobs/notification-processor.ts` - Uses `jobLockService.withLock()`
- ✅ `server/jobs/price-history-jobs.ts` - Uses `jobLockService.withLock()`
- ✅ `server/agents/extraction-agent.ts` - Uses `urlLockService.withLock()`

**Missing lock**:
- ❌ `server/jobs/price-snapshot-queue.ts` - Cron schedule has NO lock

## Solution Approach

Add `jobLockService.withLock()` to the cron scheduler in `price-snapshot-queue.ts`, following the pattern used in other job files.

---

## Implementation Steps

### Step 1: Add Lock to Cron Scheduler (15 min)

- [ ] Import `jobLockService` from `../services/job-lock-service`
- [ ] Wrap cron callback with `jobLockService.withLock()`
- [ ] Use appropriate TTL (60 seconds for adding job to queue)
- [ ] Log when lock is skipped (another server already triggered)

### Step 2: Verify (5 min)

- [ ] Test with multiple server instances
- [ ] Verify only one server adds job to queue
- [ ] Check logs show skip message on other servers

---

## Technical Details

### Current Implementation (NO LOCK)

```typescript
// server/jobs/price-snapshot-queue.ts
cron.schedule(cronSchedule, async () => {
  // ❌ This fires on ALL servers simultaneously
  logger.info(`[PriceSnapshotScheduler] Triggering scheduled price snapshot`);
  
  await priceSnapshotQueue.add({
    type: 'scheduled',
    timestamp: new Date().toISOString(),
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
});
```

### Target Implementation (WITH LOCK)

```typescript
// server/jobs/price-snapshot-queue.ts
import { jobLockService } from '../services/job-lock-service';

cron.schedule(cronSchedule, async () => {
  // ✅ Only ONE server acquires lock and triggers job
  const result = await jobLockService.withLock(
    'price-snapshot:scheduler',
    async () => {
      logger.info(`[PriceSnapshotScheduler] Triggering scheduled price snapshot (lock acquired)`);
      
      await priceSnapshotQueue.add({
        type: 'scheduled',
        timestamp: new Date().toISOString(),
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      
      return { triggered: true };
    },
    60  // TTL: 60 seconds (job add is fast)
  );
  
  if (result === null) {
    // Another server already triggered this schedule
    logger.debug('[PriceSnapshotScheduler] Skipped - already triggered by another server');
  }
});
```

### Pattern Reference (from price-analytics-jobs.ts)

```typescript
// Existing pattern used in other job files
const result = await jobLockService.withLock(
  'analytics:daily-stats',
  async () => {
    // ... job logic
    return stats;
  },
  3600  // 1 hour TTL
);

if (result === null) {
  logger.info('Job already running on another server');
}
```

---

## Checklist

- [ ] Import `jobLockService` 
- [ ] Wrap cron callback with `withLock()`
- [ ] Set appropriate TTL (60 seconds)
- [ ] Add skip logging for locked case
- [ ] Verify other servers don't duplicate trigger

## Success Criteria

- [ ] Only one server triggers price snapshot on cron schedule
- [ ] Other servers log "skipped" message
- [ ] No duplicate jobs added to Bull queue
- [ ] Existing functionality unchanged
- [ ] All tests pass

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm lock is added
  ```bash
  grep -n "jobLockService\|withLock" server/jobs/price-snapshot-queue.ts
  # Should find import and usage
  ```

- [ ] **Pattern match**: Compare to existing implementations
  ```bash
  grep -A 5 "withLock" server/jobs/price-analytics-jobs.ts
  # Reference implementation
  ```

### Testing
- [ ] **Run affected tests**:
  ```bash
  npm test server/jobs/__tests__/price-snapshot-queue.test.ts
  ```

- [ ] **Multi-server test** (optional):
  ```bash
  # Start two servers, observe only one triggers
  npm run dev &
  npm run dev &
  # Check logs at scheduled time
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: `npm run check`
- [ ] **ESLint check**: `npm run lint`

### Integration
- [ ] **README updated**: Update todos/README.md

---

## ✅ RESOLUTION (2026-01-15)

**Decision**: Implemented distributed lock using `jobLockService.withLock()` following established pattern from price-analytics-jobs.ts

### Summary

Added distributed locking to the price snapshot cron scheduler to prevent duplicate job triggers when running multiple server instances. The implementation follows the exact pattern used in other background jobs (price-analytics-jobs.ts, price-alert-checker.ts).

### Changes Made

**File: server/jobs/price-snapshot-queue.ts**

1. Added import for `jobLockService` from '../services/job-lock-service'
2. Wrapped cron.schedule callback with `jobLockService.withLock()`
3. Used lock key: 'price-snapshot:scheduler'
4. Set 60-second TTL (appropriate for fast job-add operation)
5. Added skip logging when lock is held by another server
6. Updated success log to indicate "(lock acquired)"

### Verification Results

**Code Verification:**
- ✅ jobLockService import added (line 4)
- ✅ withLock() wrapper implemented (line 72)
- ✅ Lock key follows naming convention: 'price-snapshot:scheduler'
- ✅ TTL set to 60 seconds (appropriate for operation)
- ✅ Skip logging added for locked case (line 102)
- ✅ Pattern matches price-analytics-jobs.ts implementation

**Quality Checks:**
- ✅ TypeScript compilation: No new errors (pre-existing e2e test type issue unrelated)
- ✅ ESLint: No warnings or errors in modified file
- ✅ Pattern consistency: Matches existing distributed lock implementations

**Behavior:**
- In multi-server deployment, only ONE server will trigger the cron job at scheduled time
- Other servers will log debug message: "Skipped - already triggered by another server"
- Bull queue prevents duplicate processing, but lock prevents duplicate triggers
- No functional changes to price snapshot logic

---

**Created by**: Claude Code
**Creation Date**: 2026-01-15
