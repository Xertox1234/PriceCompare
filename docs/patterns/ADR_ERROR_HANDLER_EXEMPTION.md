# ADR: Error Handler Middleware Exemption from sendError() Standardization

**Status:** Accepted
**Date:** 2025-12-04
**Context:** Phase 3 - API Response Standardization (GitHub Issue #162, TODO 007)
**Decision Maker:** Architectural Review

---

## Context and Problem Statement

During the API response standardization migration (Phase 4g - Issue #162), all routes and middleware were migrated to use standardized response helpers (`sendSuccess()`, `sendError()`, `sendErrorFromException()`). The error handler middleware (`server/middleware/error-handler.ts`) was flagged for review because it uses manual `res.status().json()` calls instead of the standardized helpers.

The question: **Should the error handler middleware use `sendError()`, or should it remain as a documented exception?**

---

## Decision Drivers

1. **Architectural Layering**: Clear separation between response formatters (api-response.ts) and error catch-all (error-handler.ts)
2. **Circular Dependency Risk**: Avoid conceptual circularity where error handlers use the same tools they're meant to back up
3. **Format Consistency**: All error responses must use the same envelope format
4. **Maintainability**: Minimize coupling between core infrastructure components
5. **Safety Net Principle**: Error handler is the last resort and should not depend on higher-level abstractions

---

## Architecture Analysis

### Current Error Flow Architecture

**Three distinct error paths exist:**

#### Path A: Direct Error Response (Primary - 99% of cases)
```
Route → sendError() → res.status().json() → Client
```
- Error handled explicitly in route
- Error handler middleware NOT invoked
- Direct response, no exceptions thrown

#### Path B: Caught Exception Response
```
Route → try/catch → sendErrorFromException() → res.status().json() → Client
```
- Exception caught in route handler
- Error handler middleware NOT invoked
- Converted to direct response

#### Path C: Uncaught Exception (Fallback - <1% of cases)
```
Route → throw Error → error-handler → res.status().json() → Client
```
- Exception NOT caught anywhere
- Error handler middleware IS invoked (last resort)
- Safety net for programming errors

### Dependency Analysis

**Current state:**
- `api-response.ts` does NOT import from `error-handler.ts` ✅
- `error-handler.ts` DOES import `sendError()` from `api-response.ts` (notFoundHandler only)
- Dependency direction: `error-handler → api-response` (one-way)

**No technical circular dependency**, but conceptual concern exists:
- Error handler is meant to be the lowest-level safety net
- Using higher-level helpers (sendError) creates conceptual layering violation
- Exception: `notFoundHandler` is not a catch-all handler - it's more like a route endpoint

---

## Critical Inconsistency Found

**IMPORTANT BUG DISCOVERED**: `AppError.toJSON()` does NOT include the `success: false` field, breaking the standardized envelope format.

### Current Format Comparison

| Error Source | `success` field | Format Consistency |
|--------------|----------------|-------------------|
| `sendError()` | ✅ `success: false` | Reference format |
| ZodError handler | ✅ `success: false` | Consistent |
| Database error handler | ✅ `success: false` | Consistent |
| Unknown error handler | ✅ `success: false` | Consistent |
| **AppError.toJSON()** | ❌ **MISSING** | **INCONSISTENT** |

### AppError Current Format (BROKEN)
```typescript
// server/utils/errors.ts (lines 24-34)
toJSON() {
  return {
    error: this.message,           // ✅ Has error field
    code: this.code,
    statusCode: this.statusCode,
    // ❌ MISSING: success: false
    ...(process.env.NODE_ENV === 'development' && {
      stack: this.stack,
      metadata: this.metadata,
    }),
  };
}
```

**Impact**: AppError instances (used in 5+ locations) return inconsistent error format when thrown.

---

## Decision

### Option Selected: **Hybrid Approach with Bug Fix**

**Primary Decision: Keep error-handler.ts as EXCEPTION from sendError() usage**

**Rationale:**
1. **Architectural Layering**: Error handler is the implementation layer for error responses, not a consumer
2. **Safety Net Principle**: Last-resort handler should not depend on abstractions it's meant to back up
3. **Conceptual Clarity**: Error handler IS the error response formatter, using sendError() would be circular
4. **Single Responsibility**: error-handler.ts owns the catch-all error formatting logic

**Secondary Decision: Fix AppError.toJSON() to include `success: false`**

**Rationale:**
1. **Format Consistency**: ALL error responses must have `success: false` discriminator
2. **Type Safety**: Frontend expects discriminated union with `success` field
3. **API Contract**: Breaks existing API response contract
4. **Critical Bug**: This is a production bug, not a style preference

**Tertiary Decision: Document notFoundHandler as special case**

**Rationale:**
1. `notFoundHandler` is NOT a catch-all error handler
2. It's a route-like handler (handles specific case: 404)
3. Using `sendError()` in notFoundHandler is appropriate and should continue

---

## Consequences

### Positive

1. **Clear Architectural Boundaries**
   - api-response.ts = Response formatter utilities
   - error-handler.ts = Catch-all error middleware (uses manual responses)
   - No conceptual circularity

2. **Reduced Coupling**
   - Error handler doesn't depend on higher-level abstractions
   - Safety net remains independent

3. **Format Consistency Achieved**
   - AppError.toJSON() fix ensures ALL errors have `success: false`
   - All error paths now produce identical envelope format

4. **Documentation Clarity**
   - Exception explicitly documented
   - Rationale codified for future maintainers

### Negative

1. **Code Duplication**
   - Manual `res.status().json({ success: false, ... })` in error-handler.ts
   - Similar logic in sendError() helper
   - **Mitigation**: Document why duplication is intentional

2. **Maintenance Burden**
   - Future envelope format changes need updates in TWO places
   - **Mitigation**: Add comment in both files cross-referencing each other

### Neutral

1. **notFoundHandler Exception**
   - Uses sendError() (only error-handler.ts code that does)
   - Documented as special case (route-like, not catch-all)

---

## Implementation Plan

### Phase 1: Fix AppError.toJSON() (CRITICAL BUG)

```typescript
// server/utils/errors.ts
toJSON() {
  return {
    success: false,  // ✅ ADD THIS LINE
    error: this.message,
    code: this.code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: this.stack,
      metadata: this.metadata,
    }),
  };
}
```

**Note**: Remove `statusCode` from JSON response - HTTP status is in response header, not body.

### Phase 2: Document Exception in CLAUDE.md

Add to "Middleware API Patterns" section:

```markdown
**Error Handler Middleware (EXCEPTION)**:

The error handler middleware (`server/middleware/error-handler.ts`) is EXEMPT from using `sendError()` helpers for the following reasons:

1. **Architectural Layer**: Error handler IS the implementation layer for error responses
2. **Safety Net**: Last-resort handler should not depend on abstractions
3. **Format Consistency**: Achieved through AppError.toJSON() standardization, not code sharing

Exception: `notFoundHandler()` uses `sendError()` because it's a route-like handler (handles specific 404 case), not a catch-all error handler.
```

### Phase 3: Add Cross-Reference Comments

```typescript
// server/middleware/error-handler.ts (top of file)
/**
 * ARCHITECTURAL NOTE:
 * This error handler uses manual res.status().json() calls instead of sendError() helpers.
 * This is INTENTIONAL - see ADR_ERROR_HANDLER_EXEMPTION.md for rationale.
 *
 * Format must match server/utils/api-response.ts sendError() envelope:
 * { success: false, error: string, code?: string, details?: unknown }
 */

// server/utils/api-response.ts (top of sendError function)
/**
 * ARCHITECTURAL NOTE:
 * Error handler middleware (server/middleware/error-handler.ts) uses manual responses
 * and does NOT use this helper. Format must remain consistent between layers.
 * See ADR_ERROR_HANDLER_EXEMPTION.md for rationale.
 */
```

### Phase 4: Update Documentation

1. `docs/03_API_PATTERNS.md` - Add error handler exemption section
2. `CLAUDE.md` - Update middleware patterns section
3. Create this ADR document for future reference

---

## Testing Strategy

### Test 1: AppError Format Verification
```typescript
// Verify AppError includes success: false
const err = new ValidationError('Test error');
const json = err.toJSON();
expect(json.success).toBe(false);
expect(json.error).toBe('Test error');
expect(json.code).toBe('VALIDATION_ERROR');
```

### Test 2: Error Handler Response Format
```typescript
// Verify error handler produces correct envelope
// Test uncaught exception handling
app.get('/test-error', () => {
  throw new Error('Test error');
});

const res = await request(app).get('/test-error');
expect(res.body.success).toBe(false);
expect(res.body.error).toBeDefined();
```

### Test 3: Format Consistency Across Paths
```typescript
// Verify all error paths produce same envelope shape
const formats = [
  sendErrorResponse,        // Path A
  caughtExceptionResponse,  // Path B
  uncaughtExceptionResponse // Path C
];

formats.forEach(format => {
  expect(format).toHaveProperty('success', false);
  expect(format).toHaveProperty('error');
});
```

---

## Compliance Checklist

- [x] Error flow documented (3 paths identified)
- [x] Circular dependency check complete (no technical circular dependency)
- [x] Decision made: Keep error-handler as exception, fix AppError.toJSON()
- [x] Critical bug identified: AppError missing `success: false`
- [x] Documentation plan defined
- [x] Testing strategy outlined
- [x] Rationale clearly articulated

---

## References

- GitHub Issue #162: API Response Standardization
- TODO 007: Error Handler Middleware Review
- `server/middleware/error-handler.ts` (lines 54, 60-66, 70-77, 84-92)
- `server/utils/api-response.ts` (sendError implementation)
- `server/utils/errors.ts` (AppError.toJSON implementation)
- `docs/03_API_PATTERNS.md` (Middleware Error Responses section)

---

## Revision History

- 2025-12-04: Initial decision - Keep exception, fix AppError.toJSON()
- 2025-12-04: Added format consistency analysis
- 2025-12-04: Identified critical AppError.toJSON() bug
