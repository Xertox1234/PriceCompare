# TODO 007: Review Error Handler Middleware for Standardization Opportunities

**Priority**: P3
**File(s)**: `server/middleware/error-handler.ts`
**Estimated Time**: 0.5 hours
**Status**: Ready

## Problem Statement

The `error-handler.ts` middleware uses manual `res.status().json()` calls for error responses (lines 54, 60-65, 70-77, 84-92, 112-118). However, this middleware is a **special case** because:

1. It's the **centralized error handler** - the last middleware in the chain
2. It handles errors from `sendError()` itself (via AppError class)
3. It formats error responses for the entire application

This needs review to determine if standardization applies or if exceptions are justified.

## Root Cause

Error handler middleware is architecturally different from route middleware - it's the response formatter itself, not a consumer of formatters.

## Solution Approach

**Two possible approaches:**

### Option A: Keep as-is (Exception)
- Document why error-handler.ts is exempt from sendError() usage
- It's the lowest-level error response generator
- Using sendError() here would create circular dependency risk

### Option B: Partial Standardization
- Extract common response format into shared utility
- Keep error-handler.ts as formatter but ensure consistency
- Use standardized envelope format

## Implementation Steps

### Step 1: Analyze architecture

- [ ] Review error flow: Route → sendError() → AppError → error-handler
- [ ] Check if sendError() uses error-handler internally
- [ ] Document error response path

### Step 2: Make decision

- [ ] If exception: Document in CLAUDE.md under "Middleware API Patterns"
- [ ] If standardization: Create refactor plan with AppError integration

### Step 3: Document outcome

- [ ] Update docs/03_API_PATTERNS.md with error handler exemption (if applicable)
- [ ] Add architectural decision record (ADR) if keeping exception

## Technical Details

**Current Pattern:**
```typescript
// Error handler returns manual responses
if (err instanceof AppError) {
  return res.status(err.statusCode).json(err.toJSON());
}

if (err.name === 'ZodError') {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: zodError.errors,
  });
}
```

**Architectural Question:**
- Should the error handler use sendError()?
- Or is error-handler.ts the implementation layer for sendError()?

## Checklist

- [ ] Error flow documented
- [ ] Circular dependency check complete
- [ ] Decision made (exception vs standardization)
- [ ] Documentation updated

## Success Criteria

- [ ] Clear architectural decision documented
- [ ] CLAUDE.md updated with error handler guidance
- [ ] No regressions in error handling
- [ ] Error response format remains consistent

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Architecture review**: Confirm error flow understanding
  ```bash
  grep -r "import.*error-handler" server/
  # Where is error-handler used?

  grep -r "AppError" server/utils/api-response.ts
  # How does sendError() relate to AppError?
  ```

### Documentation
- [ ] **ADR created** (if keeping exception):
  - Title: "Error Handler Middleware Exemption from sendError() Standardization"
  - Location: `docs/03_API_PATTERNS.md` or separate ADR file
  - Rationale documented

- [ ] **CLAUDE.md updated**: Exception clearly stated

---

**Source**: Triage session on 2025-12-04
**Category**: Architecture Review / API Response Standardization
**Related**: AppError class, sendError() implementation
**Note**: This is a review task, not a direct refactor - decision may be "no change needed"
