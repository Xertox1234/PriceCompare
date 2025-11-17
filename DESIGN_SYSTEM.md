# PriceCompare Design System

**Last Updated:** November 2025
**Status:** Active - Phase 1 Complete
**Version:** 1.0.0

## Overview

This document codifies the design system patterns implemented in the Quick Wins redesign (November 2025). All new components and updates MUST follow these patterns.

---

## Color System

### Primary Palette

Our color system is based on modern, professional blue and amber tones that convey trust and value.

#### Core Brand Colors

```css
/* Primary - Blue (Trust, Professional) */
--color-primary: 217 91% 60%;           /* #3B82F6 - Blue 500 */
--color-primary-hover: 217 91% 55%;     /* Darker on hover */
--color-primary-foreground: 0 0% 100%;  /* White text on primary */

/* Secondary - Amber (Value, Energy) */
--color-secondary: 38 92% 50%;          /* #F59E0B - Amber 500 */
--color-secondary-hover: 38 92% 45%;    /* Darker on hover */
--color-secondary-foreground: 0 0% 100%; /* White text on secondary */
```

**Usage:**
- **Primary (Blue)**: Main CTAs, links, focus states, brand elements
- **Secondary (Amber)**: Deals, highlights, featured items, accents

#### Semantic Colors

```css
/* Success - Green */
--color-success: 142 71% 45%;           /* #10B981 - Green 500 */
--color-success-foreground: 0 0% 100%;

/* Warning - Amber */
--color-warning: 38 92% 50%;            /* #F59E0B - Amber 500 */
--color-warning-foreground: 0 0% 100%;

/* Error - Red */
--color-error: 0 84% 60%;               /* #EF4444 - Red 500 */
--color-error-foreground: 210 40% 98%;

/* Info - Sky Blue */
--color-info: 199 89% 48%;              /* #0EA5E9 - Sky 500 */
--color-info-foreground: 0 0% 100%;
```

**Usage:**
- **Success**: Confirmations, successful operations, positive states
- **Warning**: Alerts, price increases, cautionary messages
- **Error**: Errors, validation failures, destructive actions
- **Info**: Informational messages, tips, neutral notifications

#### Neutral Colors

```css
/* Light Mode */
--color-background: 0 0% 100%;          /* Pure white */
--color-foreground: 222 47% 11%;        /* #0F172A - Slate 900 */
--color-muted: 210 40% 96%;             /* #F1F5F9 - Slate 100 */
--color-muted-foreground: 215 16% 47%;  /* #64748B - Slate 500 */
--color-border: 214 32% 91%;            /* #E2E8F0 - Slate 200 */

/* Dark Mode */
--color-background-dark: 222 47% 11%;   /* #0F172A - Slate 900 */
--color-foreground-dark: 210 40% 98%;   /* #F8FAFC - Slate 50 */
--color-muted-dark: 217 33% 17%;        /* #1E293B - Slate 800 */
--color-border-dark: 215 25% 27%;       /* #334155 - Slate 700 */
```

### Color Usage Rules

**DO:**
- ✅ Always use design tokens (e.g., `className="text-primary"`)
- ✅ Use semantic colors for their intended purpose
- ✅ Maintain sufficient contrast ratios (WCAG AA minimum)
- ✅ Test in both light and dark modes

**DON'T:**
- ❌ Never use hardcoded hex colors (e.g., `style={{ color: '#3B82F6' }}`)
- ❌ Don't use purple/pink colors (old brand)
- ❌ Don't bypass design tokens with inline styles
- ❌ Don't use semantic colors decoratively

### Migration Guide

When updating existing components:

```typescript
// ❌ OLD - Hardcoded colors
<button style={{ backgroundColor: '#5A5DFF', color: 'white' }}>
  Click me
</button>

// ✅ NEW - Design tokens
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Click me
</button>
```

---

## Typography

### Font Family

**Primary Font:** Inter
**Fallback Stack:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI',
             Roboto, 'Helvetica Neue', Arial, sans-serif;
