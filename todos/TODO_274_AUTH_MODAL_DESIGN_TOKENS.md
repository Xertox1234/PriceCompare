# TODO 274: Replace Hardcoded Colors in AuthModal with Design Tokens

**Priority**: P2 (IMPORTANT - Design System)
**File(s)**: `client/src/components/auth/auth-modal.tsx`
**Estimated Time**: 30 minutes
**Status**: Not Started
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

- [ ] Replace `backgroundColor: 'white'` with `className="bg-background"`
- [ ] Replace `color: 'black'` with `className="text-foreground"`
- [ ] Replace `border: '1px solid #e5e7eb'` with `className="border border-border"`

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

- [ ] All inline styles removed
- [ ] Tailwind classes use design tokens
- [ ] Component renders correctly in light mode
- [ ] Component renders correctly in dark mode
- [ ] No visual regression

## Success Criteria

- [ ] No hardcoded colors in auth-modal.tsx
- [ ] Dark mode works correctly
- [ ] Visual appearance unchanged in light mode

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: pattern-recognition-specialist
