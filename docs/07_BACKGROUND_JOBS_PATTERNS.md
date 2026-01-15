---
Pattern: Background Jobs Patterns
Version: 2.2
Last Updated: 2026-01-14
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [02_DATABASE_PATTERNS.md, 04_SECURITY_PATTERNS.md, 03_API_PATTERNS.md]
Changelog:
  - 2.2 (2026-01-14): Added Distributed URL Locking, Health Check Tiering, and Enhanced Graceful Shutdown patterns (from TODO_213, TODO_215, TODO_216)
  - 2.1 (2026-01-07): Added Product Deduplication in Batch Jobs and Consistent Distributed Locking patterns (from TODO_018 price alert checker)
  - 2.0 (2025-11-29): Initial consolidated background jobs patterns
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

## Distributed URL Locking Pattern (NEW - 2026-01-14)

**Context:** Multiple scraper jobs may attempt to scrape the same URL simultaneously, wasting resources and triggering rate limits.

**Problem:** Without URL-level locking, concurrent scrapers create duplicate requests, increased costs, and potential IP bans.

**Source:** `server/services/url-lock-service.ts` from TODO_213 (Distributed URL Locking implementation).

### ❌ WRONG - No URL Coordination

```typescript
// Multiple workers all scrape the same URL
async function scrapeProduct(url: string) {
  // No check if another worker is already scraping this URL
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const data = await extractData(page);
  await browser.close();
  return data;
}
```

**Problems:**
- 3 workers scrape amazon.com/product/123 simultaneously
- Amazon sees 3 requests from same IP in seconds → rate limit triggered
- Wasted browser resources (3x memory, 3x CPU)
- May trigger anti-bot detection

### ✅ CORRECT - URL Locking with Atomic Operations

```typescript
// server/services/url-lock-service.ts
export class URLLockService {
  private redisClient: Redis;
  private defaultTtlMs = 5 * 60 * 1000; // 5 minutes

  async withLock<T>(
    url: string,
    task: () => Promise<T>,
    options: { skipIfLocked?: boolean; ttlMs?: number } = {}
  ): Promise<T | null> {
    const normalizedUrl = this.normalizeUrl(url);
    const lockKey = `url_lock:${normalizedUrl}`;
    const ttl = options.ttlMs || this.defaultTtlMs;

    try {
      // Attempt to acquire lock atomically
      const acquired = await this.redisClient.set(
        lockKey,
        'locked',
        'NX',  // Only set if not exists
        'PX',  // TTL in milliseconds
        ttl
      );

      if (!acquired) {
        if (options.skipIfLocked) {
          logger.debug('URL locked by another worker, skipping', { url: normalizedUrl });
          return null;
        }
        // Could implement retry logic here
        throw new Error(`URL is locked: ${normalizedUrl}`);
      }

      // Execute task with lock held
      const result = await task();

      // Release lock using Lua script (atomic check-and-delete)
      await this.releaseLock(lockKey);

      return result;
    } catch (error) {
      // Ensure lock is released on error
      await this.releaseLock(lockKey);
      throw error;
    }
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid'];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    return parsed.toString();
  }

  private async releaseLock(lockKey: string): Promise<void> {
    // Lua script ensures atomic release (only delete if we own the lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redisClient.eval(script, 1, lockKey, 'locked');
  }
}
```

### Usage in Extraction Agent

```typescript
// server/agents/extraction-agent.ts
import { urlLockService } from '../services/url-lock-service';

const result = await urlLockService.withLock(
  task.url,
  async () => {
    // Scrape with lock held
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(task.url);
    const data = await extractData(page);
    await browser.close();
    return { success: true, data };
  },
  {
    skipIfLocked: true,  // Skip if another worker is scraping
    ttlMs: 5 * 60 * 1000, // 5-minute lock
  }
);

if (result === null) {
  logger.info('URL already being scraped by another worker');
}
```

### Key Features