```

**Why Inter?**
- Modern, professional appearance
- Excellent readability for prices and numbers
- Wide range of weights (400, 500, 600, 700)
- Optimized for screens
- Industry standard for SaaS products

### Font Weights

```typescript
font-normal   // 400 - Body text
font-medium   // 500 - Emphasis
font-semibold // 600 - Subheadings
font-bold     // 700 - Headings
```

### Typography Scale

```typescript
// Headings
text-4xl // Hero headings (36px)
text-3xl // Page titles (30px)
text-2xl // Section headings (24px)
text-xl  // Subsection headings (20px)
text-lg  // Card titles (18px)

// Body
text-base // Default body text (16px)
text-sm   // Secondary text (14px)
text-xs   // Captions, labels (12px)
```

### Typography Rules

**DO:**
- ✅ Use Inter for all text
- ✅ Use semantic heading tags (h1, h2, h3)
- ✅ Maintain consistent line heights (1.5 for body, 1.2 for headings)
- ✅ Use font-medium or font-semibold for emphasis

**DON'T:**
- ❌ Don't use Poppins (old font)
- ❌ Don't use excessive font weights
- ❌ Don't mix multiple font families
- ❌ Don't use all-caps for long text

---

## Component Patterns

### Navigation

**Canonical Component:** `shared-navigation.tsx`

All pages MUST use `SharedNavigation` for consistent navigation:

```typescript
// ✅ CORRECT
import { SharedNavigation } from "@/components/shared-navigation";

export function MyPage() {
  return (
    <>
      <SharedNavigation />
      <main>...</main>
    </>
  );
}
```

**Features:**
- Responsive mobile menu
- Theme toggle (light/dark)
- User authentication state
- Consistent across all pages

**Deprecated:** `new-header.tsx`, `search-header.tsx` (removed)

### Hero Section

**Canonical Component:** `new-hero-section.tsx`

Features functional search with navigation:

```typescript
import { NewHeroSection } from "@/components/new-hero-section";

// Hero automatically navigates to /products?search=query
```

**Implementation Details:**
- Uses `useLocation` from wouter for navigation
- URL-encodes search queries
- Enter key support
- Empty query validation

### Categories

**Canonical Component:** `new-categories.tsx`

Simple, performant category display without external dependencies.

**Deprecated:** `featured-categories.tsx` (removed)

### Component Consolidation Rules

**When creating components:**

1. **No "new-" prefix** - Just name it properly from the start
2. **One implementation per feature** - Delete duplicates immediately
3. **Export from index.ts** - Use barrel exports for clean imports
4. **Shared, not duplicated** - Reuse existing components

**Before creating a component, check:**
```bash
# Search for existing similar components
grep -r "function ComponentName" client/src/components/
```

---

## Spacing System

Based on 4px baseline grid:

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

**Usage:**
```typescript
className="p-4 mb-6 gap-3"  // padding: 16px, margin-bottom: 24px, gap: 12px
```

---

## Border Radius System

```css
--radius: 1rem;           /* 16px - Base */
--radius-lg: 1.5rem;      /* 24px - Large cards */
--radius-md: 0.875rem;    /* 14px - Medium */
--radius-sm: 0.75rem;     /* 12px - Small */
--radius-xs: 0.625rem;    /* 10px - Extra small */
--radius-full: 9999px;    /* Pills, avatars */
```

**Guidelines:**
- Cards: `rounded-lg` (12px)
- Buttons: `rounded-full` for primary CTAs, `rounded-lg` for secondary
- Inputs: `rounded-lg`
- Avatars/Pills: `rounded-full`

---

## Shadow System

Subtle, modern shadows for depth:

```typescript
shadow-sm   // Hover states, subtle elevation
shadow-md   // Cards, dropdowns
shadow-lg   // Modals, popovers
shadow-xl   // AVOID - too heavy for modern design
```

**Pattern:**
```typescript
// Hover elevation
className="shadow-sm hover:shadow-md transition-shadow"
```

---

## Best Practices

### Component Development

```typescript
// ✅ GOOD - Clean, token-based
export function ProductCard({ product }: Props) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="text-lg font-semibold text-foreground">{product.name}</h3>
      <p className="text-primary font-bold">${product.price}</p>
      <button className="bg-primary text-primary-foreground rounded-full px-6 py-2 hover:bg-primary/90">
        View Deal
      </button>
    </div>
  );
}

