# TODO 265: Remove YAGNI Code from New Components

**Priority**: P3 - Nice-to-Have (Code Quality)
**Effort**: Small (~20 minutes)
**Category**: Code Quality
**Source**: Code Review - Code Simplicity Reviewer
**Branch**: add_scraping

## Problem Statement

Several new components contain code that violates YAGNI (You Aren't Gonna Need It) principles:

1. **Unused utility exports** - Functions exported "just in case"
2. **Premature optimization** - Number formatting for scenarios that won't occur
3. **Placeholder UI** - "Coming Soon" alert that adds no value

## Findings

### 1. TrustLevelBadge.tsx - Unused Exports (Lines 123-134)
```typescript
// Exported but never used anywhere
export function getTrustLevelName(level: number): string { ... }
export function getAllTrustLevels(): TrustLevelConfig[] { ... }
```
Grep shows these are only referenced in the export barrel (`index.ts`).

### 2. ProfileStats.tsx - Premature formatNumber (Lines 116-124)
```typescript
// K/M formatting for numbers that will never reach 1000+
const formatNumber = (value: number): string => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};
```
No user will realistically have 1000+ posts.

### 3. profile.tsx - Coming Soon Alert (Lines 130-138)
```typescript
<Alert>
  <AlertTitle>Coming Soon: Profile Editing</AlertTitle>
  <AlertDescription>
    Profile editing features will be available soon.
  </AlertDescription>
</Alert>
```
Placeholder with no functionality.

## Proposed Solution

### Remove Unused Exports
```diff
- export function getTrustLevelName(level: number): string { ... }
- export function getAllTrustLevels(): TrustLevelConfig[] { ... }
```
Update `index.ts` to remove these exports.

### Simplify formatNumber
```diff
- if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
- if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
- return value.toString();
+ return value.toLocaleString();
```

### Remove Coming Soon Alert
Remove the alert block entirely. Add back when profile editing is implemented.

## Acceptance Criteria

- [ ] Remove `getTrustLevelName` and `getAllTrustLevels` exports
- [ ] Update `index.ts` barrel export
- [ ] Replace `formatNumber` with `toLocaleString()`
- [ ] Remove "Coming Soon" alert
- [ ] Verify no build errors
- [ ] Estimated LOC reduction: ~30 lines

## Files to Modify

- `client/src/components/profile/TrustLevelBadge.tsx`
- `client/src/components/profile/index.ts`
- `client/src/components/profile/ProfileStats.tsx`
- `client/src/pages/profile.tsx`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - code simplicity reviewer |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- YAGNI principle: Only build what you need now
- Code simplicity review findings
