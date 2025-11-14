# Distributed Locking Testing Guide

**Date:** 2025-11-14
**Feature:** Distributed Lock Service for Horizontal Scaling
**Status:** ✅ IMPLEMENTED

---

## Overview

This document provides comprehensive testing instructions for the distributed locking implementation. The distributed lock service ensures that multiple instances of the PriceCompare application can run in parallel without duplicate job processing.

---

## What Was Implemented

### 1. Distributed Lock Service (`server/services/distributed-lock.ts`)
- Redis-based distributed locking with SET NX
- Automatic lock renewal for long-running tasks
- Atomic lock release using Lua scripts
- Comprehensive metrics tracking
- Graceful error handling and failover

### 2. Job Processing Integration (`server/agents/coordinator-agent.ts`)
- Lock acquisition before job processing
- Automatic lock release after completion
- Skip jobs already locked by other instances
- 60-second TTL with automatic renewal

### 3. Monitoring Integration
- Lock metrics in dashboard
- Success rate tracking
- Contention monitoring
- Average acquisition time
- Active locks count

---

## Testing Scenarios

### Test 1: Single Instance Verification

**Objective:** Verify locks work correctly with a single instance

**Steps:**
1. Start Redis:
   ```bash
   docker-compose up -d redis
   ```

2. Start the application:
   ```bash
   npm run dev
   ```

3. Navigate to `/monitoring` dashboard (admin access required)

4. Create some jobs (via discovery or search agents)

5. **Verify:**
   - Jobs process successfully
   - Lock metrics show 100% success rate
   - Active locks count increments during processing
   - Locks are released after job completion

**Expected Results:**
- ✅ Lock acquisition attempts = Lock acquisitions succeeded
- ✅ Lock acquisitions failed = 0
- ✅ Active locks return to 0 after jobs complete
- ✅ Avg acquisition time < 50ms

---

### Test 2: Multi-Instance Duplicate Prevention

**Objective:** Verify multiple instances don't process the same job

**Steps:**
1. Start Redis:
   ```bash
   docker-compose up -d redis
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. Start **Instance 1** on port 5000:
   ```bash
   PORT=5000 npm start
   ```

4. In a **new terminal**, start **Instance 2** on port 5001:
   ```bash
   PORT=5001 npm start
   ```

5. In a **new terminal**, start **Instance 3** on port 5002:
   ```bash
   PORT=5002 npm start
   ```

6. Monitor all instances:
   - Open monitoring dashboard on each: `http://localhost:5000/monitoring`, `http://localhost:5001/monitoring`, `http://localhost:5002/monitoring`
   - Watch the logs in each terminal

7. Create a batch of 50+ jobs (use admin panel or API)

8. **Verify:**
   - Check each instance's logs for "already being processed by another instance" messages
   - Verify no job is processed twice (check database)
   - Confirm jobs are distributed across instances
   - Check lock contention rate on dashboards

**Expected Results:**
- ✅ Each job processed exactly once
- ✅ Jobs distributed across all 3 instances
- ✅ Lock acquisition failures increase (this is good - indicates contention is working)
- ✅ Overall success rate remains high (>95%)
- ✅ No duplicate job results in database

**SQL Query to Check for Duplicates:**
```sql
SELECT
  id,
  job_type,
  status,
  started_at,
  completed_at,
  COUNT(*) OVER (PARTITION BY id) as duplicate_count
FROM scraping_jobs
WHERE duplicate_count > 1;
```
Should return 0 rows.

---

### Test 3: Lock Expiration and Renewal

**Objective:** Verify locks don't expire for long-running jobs

**Steps:**
1. Create a job that takes >30 seconds (modify code temporarily or use a slow external API)

2. Start the application and process the long job

3. Monitor Redis:
   ```bash
   redis-cli
   > KEYS lock:*
   > TTL lock:job:123  # Replace with actual job ID
   ```

4. **Verify:**
   - Lock TTL is refreshed every ~30 seconds (half of 60s TTL)
   - Job completes successfully
   - Lock is released after completion

**Expected Results:**
- ✅ Lock TTL never drops below 30 seconds during processing
- ✅ Lock is renewed automatically
- ✅ Job completes successfully
- ✅ Lock is deleted after completion

---

### Test 4: Lock Release on Failure

**Objective:** Verify locks are released even when jobs fail

**Steps:**
1. Create a job that will intentionally fail (e.g., invalid targetData)

2. Process the job

3. Check Redis:
   ```bash
   redis-cli
   > KEYS lock:*
   ```

4. **Verify:**
   - Lock is released even though job failed
   - Failed job is marked as 'failed' in database
   - Lock metrics reflect the failed acquisition properly

**Expected Results:**
- ✅ No orphaned locks in Redis
- ✅ Job status = 'failed' in database
- ✅ Retry count incremented
- ✅ Lock released in finally block

---

### Test 5: Redis Disconnection Graceful Degradation

**Objective:** Verify system behavior when Redis is unavailable

**Steps:**
1. Start application with Redis running

2. Process some jobs successfully

3. Stop Redis:
   ```bash
   docker-compose stop redis
   ```

4. Try to process new jobs

