# TODO 165: Consolidate Error Handling into Single File

**Priority**: P3
**File(s)**:
- `server/utils/error-sanitizer.ts` (delete)
- `server/utils/error-helpers.ts` (delete)
- `server/utils/errors.ts` (simplify to 15-30 LOC)
- `server/utils/api-response.ts` (update imports)
**Estimated Time**: 3 hours
**Status**: Ready
**Source**: GitHub Issue #165

## Problem Statement

Error handling is fragmented across 4 files with overlapping responsibilities (244 total LOC), creating confusion and violating YAGNI principle:

1. **server/utils/error-sanitizer.ts** (88 LOC) - Creates error responses, sanitizes messages
2. **server/utils/error-helpers.ts** (30 LOC) - Extracts error messages (29 lines for one-liner logic)
3. **server/utils/errors.ts** (126 LOC) - Custom error class hierarchy (AppError → ValidationError → etc.) that's barely used
4. **server/utils/api-response.ts** (partial) - Also handles errors via `sendErrorFromException`

**Current issues:**
- Developer confusion: Which file to use for error handling?
- YAGNI violation: Custom error hierarchy with < 10 actual usages
- Code duplication: Similar logic across multiple files
- Maintenance burden: 4 files to understand and maintain

## Root Cause

The codebase evolved organically without consolidation. Custom error classes were added for anticipated needs but most code just throws regular `Error` objects.

## Solution Approach

Consolidate to a single simplified `server/utils/errors.ts` file with only the essential functions that are actually used:

```typescript
// Consolidated errors.ts (15-30 lines instead of 244)
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  const msg = error.message.toLowerCase();

  if (msg.includes('not found')) return 404;
  if (msg.includes('unauthorized')) return 401;
  if (msg.includes('forbidden')) return 403;
  if (msg.includes('conflict')) return 409;
  if (msg.includes('invalid') || msg.includes('required')) return 400;
  return 500;
}
```

**Benefits:**
- ✅ 87-93% code reduction (244 LOC → 15-30 LOC)
- ✅ 75% file reduction (4 files → 1 file)
- ✅ Easier to understand and maintain
- ✅ No functionality loss
- ✅ Clearer single responsibility

## Implementation Steps

### Step 1: Audit Error Class Usage (30 min)

- [ ] Search for custom error class usage:
  ```bash
  grep -r "extends.*Error\|new ValidationError\|new AuthenticationError" server/ --include="*.ts"
  ```
- [ ] Document actual usage count
- [ ] Identify if any custom error classes are truly needed
- [ ] Create migration plan for any used custom errors

### Step 2: Create Simplified errors.ts (30 min)

- [ ] Backup current errors.ts
- [ ] Implement `getErrorMessage(error: unknown): string`
- [ ] Implement `getErrorStatus(error: unknown): number`
- [ ] Add JSDoc comments
- [ ] Add proper TypeScript types
- [ ] Test basic functionality

### Step 3: Update api-response.ts (30 min)

- [ ] Update imports to use simplified errors.ts
- [ ] Remove dependencies on error-sanitizer.ts
- [ ] Update `sendErrorFromException` to use new utilities
- [ ] Verify error handling still works correctly
- [ ] Run tests for api-response.ts

### Step 4: Update All Imports (45 min)

- [ ] Find all error-sanitizer imports:
  ```bash
  grep -r "import .* from.*error-sanitizer" server/ --include="*.ts"
  ```
- [ ] Find all error-helpers imports:
  ```bash
  grep -r "import .* from.*error-helpers" server/ --include="*.ts"
  ```
- [ ] Replace with imports from simplified errors.ts:
  ```typescript
  import { getErrorMessage, getErrorStatus } from './utils/errors';
  ```
- [ ] Update each file systematically
- [ ] Verify TypeScript compilation after each change

### Step 5: Delete Obsolete Files (15 min)

- [ ] Archive error-sanitizer.ts (move to todos/archive/code-removed/)
- [ ] Archive error-helpers.ts (move to todos/archive/code-removed/)
- [ ] Remove unused error classes from errors.ts
- [ ] Document archived files

### Step 6: Testing & Verification (45 min)

- [ ] Run full test suite: `npm test`
- [ ] Verify TypeScript compilation: `npm run check`
- [ ] Verify ESLint: `npm run lint`
- [ ] Test error responses manually:
  - [ ] 500 errors
  - [ ] 404 errors
  - [ ] 401 errors
  - [ ] 400 validation errors
- [ ] Check Sentry error tracking still works
- [ ] Verify error sanitization in production mode

## Technical Details

### Before (Fragmented)

```typescript
// ❌ OLD - Multiple imports, unclear responsibilities
import { createErrorResponse } from './utils/error-sanitizer';
import { extractErrorMessage } from './utils/error-helpers';
import { ValidationError } from './utils/errors';

// Complex error handling
const errorResponse = createErrorResponse(error, 'Context');
res.status(errorResponse.status).json({ error: errorResponse.error });
```

### After (Consolidated)

```typescript
// ✅ NEW - Single import, clear purpose
import { getErrorMessage, getErrorStatus } from './utils/errors';
import { sendErrorFromException } from './utils/api-response';

// Simplified error handling
sendErrorFromException(res, error, 'Context');
// Uses getErrorMessage() and getErrorStatus() internally
```

### Error Status Inference Logic

The `getErrorStatus()` function infers HTTP status codes from error messages:

