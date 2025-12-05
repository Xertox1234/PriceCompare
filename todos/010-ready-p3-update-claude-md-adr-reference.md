# TODO 010: Update CLAUDE.md with ADR Error Handler Exemption Reference

**Priority**: P3 (Nice-to-have)
**File(s)**: `CLAUDE.md`
**Estimated Time**: 0.25 hours
**Status**: Ready

## Problem Statement

The architectural decision to exempt error-handler.ts from using `sendError()` helpers is documented in `docs/ADR_ERROR_HANDLER_EXEMPTION.md`, but CLAUDE.md doesn't reference this ADR. Developers reading CLAUDE.md won't discover this important architectural exception.

## Root Cause

The ADR was created during the middleware standardization work (issue #162), but CLAUDE.md wasn't updated with a reference. This was identified as an improvement during code review.

## Solution Approach

Add a clear section to CLAUDE.md explaining the error handler exemption and pointing to the comprehensive ADR for details. This ensures developers can discover the architectural decision from the main developer guide.

## Implementation Steps

### Step 1: Locate insertion point in CLAUDE.md

- [ ] Find "API Response Standardization" or "Middleware API Patterns" section
- [ ] If no suitable section exists, create "Error Handling Patterns" subsection
- [ ] Ideal location: After middleware error response examples, before edge cases

### Step 2: Add error handler exemption section

- [ ] Write clear heading: "### Error Handler Middleware (EXCEPTION)"
- [ ] Explain the 3 key reasons for exemption
- [ ] Clarify the notFoundHandler() exception-to-exception
- [ ] Reference ADR with link

### Step 3: Update table of contents

- [ ] If CLAUDE.md has TOC, add new section link
- [ ] Verify markdown anchors work correctly

## Technical Details

**Proposed Content for CLAUDE.md**:

```markdown
### Error Handler Middleware (EXCEPTION)

**The error handler middleware (`server/middleware/error-handler.ts`) is EXEMPT from using `sendError()` helpers.**

**Rationale**:

1. **Architectural Layer**: The error handler IS the implementation layer for error responses (not a consumer of helpers)
2. **Safety Net Principle**: The last-resort handler should not depend on abstractions it's meant to back up
3. **Circular Dependency Risk**: Using sendError() in error-handler creates conceptual circularity

**Format Consistency**: Achieved through manual responses that match the standardized envelope format:
```typescript
{
  success: false,
  error: string,
  code?: string,
  details?: unknown
}
```

**Exception-to-Exception**: The `notFoundHandler()` function within error-handler.ts DOES use `sendError()` because it's route-like (handles specific 404 case), not a catch-all error handler.

**See**: `docs/ADR_ERROR_HANDLER_EXEMPTION.md` for complete architectural decision, error flow analysis, and implementation details.

**Example (error-handler.ts)**:
```typescript
// Manual response (intentional) - matches sendError() envelope format
if (err instanceof AppError) {
  return res.status(err.statusCode).json(err.toJSON());
  // Returns: { success: false, error, code, statusCode }
}

// Exception uses helper (route-like, not catch-all)
export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  sendError(res, 'Route not found', 404, {
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}
```
```

**Location Options** (in order of preference):

1. **After "API Response Standardization (MANDATORY)" section** - Most logical placement
2. **In "Common Pitfalls to Avoid"** - As an exception to avoid confusion
3. **New "Error Handling Patterns" section** - If neither above exists

## Checklist

- [ ] Section added to appropriate location in CLAUDE.md
- [ ] 3 key rationale points clearly explained
- [ ] notFoundHandler() exception-to-exception clarified
- [ ] ADR link included (relative path: `docs/ADR_ERROR_HANDLER_EXEMPTION.md`)
- [ ] Code examples show manual vs helper usage
- [ ] Markdown formatting correct (headings, code blocks, lists)
- [ ] No broken links

## Success Criteria

- [ ] Developers reading CLAUDE.md will discover error-handler exemption
- [ ] Rationale is immediately clear without reading ADR
- [ ] Link to ADR provided for comprehensive details
- [ ] No confusion about why error-handler.ts differs from middleware
- [ ] notFoundHandler() usage pattern clarified

## Benefits

1. **Discoverability**: Developers find architectural exceptions in main guide
2. **Context**: Quick rationale without forcing ADR read
3. **Depth**: Link to ADR for those needing complete analysis
4. **Consistency**: All major architectural decisions referenced in CLAUDE.md
5. **Onboarding**: New developers won't be confused by error-handler.ts differences

## Related Documentation

- `docs/ADR_ERROR_HANDLER_EXEMPTION.md` - Complete architectural decision
- `server/middleware/error-handler.ts` - Inline architectural notes (lines 7-27)
- `server/utils/api-response.ts` - Cross-reference comment (lines 76-78)
- `docs/03_API_PATTERNS.md` - Middleware error response patterns

---

**Source**: Code review improvement suggestion from issue #162
**Category**: Documentation / Developer Onboarding
**Related**: Architectural decision records, error handling patterns
**Estimated Impact**: Improves developer understanding, reduces confusion
