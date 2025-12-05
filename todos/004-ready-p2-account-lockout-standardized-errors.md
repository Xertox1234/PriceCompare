# TODO 004: Migrate Account Lockout Middleware to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/account-lockout.ts`
**Estimated Time**: 0.25 hours
**Status**: Ready

## Problem Statement

The `checkAccountLockout` middleware in `server/middleware/account-lockout.ts` uses manual `res.status(429).json()` call for locked account errors (line 446-453) instead of standardized `sendError()` helper.

## Root Cause

Account lockout middleware written before API response standardization initiative.

## Solution Approach

Replace manual error response with `sendError()` helper while preserving lockout details (remainingTime, attempts).

## Implementation Steps

### Step 1: Import sendError helper

- [ ] Add `import { sendError } from '../utils/api-response';`

### Step 2: Replace locked account response

- [ ] Line 446-453: Replace manual JSON with `sendError()`
- [ ] Preserve locked status, remainingTime, attempts in details
- [ ] Maintain Retry-After header setting
- [ ] Keep user-friendly message generation

## Technical Details

**Current Pattern:**
```typescript
// Line 446-453: Account locked response
return res.status(429).json({
  success: false,
  error: 'Account temporarily locked due to too many failed login attempts',
  locked: true,
  remainingTime: lockStatus.remainingTime,
  message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
  attempts: lockStatus.attempts,
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 446-453
sendError(
  res,
  'Account temporarily locked due to too many failed login attempts',
  429,
  {
    locked: true,
    remainingTime: lockStatus.remainingTime,
    message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
    attempts: lockStatus.attempts,
  }
);
```

**Note**: Retry-After header (line 444) is set BEFORE sendError() call, so it's preserved.

## Checklist

- [ ] Implementation complete
- [ ] Account lockout tests pass
- [ ] Retry-After header preserved
- [ ] Lockout details (locked, remainingTime, attempts) included

## Success Criteria

- [ ] Manual `res.status(429).json()` replaced with `sendError()`
- [ ] `npm test server/middleware/__tests__/account-lockout.test.ts` passes
- [ ] All lockout details preserved in response
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 429 in checkAccountLockout
  ```bash
  grep "res.status(429)" server/middleware/account-lockout.ts
  # Should return: No matches

  grep "sendError" server/middleware/account-lockout.ts
  # Should return: 1 match (import + call)
  ```

### Testing
- [ ] **Run account lockout tests**:
  ```bash
  npm test server/middleware/__tests__/account-lockout.test.ts
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
**Related**: Account security, rate limiting
