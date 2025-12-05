# TODO 008: Migrate 404 Not Found Handler to Standardized Error Responses

**Priority**: P3
**File(s)**: `server/middleware/error-handler.ts`
**Estimated Time**: 0.25 hours
**Status**: Ready

## Problem Statement

The `notFoundHandler` middleware in `server/middleware/error-handler.ts` uses manual `res.status(404).json()` call (lines 112-118) instead of standardized `sendError()` helper.

## Root Cause

404 handler written before API response standardization. Located in same file as error-handler but serves different purpose (route not found vs error handling).

## Solution Approach

Replace manual error response with `sendError()` helper while preserving path and method details.

## Implementation Steps

### Step 1: Import sendError helper

- [ ] Add `import { sendError } from '../utils/api-response';` (if not already present)

### Step 2: Replace 404 response

- [ ] Line 112-118: Replace manual JSON with `sendError()`
- [ ] Pass path, method, and code in details parameter
- [ ] Maintain user-friendly error message

## Technical Details

**Current Pattern:**
```typescript
// Line 112-118: 404 Not Found
export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}
```

**New Pattern:**
```typescript
import { sendError } from '../utils/api-response';

export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  sendError(res, 'Route not found', 404, {
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}
```

## Checklist

- [ ] Implementation complete
- [ ] 404 tests pass (if they exist)
- [ ] Path and method preserved in response
- [ ] Response format validated

## Success Criteria

- [ ] Manual `res.status(404).json()` replaced with `sendError()`
- [ ] 404 response includes path, method, code
- [ ] TypeScript compilation successful
- [ ] No regressions in route not found behavior

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm no manual 404 in notFoundHandler
  ```bash
  grep "res.status(404)" server/middleware/error-handler.ts
  # Should return: No matches

  grep "sendError" server/middleware/error-handler.ts
  # Should return: 1+ matches
  ```

### Testing
- [ ] **Manual test**: Verify 404 response format
  ```bash
  # Start dev server and test 404 route
  curl -X GET http://localhost:5000/api/nonexistent
  # Should return standardized error envelope
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  ```

---

**Source**: Triage session on 2025-12-04
**Category**: API Response Standardization
**Related**: TODO 007 (error-handler.ts architectural review)
**Note**: Lower priority (P3) because 404s are less critical than security middleware
