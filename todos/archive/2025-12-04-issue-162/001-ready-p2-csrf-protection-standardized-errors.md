# TODO 001: Migrate CSRF Protection to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/security.ts`
**Estimated Time**: 0.5 hours
**Status**: Ready

## Problem Statement

The `csrfProtection` middleware in `server/middleware/security.ts` uses manual `res.status().json()` calls for error responses instead of the standardized `sendError()` helper from `utils/api-response.ts`. This violates the 100% API response standardization mandate documented in CLAUDE.md.

## Root Cause

Legacy code written before the API response standardization initiative (completed 2025-11-28). The middleware predates the `sendError()` helper and was not included in the initial migration.

## Solution Approach

Replace 3 manual error response calls with `sendError()` helper while maintaining existing security logging and response structure.

## Implementation Steps

### Step 1: Import standardized helper

- [ ] Add `import { sendError } from '../utils/api-response';` at top of file

### Step 2: Replace manual error responses

- [ ] Line 187-192: Replace CSRF token missing error
- [ ] Line 214-217: Replace invalid CSRF token (mismatch) error
- [ ] Line 233-236: Replace invalid CSRF token (format) error

### Step 3: Verify security logging unchanged

- [ ] Confirm `logSecurityEvent()` calls remain before error responses
- [ ] Verify response format matches existing tests

## Technical Details

**Current Pattern (3 instances):**
```typescript
// Line 187-192: CSRF token missing
res.status(403).json({
  success: false,
  error: 'CSRF token missing',
  message: 'CSRF token is required for this request'
});

// Line 214-217: Invalid token (mismatch)
res.status(403).json({
  success: false,
  error: 'Invalid CSRF token'
});

// Line 233-236: Invalid token (format)
res.status(403).json({
  success: false,
  error: 'Invalid CSRF token'
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 187-192: CSRF token missing
sendError(res, 'CSRF token missing', 403, 'CSRF token is required for this request');

// Line 214-217 & 233-236: Invalid token
sendError(res, 'Invalid CSRF token', 403);
```

## Checklist

- [ ] Implementation complete
- [ ] Tests pass (csrf.test.ts)
- [ ] Security logging unchanged
- [ ] Error response format validated

## Success Criteria

- [ ] All 3 manual `res.status().json()` calls replaced with `sendError()`
- [ ] `npm test server/middleware/__tests__/csrf.test.ts` passes
- [ ] No changes to security event logging
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual JSON responses remain in CSRF protection
  ```bash
  grep -A 2 "res.status(403).json" server/middleware/security.ts
  # Should return: No matches in csrfProtection function

  grep "sendError" server/middleware/security.ts
  # Should return: 3+ matches (import + 3 calls)
  ```

- [ ] **File inspection**: Manually verify changes
  ```bash
  git diff server/middleware/security.ts
  # Should show sendError imports and replacements
  ```

### Testing
- [ ] **Run CSRF tests**:
  ```bash
  npm test server/middleware/__tests__/csrf.test.ts
  # All tests should pass
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  # Should complete with no errors
  ```

- [ ] **ESLint check**:
  ```bash
  npm run lint
  # Should pass with no errors
  ```

### Integration
- [ ] **Verify security.ts line count**: ~456 lines → ~454 lines (net -2 lines)
- [ ] **Check related middleware**: Ensure pattern consistent across files

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: CLAUDE.md (API Response Standardization section)
