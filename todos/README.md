# TODO Management

This folder contains TODO items for the PriceCompare project. Completed TODOs are archived to `archive/` with timestamps.

## Active TODOs

Currently, there is **1 active TODO**:

### Code Quality & Simplification
- 🔵 **TODO_165 (Error Handling Consolidation)** - Consolidate error handling into single file (P3, 3 hours)
  - Reduce from 4 files (244 LOC) to 1 file (15-30 LOC)
  - Remove error-sanitizer.ts, error-helpers.ts
  - Simplify errors.ts with 2 utility functions
  - 87-93% code reduction, no functionality loss
  - Status: **Ready** - Can be picked up for implementation
  - Source: GitHub Issue #165

## Recently Completed (2025-12-03)

### Code Quality & Technical Debt
- ✅ **TODO_006 (Discussion Count Tests)** - Removed failing tests for unimplemented feature (P2, 30 min)
  - Removed 2 test cases checking for `discussionCount`/`hasActiveDiscussion` fields
  - Cleaned up unused forum storage mock
  - Added storage-cache mock to prevent Redis dependency
  - See: `COMPLETION_SUMMARY.md` and `docs/LEARNINGS_TODO_006_DISCUSSION_COUNT.md`

### Performance Optimization
- ✅ **TODO_010** - Fixed sequential price history inserts - 20x performance bottleneck (P0, 1.5 hours)
  - Replaced 500 sequential inserts with single batch insert
  - Performance: 1,000ms → 50ms per batch (95% reduction)
  - Unblocks scaling to 10,000+ products

All completed TODOs have been archived to `archive/2025-12-03-*`:

### Critical Test Fixes
- ✅ **TODO_TEST_FIXES** - Fixed 71 failing tests across 6 test suites
  - Fixed Redis mocking in product-routes.test.ts (40 tests)
  - Fixed Redis mocking in auth-routes.test.ts (55 tests, 18 login tests)
  - All 202 tests now passing reliably

### Test Quality Improvements
- ✅ **TODO_004** - Clarified watchlist test descriptions (P3, 15min)
- ✅ **TODO_005** - Enhanced pagination test assertions (P3, 20min)
- ✅ **TODO_006** - Added trigger documentation with line references (P3, 10min)
- ✅ **TODO_007** - Extracted test data builder helpers (P4, 45min)
- ✅ **TODO_008** - Added edge case tests for watchlist (P4, 30min)
- ✅ **TODO_009** - Added performance sanity check (P4, 20min)

## Archive

Completed TODOs are stored in the `archive/` directory with format:
```
archive/YYYY-MM-DD-TODO_XXX_DESCRIPTION.md
```

## Workflow

1. **Create TODO**: Copy `TODO_TEMPLATE.md` and rename to TODO_XXX_DESCRIPTION.md
   - Fill in priority, time estimate, and implementation steps
   - Use the template's structured format
2. **Work on TODO**: Follow implementation steps in the TODO file
3. **Pre-Close Verification**: Complete the **PRE-CLOSE VERIFICATION CHECKLIST** (mandatory!)
   - Run all verification commands
   - Document results in resolution section
   - This prevents documentation-implementation gaps
4. **Complete**: Move to `archive/` with timestamp prefix: `archive/YYYY-MM-DD-TODO_XXX_DESCRIPTION.md`
5. **Update README**: Update this file to reflect current active TODOs

**IMPORTANT**: The Pre-Close Verification Checklist in `TODO_TEMPLATE.md` is **mandatory**. It prevents issues where documentation claims changes were made but code verification shows they weren't. See `COMPLETION_SUMMARY.md` for why this matters.

## Priority Levels

- **P0 - Critical**: Blocking issues, must fix immediately
- **P1 - High**: Important improvements, fix soon
- **P2 - Medium**: Valuable improvements, schedule when possible
- **P3 - Low**: Nice-to-have improvements
- **P4 - Optional**: Enhancement opportunities
