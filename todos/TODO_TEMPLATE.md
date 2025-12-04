# TODO XXX: [Brief Title]

**Priority**: P0/P1/P2/P3/P4
**File(s)**: `path/to/file.ts`
**Estimated Time**: X hours
**Status**: Not Started / In Progress / Blocked / ✅ Complete

## Problem Statement

Clear description of what needs to be fixed or implemented.

## Root Cause (if applicable)

Why does this issue exist? What caused it?

## Solution Approach

High-level approach to solving the problem.

## Implementation Steps

### Step 1: [Action]

- [ ] Specific task
- [ ] Another task

### Step 2: [Action]

- [ ] Specific task

## Technical Details

```typescript
// Code examples, patterns to follow, etc.
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
- [ ] Documentation updated
- [ ] Related files checked

## Success Criteria

- [ ] Specific measurable outcome
- [ ] Tests pass
- [ ] No regressions

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Run grep/search to confirm all claimed changes exist
  ```bash
  # If you removed code:
  grep -r "removed_pattern" .
  # Should return: No matches found

  # If you added code:
  grep -r "new_pattern" path/to/file
  # Should return: Expected matches
  ```

- [ ] **File inspection**: Manually inspect changed files to verify modifications
  ```bash
  # View the actual changes
  git diff path/to/file

  # Or if already committed, check the file directly
  cat path/to/file | grep -A 5 -B 5 "relevant_section"
  ```

### Testing
- [ ] **Run affected tests**: Execute tests for modified functionality
  ```bash
  npm test path/to/affected.test.ts
  ```

- [ ] **Verify test results**: Confirm expected number of tests pass
  - Expected passing: X tests
  - Actual passing: ___ tests
  - Any failures: Document why (if intentional)

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors introduced
  ```bash
  npm run check
  # Should complete with no errors
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  # Should pass with no errors or warnings
  ```

### Diagnostics
- [ ] **Check IDE diagnostics**: No new TypeScript/ESLint errors in changed files
- [ ] **Verify imports**: All imports resolve correctly
- [ ] **Check for unused variables**: No new unused variable warnings

### Documentation Alignment
- [ ] **File changes match claims**: If doc says "removed X lines", verify line count
  ```bash
  wc -l path/to/file
  # Compare before/after line counts
  ```

- [ ] **Verify all referenced files**: Check that all files mentioned in docs actually changed
  ```bash
  git diff --name-only
  # Should include all files mentioned in resolution
  ```

- [ ] **Archive location**: If archiving, verify file moved to correct location
  ```bash
  ls todos/archive/YYYY-MM-DD-TODO_XXX_*.md
  # Should exist
  ```

### Pre-Commit Hooks
- [ ] **Run pre-commit checks**: If hooks exist, verify they pass
  ```bash
  git add .
  git commit -m "test commit" --dry-run
  # Or use --no-verify if testing, but document why
  ```

### Integration
- [ ] **Related TODOs updated**: Check if other TODOs reference this one
- [ ] **README updated**: Update todos/README.md active/completed sections
- [ ] **Learnings documented**: Create LEARNINGS_TODO_XXX.md if patterns emerged

### Final Verification
- [ ] **Run full test suite**: Ensure no regressions
  ```bash
  npm test
  # All tests should pass
  ```

- [ ] **Manual testing**: If user-facing, manually test the functionality

- [ ] **Performance check**: Verify no significant performance regression

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [Implemented feature / Fixed bug / Removed tests / Deferred]

### Summary

Brief summary of what was done and why.

### Changes Made

1. **File 1** (`path/to/file1.ts`)
   - Change 1
   - Change 2

2. **File 2** (`path/to/file2.ts`)
   - Change 1

### Verification Results

```bash
# Paste verification command outputs here
grep -r "pattern" .
# Result: No matches found ✅

npm test path/to/test.ts
# Result: 10/10 tests passing ✅

npm run check
# Result: No TypeScript errors ✅
```

### Related Documentation

- `docs/LEARNINGS_TODO_XXX.md` - Patterns learned
- `path/to/related/file.md` - Related docs

### Outcome

✅ All verification checks passed
✅ Ready for commit/PR
✅ No regressions detected

---

**Completed by**: [Name/Claude Code]
**Completion Date**: YYYY-MM-DD
**Actual Time**: X hours (vs estimated X hours)
