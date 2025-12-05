# TODO 006: Migrate Request Size Limiter to Standardized Error Responses

**Priority**: P2
**File(s)**: `server/middleware/request-limits.ts`
**Estimated Time**: 0.5 hours
**Status**: Ready

## Problem Statement

The `requestSizeLimiter` and `rejectOversizedRequests` middleware in `server/middleware/request-limits.ts` use manual `res.status(413).json()` calls for error responses (lines 74-79 and 134-138) instead of standardized `sendError()` helper.

## Root Cause

Request size limiting middleware written before API response standardization initiative.

## Solution Approach

Replace 2 manual error responses with `sendError()` helper while preserving size limit details (maxSize, receivedSize).

## Implementation Steps

### Step 1: Import sendError helper

- [ ] Add `import { sendError } from '../utils/api-response';`

### Step 2: Replace requestSizeLimiter error (lines 74-79)

- [ ] Replace manual JSON response
- [ ] Pass maxSize and receivedSize in details

### Step 3: Replace rejectOversizedRequests error (lines 134-138)

- [ ] Replace manual JSON response
- [ ] Pass maxSize in details

## Technical Details

**Current Pattern:**
```typescript
// Line 74-79: Content-Length exceeds limit
return res.status(413).json({
  success: false,
  error: 'Request payload too large',
  maxSize: limit,
  receivedSize: formatBytes(sizeInBytes)
});

// Line 134-138: Stream exceeds limit
res.status(413).json({
  success: false,
  error: 'Request entity too large',
  maxSize: formatBytes(maxSize)
});
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

// Line 74-79
sendError(res, 'Request payload too large', 413, {
  maxSize: limit,
  receivedSize: formatBytes(sizeInBytes)
});

// Line 134-138
sendError(res, 'Request entity too large', 413, {
  maxSize: formatBytes(maxSize)
});
```

## Checklist

- [ ] Implementation complete
- [ ] Request size tests pass
- [ ] Size details preserved in response
- [ ] Both middleware functions updated

## Success Criteria

- [ ] Both manual `res.status(413).json()` calls replaced
- [ ] Request size limits tests pass
- [ ] Size information (maxSize, receivedSize) preserved
- [ ] TypeScript compilation successful

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 413 responses
  ```bash
  grep "res.status(413)" server/middleware/request-limits.ts
  # Should return: No matches

  grep "sendError" server/middleware/request-limits.ts
  # Should return: 2 matches (import + 2 calls)
  ```

### Testing
- [ ] **Run request limits tests** (if they exist):
  ```bash
  npm test server/middleware/__tests__/request-limits.test.ts
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  ```

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: Request security, DoS prevention