**1. URL Normalization**
```typescript
// These URLs are treated as identical:
'https://amazon.com/product/123?utm_source=email&ref=home'
'https://amazon.com/product/123?ref=search'
'https://amazon.com/product/123'
// All normalize to: 'https://amazon.com/product/123'
```

**2. Automatic Deadlock Prevention**
- TTL ensures locks expire even if worker crashes
- Default 5-minute timeout prevents indefinite locks
- Lua script prevents releasing someone else's lock

**3. Graceful Degradation**
- `skipIfLocked: true` → Returns null instead of error
- Caller decides whether to retry or skip
- No exceptions thrown for normal lock contention

### When to Use

✅ **Use URL locking when:**
- Multiple workers may scrape same URL concurrently
- Scraping targets have rate limits
- Browser automation is expensive (memory/CPU)
- You want to deduplicate scraper work across workers

❌ **NOT needed when:**
- Single-worker deployment (no concurrency)
- URLs are guaranteed unique per job (e.g., user-specific URLs)
- Target site has no rate limiting
- Scraping is idempotent and cheap (simple HTTP GET)

### Rationale

- **Resource efficiency**: Only one worker scrapes each URL
- **Rate limit protection**: Prevents triggering site rate limits
- **Atomic operations**: Redis NX flag ensures lock safety
- **Deadlock prevention**: TTL ensures eventual lock release
- **URL normalization**: Tracking parameters don't bypass lock

### Detection Rule

```bash
# Find scraper code without URL locking
grep -r "chromium.launch\|page.goto" server/agents/ | \
  xargs grep -L "urlLockService\|withLock"
```

### Quality Checklist

- [ ] URL normalization removes tracking parameters
- [ ] Lock TTL exceeds expected task duration
- [ ] Lua script used for atomic lock release
- [ ] Graceful handling when lock is held
- [ ] Tests verify only one worker processes URL
- [ ] Logging shows when URLs are skipped (locked)

**Source:** TODO_213 distributed URL locking service
**Added:** 2026-01-14

---

## Health Check Tiering Pattern (NEW - 2026-01-14)

**Context:** Monitoring systems, load balancers, and incident responders have different health check requirements.

**Problem:** Single health check endpoint mixing concerns - too slow for load balancers, not detailed enough for debugging.

**Source:** `server/routes/health.ts` from TODO_215 (Health Check Endpoints implementation).

### ❌ WRONG - Single Heavyweight Endpoint

```typescript
// One endpoint doing everything (TOO SLOW for load balancer!)
app.get('/health', async (req, res) => {
  // This takes 200-500ms - too slow for frequent polling
  const dbOk = await checkDatabase();      // 100ms
  const redisOk = await checkRedis();      // 50ms
  const memoryOk = checkMemory();          // 1ms
  const cpuOk = checkCPU();                // 50ms
  const nodeVersion = process.version;     // Fast
  const uptime = process.uptime();         // Fast

  res.json({
    status: dbOk && redisOk ? 'healthy' : 'unhealthy',
    database: dbOk,
    redis: redisOk,
    memory: memoryOk,
    cpu: cpuOk,
    nodeVersion,
    uptime,
  });
});
```

**Problems:**
- Load balancer polls every 10 seconds → 200ms overhead
- Deep diagnostics mixed with routing decision
- Production diagnostics exposed (security issue)
- No distinction between "app running" vs "dependencies healthy"

### ✅ CORRECT - Three-Tier Health Checks

