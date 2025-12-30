# Tailwind CSS Style Guide

## Overview

This guide establishes best practices for using Tailwind CSS in the PriceCompare application. Following these guidelines ensures consistency, maintainability, and proper theming support across the codebase.

---

## Design Token System

### Philosophy

**ALWAYS use design tokens instead of hardcoded color values.** Our design system is defined in `client/src/index.css` using the `@theme` directive.

### Available Design Tokens

#### Colors

```tsx
// ✅ GOOD - Use design tokens
<div className="bg-primary text-primary-foreground">
<div className="bg-secondary text-secondary-foreground">
<div className="bg-success text-success-foreground">
<div className="bg-warning text-warning-foreground">
<div className="bg-destructive text-destructive-foreground">
<div className="bg-muted text-muted-foreground">

// ❌ BAD - Hardcoded colors
<div className="bg-blue-600 text-white">
<div className="bg-red-500 text-white">
<div className="text-gray-500">
```

#### Background and Foreground

```tsx
// ✅ GOOD
<div className="bg-background text-foreground">
<div className="bg-card text-card-foreground">
<div className="border-border">
```

---

## Gradient Utilities

Use predefined gradient classes instead of inline gradients.

### Available Gradients

```tsx
// ✅ GOOD - Use gradient utilities
<div className="gradient-brand">        // primary → secondary
<div className="gradient-deal">         // destructive → secondary
<div className="gradient-success">      // success → darker success
<div className="gradient-dark">         // dark gradient
<h1 className="gradient-text-brand">   // Gradient text effect

// ❌ BAD - Inline gradients
<div className="bg-gradient-to-r from-blue-600 to-purple-600">
<div className="bg-gradient-to-r from-red-500 to-pink-500">
```

**Example:**
```tsx
// Before
<Button className="bg-gradient-to-r from-blue-600 to-purple-600">
  View Deal
</Button>

// After
<Button className="gradient-brand text-white">
  View Deal
</Button>
```

---

## Special Utility Classes

### Star Ratings

```tsx
// ✅ GOOD - Use star utilities
<Star className={cn(
  "h-4 w-4",
  isFilled ? "star-filled" : "star-empty"
)} />

// ❌ BAD - Hardcoded colors
<Star className="fill-yellow-400 text-yellow-400" />
<Star className="text-gray-300" />
```

---

## Configuration

### Tailwind Config

Custom theme values are defined in `tailwind.config.ts`:

```typescript
maxWidth: {
  'container': '1280px',  // Use max-w-container
  'search': '600px',      // Use max-w-search
  'hero-text': '500px',   // Use max-w-hero-text
}
```

**Usage:**
```tsx
// ✅ GOOD - Use configured values
<div className="max-w-container mx-auto">
<div className="max-w-search">

// ❌ BAD - Arbitrary values
<div className="max-w-[1280px] mx-auto">
<div className="max-w-[600px]">
```

---

## Class Composition

### Use the `cn()` Utility

Always use the `cn()` utility from `@/lib/utils` for composing classes, especially with conditional logic.

```tsx
import { cn } from "@/lib/utils";

// ✅ GOOD - Using cn() utility
<div className={cn(
  "base-classes",
  condition && "conditional-classes",
  variant === "primary" && "variant-classes"
)} />

// ❌ BAD - Template literals
<div className={`base-classes ${condition ? "conditional" : ""}`} />
```

---

## Component Patterns

### 1. Extracting Long Class Strings

When className strings exceed ~80 characters, extract them into a constant.

```tsx
// ✅ GOOD - Extract long class strings
const searchInputClasses = cn(
  "w-full pl-12 pr-4 py-4 text-lg rounded-2xl",
  "border-2 border-input bg-muted",
  "outline-none transition-all duration-300",
  "focus:border-primary focus:shadow-lg focus:bg-background"
);

<input className={searchInputClasses} />

// ❌ BAD - 150+ character inline string
<input className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-2xl bg-gray-50 outline-none transition-all duration-300 focus:border-primary focus:shadow-lg focus:bg-white" />
```

### 2. Component Variants with CVA

For components with multiple variants, use `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
  }
);
```

---

## Status Indicators

Use semantic color tokens for status indicators:

