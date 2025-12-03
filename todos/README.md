# TODO Management

This folder contains TODO items for the PriceCompare project. Completed TODOs are archived to `archive/` with timestamps.

## Active TODOs

Currently, there is 1 active TODO remaining:

- **[TODO_006_PRODUCT_DISCUSSION_COUNT.md](./TODO_006_PRODUCT_DISCUSSION_COUNT.md)** - Add discussion count to product queries (P2, 1 hour)

## Recently Completed (2025-12-03)

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

1. **Create TODO**: Add new TODO_XXX_DESCRIPTION.md with priority, time estimate, and implementation steps
2. **Work on TODO**: Follow implementation steps in the TODO file
3. **Complete**: Move to `archive/` with timestamp prefix
4. **Update README**: Update this file to reflect current active TODOs

## Priority Levels

- **P0 - Critical**: Blocking issues, must fix immediately
- **P1 - High**: Important improvements, fix soon
- **P2 - Medium**: Valuable improvements, schedule when possible
- **P3 - Low**: Nice-to-have improvements
- **P4 - Optional**: Enhancement opportunities
