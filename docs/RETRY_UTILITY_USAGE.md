# Retry Utility Usage Guide

**Status**: Production Ready
**Created**: 2026-01-14
**Location**: `server/utils/retry.ts`

## Overview

The retry utility provides smart retry logic with exponential backoff and jitter for handling transient failures in scraping operations, API calls, and other network-dependent tasks.

## Quick Start

```typescript
import { withRetry, createSmartRetryCondition } from '../utils/retry';
import { logger } from '../utils/logger';

// Basic usage with smart retry logic
const result = await withRetry(
  () => scrapeProductPrice(url),
  {
    maxAttempts: 3,
    baseDelayMs: 2000,
    shouldRetry: createSmartRetryCondition(),
    onRetry: (error, attempt, delayMs) => {
      logger.warn({
        error: error.message,
        attempt,
        delayMs,
      }, `Retry attempt ${attempt}`);
    },
  }
);
```

## API Reference

### `withRetry<T>(fn, options): Promise<T>`

Execute a function with automatic retry on transient failures.

**Parameters:**
- `fn: () => Promise<T>` - Async function to execute with retry
- `options: Partial<RetryOptions>` - Configuration options

**RetryOptions:**
```typescript
{
  maxAttempts: number;      // Default: 3
  baseDelayMs: number;      // Default: 1000ms
  maxDelayMs: number;       // Default: 30000ms
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}
```

**Returns:** Promise resolving to function result

**Throws:** Last error if all retry attempts exhausted

### `isRetryableError(error: Error): boolean`

Determine if an error represents a transient failure that should be retried.

**Retryable error patterns:**
- Network timeouts: `ETIMEDOUT`, `timeout`, `navigation timeout`
- Connection errors: `ECONNRESET`, `ECONNREFUSED`, `ENOTFOUND`
- Playwright errors: `target closed`, `protocol error`, `waiting for selector`
- HTTP errors: 429 (rate limit), 5xx (server errors)

**Example:**
```typescript
try {
  await scrape(url);
} catch (error) {
  if (isRetryableError(error as Error)) {
    // Transient failure - safe to retry
  }
}
```

### `isNonRetryableError(error: Error): boolean`

Determine if an error represents a permanent failure that should NOT be retried.

**Non-retryable error patterns:**
- SSRF protection: `not in allowlist`
- Validation errors: `invalid url`, `validation error`
- Auth errors: `unauthorized`, `forbidden`
- Client errors: `404`, `bad request`

**Example:**
```typescript
try {
  await validate(input);
} catch (error) {
  if (isNonRetryableError(error as Error)) {
    // Permanent failure - fail fast
    throw error;
  }
}
```

### `createSmartRetryCondition(): (error, attempt) => boolean`

Factory function that creates a smart retry condition combining retryable and non-retryable error detection.

**Behavior:**
1. Returns `false` for non-retryable errors (fail fast)
2. Returns `true` for retryable errors (retry)
3. Returns `false` for unknown errors (conservative default)

**Example:**
```typescript
const result = await withRetry(
  () => fetchData(url),
  {
    maxAttempts: 3,
    shouldRetry: createSmartRetryCondition(),
  }
);
```

## Usage Examples

### Example 1: Scraping with Smart Retry

```typescript
import { withRetry, createSmartRetryCondition } from '../utils/retry';
import { logger } from '../utils/logger';

async function scrapeWithRetry(url: string) {
  return withRetry(
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.goto(url, { timeout: 30000 });
        const price = await page.locator('.price').textContent();
        return price;
      } finally {
        await browser.close();
      }
    },
    {
      maxAttempts: 3,
      baseDelayMs: 2000,        // Start with 2s delay
      maxDelayMs: 60000,        // Cap at 60s
      shouldRetry: createSmartRetryCondition(),
      onRetry: (error, attempt, delayMs) => {
        logger.warn({
          url,
          attempt,
          delayMs,
          error: error.message,
        }, `Scrape failed, retrying in ${delayMs}ms`);
      },
    }
  );
}
```

### Example 2: API Call with Custom Retry Logic

```typescript
import { withRetry, isRetryableError } from '../utils/retry';

async function callExternalAPI(endpoint: string) {
  return withRetry(
    () => fetch(endpoint).then(res => res.json()),
    {
      maxAttempts: 5,           // More attempts for external APIs
      baseDelayMs: 1000,
      shouldRetry: (error, attempt) => {
        // Custom logic: only retry first 3 attempts
        if (attempt >= 3) return false;

        // Use built-in retryable error detection
        return isRetryableError(error);
      },
    }
  );
}
```