```tsx
// ✅ GOOD - Semantic tokens
<div className={cn(
  "w-2 h-2 rounded-full",
  status === "available" && "bg-success",
  status === "limited" && "bg-warning",
  status === "unavailable" && "bg-destructive"
)} />

<span className={cn(
  "text-sm font-medium",
  status === "available" && "text-success",
  status === "limited" && "text-warning",
  status === "unavailable" && "text-destructive"
)} />

// ❌ BAD - Hardcoded colors
<div className={status === "available" ? "bg-green-500" : "bg-red-500"} />
<span className="text-yellow-600">Limited Stock</span>
```

---

## Dark Mode

Our design system supports dark mode via the `.dark` class. All design tokens automatically adjust for dark mode.

```tsx
// ✅ GOOD - Uses tokens that adapt to dark mode
<div className="bg-background text-foreground">
<div className="bg-card border-border">

// ❌ BAD - Manual dark mode variants with hardcoded colors
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```

---

## Common Migrations

### Before → After Examples

#### Example 1: Product Card Badge

```tsx
// Before
<Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
  Best Price
</Badge>

// After
<Badge className="gradient-deal text-white">
  Best Price
</Badge>
```

#### Example 2: Text Colors

```tsx
// Before
<p className="text-gray-600 dark:text-gray-400">
  Description
</p>

// After
<p className="text-muted-foreground">
  Description
</p>
```

#### Example 3: Conditional Classes

