# TODO 288: Consolidate Duplicate Hooks

**Priority**: P2
**File(s)**: `client/src/hooks/use-mobile.tsx`, `client/src/hooks/useMediaQuery.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Tags**: `code-review`, `cleanup`, `patterns`

## Problem Statement

Two separate hooks provide mobile detection functionality:

1. **`use-mobile.tsx`** (19 lines) - Simple hook with `useIsMobile()`
2. **`useMediaQuery.ts`** (94 lines) - Comprehensive hook with `useIsMobile()`, `useIsTablet()`, `useIsDesktop()`, `useBreakpoint()`

This creates confusion about which to use and potential inconsistencies.

## Evidence

**Duplicate 1** (`use-mobile.tsx:5-19`):
```typescript
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
  // Different implementation
}
```

**Duplicate 2** (`useMediaQuery.ts:47-49`):
```typescript
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}
```

**Usage is split**:
- `comparison.tsx` imports from `useMediaQuery.ts`
- `sidebar.tsx` imports from `use-mobile.tsx`

## Solution Approach

Delete `use-mobile.tsx` and update imports to use `useMediaQuery.ts` which is more complete.

## Implementation Steps

### Step 1: Find All use-mobile.tsx Imports

- [ ] Run `grep -r "use-mobile" client/src/`
- [ ] Document all files importing from `use-mobile.tsx`

### Step 2: Update Imports

- [ ] Update each file to import from `useMediaQuery.ts`:
  ```typescript
  // BEFORE
  import { useIsMobile } from '@/hooks/use-mobile';

  // AFTER
  import { useIsMobile } from '@/hooks/useMediaQuery';
  ```

### Step 3: Delete use-mobile.tsx

- [ ] Delete `client/src/hooks/use-mobile.tsx`
- [ ] Verify no broken imports

### Step 4: Rename for Consistency (Optional)

- [ ] Rename `useMediaQuery.ts` to `use-media-query.ts` for kebab-case consistency
- [ ] Update all imports

## Checklist

- [ ] All imports updated
- [ ] `use-mobile.tsx` deleted
- [ ] Tests pass
- [ ] No broken imports

## Success Criteria

- [ ] Single source of truth for mobile detection
- [ ] 19 lines of duplicate code removed
- [ ] Consistent hook naming (consider renaming to kebab-case)

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: pattern-recognition-specialist, code-simplicity-reviewer