```typescript
// server/routes/health.ts

// TIER 1: Liveness Check (Fast, No Dependencies)
// Purpose: "Is the process alive?"
// Used by: Kubernetes liveness probe, container orchestration
// Requirement: < 100ms response time
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// TIER 2: Readiness Check (Dependencies, Routing Decision)
// Purpose: "Is the app ready to serve traffic?"
// Used by: Load balancers, Kubernetes readiness probe
// Requirement: < 500ms response time, check critical dependencies
router.get('/health/ready', async (req, res) => {
  const checks = {
    database: { status: 'unknown', latencyMs: 0 },
    redis: { status: 'unknown', latencyMs: 0 },
  };

  // Check database
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'pass', latencyMs: Date.now() - dbStart };
  } catch (error) {
    checks.database = { status: 'fail', latencyMs: Date.now() - dbStart, message: error.message };
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    await redisClient.ping();
    checks.redis = { status: 'pass', latencyMs: Date.now() - redisStart };
  } catch (error) {
    checks.redis = { status: 'fail', latencyMs: Date.now() - redisStart, message: error.message };
  }

  const allHealthy = checks.database.status === 'pass' && checks.redis.status === 'pass';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
});

// TIER 3: Detailed Diagnostics (Deep Inspection, Production-Protected)
// Purpose: "What's wrong during an incident?"
// Used by: Incident response, debugging, operations team
// Requirement: Protected in production (auth required)
router.get('/health/detailed', async (req, res) => {
  // SECURITY: Require auth header in production
  if (process.env.NODE_ENV === 'production') {
    const authKey = req.headers['x-health-key'];
    if (authKey !== process.env.HEALTH_CHECK_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
  }

  // Deep diagnostics
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
    uptime: process.uptime(),
    pid: process.pid,
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
  });
});
```

### Three-Tier Decision Matrix

| Tier | Endpoint | Response Time | Dependencies | Auth Required | Use Case |
|------|----------|---------------|--------------|---------------|----------|
| 1. Liveness | `/health` | < 100ms | None | No | Process alive? Container restart decision |
| 2. Readiness | `/health/ready` | < 500ms | DB, Redis | No | Route traffic? Load balancer decision |
| 3. Detailed | `/health/detailed` | No limit | All | Yes (prod) | What's broken? Incident response |

### Load Balancer Configuration

```nginx
# Nginx upstream health check
upstream pricecompare_backend {
  server app1:5000;
  server app2:5000;
  server app3:5000;

  # Use readiness check for routing
  check interval=10s fall=3 rise=2 timeout=5s type=http;
  check_http_send "GET /health/ready HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx http_3xx;
}
```

### Kubernetes Probes

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pricecompare-api
spec:
  containers:
  - name: api
    image: pricecompare:latest
    ports:
    - containerPort: 5000
    livenessProbe:
      httpGet:
        path: /health
        port: 5000
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 1
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 5000
      initialDelaySeconds: 15
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
```

### Rationale

- **Separation of concerns**: Each tier serves specific purpose
- **Performance**: Liveness check is fast (no I/O), frequently polled
- **Security**: Detailed diagnostics protected in production
- **Debugging**: Deep inspection available when needed
- **Standard compliance**: Follows Kubernetes health check patterns

### When to Use

✅ **Use three-tier health checks when:**
- App has external dependencies (database, cache, queues)
- Load balancer needs routing decisions
- Container orchestration (Kubernetes, ECS)
- You want detailed diagnostics for incidents

❌ **Single endpoint sufficient when:**
- No external dependencies (stateless app)
- Simple deployment (no load balancer)
- Development/prototype environment

### Quality Checklist

- [ ] Liveness check has no dependencies (process-level only)
- [ ] Readiness check verifies critical dependencies
- [ ] Detailed endpoint protected with auth in production
- [ ] Response times meet requirements (< 100ms liveness, < 500ms readiness)
- [ ] Status codes correct (200 healthy, 503 degraded)
- [ ] Load balancer configured to use readiness endpoint

**Source:** TODO_215 health check endpoints implementation
**Added:** 2026-01-14

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

## Product Deduplication in Batch Jobs (NEW - 2026-01-07)

**Context:** When processing multiple alerts/jobs that reference the same product, calling a service function that operates on "all alerts for product" causes duplicate processing.

**Problem:** If you iterate over individual alerts and call `checkPriceAlertsForDrop(productId)` for each one, you process the same product N times, creating N × M notifications where M = alerts per product.

**Source:** `server/jobs/price-alert-checker.ts` from TODO_018 price alert email notification implementation. Bug caught during code review before production.

### ❌ WRONG - Process Same Product Multiple Times

```typescript
// Fetch all alerts with current prices
const alertsWithPrices = await db.select({
  alertId: priceAlerts.id,
  productId: priceAlerts.productId,
  userId: priceAlerts.userId,
  targetPrice: priceAlerts.targetPrice,
  currentPrice: sql<string>`MIN(${productOffers.price})`,
}).from(priceAlerts)
  .innerJoin(products, eq(priceAlerts.productId, products.id))
  .leftJoin(productOffers, and(
    eq(products.id, productOffers.productId),
    eq(productOffers.availability, 'in_stock')
  ))
  .where(eq(priceAlerts.isActive, true))
  .groupBy(priceAlerts.id, products.id);