### Example 3: Database Connection with Retry

```typescript
import { withRetry } from '../utils/retry';

async function connectWithRetry() {
  return withRetry(
    async () => {
      const client = new DatabaseClient();
      await client.connect();
      return client;
    },
    {
      maxAttempts: 5,
      baseDelayMs: 5000,        // 5s base delay for DB
      maxDelayMs: 30000,
      shouldRetry: (error) => {
        const message = error.message.toLowerCase();
        return message.includes('connection') ||
               message.includes('timeout') ||
               message.includes('unavailable');
      },
    }
  );
}
```

### Example 4: File Upload with Progress Logging

```typescript
import { withRetry } from '../utils/retry';
import { logger } from '../utils/logger';

async function uploadFileWithRetry(file: File, url: string) {
  let attemptCount = 0;

  return withRetry(
    async () => {
      attemptCount++;
      logger.info(`Upload attempt ${attemptCount}`);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = new Error(`Upload failed: ${response.status}`) as Error & { statusCode: number };
        error.statusCode = response.status;
        throw error;
      }

      return response.json();
    },
    {
      maxAttempts: 3,
      baseDelayMs: 3000,
      onRetry: (error, attempt, delayMs) => {
        logger.warn({
          fileName: file.name,
          fileSize: file.size,
          attempt,
          delayMs,
          error: error.message,
        }, 'Upload failed, retrying...');
      },
    }
  );
}
```

## Exponential Backoff Behavior

The retry utility implements exponential backoff with jitter:

```
Attempt 1: Initial attempt (no delay)
Attempt 2: baseDelay * 2^0 + jitter = ~1s (if baseDelay=1000ms)
Attempt 3: baseDelay * 2^1 + jitter = ~2s
Attempt 4: baseDelay * 2^2 + jitter = ~4s
...
```

**Jitter**: Random value between 0-1000ms added to each delay to prevent thundering herd problem.

**Example timeline with baseDelay=2000ms:**
```
t=0s:    Attempt 1 fails with ETIMEDOUT
t=2.3s:  Attempt 2 (after ~2s + 300ms jitter)
t=6.7s:  Attempt 3 (after ~4s + 700ms jitter)
t=15.1s: Attempt 4 (after ~8s + 100ms jitter)
```

## Integration with Existing Systems

### BaseAgent Integration

The BaseAgent already has retry logic built-in:

```typescript
// server/agents/base-agent.ts
export class BaseAgent extends EventEmitter {
  constructor(config: AgentConfig) {
    super();
    this.config = {
      retryAttempts: 3,
      retryDelay: 2000,
      ...config,
    };
  }

  // Automatic retry for all tasks
  private async runTaskWithRetry<T>(...) {
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await taskFn();
      } catch (error) {
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }
  }
}
```

**Note:** BaseAgent retries ALL errors. Use the new retry utility for selective retry based on error type.

### Bull Queue Integration

Bull Queue already supports retry configuration:

```typescript
// server/jobs/price-snapshot-queue.ts
await priceSnapshotQueue.add(
  { type: 'scheduled' },
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
);
```

## Best Practices

### 1. Extract Module-Level Retry Configuration (NEW - 2026-01-15)

**Context:** Retry options are often duplicated inline across multiple `withRetry()` calls within the same module, violating DRY principle.

**Problem:** When retry strategy needs adjustment (e.g., increase max delay), you must update multiple locations, risking inconsistencies.

**Source:** `server/services/price-snapshot-service.ts` from TODO_227 (Retry Logic Implementation).

#### ❌ WRONG - Duplicated Retry Options

```typescript
// server/services/price-snapshot-service.ts

// Retry options duplicated in 3 places
async function takeSnapshot(productId: number) {
  return withRetry(
    () => scrapeProduct(productId),
    {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      shouldRetry: createSmartRetryCondition(),
    }
  );
}

async function batchSnapshot(productIds: number[]) {
  return withRetry(
    () => processBatch(productIds),
    {
      maxAttempts: 3,  // Duplicated!
      baseDelayMs: 2000,  // Duplicated!
      maxDelayMs: 30000,  // Duplicated!
      shouldRetry: createSmartRetryCondition(),  // Duplicated!
    }
  );
}

async function insertSnapshots(data: SnapshotData[]) {
  return withRetry(
    () => db.insert(snapshots).values(data),
    {
      maxAttempts: 3,  // Duplicated again!
      baseDelayMs: 1000,  // Different! (inconsistency bug)
      maxDelayMs: 10000,
      shouldRetry: createSmartRetryCondition(),
    }
  );
}
```

