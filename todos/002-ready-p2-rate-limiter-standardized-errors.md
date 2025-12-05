# TODO 002: Migrate Rate Limiter (security.ts) to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/security.ts`
**Estimated Time**: 0.5 hours
**Status**: Ready

## Problem Statement

The `rateLimiter` middleware in `server/middleware/security.ts` uses manual `res.status(429).json()` calls for error responses instead of the standardized `sendError()` helper. Two instances exist (lines 76-80 and 103-107).

## Root Cause

Legacy in-memory rate limiter written before API response standardization. This is the fallback rate limiter used when Redis is unavailable.

## Solution Approach

Replace 2 manual 429 error responses with `sendError()` helper while preserving rate limit headers (`retryAfter`).

## Implementation Steps

### Step 1: Replace capacity-exceeded error (lines 76-80)

- [ ] Replace manual JSON response with `sendError()`
- [ ] Pass `retryAfter: 60` as details parameter

### Step 2: Replace rate-limit-exceeded error (lines 103-107)

- [ ] Replace manual JSON response with `sendError()`
- [ ] Calculate and pass `retryAfter` in details

### Step 3: Verify compatibility with Redis rate limiter

- [ ] Ensure response format matches `redis-rate-limiter.ts` pattern
- [ ] Confirm tests handle standardized responses

## Technical Details

**Current Pattern:**
```typescript
// Line 76-80: Capacity exceeded
res.status(429).json({
  success: false,
  error: 'Service temporarily unavailable due to high load',
  retryAfter: 60
});

// Line 103-107: Rate limit exceeded
res.status(429).json({
  success: false,
  error: message,
  retryAfter: Math.ceil((record.resetTime - now) / 1000)
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 76-80: Capacity exceeded
sendError(res, 'Service temporarily unavailable due to high load', 429, { retryAfter: 60 });

// Line 103-107: Rate limit exceeded
sendError(res, message, 429, {
  retryAfter: Math.ceil((record.resetTime - now) / 1000)
});
```

## Checklist

- [ ] Implementation complete
- [ ] Tests pass (security tests)
- [ ] Response format validated
- [ ] retryAfter preserved in response

## Success Criteria

- [ ] Both manual `res.status(429).json()` calls replaced
- [ ] `npm test server/middleware/__tests__/security-headers.test.ts` passes
- [ ] Rate limit behavior unchanged
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 429 responses in rateLimiter
  ```bash
  grep -A 2 "res.status(429)" server/middleware/security.ts
  # Should return: No matches in rateLimiter function

  grep "sendError.*429" server/middleware/security.ts
  # Should return: 2 matches
  ```

### Testing
- [ ] **Run security tests**:
  ```bash
  npm test server/middleware/__tests__/security-headers.test.ts
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  ```

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: TODO 001 (same file)
