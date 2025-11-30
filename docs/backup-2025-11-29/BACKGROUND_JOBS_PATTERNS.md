---
Pattern: Background Jobs Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [DATABASE_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md]
---

# Background Jobs Patterns

This document codifies patterns for background jobs, scheduled tasks, and asynchronous processing to ensure reliability, safety, and maintainability.

## Table of Contents
- [Rate Limiting in Jobs](#rate-limiting-in-jobs)
- [Distributed Job Locking](#distributed-job-locking)
- [Job Safety Patterns](#job-safety-patterns)
- [Error Handling in Jobs](#error-handling-in-jobs)
- [TODO vs NOTE Comments](#todo-vs-note-comments)
- [Monitoring and Observability](#monitoring-and-observability)

---

## Rate Limiting in Jobs

Background jobs MUST have circuit breakers to prevent spam if logic malfunctions or becomes overly aggressive.

### ❌ WRONG - No Rate Limiting

```typescript
// THIS IS DANGEROUS!
async function processSmartNotifications() {
  const users = await storage.getAllActiveUsers();

  for (const user of users) {
    const triggers = await smartAlerts.evaluateUserTriggers(user.id);

    // No limit! If urgency logic has a bug and flags everything as urgent,
    // this could send 1000+ notifications to a single user
    for (const trigger of triggers) {
      await notificationService.send({
        userId: user.id,
        type: 'smart_alert',
        content: trigger.message,
      });
    }
  }
}
```

**Problems:**
- Bug in urgency detection → 500 notifications sent to one user
- Database table scanned incorrectly → all products flagged
- User receives notification spam, unsubscribes, leaves platform
- Email provider flags account for spam
- WebSocket connections overwhelmed

### ✅ CORRECT - Per-Run Circuit Breaker

```typescript
// server/jobs/smart-notification-processor.ts
async function processSmartNotifications() {
  const users = await storage.getAllActiveUsers();
  const MAX_PER_USER_PER_RUN = 5;  // Safety valve!

  for (const user of users) {
    const preferences = await storage.getNotificationPreferences(user.id);

    // Respect user preferences
    if (!preferences.smartAlertsEnabled) {
      continue;
    }

    const triggers = await smartAlerts.evaluateUserTriggers(user.id);
    let sentThisRun = 0;

    for (const trigger of triggers) {
      // Circuit breaker - NEVER send more than 5 per run
      if (sentThisRun >= MAX_PER_USER_PER_RUN) {
        log.debug(`Reached per-run limit for user ${user.id}`, {
          skipped: triggers.length - sentThisRun,
        });
        break;  // Stop processing for this user
      }

      await notificationService.send({
        userId: user.id,
        type: 'smart_alert',
        priority: trigger.urgencyScore,
        content: trigger.message,
      });

      sentThisRun++;
    }

    log.info(`Processed notifications for user ${user.id}`, {
      evaluated: triggers.length,
      sent: sentThisRun,
    });
  }
}

// Run every 15 minutes
schedule('*/15 * * * *', processSmartNotifications);
```

**Benefits:**
- Even with buggy logic, maximum 5 notifications per user per 15 minutes
- User gets 20 notifications/hour max instead of 1000+
- Gives time to detect and fix bugs before major damage
- Logs show when limit is hit (debugging signal)

### Multi-Layer Rate Limiting

For critical notification systems, implement multiple safety layers:

```typescript
async function sendNotification(notification: Notification) {
  const userId = notification.userId;

  // Layer 1: Per-run limit (in-memory, fast)
  if (sentThisRun >= MAX_PER_RUN) {
    log.warn('Per-run limit reached', { userId });
    return;
  }

  // Layer 2: Hourly limit (Redis)
  const hourlyKey = `notifications:hourly:${userId}`;
  const hourlyCount = await redis.incr(hourlyKey);
  await redis.expire(hourlyKey, 3600);  // 1 hour TTL

  if (hourlyCount > 20) {
    log.warn('Hourly limit reached', { userId, count: hourlyCount });
    return;
  }

  // Layer 3: Daily limit (database check)
  const dailyCount = await storage.getNotificationCount(userId, {
    since: startOfDay(new Date()),
  });

  if (dailyCount > 50) {
    log.warn('Daily limit reached', { userId, count: dailyCount });
    return;
  }

  // All limits passed - send notification
  await notificationService.send(notification);
  sentThisRun++;
}
```

### Detection Rule
```bash
# Find jobs that send notifications without rate limiting
grep -r "notificationService.send" server/jobs/ | xargs grep -L "MAX_PER"
grep -r "emailService.send" server/jobs/ | xargs grep -L "limit"
```

---

## Distributed Job Locking

Jobs running on multiple servers MUST use distributed locks to prevent duplicate execution.

### ❌ WRONG - No Locking (Duplicate Execution)

```typescript
// THIS WILL RUN MULTIPLE TIMES if you have multiple servers!
cron.schedule('0 2 * * *', async () => {
  // If 3 servers are running, this runs 3x
  // → Price snapshots taken 3x
  // → Database writes duplicated
  // → External API calls tripled
  await performDailyPriceSnapshot();
});
```

### ✅ CORRECT - Distributed Lock

```typescript
import { jobLockService } from '../services/job-lock-service';

cron.schedule('0 2 * * *', async () => {
  const result = await jobLockService.withLock(
    'price-snapshot:daily',
    async () => {
      log.info('Starting daily price snapshot (lock acquired)');
      const stats = await performDailyPriceSnapshot();
      log.info('Daily price snapshot completed', stats);
      return stats;
    },
    3600  // TTL: 1 hour (job should complete in < 1 hour)
  );

  if (result === null) {
    // Lock was held by another server - this is normal
    log.info('Price snapshot already running on another server');
  }
});
```

### Lock Implementation Pattern

```typescript
// server/services/job-lock-service.ts
export class JobLockService {
  async withLock<T>(
    lockKey: string,
    task: () => Promise<T>,
    ttl: number = 300
  ): Promise<T | null> {
    const lockValue = crypto.randomUUID();
    const fullKey = `lock:${lockKey}`;

    try {
      // Acquire lock (only one server succeeds)
      const acquired = await redis.set(
        fullKey,
        lockValue,
        'EX', ttl,
        'NX'  // Only set if not exists
      );

      if (!acquired) {
        // Another server holds the lock
        return null;
      }

      // Execute task with lock held
      const result = await task();

      // Release lock (only if we still own it)
      await this.releaseLock(fullKey, lockValue);

      return result;
    } catch (error) {
      // Ensure lock is released even on error
      await this.releaseLock(fullKey, lockValue);
      throw error;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    // Use Lua script to atomically check and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, key, value);
  }
}
```

### When to Use Distributed Locks

**Use locks for:**
- Scheduled jobs (cron, recurring tasks)
- Jobs that modify global state
- Jobs that call rate-limited external APIs
- Jobs that should run exactly once per interval
- Data imports/exports

**Don't need locks for:**
- User-triggered actions (each user gets their own job)
- Jobs that are naturally idempotent
- Read-only analytics jobs (multiple runs don't matter)

---

## Job Safety Patterns

### Graceful Degradation

Jobs should handle failures gracefully and continue processing other items.

```typescript
async function processProductPriceUpdates() {
  const products = await storage.getActiveProducts();
  let succeeded = 0;
  let failed = 0;

  for (const product of products) {
    try {
      await updateProductPrices(product.id);
      succeeded++;
    } catch (error) {
      // Log error but continue processing
      log.error(`Failed to update prices for product ${product.id}`, error);
      failed++;

      // Optionally: store failure for retry
      await storage.recordFailedPriceUpdate(product.id, error);
    }
  }

  log.info('Price update job completed', {
    total: products.length,
    succeeded,
    failed,
  });

  // Alert if failure rate is high
  if (failed > products.length * 0.1) {
    await alertOps('High failure rate in price updates', { failed, total: products.length });
  }
}
```

### Batch Processing with Progress Tracking

```typescript
async function processPriceHistory() {
  const BATCH_SIZE = 100;
  const products = await storage.getProductsNeedingHistory();
  const totalBatches = Math.ceil(products.length / BATCH_SIZE);

  log.info(`Starting price history processing`, {
    totalProducts: products.length,
    totalBatches,
    batchSize: BATCH_SIZE,
  });

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    try {
      await processBatch(batch);
      log.info(`Batch ${batchNum}/${totalBatches} completed`, {
        processed: Math.min(i + BATCH_SIZE, products.length),
        total: products.length,
      });
    } catch (error) {
      log.error(`Batch ${batchNum} failed`, error);
      // Continue with next batch
    }
  }
}
```

### Idempotency

Jobs should be safe to run multiple times (idempotent).

```typescript
// ✅ CORRECT - Idempotent price snapshot
async function takePriceSnapshot(productId: number) {
  const today = startOfDay(new Date());

  // Check if snapshot already exists for today
  const existing = await db.select()
    .from(priceSnapshots)
    .where(and(
      eq(priceSnapshots.productId, productId),
      eq(priceSnapshots.snapshotDate, today)
    ))
    .limit(1);

  if (existing.length > 0) {
    log.debug(`Snapshot already exists for product ${productId} on ${today}`);
    return existing[0];
  }

  // Create snapshot
  const [snapshot] = await db.insert(priceSnapshots)
    .values({
      productId,
      snapshotDate: today,
      price: await getCurrentPrice(productId),
    })
    .onConflictDoNothing()  // Handle race conditions
    .returning();

  return snapshot;
}
```

---

## Error Handling in Jobs

### Retry Logic with Exponential Backoff

```typescript
import { withRetry } from '../utils/retry';

async function scrapeProductPrice(url: string) {
  return withRetry(
    () => scrapePage(url),
    {
      maxAttempts: 3,
      delay: 1000,
      backoff: 2,
      shouldRetry: (error, attempt) => {
        // Don't retry 4xx errors (permanent failures)
        if (error.statusCode >= 400 && error.statusCode < 500) {
          return false;
        }
        // Retry 5xx and network errors
        return true;
      },
    }
  );
}
```

### Dead Letter Queue Pattern

```typescript
// Bull queue with retry and DLQ
const priceUpdateQueue = new Queue('price-updates', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Process jobs
priceUpdateQueue.process(async (job) => {
  try {
    await updateProductPrice(job.data.productId);
  } catch (error) {
    log.error('Price update failed', { jobId: job.id, error });
    throw error;  // Let Bull handle retry
  }
});

// Failed jobs (after all retries)
priceUpdateQueue.on('failed', async (job, error) => {
  log.error('Job permanently failed', {
    jobId: job.id,
    productId: job.data.productId,
    error,
  });

  // Store in dead letter table for investigation
  await storage.recordDeadJob({
    queueName: 'price-updates',
    jobId: job.id,
    data: job.data,
    error: error.message,
    failedAt: new Date(),
  });
});
```

---

## TODO vs NOTE Comments

### ❌ WRONG - TODO in Production Code

```typescript
// THIS WILL FAIL CODE REVIEW!
async function getWatchedProducts(userId: number) {
  return db.select({
    productId: products.id,
    name: products.name,
    stockStatus: 'in_stock',  // TODO: Get from product offers
  }).from(products);
}
```

**Problem:** TODO implies "fix before shipping" but code is already in production. Creates technical debt and confusion.

### ✅ CORRECT - NOTE for Known Limitations

```typescript
async function getWatchedProducts(userId: number) {
  return db.select({
    productId: products.id,
    name: products.name,
    // NOTE: Stock status not yet implemented in getWatchedProducts
    // Currently defaulting to 'in_stock' - future enhancement will
    // join with product_offers to fetch real-time stock status
    stockStatus: 'in_stock',
  }).from(products);
}
```

**Better:** Document the limitation clearly and explain future plans.

### Comment Guidelines

**Use TODO when:**
- Code is still in development (not merged)
- Something MUST be fixed before release
- There's a clear, immediate action needed

**Use NOTE when:**
- Explaining a known limitation
- Documenting why something is done a certain way
- Clarifying future enhancement plans
- Code is complete but has known gaps

**Use FIXME when:**
- There's a bug that needs attention
- Workaround is in place temporarily
- Technical debt needs addressing

```typescript
// TODO: Add input validation before PR is merged
// NOTE: This uses simplified calculation - full algorithm in ticket #123
// FIXME: Race condition possible here - needs distributed lock
// HACK: Temporary workaround for vendor API bug, remove after they fix
```

---

## Monitoring and Observability

### Logging Best Practices

```typescript
async function processNotifications() {
  const startTime = Date.now();
  log.info('Starting notification processor');

  try {
    const results = await processAllUsers();

    log.info('Notification processor completed', {
      duration: Date.now() - startTime,
      usersProcessed: results.total,
      notificationsSent: results.sent,
      errors: results.errors,
    });
  } catch (error) {
    log.error('Notification processor failed', {
      duration: Date.now() - startTime,
      error,
    });
    throw error;
  }
}
```

### Metrics Collection

```typescript
import { metrics } from '../services/metrics';

async function processJob() {
  const timer = metrics.startTimer('job_duration_seconds');

  try {
    await doWork();
    metrics.increment('jobs_completed_total', { status: 'success' });
  } catch (error) {
    metrics.increment('jobs_completed_total', { status: 'error' });
    throw error;
  } finally {
    timer.end();
  }
}
```

### Health Checks

```typescript
// Expose job status for monitoring
app.get('/api/health/jobs', async (req, res) => {
  const jobs = await Promise.all([
    checkJobHealth('price-updates'),
    checkJobHealth('notifications'),
    checkJobHealth('scraping'),
  ]);

  const allHealthy = jobs.every(j => j.healthy);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    jobs,
  });
});

async function checkJobHealth(queueName: string) {
  const queue = getQueue(queueName);
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const failed = await queue.getFailedCount();

  return {
    name: queueName,
    healthy: failed < 10 && waiting < 1000,
    waiting,
    active,
    failed,
  };
}
```

---

## Background Jobs Checklist

- [ ] **Rate limiting** - Circuit breakers prevent spam
- [ ] **Distributed locks** - Jobs run once across multiple servers
- [ ] **Error handling** - Graceful degradation, continue on errors
- [ ] **Retry logic** - Exponential backoff for transient failures
- [ ] **Idempotency** - Safe to run multiple times
- [ ] **Batch processing** - Large datasets processed in chunks
- [ ] **Progress tracking** - Log progress for long-running jobs
- [ ] **Dead letter queue** - Failed jobs stored for investigation
- [ ] **NOTE vs TODO** - Proper comment usage
- [ ] **Monitoring** - Logs, metrics, and health checks

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Transaction patterns
- [ERROR_HANDLING_PATTERNS.md](ERROR_HANDLING_PATTERNS.md) - Error handling
- [server/jobs/](../server/jobs/) - Job implementations