**Problems:**
- 3+ copies of similar retry configuration
- Inconsistent delays (2000ms vs 1000ms - unintentional)
- Changing strategy requires updating multiple call sites
- Risk of missing updates, typos

#### ✅ CORRECT - Module-Level Typed Constants

```typescript
// server/services/price-snapshot-service.ts
import { type RetryOptions, createSmartRetryCondition } from '../utils/retry';

// SINGLE SOURCE OF TRUTH for scraping retry strategy
const SNAPSHOT_RETRY_CONFIG: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  shouldRetry: createSmartRetryCondition(),
};

// Different strategy for database operations
const BATCH_INSERT_RETRY_CONFIG: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,  // Faster retries for DB (less network variance)
  maxDelayMs: 10000,
  shouldRetry: createSmartRetryCondition(),
};

// Reuse base config
async function takeSnapshot(productId: number) {
  return withRetry(
    () => scrapeProduct(productId),
    SNAPSHOT_RETRY_CONFIG  // No duplication!
  );
}

async function batchSnapshot(productIds: number[]) {
  return withRetry(
    () => processBatch(productIds),
    SNAPSHOT_RETRY_CONFIG  // Guaranteed consistent!
  );
}

async function insertSnapshots(data: SnapshotData[]) {
  return withRetry(
    () => db.insert(snapshots).values(data),
    BATCH_INSERT_RETRY_CONFIG  // Explicit different strategy
  );
}

// Override for specific case
async function urgentSnapshot(productId: number) {
  return withRetry(
    () => scrapeProduct(productId),
    {
      ...SNAPSHOT_RETRY_CONFIG,
      maxAttempts: 5,  // More retries for urgent jobs
      onRetry: (error, attempt, delay) => {
        logger.warn({ productId, attempt, delay }, 'Urgent snapshot retry');
      },
    }
  );
}
```

#### Type Safety with `Partial<RetryOptions>`

**Why use `Partial<RetryOptions>`:**

```typescript
import { type RetryOptions } from '../utils/retry';

// ✅ CORRECT - Typed as Partial<RetryOptions>
const RETRY_CONFIG: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  // TypeScript verifies property names match RetryOptions
  // TypeScript verifies property types are correct
};

// ❌ WRONG - Untyped object (no type safety)
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxAttempts: 5,  // Typo not caught! (duplicate key)
};

// ❌ WRONG - Typo in property name
const RETRY_CONFIG: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 2000,  // ❌ TypeScript ERROR: 'baseDelay' doesn't exist on RetryOptions
};
```

#### When to Use Module-Level Constants

✅ **Use when:**
- 2+ `withRetry()` calls in same module share retry strategy
- Retry configuration may need adjustment over time
- Consistency important across retry operations
- Clear separation between different retry strategies (scraping vs DB)

❌ **NOT needed when:**
- Only one `withRetry()` call in module
- Each retry legitimately needs unique configuration
- Configuration is highly dynamic (computed at runtime)
- One-off retry usage

#### Naming Convention

**Pattern:** `<OPERATION>_RETRY_CONFIG`

```typescript
const SNAPSHOT_RETRY_CONFIG: Partial<RetryOptions> = { ... };
const BATCH_INSERT_RETRY_CONFIG: Partial<RetryOptions> = { ... };
const API_CALL_RETRY_CONFIG: Partial<RetryOptions> = { ... };
const DATABASE_RETRY_CONFIG: Partial<RetryOptions> = { ... };
```

#### Rationale

- **DRY Principle**: Single source of truth for retry strategy
- **Consistency**: All operations use same retry logic
- **Type Safety**: `Partial<RetryOptions>` catches typos and type errors
- **Maintainability**: Update one constant instead of N call sites
- **Discoverability**: Module-level constants visible at top of file
- **Intent**: Named constants clarify retry strategy (SNAPSHOT vs INSERT)

#### Quality Checklist

