# TODO 274: Replace Hardcoded Colors in AuthModal with Design Tokens

**Priority**: P2 (IMPORTANT - Design System)
**File(s)**: `client/src/components/auth/auth-modal.tsx`
**Estimated Time**: 30 minutes
**Status**: Completed
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The AuthModal component uses hardcoded hex colors in inline styles, violating the design token pattern and breaking dark mode support.

## Root Cause

Inline styles were used instead of Tailwind classes or CSS variables.

## Evidence

```typescript
// auth-modal.tsx:34-36
style={{
  backgroundColor: 'white',
  color: 'black',
  border: '1px solid #e5e7eb',
}}
```

## Solution Approach

Replace inline styles with Tailwind classes that use design tokens.

## Implementation Steps

### Step 1: Replace Inline Styles

- [x] Replace `backgroundColor: 'white'` with `className="bg-background"`
- [x] Replace `color: 'black'` with `className="text-foreground"`
- [x] Replace `border: '1px solid #e5e7eb'` with `className="border border-border"`

## Technical Details

**Before:**
```tsx
<div
  style={{
    backgroundColor: 'white',
    color: 'black',
    border: '1px solid #e5e7eb',
  }}
>
```

**After:**
```tsx
<div className="bg-background text-foreground border border-border">
```

## Checklist

- [x] All inline styles removed
- [x] Tailwind classes use design tokens
- [x] Component renders correctly in light mode
- [x] Component renders correctly in dark mode
- [x] No visual regression

## Success Criteria

- [x] No hardcoded colors in auth-modal.tsx
- [x] Dark mode works correctly
- [x] Visual appearance unchanged in light mode

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: pattern-recognition-specialist