// Process each alert
for (const alert of alertsWithPrices) {
  const currentPrice = parseFloat(alert.currentPrice);
  const targetPrice = parseFloat(alert.targetPrice);

  if (currentPrice <= targetPrice) {
    // BUG: checkPriceAlertsForDrop finds ALL alerts for this product
    // If 2 users have alerts for same product, this creates 2 + 2 = 4 notifications
    // Instead of 2 notifications (1 per user)
    await checkPriceAlertsForDrop(alert.productId, currentPrice);
  }
}
```

**Example scenario:**
- Product A has 2 alerts: user1 (target $95), user2 (target $95)
- Current price: $90 (triggers both)
- Without deduplication: Loop runs twice, each calls `checkPriceAlertsForDrop(productA, 90)`
- Each call finds both alerts and creates 2 notifications
- Result: 4 notifications (2 duplicates!)

### ✅ CORRECT - Track Processed Products

```typescript
const alertsWithPrices = await db.select({
  alertId: priceAlerts.id,
  productId: priceAlerts.productId,
  userId: priceAlerts.userId,
  targetPrice: priceAlerts.targetPrice,
  currentPrice: sql<string>`MIN(${productOffers.price})`,
}).from(priceAlerts)
  .innerJoin(products, eq(priceAlerts.productId, products.id))
  .leftJoin(productOffers, and(
    eq(products.id, productOffers.productId),
    eq(productOffers.availability, 'in_stock')
  ))
  .where(eq(priceAlerts.isActive, true))
  .groupBy(priceAlerts.id, products.id);

// Track which products have been processed
const processedProducts = new Set<number>();
let triggered = 0;

for (const alert of alertsWithPrices) {
  const currentPrice = parseFloat(alert.currentPrice);
  const targetPrice = parseFloat(alert.targetPrice);

  if (currentPrice <= targetPrice) {
    // Skip if we already processed this product
    if (processedProducts.has(alert.productId)) {
      logger.debug('Product already processed, skipping', {
        productId: alert.productId
      });
      continue;
    }

    // Process ALL alerts for this product once
    const alertsTriggered = await checkPriceAlertsForDrop(
      alert.offerId,
      currentPrice
    );

    if (alertsTriggered > 0) {
      triggered += alertsTriggered;
      // Mark product as processed
      processedProducts.add(alert.productId);
    }
  }
}
```

### Rationale

- **Correct count**: Each alert triggers exactly once (not N times)
- **Performance**: Fewer database queries (N products vs N alerts)
- **User experience**: No duplicate notifications
- **Debugging**: Logs show when deduplication occurs

### When to Use

✅ **Use when:**
- Batch job iterates over individual entities (alerts, orders, items)
- Service function operates on ALL entities matching a condition (e.g., "all alerts for product X")
- Multiple entities can reference the same parent (e.g., multiple alerts for same product)
- Processing cost is high (notifications, emails, external API calls)

❌ **NOT needed when:**
- Service function operates on single entity only (1:1 relationship)
- Each iteration processes completely independent data
- Duplicate processing is idempotent (safe to repeat)
- Using database `DISTINCT` or `GROUP BY` to handle deduplication

### Alternative Patterns

**Pattern 1: Deduplicate Before Loop**

```typescript
// Get unique product IDs first
const uniqueProductIds = [...new Set(alertsWithPrices.map(a => a.productId))];

