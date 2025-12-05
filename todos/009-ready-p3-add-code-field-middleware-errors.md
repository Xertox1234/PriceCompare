# TODO 009: Add `code` Field to Middleware Error Responses

**Priority**: P3 (Nice-to-have)
**File(s)**: `server/middleware/account-lockout.ts`, `server/middleware/redis-rate-limiter.ts`, `server/middleware/request-limits.ts`, `server/middleware/security.ts`
**Estimated Time**: 1 hour
**Status**: Ready

## Problem Statement

Middleware error responses currently lack explicit `code` fields for programmatic client handling. The error-handler.ts middleware includes codes like `'VALIDATION_ERROR'`, `'DATABASE_ERROR'`, `'NOT_FOUND'`, but middleware responses only include the `error` message field.

This inconsistency makes it harder for API clients to programmatically handle specific error types (e.g., distinguishing between rate limit vs account lockout).

## Root Cause

The middleware standardization work (issue #162) focused on response format consistency but didn't add error codes. This was identified as an enhancement during code review.

## Solution Approach

Add explicit `code` field to middleware error responses for consistency with error-handler.ts pattern. The code field enables programmatic client handling while maintaining backward compatibility (additive change only).

## Implementation Steps

### Step 1: Account Lockout Middleware

- [ ] Add `code: 'ACCOUNT_LOCKED'` to sendError details (line ~452)
- [ ] Current: `{ locked: true, remainingTime, message, attempts }`
- [ ] Updated: `{ code: 'ACCOUNT_LOCKED', locked: true, remainingTime, message, attempts }`

### Step 2: Redis Rate Limiter

- [ ] Add `code: 'RATE_LIMIT_EXCEEDED'` to sendError details (line ~391)
- [ ] Current: `{ retryAfter }`
- [ ] Updated: `{ code: 'RATE_LIMIT_EXCEEDED', retryAfter }`

### Step 3: In-Memory Rate Limiter (security.ts)

- [ ] Add `code: 'RATE_LIMIT_EXCEEDED'` to capacity exceeded error (line ~77)
- [ ] Add `code: 'RATE_LIMIT_EXCEEDED'` to rate limit exceeded error (line ~101)

### Step 4: Request Size Limiter

- [ ] Add `code: 'PAYLOAD_TOO_LARGE'` to requestSizeLimiter (line ~75)
- [ ] Add `code: 'PAYLOAD_TOO_LARGE'` to rejectOversizedRequests (line ~136)

### Step 5: CSRF Protection (Optional - Security Consideration)

- [ ] Consider adding `code: 'CSRF_TOKEN_MISSING'` and `code: 'CSRF_TOKEN_INVALID'`
- [ ] Review: Does this leak implementation details? (Probably OK for standardized security)

## Technical Details

**Pattern (from error-handler.ts)**:
```typescript
return res.status(400).json({
  success: false,
  error: 'Validation failed',
  code: 'VALIDATION_ERROR',  // <-- Consistent pattern
  details: zodError.errors,
});
```

**Proposed Middleware Pattern**:
```typescript
// Account lockout (line 452)
sendError(
  res,
  'Account temporarily locked due to too many failed login attempts',
  429,
  {
    code: 'ACCOUNT_LOCKED',  // ADD THIS
    locked: true,
    remainingTime: lockStatus.remainingTime,
    message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
    attempts: lockStatus.attempts,
  }
);

// Rate limiter (line 391)
sendError(res, message, 429, {
  code: 'RATE_LIMIT_EXCEEDED',  // ADD THIS
  retryAfter: Math.ceil((info.reset - Date.now()) / 1000)
});

// Request size limiter (line 75)
sendError(res, 'Request payload too large', 413, {
  code: 'PAYLOAD_TOO_LARGE',  // ADD THIS
  maxSize: limit,
  receivedSize: formatBytes(sizeInBytes)
});
```

## Error Code Naming Conventions

Follow existing error-handler.ts patterns:
- **Uppercase with underscores**: `RATE_LIMIT_EXCEEDED` (not `rateLimitExceeded`)
- **Descriptive and specific**: `ACCOUNT_LOCKED` (not `LOCKED` or `ERROR`)
- **Action-oriented for errors**: `TOKEN_INVALID` (not `INVALID_TOKEN`)

**Suggested Codes**:
- Account lockout: `ACCOUNT_LOCKED`
- Rate limiting: `RATE_LIMIT_EXCEEDED`
- Request size: `PAYLOAD_TOO_LARGE`
- CSRF (optional): `CSRF_TOKEN_MISSING`, `CSRF_TOKEN_INVALID`
- CORS (optional): `ORIGIN_NOT_ALLOWED`

## Checklist

- [ ] All middleware error responses include `code` field
- [ ] Code names follow UPPERCASE_WITH_UNDERSCORES convention
- [ ] Codes are descriptive and action-oriented
- [ ] Tests updated to verify `code` field presence
- [ ] TypeScript compilation successful
- [ ] No breaking changes (additive only)

## Success Criteria

- [ ] All 429 errors include appropriate code field
- [ ] All 413 errors include appropriate code field
- [ ] All 403 errors include appropriate code field (CSRF/CORS)
- [ ] Client code can programmatically distinguish error types
- [ ] Backward compatible (existing clients ignore new field)
- [ ] Tests verify code field in responses

## Benefits

1. **Programmatic Handling**: Clients can switch on error codes instead of parsing strings
2. **Consistency**: Matches error-handler.ts pattern across entire API
3. **Clarity**: Explicit codes make error types immediately obvious
4. **Future-Proof**: Enables localization without breaking client logic
5. **Developer Experience**: Better IDE autocomplete and type safety

## Example Client Usage

```typescript
// Before (fragile string matching)
if (error.error.includes('locked')) {
  showAccountLockedMessage(error.remainingTime);
}

// After (robust code matching)
if (error.code === 'ACCOUNT_LOCKED') {
  showAccountLockedMessage(error.remainingTime);
}
```

---

**Source**: Code review enhancement suggestion from issue #162
**Category**: API Consistency / Developer Experience
**Related**: error-handler.ts error code pattern, client SDK development
**Backward Compatible**: Yes (additive change only)
