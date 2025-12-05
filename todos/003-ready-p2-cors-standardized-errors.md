# TODO 003: Migrate CORS Middleware to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/security.ts`
**Estimated Time**: 0.25 hours
**Status**: Ready

## Problem Statement

The `corsMiddleware` function in `server/middleware/security.ts` uses manual `res.status(403).json()` call for disallowed origin errors (line 446-449) instead of standardized `sendError()` helper.

## Root Cause

Legacy CORS implementation predating API response standardization.

## Solution Approach

Replace single manual error response with `sendError()` helper while maintaining security logging.

## Implementation Steps

### Step 1: Replace OPTIONS preflight rejection

- [ ] Line 446-449: Replace manual JSON response
- [ ] Maintain security logging before error response
- [ ] Preserve 403 status code

## Technical Details

**Current Pattern:**
```typescript
// Line 446-449: Reject preflight for disallowed origins
res.status(403).json({
  success: false,
  error: 'Origin not allowed'
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 446-449
sendError(res, 'Origin not allowed', 403);
```

## Checklist

- [ ] Implementation complete
- [ ] CORS tests pass
- [ ] Security logging unchanged
- [ ] Response format validated

## Success Criteria

- [ ] Manual `res.status(403).json()` call replaced in corsMiddleware
- [ ] CORS tests pass
- [ ] Security event logging preserved
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 403 in CORS
  ```bash
  # Check corsMiddleware function specifically
  sed -n '/^export function corsMiddleware/,/^}/p' server/middleware/security.ts | grep "res.status(403)"
  # Should return: No matches
  ```

### Testing
- [ ] **Run security tests**:
  ```bash
  npm test server/middleware/__tests__/security-headers.test.ts
  ```

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: TODO 001, TODO 002 (same file - security.ts)