for (const productId of uniqueProductIds) {
  await checkPriceAlertsForDrop(productId);
}
```

**Pattern 2: Batch by Product**

```typescript
// Group alerts by product
const alertsByProduct = new Map<number, Alert[]>();
for (const alert of alertsWithPrices) {
  if (!alertsByProduct.has(alert.productId)) {
    alertsByProduct.set(alert.productId, []);
  }
  alertsByProduct.get(alert.productId)!.push(alert);
}

// Process each product once
for (const [productId, alerts] of alertsByProduct) {
  await processProductAlerts(productId, alerts);
}
```

### Detection Rule

```bash
# Find batch jobs that might have deduplication issues
grep -r "for.*of.*alerts\|for.*of.*items" server/jobs/ | \
  xargs grep -L "processedProducts\|processedIds\|Set<number>"
```

### Quality Checklist

- [ ] Set/Map used to track processed entities
- [ ] Deduplication check before expensive operations
- [ ] Logging shows when duplicates are skipped
- [ ] Tests verify no duplicate processing (check notification counts)
- [ ] Deduplication handles entity IDs (not objects - use ID comparison)

**Bug prevented:** 4 notifications instead of 2 for same product with 2 user alerts

*Source: TODO_018 price alert checker job code review*
*Added: 2026-01-07*

---

## Consistent Distributed Locking Across Entry Points (NEW - 2026-01-07)

**Context:** Background jobs often have multiple entry points: scheduled execution (cron) and manual triggers (admin actions, testing). Both access the same shared resources.

**Problem:** If only the scheduled job uses distributed locking, manual triggers can create race conditions in multi-server deployments.

**Source:** `server/jobs/price-alert-checker.ts` from TODO_018 - Code review caught missing lock on manual trigger.

### ❌ WRONG - Inconsistent Locking

```typescript
// Scheduled job - HAS distributed lock
export function startPriceAlertCheckerJob(): void {
  cron.schedule('*/30 * * * *', async () => {
    await jobLockService.withLock(
      'price-alert-checker:periodic',
      async () => {
        return await checkAllActivePriceAlerts();
      },
      2700 // 45 minute lock
    );
  });
}

// Manual trigger - NO distributed lock (BUG!)
export async function triggerPriceAlertCheck() {
  logger.info('Manually triggering price alert check...');

  // BUG: No lock! Can run simultaneously with scheduled job
  const stats = await checkAllActivePriceAlerts();

  logger.info('Manual price alert check completed', stats);
  return stats;
}
```

**Race condition scenario:**
- Server A: Scheduled job starts at 12:00 (acquires lock)
- Server B: Admin triggers manual check at 12:01 (bypasses lock!)
- Result: Both servers process same alerts, duplicate notifications sent

### ✅ CORRECT - Lock All Entry Points

```typescript
// Shared implementation (no lock)
async function checkAllActivePriceAlerts() {
  // Core business logic
  const alerts = await getActiveAlerts();
  // ... process alerts
  return { checked, triggered, skipped };
}

// Scheduled entry point - WITH lock
export function startPriceAlertCheckerJob(): void {
  cron.schedule('*/30 * * * *', async () => {
    const result = await jobLockService.withLock(
      'price-alert-checker:periodic',
      async () => {
        return await checkAllActivePriceAlerts();
      },
      2700 // 45 minute lock (longer than 30 min interval)
    );

    if (result === null) {
      logger.info('Alert check skipped - already running on another server');
    }
  });
}

