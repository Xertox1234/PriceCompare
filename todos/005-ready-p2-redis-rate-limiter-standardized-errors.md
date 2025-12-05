# TODO 005: Migrate Redis Rate Limiter to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/redis-rate-limiter.ts`
**Estimated Time**: 0.25 hours
**Status**: Ready

## Problem Statement

The `createRateLimiter` middleware in `server/middleware/redis-rate-limiter.ts` uses manual `res.status(429).json()` call for rate limit exceeded errors (line 385-389) instead of standardized `sendError()` helper.

## Root Cause

Redis-based rate limiter written before API response standardization. This is the primary rate limiter used in production (when Redis is available).

## Solution Approach

Replace manual error response with `sendError()` helper while preserving rate limit headers and retryAfter calculation.

## Implementation Steps

### Step 1: Import sendError helper

- [ ] Add `import { sendError } from '../utils/api-response';`

### Step 2: Replace rate limit exceeded response

- [ ] Line 385-389: Replace manual JSON with `sendError()`
- [ ] Pass `retryAfter` in details parameter
- [ ] Verify rate limit headers set before error response (lines 366-369)

## Technical Details

**Current Pattern:**
```typescript
// Line 385-389: Rate limit exceeded
res.status(429).json({
  success: false,
  error: message,
  retryAfter: Math.ceil((info.reset - Date.now()) / 1000),
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 385-389
sendError(res, message, 429, {
  retryAfter: Math.ceil((info.reset - Date.now()) / 1000)
});
```

**Note**: Rate limit headers (X-RateLimit-*, lines 366-369) are set BEFORE sendError() call, so they're preserved.

## Checklist

- [ ] Implementation complete
- [ ] Redis rate limiter tests pass
- [ ] Rate limit headers preserved
- [ ] retryAfter included in response

## Success Criteria

- [ ] Manual `res.status(429).json()` replaced with `sendError()`
- [ ] `npm test server/middleware/__tests__/redis-rate-limiter.test.ts` passes
- [ ] Rate limit headers (X-RateLimit-*) preserved
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 429 in createRateLimiter
  ```bash
  grep "res.status(429)" server/middleware/redis-rate-limiter.ts
  # Should return: No matches

  grep "sendError" server/middleware/redis-rate-limiter.ts
  # Should return: 1 match (import + call)
  ```

### Testing
- [ ] **Run Redis rate limiter tests**:
  ```bash
  npm test server/middleware/__tests__/redis-rate-limiter.test.ts
  npm test server/middleware/__tests__/redis-rate-limiter.integration.test.ts
  # All tests should pass
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  ```

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: TODO 002 (in-memory rate limiter fallback)