```tsx
// Before
<Star className={`h-4 w-4 ${filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />

// After
<Star className={cn(
  "h-4 w-4",
  filled ? "star-filled" : "star-empty"
)} />
```

#### Example 4: Container Widths

```tsx
// Before
<div className="max-w-[1280px] mx-auto px-8">

// After
<div className="max-w-container mx-auto px-8">
```

---

## Avoiding Anti-Patterns

### ❌ Don't Use Undefined Custom Classes

```tsx
// ❌ BAD - These classes don't exist
<Card className="product-card-modern">
<Button className="btn-modern">

// ✅ GOOD - Use only Tailwind utilities or defined component classes
<Card className="rounded-2xl overflow-hidden">
<Button variant="default">
```

### ❌ Don't Use !important

Our design system has proper specificity. If you need `!important`, there's likely a better solution.

**Exception:** Radix UI dialog overrides in `index.css` require `!important` to override inline styles. These are documented and necessary.

```tsx
// ❌ BAD - In component code
<div className="bg-primary !text-white">

// ✅ GOOD - In component code
<div className="bg-primary text-primary-foreground">
```

### ❌ Don't Mix Design Systems

```tsx
// ❌ BAD - Mixing tokens with hardcoded colors
<div className="bg-primary text-blue-600">

// ✅ GOOD - Consistent token usage
<div className="bg-primary text-primary-foreground">
```

### Acceptable Exceptions to Hardcoded Colors

The following use cases are **acceptable** for hardcoded hex colors:

1. **Data Visualization** - Chart colors (e.g., Recharts `stroke` or `fill` props)
   ```tsx
   // ✅ ACCEPTABLE - Chart-specific colors
   <Line stroke="#3b82f6" dataKey="price" />
   <Bar fill={colors.chart.blue} />
   ```
   **Reason:** Chart libraries often require specific hex colors for data clarity and visual distinction between data series.

2. **User-Selected Colors** - Colors chosen by users (e.g., label colors, custom themes)
   ```tsx
   // ✅ ACCEPTABLE - User preference
   <div style={{ backgroundColor: userPreferences.labelColor }} />
   ```
   **Reason:** User's personal choice stored in database, not a design system color.

3. **Third-Party Integration** - External library requirements
   ```tsx
   // ✅ ACCEPTABLE - Library constraint
   <ExternalComponent color={entry.color || '#000000'} />
   ```
   **Reason:** External library API requires hex color string format.

**All other cases** must use design tokens from `@theme` in `index.css`.

**Detection:** Use grep to find potential violations:
```bash
# Find hardcoded colors (should only be in documented exceptions)
grep -r "bg-\[#" client/src --include="*.tsx"
grep -r "#[0-9a-fA-F]{6}" client/src --include="*.tsx"
```

**Note:** During TODO 008 CSS Architecture Consolidation (2025-12-30), we eliminated 442 color violations across 60+ files with zero regressions. See `docs/05_FRONTEND_PATTERNS.md` (CSS Architecture section) for migration patterns.

---

## Prettier Integration

This project uses `prettier-plugin-tailwindcss` for automatic class sorting.

### Setup

Already configured in `.prettierrc.json`. Classes will be automatically sorted on save.

### Before Prettier:
```tsx
<div className="text-white bg-primary px-4 py-2 rounded-lg">
```

### After Prettier:
```tsx
<div className="rounded-lg bg-primary px-4 py-2 text-white">
```

---

## Tools & Resources

### Configuration Files

- **Tailwind Config:** `tailwind.config.ts`
- **Theme Definition:** `client/src/index.css` (see `@theme` section)
- **Prettier Config:** `.prettierrc.json`

### Utilities

- **Class Composition:** `client/src/lib/utils.ts` → `cn()` function
- **Component Variants:** Using `class-variance-authority` (CVA)

### Available Design Tokens Reference

| Token | Usage | Example |
|-------|-------|---------|
| `primary` | Primary brand color | `bg-primary text-primary-foreground` |
| `secondary` | Secondary brand color | `bg-secondary text-secondary-foreground` |
| `success` | Success states | `bg-success text-success-foreground` |
| `warning` | Warning states | `bg-warning text-warning-foreground` |
| `destructive` / `error` | Error states | `bg-destructive text-destructive-foreground` |
| `muted` | Subtle backgrounds | `bg-muted text-muted-foreground` |
| `accent` | Accent highlights | `bg-accent text-accent-foreground` |
| `background` | Page background | `bg-background` |
| `foreground` | Primary text | `text-foreground` |
| `card` | Card backgrounds | `bg-card text-card-foreground` |
| `border` | Border colors | `border-border` |
| `input` | Input borders | `border-input` |

---

## Large-Scale Design System Migrations

**When migrating 50+ files** (e.g., consolidating color systems, updating design tokens):

### Migration Strategy

Follow the **phased approach with verification checkpoints** documented in `docs/05_FRONTEND_PATTERNS.md`:

1. **Phase 1: System Consolidation**
   - Audit violations with grep
   - Choose winning system (document decision)
   - **CRITICAL:** Migrate components BEFORE removing from config
   - Verify: Build succeeds, zero pattern violations

2. **Phase 2: Token Enforcement**
   - Create semantic mapping (e.g., `green-600 → text-success`)
   - File-by-file migration (NOT bulk sed)
   - Document exceptions (charts, user data)
   - Verify: Build succeeds, violation count decreases

3. **Phase 3: Cleanup**
   - Remove orphaned CSS
   - Update documentation
   - Final verification: Build + tests + UI regression check

### Key Principles

- ✅ **Component-first order:** Update components before config changes
- ✅ **File-by-file:** Catch edge cases sed would miss
- ✅ **Verification checkpoints:** Prevent cascading failures
- ✅ **Document exceptions:** Chart colors, user preferences, library constraints

### Success Metrics (TODO 008 Reference)

- 442 violations eliminated (47 template.* + 395 hardcoded colors)
- 60+ files updated without breaking builds
- 93.2% reduction in hardcoded colors
- Zero visual regressions
- Completed in 6-8 hours

**See:** `docs/05_FRONTEND_PATTERNS.md` → CSS Architecture section for complete patterns.

---

## Migration Checklist

When refactoring a component:

- [ ] Import `cn` from `@/lib/utils` if using conditional classes
- [ ] Replace all hardcoded colors with design tokens
- [ ] Replace inline gradients with gradient utility classes
- [ ] Use `star-filled` / `star-empty` for rating stars
- [ ] Replace arbitrary values like `max-w-[1280px]` with configured values
- [ ] Extract long className strings (80+ chars) into constants
- [ ] Remove undefined custom CSS classes
- [ ] Use semantic tokens for status indicators
- [ ] Replace dark mode variants with token-based approach
- [ ] Use `cn()` for all conditional class logic

---

## Getting Help

If you encounter patterns not covered in this guide:

1. Check existing refactored components (`product-card.tsx`, `search-header.tsx`)
2. Review the design token definitions in `client/src/index.css`
3. Consult the Tailwind config in `tailwind.config.ts`
4. Ask the team for guidance on new patterns

---

## Summary

**Key Principles:**

1. **Always use design tokens** - Never hardcode colors
2. **Use gradient utilities** - No inline gradients
3. **Use the `cn()` utility** - For class composition
4. **Extract long strings** - Keep components readable
5. **Be consistent** - Follow established patterns

By following this guide, we maintain a consistent, maintainable, and theme-friendly codebase.