// Manual trigger entry point - WITH lock (different key)
export async function triggerPriceAlertCheck() {
  logger.info('Manually triggering price alert check...');

  const stats = await jobLockService.withLock(
    'price-alert-checker:manual', // Different lock key
    async () => {
      return await checkAllActivePriceAlerts();
    },
    300 // 5 minute lock for manual execution
  );

  if (stats === null) {
    logger.info('Manual price alert check skipped - job already running');
    return null;
  }

  logger.info('Manual price alert check completed', stats);
  return stats;
}
```

### Key Insights

**Different lock keys for different contexts:**
- `price-alert-checker:periodic` - Long TTL (45 min) for scheduled job
- `price-alert-checker:manual` - Short TTL (5 min) for manual trigger

**Why different keys?**
- Manual trigger should be allowed while scheduled job runs (admin override)
- But manual triggers should block each other (prevent admin spam)
- Scheduled jobs should block each other (prevent overlap)

**Alternative: Same lock key (stricter)**

```typescript
// Use same lock key - manual trigger waits for scheduled job
export async function triggerPriceAlertCheck() {
  const stats = await jobLockService.withLock(
    'price-alert-checker', // Same key as periodic
    async () => {
      return await checkAllActivePriceAlerts();
    },
    300
  );

  if (stats === null) {
    // Could be periodic job OR another manual trigger holding lock
    logger.info('Price alert check already running');
    return null;
  }

  return stats;
}
```

**Choose based on use case:**
- **Different keys**: Manual trigger can override/run alongside scheduled job
- **Same key**: Manual trigger waits for scheduled job to complete

### Rationale

- **No race conditions**: All access paths protected by locks
- **Multi-server safe**: Works in load-balanced deployments
- **Explicit locking**: Lock key names clarify purpose (periodic vs manual)
- **Appropriate TTLs**: Lock duration matches execution context
- **Graceful handling**: Returns null when lock held (not error)

### When to Use

✅ **Use when:**
- Job has multiple entry points (cron + API trigger + testing)
- Job modifies shared state (database, cache, external API)
- Running same job twice causes issues (duplicate notifications, double charges)
- Multi-server deployment possible (now or future)

❌ **NOT needed when:**
- Job is read-only (no side effects)
- Job is naturally idempotent (safe to run multiple times)
- Single-server deployment guaranteed (still good practice!)
- User-specific jobs (each user gets own execution context)

### Lock Key Naming Convention

```typescript
// Format: <resource>:<context>
'price-alert-checker:periodic'  // Scheduled execution
'price-alert-checker:manual'    // Manual trigger
'price-snapshot:daily'          // Daily scheduled snapshot
'scraper:manual'                // Manual scrape trigger
'notification-digest:hourly'    // Hourly digest job
```

### Quality Checklist

- [ ] All entry points use distributed locking
- [ ] Lock keys are descriptive (include context)
- [ ] TTL appropriate for execution duration (not too short, not too long)
- [ ] Returns null when lock held (doesn't throw error)
- [ ] Logs when execution skipped due to lock
- [ ] Tests verify locking prevents concurrent execution

**Bug prevented:** Race conditions causing duplicate notifications in multi-server deployments

*Source: TODO_018 price alert checker job implementation*
*Added: 2026-01-07*

---

## Graceful Shutdown with cleanupManager (CRITICAL - 2025-12-02)

All background intervals and timers MUST be registered with `cleanupManager` for proper graceful shutdown.

### ❌ WRONG - Unregistered Intervals

```typescript
class MetricsService {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    // WRONG: Interval not registered for cleanup
    this.interval = setInterval(() => {
      this.collectAndLog();
    }, 60000);
  }

  // No cleanup method - interval runs forever after SIGTERM!
}
```

**Problems:**
- Interval continues after shutdown signal
- Delays graceful termination
- May cause errors during shutdown (resources already closed)
- Memory leaks in development with hot reloading

### ✅ CORRECT - Registered with cleanupManager

```typescript
import { cleanupManager } from '../utils/cleanup-manager';

class MetricsService {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    this.interval = setInterval(() => {
      this.collectAndLog();
    }, 60000);

    // CRITICAL: Register cleanup handler
    cleanupManager.register('metrics-interval', () => {
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = null;
        log.info('Metrics collection stopped');
      }
    });
  }
}
```

### cleanupManager API

```typescript
// Register a cleanup handler
cleanupManager.register(name: string, handler: () => void | Promise<void>): void