// ❌ BAD - Hardcoded, inline styles
export function ProductCard({ product }: Props) {
  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '24px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ color: '#374151', fontSize: '18px' }}>{product.name}</h3>
      <p style={{ color: '#5A5DFF' }}>${product.price}</p>
      <button style={{ background: 'linear-gradient(to right, #5A5DFF, #E91E63)' }}>
        View Deal
      </button>
    </div>
  );
}
```

### Search Implementation

**Pattern for search navigation:**

```typescript
import { useLocation } from 'wouter';

export function SearchComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [, navigate] = useLocation();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <input
      type="search"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      onKeyDown={handleKeyDown}
      className="..."
    />
  );
}
```

### Accessibility

**Required for all interactive elements:**

```typescript
// Buttons
<button
  aria-label="Search products"
  className="..."
>

// Form inputs
<input
  type="search"
  aria-label="Search query"
  placeholder="What are you looking for?"
/>

// Focus states (automatic with design tokens)
className="focus:outline-none focus:ring-2 focus:ring-primary"
```

---

## Testing Checklist

Before committing design changes:

- [ ] All colors use design tokens (no hardcoded hex)
- [ ] Typography uses Inter font
- [ ] No inline styles (except truly dynamic values)
- [ ] Component has no duplicates
- [ ] Works in light AND dark mode
- [ ] Responsive on mobile (test at 375px, 768px, 1024px)
- [ ] Keyboard accessible (tab navigation, enter key)
- [ ] No console errors
- [ ] Maintains WCAG AA contrast ratios

---

## Migration Checklist

When updating existing components to new design system:

1. **Colors**
   - [ ] Replace hardcoded colors with design tokens
   - [ ] Update purple/pink to blue/amber
   - [ ] Test dark mode

2. **Typography**
   - [ ] Change Poppins to Inter
   - [ ] Use consistent font weights
   - [ ] Update heading hierarchy

3. **Spacing**
   - [ ] Remove inline spacing styles
   - [ ] Use Tailwind spacing utilities
   - [ ] Follow 4px baseline grid

4. **Shadows**
   - [ ] Replace shadow-xl with shadow-sm/md
   - [ ] Add hover states with transitions

5. **Testing**
   - [ ] Visual regression test
   - [ ] Responsive test
   - [ ] Accessibility test

---

## Examples

### Before and After

#### Button Component

```typescript
// ❌ BEFORE - Old design system
<button style={{
  background: 'linear-gradient(to right, #5A5DFF, #E91E63)',
  color: 'white',
  padding: '12px 32px',
  borderRadius: '9999px',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
}}>
  Buy Now
</button>

// ✅ AFTER - New design system
<button className="bg-primary text-primary-foreground px-8 py-3 rounded-full shadow-sm hover:shadow-md hover:bg-primary/90 transition-all">
  Buy Now
</button>
```

#### Product Card

```typescript
// ❌ BEFORE
<div className="bg-white rounded-2xl shadow-xl p-6">
  <h3 className="text-gray-900 font-bold text-lg" style={{ fontFamily: 'Poppins' }}>
    {product.name}
  </h3>
  <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg">
    Deal!
  </div>
</div>

// ✅ AFTER
<div className="bg-background rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-border">
  <h3 className="text-foreground font-semibold text-lg">
    {product.name}
  </h3>
  <div className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg">
    Deal!
  </div>
</div>
```

---

## Version History

### Version 1.0.0 (November 2025)
- Initial design system codification
- Modern blue/amber color palette
- Inter typography system
- Component consolidation patterns
- Completed Quick Wins Phase 1

---

## Resources

- **Color Palette Tool:** [https://uicolors.app](https://uicolors.app)
- **Typography:** [Inter Font](https://rsms.me/inter/)
- **Accessibility:** [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- **Tailwind Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)

---

## Questions?

For design system questions or clarifications:
1. Check this document first
2. Review `DESIGN_IMPROVEMENT_PLAN.md` for future roadmap
3. Refer to `CLAUDE.md` for coding patterns
4. Check implementation in `client/src/index.css`

**Maintainers:** Follow patterns strictly - consistency is key to a professional product.