5. **Verify:**
   - Application logs error: "Distributed Lock: Failed to connect to Redis"
   - Jobs fail to acquire locks
   - Application continues running (doesn't crash)
   - Metrics show lock acquisition failures

6. Restart Redis:
   ```bash
   docker-compose start redis
   ```

7. **Verify:**
   - Lock service reconnects automatically
   - Jobs resume processing
   - Lock metrics return to normal

**Expected Results:**
- ✅ No application crash when Redis unavailable
- ✅ Clear error logging
- ✅ Automatic reconnection when Redis returns
- ✅ Lock acquisition failures = 100% while Redis down

---

### Test 6: High Contention Stress Test

**Objective:** Test lock performance under high contention

**Steps:**
1. Start 5 application instances (ports 5000-5004)

2. Create 500 jobs simultaneously

3. Monitor:
   - Lock contention rate on dashboard
   - Average acquisition time
   - Lock success rate
   - Total processing time

4. **Verify:**
   - All 500 jobs complete
   - No duplicates
   - Acceptable performance degradation

**Expected Results:**
- ✅ Lock success rate > 90%
- ✅ Contention rate < 20%
- ✅ Avg acquisition time < 500ms
- ✅ All jobs processed exactly once
- ✅ Processing time scales with instance count

**Performance Benchmark:**
| Instances | Jobs | Expected Time | Max Contention |
|-----------|------|---------------|----------------|
| 1         | 100  | ~10 min       | 0%             |
| 3         | 100  | ~3-4 min      | <10%           |
| 5         | 500  | ~10-15 min    | <20%           |

---

### Test 7: Lock Metrics Accuracy

**Objective:** Verify lock metrics are tracked correctly

**Steps:**
1. Reset lock metrics (restart application)

2. Process exactly 10 jobs

3. Check metrics on dashboard:
   ```
   acquisitionAttempts: should be 10
   acquisitionsSucceeded: should be 10
   acquisitionsFailed: should be 0
   locksReleased: should be 10
   activeLocks: should be 0 (after all complete)
   ```

4. Run 2 instances and process 20 jobs

5. **Verify:**
   - Combined metrics across both instances = 20 acquisitions
   - Some acquisition failures due to contention
   - Success rate calculation is accurate

**Expected Results:**
- ✅ Metrics match actual job processing
- ✅ Contention rate = failures / attempts
- ✅ Success rate = successes / attempts
- ✅ Active locks accurate in real-time

---

## Debugging Commands

### Check Redis Locks
```bash
# Connect to Redis CLI
redis-cli

# List all locks
KEYS lock:*

# Check specific lock
GET lock:job:123
TTL lock:job:123

# Delete specific lock (for testing)
DEL lock:job:123

# Delete all locks (DANGER: only for testing)
KEYS lock:* | xargs redis-cli DEL
```

### Check Application Logs
```bash
# Search for lock-related logs
grep "Lock acquired" logs/app.log
grep "Lock released" logs/app.log
grep "already being processed" logs/app.log
grep "Failed to acquire lock" logs/app.log
```

### Check Database Job Status
```sql
-- Check job processing status
SELECT
  job_type,
  status,
  COUNT(*) as count
FROM scraping_jobs
GROUP BY job_type, status;

-- Check for jobs stuck in 'running' state
SELECT *
FROM scraping_jobs
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '5 minutes';

-- Check job processing timeline
SELECT
  id,
  job_type,
  status,
  created_at,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM scraping_jobs
WHERE completed_at IS NOT NULL
ORDER BY completed_at DESC
LIMIT 20;
```

---

## Common Issues & Solutions

### Issue 1: High Lock Contention Rate (>30%)

**Symptoms:**
- Lock contention badge shows yellow/red
- Many "already being processed" log messages
- Slow job processing

**Solutions:**
- Increase number of instances (more workers = less contention per instance)
- Reduce lock retry attempts in code
- Increase job batch sizes
- Optimize job processing time

---

### Issue 2: Orphaned Locks

**Symptoms:**
- Locks remain in Redis after jobs complete
- `KEYS lock:*` shows many old locks
- Dashboard shows high "active locks" count

**Solutions:**
```bash
# Check lock TTL
redis-cli TTL lock:job:123

# If TTL is -1 (no expiration), delete manually
redis-cli DEL lock:job:123

# Verify lock renewal is working in code
```

**Prevention:**
- Always use try-finally blocks for lock release
- Ensure TTL is set on lock acquisition
- Monitor lock renewal intervals

---

### Issue 3: Application Can't Connect to Redis

**Symptoms:**
- Error: "Failed to connect to Redis after 3 attempts"
- Lock acquisitions fail
- Application continues but jobs don't process

**Solutions:**
1. Verify Redis is running:
   ```bash
   docker-compose ps redis
   docker-compose logs redis
   ```

2. Check Redis connection string in `.env`:
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

3. Test Redis connectivity:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

---

## Success Criteria

✅ **All tests pass with the following metrics:**

| Metric | Target | Critical |
|--------|--------|----------|
| Lock Success Rate | >95% | >90% |
| Lock Contention Rate | <15% | <30% |
| Avg Acquisition Time | <100ms | <500ms |
| Duplicate Jobs | 0 | 0 |
| Orphaned Locks | 0 | <5 |
| Application Uptime | 99.9% | 99% |

---

## Next Steps After Testing

1. ✅ Run all 7 test scenarios
2. ✅ Document any issues found
3. ✅ Verify metrics meet success criteria
4. ✅ Load test with realistic job volumes
5. ✅ Review logs for any errors or warnings
6. 📝 Create production deployment guide
7. 🚀 Deploy to staging environment
8. 📊 Monitor for 24 hours
9. 🎯 Deploy to production

---

## References

- **Implementation File:** `server/services/distributed-lock.ts`
- **Integration File:** `server/agents/coordinator-agent.ts`
- **Monitoring Dashboard:** `/monitoring` (admin access)
- **Redis Documentation:** https://redis.io/commands/set
- **Lock Pattern:** https://redis.io/docs/manual/patterns/distributed-locks/

---

**Last Updated:** 2025-11-14
**Version:** 1.0
**Status:** Ready for Testing