// All handlers are called during graceful shutdown in reverse order
// (last registered, first called - like a stack)

// Example: Multiple registrations
cleanupManager.register('redis-connection', () => redis.quit());
cleanupManager.register('database-pool', () => db.end());
cleanupManager.register('websocket-server', () => io.close());
```

### What to Register

Register these with cleanupManager:
- `setInterval()` timers
- `setTimeout()` long-running timers
- Database connection pools
- Redis client connections
- WebSocket servers
- File handles / streams
- External service connections

### Enhanced Graceful Shutdown Sequence (NEW - 2026-01-14)

**Context:** Proper shutdown ordering prevents data loss and ensures all operations complete before process termination.

**Problem:** Random shutdown order causes errors - closing database before finishing queries, closing Redis before flushing cache.

**Source:** `server/index.ts` lines 280-350 from TODO_216 (Enhanced Graceful Shutdown implementation).

#### ✅ CORRECT - Ordered Shutdown with Timeout

```typescript
// server/index.ts
async function gracefulShutdown(signal: string): Promise<void> {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress, ignoring signal', { signal });
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Safety timeout - force exit after 30 seconds
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded - forcing exit');
    process.exit(1);
  }, 30000);

  try {
    // CRITICAL ORDERING - Each step depends on previous completing

    // Step 1: Stop accepting new HTTP connections
    logger.info('Closing HTTP server...');
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err });
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });

    // Step 2: Stop background jobs and finish in-flight work
    logger.info('Cleaning up background tasks...');
    await cleanupManager.cleanup();

    // Step 3: Close job queues (wait for active jobs)
    logger.info('Closing job queues...');
    await notificationQueue.close();
    await priceSnapshotQueue.close();

    // Step 4: Close WebSocket connections
    logger.info('Closing WebSocket connections...');
    shutdownWebSocket();

    // Step 5: Remove all event listeners
    logger.info('Removing event listeners...');
    eventBus.removeAllListeners();

    // Step 6: Flush and close cache (before closing Redis!)
    logger.info('Closing cache...');
    await advancedCache.close();

    // Step 7: Close Redis connections
    logger.info('Closing Redis connections...');
    await ioRedisClient.quit();
    await redisClient.quit();

    // Step 8: Close database pool (LAST - after all queries complete!)
    logger.info('Closing database pool...');
    await pool.end();

    logger.info('Graceful shutdown completed successfully');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', { error });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

#### Shutdown Ordering Rationale

**Why this specific order:**

1. **HTTP Server First** - Stop accepting new requests, but keep existing connections alive
2. **Background Jobs** - Finish in-flight background work before closing resources
3. **Job Queues** - Wait for active jobs to complete, prevent new job processing
4. **WebSockets** - Close real-time connections gracefully (send disconnect messages)
5. **Event Listeners** - Prevent new events from triggering after resources closed
6. **Cache** - Flush cache writes before closing Redis connection
7. **Redis** - Close Redis connections after all cache operations complete
8. **Database Last** - Close database pool AFTER all queries finish (most critical!)

**Why database must close last:**
```typescript
// ❌ WRONG ORDER - Database closes before queries finish
await pool.end();           // Database closed!
await advancedCache.close(); // Tries to write to DB → ERROR!
await notificationQueue.close(); // Active jobs try to query DB → ERROR!

// ✅ CORRECT ORDER - Database closes after all operations
await notificationQueue.close();  // Finish jobs (may query DB)
await advancedCache.close();      // Flush cache (may write to DB)
await pool.end();                 // NOW safe to close database
```

#### Timeout Protection

**Why 30-second timeout:**
- Prevents hung shutdown (infinite wait for unresponsive resource)
- Kubernetes default grace period is 30 seconds
- Gives time for:
  - Active HTTP requests to complete (~5s)
  - Background jobs to finish (~10s)
  - Cache flush and connection cleanup (~5s)
  - Buffer for slow operations (~10s)

