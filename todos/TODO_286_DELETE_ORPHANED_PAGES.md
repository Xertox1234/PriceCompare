# TODO 286: Delete Orphaned/Dead Code Pages

**Priority**: P2
**File(s)**: `client/src/pages/comparison.tsx`, `client/src/pages/product-detail.tsx`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Tags**: `code-review`, `dead-code`, `cleanup`

## Problem Statement

Two page files are completely orphaned (not routed, not used):

1. **`comparison.tsx`** (146 lines) - No route exists in `App.tsx`
2. **`product-detail.tsx`** (597 lines) - Replaced by `product-detail-new.tsx`, `LazyProductDetailPage` imports the new version

Total dead code: **743 lines**

## Evidence

**comparison.tsx not routed**:
```bash
grep -r "comparison" client/src/App.tsx
# Returns: Nothing related to comparison.tsx routing
```

**product-detail.tsx replaced**:
```typescript
// client/src/components/lazy/index.ts:125
export const LazyProductDetailPage = lazy(() => import('@/pages/product-detail-new'));
// Note: imports product-detail-NEW, not product-detail
```

## Solution Approach

Delete both orphaned files after confirming no imports reference them.

## Implementation Steps

### Step 1: Verify No Dependencies

- [ ] Run `grep -r "comparison.tsx" client/src/` - should return nothing
- [ ] Run `grep -r "product-detail.tsx" client/src/` - should return nothing
- [ ] Run `grep -r "from.*pages/comparison" client/src/` - should return nothing
- [ ] Run `grep -r "from.*pages/product-detail[^-]" client/src/` - should return nothing

### Step 2: Delete Files

- [ ] Delete `client/src/pages/comparison.tsx`
- [ ] Delete `client/src/pages/product-detail.tsx`

### Step 3: Verify Build

- [ ] Run `npm run check` - no TypeScript errors
- [ ] Run `npm run build` - builds successfully

## Checklist

- [ ] No imports reference deleted files
- [ ] Files deleted
- [ ] Build passes
- [ ] No broken links in app

## Success Criteria

- [ ] 743 lines of dead code removed
- [ ] Build and tests pass
- [ ] No 404 errors in app

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: architecture-strategist, code-simplicity-reviewer