- [ ] Module-level constants defined at top of file (after imports)
- [ ] Typed as `Partial<RetryOptions>` for type safety
- [ ] Reused in all `withRetry()` calls with same strategy
- [ ] Spread operator (`...CONFIG`) used for overrides
- [ ] Different strategies have different named constants
- [ ] No duplicated retry options objects in same module

**Source:** TODO_227 retry logic implementation (price-snapshot-service.ts lines 7-20)
**Added:** 2026-01-15

---

### 2. Always Use Smart Retry Logic

✅ **Good** - Fail fast on permanent errors:
```typescript
await withRetry(fn, {
  shouldRetry: createSmartRetryCondition(),
});
```

❌ **Bad** - Retry all errors:
```typescript
await withRetry(fn, {
  // No shouldRetry - retries everything
});
```

### 3. Log Retry Attempts

✅ **Good** - Log for monitoring:
```typescript
await withRetry(fn, {
  onRetry: (error, attempt, delay) => {
    logger.warn({ error: error.message, attempt, delay }, 'Retrying...');
  },
});
```

### 4. Set Appropriate Timeouts

✅ **Good** - Different delays for different operations:
```typescript
// Fast operations (API calls)
{ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000 }

// Slow operations (scraping)
{ maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 60000 }

// Critical operations (DB connections)
{ maxAttempts: 5, baseDelayMs: 5000, maxDelayMs: 30000 }
```

### 5. Handle Cleanup in Finally Blocks

✅ **Good** - Always cleanup resources:
```typescript
await withRetry(async () => {
  const browser = await chromium.launch();
  try {
    return await scrape(browser);
  } finally {
    await browser.close(); // Always cleanup
  }
});
```

## Testing Retry Logic

See `server/utils/__tests__/retry.test.ts` for comprehensive test examples:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRetryableError } from '../retry';

describe('retry logic', () => {
  it('should retry transient failures', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      shouldRetry: isRetryableError,
    });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

## Performance Considerations

### Memory Usage

- Each retry creates a new setTimeout
- Jitter adds randomness (0-1000ms per retry)
- Maximum memory: O(1) per retry operation

### Timing

Example with 3 attempts and baseDelay=2000ms:
- Best case (success on first try): 0ms
- Average case (success on retry 2): ~2.5s
- Worst case (all retries fail): ~6.5s

### Concurrency

The retry utility is safe for concurrent operations:
- Each `withRetry` call is independent
- Jitter prevents thundering herd
- No shared state between calls

## Migration Guide

### From BaseAgent Retry

BaseAgent already has retry - no migration needed. Use the new utility for operations outside BaseAgent:

```typescript
// Before: Manual retry logic
let attempts = 0;
while (attempts < 3) {
  try {
    return await operation();
  } catch (error) {
    attempts++;
    if (attempts >= 3) throw error;
    await sleep(1000 * Math.pow(2, attempts));
  }
}

// After: Use retry utility
return withRetry(
  () => operation(),
  {
    maxAttempts: 3,
    baseDelayMs: 1000,
    shouldRetry: createSmartRetryCondition(),
  }
);
```

## Troubleshooting

### Issue: Retrying non-retryable errors

**Solution:** Use `createSmartRetryCondition()` or implement custom `shouldRetry`:

```typescript
shouldRetry: (error) => {
  if (isNonRetryableError(error)) return false;
  return isRetryableError(error);
}
```

### Issue: Too many retries causing delays

**Solution:** Reduce `maxAttempts` or `baseDelayMs`:

```typescript
{
  maxAttempts: 2,        // Fewer attempts
  baseDelayMs: 500,      // Shorter delays
  maxDelayMs: 5000,      // Lower cap
}
```

### Issue: Retry attempts not logged

**Solution:** Add `onRetry` callback:

```typescript
{
  onRetry: (error, attempt, delayMs) => {
    logger.warn(`Retry ${attempt} in ${delayMs}ms: ${error.message}`);
  },
}
```

## References

- Implementation: `server/utils/retry.ts`
- Tests: `server/utils/__tests__/retry.test.ts`
- TODO Resolution: `todos/TODO_217_SCRAPER_RETRY_LOGIC.md`
- Pattern: `docs/01_TYPESCRIPT_PATTERNS.md` (async/await, error handling)
- Pattern: `docs/06_ERROR_HANDLING_PATTERNS.md` (error classification)
