# TODO 292: Standardize Hook File Naming to kebab-case

**Priority**: P3
**File(s)**: Multiple hook files (see list)
**Estimated Time**: 1 hour
**Status**: Not Started
**Tags**: `code-review`, `cleanup`, `naming-convention`

## Problem Statement

Hook files use inconsistent naming conventions:
- **kebab-case** (24 files): `use-auth.ts`, `use-products.ts`, etc.
- **camelCase** (7 files): `useChartExport.ts`, `useMediaQuery.ts`, etc.

This creates confusion and inconsistency in imports.

## Files to Rename

| Current Name | New Name |
|--------------|----------|
| `useChartExport.ts` | `use-chart-export.ts` |
| `useMediaQuery.ts` | `use-media-query.ts` |
| `usePriceHistoryInfinite.ts` | `use-price-history-infinite.ts` |
| `useProductComparison.ts` | `use-product-comparison.ts` |
| `useRateLimit.ts` | `use-rate-limit.ts` |
| `useSmartNotifications.ts` | `use-smart-notifications.ts` |
| `useWatchList.ts` | `use-watchlist.ts` |

## Implementation Steps

### Step 1: Rename Files

- [ ] Rename each file to kebab-case

### Step 2: Update All Imports

- [ ] Run search and replace for each renamed file
- [ ] Update imports in all consuming files

### Step 3: Update Test Files

- [ ] Rename test files if they follow same convention
- [ ] Update test imports

### Step 4: Verify

- [ ] Run `npm run check` - no TypeScript errors
- [ ] Run `npm test` - all tests pass

## Technical Details

```bash
# Example rename sequence
git mv client/src/hooks/useChartExport.ts client/src/hooks/use-chart-export.ts

# Find and update imports
grep -r "useChartExport" client/src/ --include="*.tsx" --include="*.ts"
```

## Checklist

- [ ] All 7 files renamed
- [ ] All imports updated
- [ ] TypeScript compiles
- [ ] Tests pass

## Success Criteria

- [ ] 100% kebab-case hook file naming
- [ ] No broken imports
- [ ] Consistent codebase

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: pattern-recognition-specialist
