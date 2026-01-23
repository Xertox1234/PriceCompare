# TODO 263: Document or Fix TrustLevelBadge Hardcoded Colors

**Priority**: P3 - Nice-to-Have (Code Quality)
**Effort**: Small (~15 minutes)
**Category**: Design System
**Source**: Code Review - Architecture Strategist
**Branch**: add_scraping

## Problem Statement

The TrustLevelBadge component uses hardcoded Tailwind color classes instead of design tokens:

```typescript
// TrustLevelBadge.tsx:25-53
color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
```

According to `docs/05_FRONTEND_PATTERNS.md`, this is a pattern violation. However, trust level badges may qualify as "data visualization" which is an acceptable exception.

## Decision Required

Choose one:

### Option A: Document as Exception
If trust levels are considered "data visualization" (distinct categorical data):
- Add comment explaining why hardcoded colors are intentional
- Document in component file

### Option B: Use Semantic Tokens
Create CSS variables for trust level colors:
```css
/* index.css */
:root {
  --trust-level-0-bg: theme('colors.gray.100');
  --trust-level-0-text: theme('colors.gray.700');
  /* ... */
}
```

## Acceptance Criteria

**If Option A:**
- [ ] Add comment in TrustLevelBadge explaining exception
- [ ] Reference docs/05_FRONTEND_PATTERNS.md acceptable exceptions

**If Option B:**
- [ ] Create CSS variables for trust level colors
- [ ] Update component to use CSS variables
- [ ] Test dark mode compatibility

## Files to Modify

- `client/src/components/profile/TrustLevelBadge.tsx`
- `client/src/index.css` (if Option B)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - architecture strategist |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Design system: `docs/05_FRONTEND_PATTERNS.md`
- Component: `client/src/components/profile/TrustLevelBadge.tsx`