| Error Message Contains | HTTP Status | Use Case |
|------------------------|-------------|----------|
| "not found" | 404 | Resource not found |
| "unauthorized" | 401 | Authentication required |
| "forbidden" | 403 | Permission denied |
| "conflict" | 409 | Duplicate resource |
| "invalid", "required" | 400 | Validation error |
| (default) | 500 | Internal server error |

## Checklist

- [ ] Custom error class usage audited
- [ ] Simplified errors.ts created
- [ ] api-response.ts updated
- [ ] All imports updated
- [ ] Obsolete files deleted
- [ ] Tests pass
- [ ] Documentation updated

## Success Criteria

- [ ] Single `server/utils/errors.ts` file (15-30 LOC)
- [ ] `getErrorMessage()` and `getErrorStatus()` functions work correctly
- [ ] All error handling functionality preserved
- [ ] error-sanitizer.ts deleted
- [ ] error-helpers.ts deleted
- [ ] Unused error classes removed
- [ ] All tests pass
- [ ] TypeScript compilation succeeds
- [ ] No import errors
- [ ] Error responses work correctly (verified manually)

### Code Reduction Metrics

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| error-sanitizer.ts | 88 LOC | 0 LOC (deleted) | 100% |
| error-helpers.ts | 30 LOC | 0 LOC (deleted) | 100% |
| errors.ts | 126 LOC | 15-30 LOC | 76-88% |
| **Total** | **244 LOC** | **15-30 LOC** | **87-93%** |

### Complexity Reduction

**Before:**
- 4 files to understand
- Custom error hierarchy
- Overlapping responsibilities
- 244 lines of error handling code

**After:**
- 1 file to understand
- 2 simple utility functions
- Clear single responsibility
- 15-30 lines of error handling code

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification

- [ ] **Grep verification for deleted files**:
  ```bash
  # Verify error-sanitizer.ts is deleted
  ls server/utils/error-sanitizer.ts
  # Should return: No such file or directory

  # Verify error-helpers.ts is deleted
  ls server/utils/error-helpers.ts
  # Should return: No such file or directory
  ```

- [ ] **Grep verification for removed imports**:
  ```bash
  # Verify no imports from deleted files
  grep -r "from.*error-sanitizer" server/ --include="*.ts"
  # Should return: No matches found

  grep -r "from.*error-helpers" server/ --include="*.ts"
  # Should return: No matches found
  ```

- [ ] **Verify new utilities exist**:
  ```bash
  grep -n "function getErrorMessage" server/utils/errors.ts
  grep -n "function getErrorStatus" server/utils/errors.ts
  # Should return matches
  ```

- [ ] **File inspection**:
  ```bash
  # Check simplified errors.ts
  wc -l server/utils/errors.ts
  # Should be 15-30 lines (vs 126 before)

  # View the new file
  cat server/utils/errors.ts
  ```

### Testing

- [ ] **Run full test suite**:
  ```bash
  npm test
  # All tests should pass
  ```

- [ ] **Verify test results**:
  - Expected passing: All tests
  - Actual passing: ___ tests
  - Any failures: Document why

### Build & Type Safety

- [ ] **TypeScript compilation**:
  ```bash
  npm run check
  # Should complete with no errors
  ```

- [ ] **ESLint check**:
  ```bash
  npm run lint
  # Should pass with no errors or warnings
  ```

### Diagnostics

- [ ] **Check IDE diagnostics**: No new TypeScript/ESLint errors in changed files
- [ ] **Verify imports**: All imports resolve correctly
- [ ] **Check for unused variables**: No new unused variable warnings

### Documentation Alignment

- [ ] **Line count verification**:
  ```bash
  # Verify total LOC reduction
  wc -l server/utils/errors.ts
  # Should be ~15-30 lines (was 126)
  ```

- [ ] **Verify all changed files**:
  ```bash
  git diff --name-only
  # Should include:
  # - server/utils/errors.ts (modified)
  # - server/utils/api-response.ts (modified)
  # - All files with updated imports
  # - Deleted: error-sanitizer.ts, error-helpers.ts
  ```

### Integration

- [ ] **Related TODOs updated**: Check if other TODOs reference error handling
- [ ] **README updated**: Update todos/README.md active/completed sections
- [ ] **Learnings documented**: Create LEARNINGS_TODO_165.md with consolidation patterns

### Final Verification

- [ ] **Manual error testing**: Test all error types
  - [ ] 500 Internal Server Error
  - [ ] 404 Not Found
  - [ ] 401 Unauthorized
  - [ ] 400 Bad Request
  - [ ] Error sanitization works

- [ ] **Performance check**: Verify no performance regression

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be filled upon completion]

### Summary

[Brief summary of what was done and why]

### Changes Made

1. **server/utils/errors.ts** (simplified)
   - [List changes]

2. **server/utils/api-response.ts** (updated imports)
   - [List changes]

3. **Files deleted**
   - server/utils/error-sanitizer.ts
   - server/utils/error-helpers.ts

4. **Import updates across codebase**
   - [List affected files]

### Verification Results

```bash
# Paste verification command outputs here
```

### Related Documentation

- `docs/06_ERROR_HANDLING_PATTERNS.md` - Error handling guide
- `docs/LEARNINGS_TODO_165.md` - Consolidation patterns learned
- GitHub Issue #165

### Outcome

✅ All verification checks passed
✅ Ready for commit/PR
✅ No regressions detected

---

**Completed by**: [Name/Claude Code]
**Completion Date**: YYYY-MM-DD
**Actual Time**: ___ hours (vs estimated 3 hours)
