# TODO 217: Missing Retry Logic with Exponential Backoff

**Priority**: P1 - HIGH
**File(s)**: `server/jobs/price-scraper-job.ts`, `server/utils/retry.ts` (new)
**Estimated Time**: 1 hour
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Scraper jobs fail permanently on first error without retry, causing data gaps in price history. Transient failures (network timeouts, temporary rate limits, brief site outages) result in missing price data points.

**Business Impact**:
- Gaps in price history charts
- Missed price drop alerts
- Incomplete data for analysis
- Unreliable user experience

## Root Cause

Job processor doesn't implement retry logic - a single failure marks the job as failed without attempting recovery.

## Solution Approach

1. Create reusable retry utility with exponential backoff
2. Add jitter to prevent thundering herd
3. Implement smart retry logic (only retry transient errors)
4. Apply to all scraper jobs

## Implementation Steps

### Step 1: Create Retry Utility

- [ ] Create `server/utils/retry.ts`
- [ ] Implement exponential backoff with jitter
- [ ] Add configurable max attempts, base delay, max delay
- [ ] Add retry condition function for smart retries

### Step 2: Identify Retryable Errors

- [ ] Timeout errors (network, navigation)
- [ ] Connection errors (ECONNRESET, ETIMEDOUT)
- [ ] Temporary rate limits (429 status)
- [ ] NOT retryable: 404, validation errors, auth errors

### Step 3: Apply to Scraper Jobs

- [ ] Wrap scraper calls in withRetry()
- [ ] Configure appropriate retry settings per scraper
- [ ] Log retry attempts for monitoring

### Step 4: Add Tests

- [ ] Test successful retry after transient failure
- [ ] Test max attempts limit
- [ ] Test exponential backoff timing
- [ ] Test non-retryable errors fail immediately

## Technical Details

**Current Implementation (NO RETRY):**
```typescript
export async function processPriceScrapeJob(job: Job<PriceScrapeData>) {
  const { productId, url } = job.data;
  
  // ❌ Single attempt - transient failures cause permanent data gaps
  const result = await scrapeProductPrice(url);
  await storage.savePriceHistory(productId, result.price);
}
```

**Retry Utility Implementation:**
```typescript
// server/utils/retry.ts

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      if (opts.shouldRetry && !opts.shouldRetry(lastError, attempt)) {
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt >= opts.maxAttempts) {
        break;
      }
      
      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000; // 0-1 second jitter
      const delay = Math.min(exponentialDelay + jitter, opts.maxDelayMs);
      
      // Notify about retry
      if (opts.onRetry) {
        opts.onRetry(lastError, attempt, delay);
      }
      
      // Wait before retry
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Determine if error is retryable
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  const retryablePatterns = [
    'timeout',
    'econnreset',
    'etimedout',
    'enotfound',
    'econnrefused',
    'net::err_',
    'navigation timeout',
    'waiting for selector',
    'target closed',
    'protocol error',
    'socket hang up',
  ];
  
  // Check error message
  if (retryablePatterns.some(pattern => message.includes(pattern))) {
    return true;
  }
  
  // Check for HTTP 429 (rate limit) or 5xx (server errors)
  if ('statusCode' in error) {
    const status = (error as any).statusCode;
    return status === 429 || (status >= 500 && status < 600);
  }
  
  return false;
}

// Non-retryable errors (fail fast)
export function isNonRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  const nonRetryablePatterns = [
    'not in allowlist',      // SSRF protection
    'invalid url',           // Validation error
    'unauthorized',          // Auth error
    '404',                   // Not found
    'forbidden',             // 403
  ];
  
  return nonRetryablePatterns.some(pattern => message.includes(pattern));
}
```

**Fixed Job Implementation:**
```typescript
// server/jobs/price-scraper-job.ts
import { withRetry, isRetryableError, isNonRetryableError } from '../utils/retry';
import { logger } from '../utils/logger';

export async function processPriceScrapeJob(job: Job<PriceScrapeData>) {
  const { productId, url } = job.data;
  
  const result = await withRetry(
    () => scrapeProductPrice(url),
    {
      maxAttempts: 3,
      baseDelayMs: 2000,      // Start with 2 second delay
      maxDelayMs: 60000,      // Max 1 minute delay
      shouldRetry: (error) => {
        // Don't retry validation/auth errors
        if (isNonRetryableError(error)) {
          return false;
        }
        // Retry transient errors
        return isRetryableError(error);
      },
      onRetry: (error, attempt, delayMs) => {
        logger.warn({
          jobId: job.id,
          productId,
          url,
          attempt,
          delayMs,
          error: error.message,
        }, `Scrape attempt ${attempt} failed, retrying in ${delayMs}ms`);
      },
    }
  );
  
  await storage.savePriceHistory(productId, result.price);
  
  logger.info({
    jobId: job.id,
    productId,
    price: result.price,
  }, 'Price scraped successfully');
}
```

**Bull Queue Retry Configuration:**
```typescript
// Bull also supports built-in retries, can be used in combination
const priceScraperQueue = new Queue('price-scraper', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
  },
});
```

## Checklist

- [ ] Retry utility created with exponential backoff
- [ ] Jitter added to prevent thundering herd
- [ ] Retryable vs non-retryable errors distinguished
- [ ] Scraper jobs use retry wrapper
- [ ] Retry attempts logged for monitoring
- [ ] Tests cover retry scenarios

## Success Criteria

- [ ] Transient failures retry up to 3 times
- [ ] Exponential backoff: ~2s, ~4s, ~8s delays
- [ ] Non-retryable errors fail immediately
- [ ] Retry attempts visible in logs
- [ ] Data gaps reduced from transient failures
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Retry storm on mass failure | Medium | Medium | Add jitter, use distributed lock |
| Delayed job completion | Low | Low | Acceptable tradeoff for reliability |
| Infinite retry on persistent error | Low | High | Max attempts limit, smart retry logic |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm retry utility and usage exist
  ```bash
  # Verify retry utility exists
  ls server/utils/retry.ts
  
  # Verify withRetry is used in scraper jobs
  grep -n "withRetry" server/jobs/price-scraper-job.ts
  
  # Verify isRetryableError function exists
  grep -n "isRetryableError" server/utils/retry.ts
  ```

- [ ] **File inspection**: Review retry implementation
  ```bash
  cat server/utils/retry.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute retry and scraper tests
  ```bash
  npm test -- retry
  npm test -- scraper
  npm test -- price-scraper-job
  ```

- [ ] **Manual retry test**: Verify retry behavior
  ```bash
  # Check logs for retry attempts on transient failures
  grep -i "retry" logs/scraper.log | tail -20
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