**Handling timeout expiration:**
```typescript
const shutdownTimeout = setTimeout(() => {
  logger.error('Graceful shutdown timeout exceeded', {
    duration: 30000,
    pendingResources: getPendingResources(), // Log what's blocking
  });
  process.exit(1); // Force exit (better than hanging forever)
}, 30000);
```

#### Idempotent Shutdown

**Prevent duplicate shutdowns:**
```typescript
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress', { signal });
    return; // Ignore duplicate signals
  }
  isShuttingDown = true;
  // ... shutdown logic
}
```

**Why needed:**
- Kubernetes sends SIGTERM, waits 30s, then sends SIGKILL
- User may press Ctrl+C multiple times
- Multiple signals don't cause parallel shutdowns (race conditions)

#### Testing Graceful Shutdown

```typescript
// Test shutdown ordering
describe('Graceful Shutdown', () => {
  it('should close resources in correct order', async () => {
    const closeOrder: string[] = [];

    // Mock close methods to track order
    server.close = vi.fn(() => closeOrder.push('server'));
    notificationQueue.close = vi.fn(async () => closeOrder.push('queue'));
    pool.end = vi.fn(async () => closeOrder.push('database'));

    await gracefulShutdown('SIGTERM');

    expect(closeOrder).toEqual(['server', 'queue', 'database']);
  });

  it('should complete within timeout', async () => {
    const start = Date.now();
    await gracefulShutdown('SIGTERM');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
  });
});
```

#### Quality Checklist

- [ ] HTTP server closes first (stop accepting connections)
- [ ] Background jobs finish before resource cleanup
- [ ] Database pool closes LAST (after all queries)
- [ ] 30-second timeout prevents hung shutdown
- [ ] Idempotent (ignores duplicate signals)
- [ ] Logs each shutdown step for debugging
- [ ] Error handling logs failures but still attempts remaining cleanup
- [ ] Tests verify shutdown ordering

**Source:** TODO_216 enhanced graceful shutdown sequence
**Added:** 2026-01-14

---

## Structured Metrics Logging (2025-12-02)

Metrics logging should use structured JSON for log aggregation systems.

### ✅ CORRECT - Structured JSON Output

```typescript
private logMetrics(): void {
  const stats = this.getStats();

  // Structured format for log aggregation (Datadog, ELK, Splunk)
  log.info('Cache metrics', {
    // Identifiers
    service: 'cache-service',
    metricType: 'cache_stats',

    // Metrics
    hits: stats.hits,
    misses: stats.misses,
    hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    totalKeys: stats.totalKeys,
    memoryUsageMB: stats.memoryUsage / 1024 / 1024,

    // Metadata
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
}
```

**Benefits:**
- Queryable in log aggregation systems
- Can build dashboards from log data
- Enables alerting on specific metrics
- Consistent format across services

### Common Metrics to Log

```typescript
// Job completion metrics
log.info('Job completed', {
  jobName: 'price-snapshot',
  duration: Date.now() - startTime,
  itemsProcessed: count,
  itemsFailed: failures,
  successRate: (count - failures) / count,
});

// Cache metrics
log.info('Cache stats', {
  hits: stats.hits,
  misses: stats.misses,
  hitRate: stats.hitRate,
  evictions: stats.evictions,
});

// Queue metrics
log.info('Queue status', {
  queueName: 'notifications',
  waiting: await queue.getWaitingCount(),
  active: await queue.getActiveCount(),
  failed: await queue.getFailedCount(),
  delayed: await queue.getDelayedCount(),
});
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
- [ ] **cleanupManager registration** - All intervals registered for graceful shutdown
- [ ] **Structured logging** - Metrics use JSON format for aggregation

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [02_DATABASE_PATTERNS.md](02_DATABASE_PATTERNS.md) - Transaction patterns
- [04_SECURITY_PATTERNS.md](04_SECURITY_PATTERNS.md) - Security patterns
- [server/jobs/](../server/jobs/) - Job implementations
