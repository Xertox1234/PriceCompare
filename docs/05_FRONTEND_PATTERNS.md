# Frontend Patterns

**Version:** 2.10
**Last Updated:** 2026-01-16
**Changelog:**
- 2.10 (2026-01-16): Added Toast Notifications: WCAG Compliance pattern - documents Radix Toast type prop mapping for proper ARIA live region announcements (aria-live="assertive" for destructive, aria-live="polite" for default), WCAG AA color contrast verification, and E2E testing strategy (from TODO_231 Phase 6)
- 2.9 (2026-01-06): Added Authentication Guards for React Query Hooks pattern - documents `enabled: !!user` requirement for authenticated endpoints, HTTP Basic Auth popup prevention, middleware-based classification, compound conditions, and audit methodology (15 hooks fixed across 4 files from TODO_014 follow-up)
- 2.8 (2026-01-06): Added Optimistic Updates with Rollback pattern to React Query Patterns section - documents instant UI feedback with automatic rollback, race condition prevention via query cancellation, minimal invalidation strategy, and performance optimization (6→1 API calls, 200-500ms→0ms latency) from TODO_013 watchlist integration
- 2.7 (2026-01-02): Added Mega Menu: React State Over CSS-Only Hover pattern to Accessibility section - documents pointer-events control, keyboard navigation, ARIA attributes, and delayed close pattern for hover menus (from header navigation click failure fix)
- 2.6 (2025-12-30): Added CSS Architecture Consolidation patterns: Large-Scale Design Token Migration Strategy, Component-First Configuration-Last Migration Order, Semantic Design Token Mapping Strategy, Phase-Gated Refactoring with Verification Checkpoints (from TODO 008 - 442 violations, 60+ files, zero regressions)
- 2.5 (2025-12-26): Enhanced Lazy Loading verification checklist with production testing requirements
- 2.4 (2025-12-26): Added Lazy Loading for Bundle Size Optimization pattern to Performance section
- 2.3 (2025-12-23): Added "When to Use" context to Component Reuse pattern
- 2.2 (2025-12-16): Added Watchlist Hook Ownership pattern

**Migrated From:**
- docs/FRONTEND_PATTERNS.md (v1.0 - 2025-11-26)
- docs/PHASE1_WATCHLIST_PATTERNS.md (React Query patterns, form handling, pagination - 2025-11-29)

---

## Table of Contents

1. [Overview](#overview)
2. [React Component Patterns](#react-component-patterns)
  - [Component Reuse](#component-reuse)
  - [Design System Compliance](#design-system-compliance)
  - [Conditional UI Rendering](#conditional-ui-rendering)
  - [Accessibility: Icon-Only Buttons Must Have Names](#accessibility-icon-only-buttons-must-have-names-new---2025-12-15)
  - [Mega Menu: React State Over CSS-Only Hover](#mega-menu-react-state-over-css-only-hover-new---2026-01-02)
  - [Toast Notifications: WCAG Compliance](#toast-notifications-wcag-compliance-new---2026-01-16)
3. [React Query Patterns](#react-query-patterns)
  - [Authentication Guards for React Query Hooks](#authentication-guards-for-react-query-hooks-new---2026-01-06)
  - [Mutation Best Practices](#mutation-best-practices)
  - [Query Invalidation Strategy](#query-invalidation-strategy)
  - [Async Handler ESLint Compliance](#async-handler-eslint-compliance)
  - [Cursor-Based Pagination](#cursor-based-pagination)
4. [Form Handling](#form-handling)
  - [Dialog Component Design](#dialog-component-design)
  - [Inline Editing Pattern](#inline-editing-pattern)
  - [Decimal Field Handling](#decimal-field-handling)
5. [State Management](#state-management)
  - [Local State vs Server State](#local-state-vs-server-state)
  - [Component Integration Pattern](#component-integration-pattern)
6. [API Integration Patterns](#api-integration-patterns)
  - [Centralized API Client](#centralized-api-client)
  - [Watchlist Hook Ownership](#watchlist-hook-ownership-new---2025-12-16)
  - [Error Handling](#error-handling)
7. [Performance Patterns](#performance-patterns)
  - [Client-Side Data Aggregation Anti-Pattern](#client-side-data-aggregation-anti-pattern)
  - [Deterministic Sorting for Pagination](#deterministic-sorting-for-pagination)
  - [Lazy Loading for Bundle Size Optimization](#lazy-loading-for-bundle-size-optimization)
8. [Common Anti-Patterns](#common-anti-patterns)
  - [Hardcoded Values](#hardcoded-values)
9. [CSS & Tailwind 4 Patterns](#css--tailwind-4-patterns)
  - [Theme Configuration](#theme-configuration)
  - [Custom Utility Classes](#custom-utility-classes)
  - [Avoiding Arbitrary Values](#avoiding-arbitrary-values)
  - [Large-Scale Design Token Migration Strategy](#large-scale-design-token-migration-strategy)
  - [Component-First Configuration-Last Migration Order](#component-first-configuration-last-migration-order)
  - [Semantic Design Token Mapping Strategy](#semantic-design-token-mapping-strategy)
  - [Phase-Gated Refactoring with Verification Checkpoints](#phase-gated-refactoring-with-verification-checkpoints)
10. [Testing Patterns](#testing-patterns)
11. [Checklist](#frontend-checklist)

---

## Overview

This document codifies frontend patterns to ensure consistent, performant, and maintainable React code in the PriceCompare client application.

**Key Technologies:**
- React 19 with TypeScript
- TanStack React Query (data fetching/caching)
- shadcn/ui components
- Tailwind CSS
- react-intersection-observer (infinite scroll)

**Core Principles:**
- Server state in React Query, local state in useState
- Design system compliance (no hardcoded colors)
- Reuse existing components before creating new ones
- Zero tolerance for `any` types (see `docs/01_TYPESCRIPT_PATTERNS.md`)
- ESLint compliance for all async operations

---

## React Component Patterns

### Component Reuse

**When to Use:** Before creating any new component, especially for navigation, layouts, or common UI elements.

**Context:** The codebase has many shared components (`SharedNavigation`, `HeroSection`, `Categories`, etc.). Duplicating components creates maintenance burden, inconsistent UX, and violates DRY principles. Always search first.

**NEVER duplicate components.** Search for existing implementations first.

#### ❌ WRONG - Duplicating Navigation
```typescript
// Creating NEW navigation when SharedNavigation exists!
function MyPage() {
  return (
    <div>
      <nav className="...">
        <Link to="/">Home</Link>
        <Link to="/products">Products</Link>
        {/* Duplicating navigation logic */}
      </nav>
      <main>{/* content */}</main>
    </div>
  );
}
```

#### ✅ CORRECT - Reuse Shared Components
```typescript
import { SharedNavigation } from "@/components/shared-navigation";

function MyPage() {
  return (
    <div>
      <SharedNavigation />
      <main>{/* content */}</main>
    </div>
  );
}
```

#### How to Find Existing Components
```bash
# Search for component by name
grep -r "function ComponentName" client/src/components/
grep -r "export.*ComponentName" client/src/components/

# Find components with similar functionality
grep -r "navigation" client/src/components/
grep -r "hero" client/src/components/
grep -r "category" client/src/components/
```

#### Shared Components Reference

**Layout:**
- `SharedNavigation` - App navigation header
- `Footer` - App footer

**Landing Page:**
- `NewHeroSection` - Hero section
- `NewCategories` - Category grid
- `CallToAction` - CTA sections

**UI Primitives (shadcn/ui):**
- `Button` - All button variations
- `Card` - Card layouts
- `Dialog` - Modals
- `Form` - Form components
- `Input` - Input fields
- Many more in `@/components/ui/`

---

### Design System Compliance

**All UI work MUST follow the design system** to maintain consistency.

#### ❌ WRONG - Hardcoded Color Values

```typescript
// THIS WILL FAIL CODE REVIEW!
<div className="bg-green-500 text-white">
  Price dropped!
</div>

<div className="bg-[#3B82F6] text-[#FFFFFF]">
  {/* Arbitrary hex colors - inconsistent with design system */}
</div>

<Button style={{ backgroundColor: '#F59E0B' }}>
  {/* Inline styles with hardcoded colors - WRONG! */}
</Button>

// Old/deprecated colors - also wrong
<div className="bg-purple-500">  {/* Old brand color */}
<div className="bg-pink-600">    {/* Old accent color */}
```

**Problems:**
- Inconsistent colors across UI
- Breaks dark mode support
- Can't update theme centrally
- Violates design system standards
- Harder to maintain

#### ✅ CORRECT - Use Design Tokens

```typescript
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Use semantic color classes from design system
<div className="bg-primary text-primary-foreground">
  Primary action
</div>

<div className="bg-secondary text-secondary-foreground">
  Secondary action
</div>

<div className="bg-muted text-muted-foreground">
  Muted/disabled state
</div>

<div className="bg-destructive text-destructive-foreground">
  Destructive action
</div>

// Status colors with dark mode support
<div className="bg-green-600 dark:bg-green-500 text-white">
  Success state - properly themed
</div>

<div className="bg-red-600 dark:bg-red-500 text-white">
  Error state - properly themed
</div>

// Use design system components
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>

<Card className="bg-card text-card-foreground">
  Card content with semantic colors
</Card>
```

#### Current Design System Colors

**Brand Colors:**
- Primary: Blue 500 (#3B82F6) - Use `bg-primary` or `text-primary`
- Secondary: Amber 500 (#F59E0B) - Use `bg-secondary` or `text-secondary`

**Semantic Colors:**
- `bg-background` - Page background
- `bg-foreground` - Primary text
- `bg-card` - Card backgrounds
- `bg-muted` - Muted/disabled states
- `bg-accent` - Accent elements
- `bg-destructive` - Destructive actions
- `bg-border` - Borders

**Status Colors (with dark mode):**
```typescript
// Success
className="bg-green-600 dark:bg-green-500"

// Warning
className="bg-yellow-600 dark:bg-yellow-500"

// Error
className="bg-red-600 dark:bg-red-500"

// Info
className="bg-blue-600 dark:bg-blue-500"
```

#### Detection Rule
```bash
# Find hardcoded hex colors
grep -r "bg-\[#" client/src
grep -r "text-\[#" client/src
grep -r "backgroundColor.*#" client/src

# Find deprecated color usage
grep -r "bg-purple-" client/src
grep -r "bg-pink-" client/src

# Find specific hardcoded Tailwind colors that should use tokens
grep -r "bg-green-500" client/src  # Should be bg-green-600 dark:bg-green-500 or semantic
```

#### Exceptions (Rare)

Truly dynamic colors calculated at runtime are acceptable:
```typescript
// OK - Dynamic color based on data
<div style={{
  backgroundColor: `hsl(${hue}, 70%, 50%)`,  // Calculated from data
  opacity: confidence
}}>
```

---

### Conditional UI Rendering

**When:** Showing/hiding UI elements based on state

#### Anti-Pattern
```typescript
// ❌ WRONG - UI always present, just hidden
<Button style={{ display: hasAlert ? 'none' : 'block' }}>
  Set Alert
</Button>
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Conditional rendering with proper React pattern
{product.alertStatus === 'none' && (
  <div className="mt-3">
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setShowAlertDialog(true)}
    >
      <Bell className="w-4 h-4 mr-2" />
      Set Price Alert
    </Button>
  </div>
)}
```

**Why:**
- Only renders when condition is true (better performance)
- Clearer intent in code
- No CSS display tricks
- Better for accessibility (element not in DOM when hidden)

---

### Accessibility: Icon-Only Buttons Must Have Names (NEW - 2025-12-15)

**Rule:** Any icon-only interactive control MUST have an accessible name.

#### Anti-Pattern

```tsx
// ❌ WRONG - No accessible name (Axe: button-name)
<Button variant="ghost" size="icon" onClick={toggleWishlist}>
  <Heart className="h-4 w-4" />
</Button>
```

#### Correct Pattern

```tsx
// ✅ CORRECT - aria-label provides an accessible name
<Button
  type="button"
  variant="ghost"
  size="icon"
  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
  onClick={toggleWishlist}
>
  <Heart className="h-4 w-4" aria-hidden="true" focusable="false" />
</Button>
```

**Notes:**
- Use `type="button"` when a button is inside a `<form>` to avoid accidental submits.
- Images that communicate meaning need descriptive `alt` text; decorative images should use `alt=""`.

**Reference fixes:**
- `client/src/pages/product-detail-new.tsx` (gallery arrows, thumbnails, icon buttons)
- `client/src/components/auth/login-form.tsx` (password visibility toggle)

---

### Mega Menu: React State Over CSS-Only Hover (NEW - 2026-01-02)

**Problem:** CSS-only hover states (`group-hover:`) for mega menus create timing issues that cause intermittent click failures during transitions. When mega menus fade out (200ms transition), they still intercept pointer events and block clicks on adjacent menu items.

**Root Cause:** Pure CSS cannot control `pointer-events` based on transition state, leading to race conditions where hidden/hiding elements block user interactions.

**Solution:** Replace CSS-only hover with React state management + explicit `pointer-events` control.

#### Anti-Pattern

```tsx
// ❌ WRONG - CSS-only hover creates click interception issues
<li className="group relative">
  <Link href={item.link}>
    {item.label}
    {item.megaMenu && <ChevronDown />}
  </Link>

  {/* Mega menu controlled purely by CSS */}
  {item.megaMenu && (
    <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200">
      {/* Menu content - still intercepts clicks during fade-out! */}
    </div>
  )}
</li>
```

**Problems:**
- During 200ms fade-out, mega menu intercepts pointer events
- Adjacent menu items become unclickable during transitions
- Rapid hover movements cause race conditions
- No keyboard navigation support
- Missing ARIA attributes for screen readers

#### Correct Pattern

```tsx
// ✅ CORRECT - React state + pointer-events control
function TemplateHeader() {
  const MEGA_MENU_CLOSE_DELAY_MS = 150; // Prevents flicker when moving between items
  const [openMegaMenuId, setOpenMegaMenuId] = useState<number | null>(null);
  const megaMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (megaMenuTimeoutRef.current) {
        clearTimeout(megaMenuTimeoutRef.current);
      }
    };
  }, []);

  const handleMegaMenuEnter = (menuId: number) => {
    // Clear any pending hide timeout
    if (megaMenuTimeoutRef.current) {
      clearTimeout(megaMenuTimeoutRef.current);
      megaMenuTimeoutRef.current = null;
    }
    setOpenMegaMenuId(menuId);
  };

  const handleMegaMenuLeave = () => {
    // Delayed close prevents accidental dismissal
    megaMenuTimeoutRef.current = setTimeout(() => {
      setOpenMegaMenuId(null);
    }, MEGA_MENU_CLOSE_DELAY_MS);
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && openMegaMenuId !== null) {
      setOpenMegaMenuId(null);
      event.preventDefault();
    }
  };

  return (
    <ul>
      {menuItems.map((item) => (
        <li
          key={item.id}
          className="relative"
          onMouseEnter={() => item.megaMenu && handleMegaMenuEnter(item.id)}
          onMouseLeave={() => item.megaMenu && handleMegaMenuLeave()}
          onKeyDown={handleMenuKeyDown}
        >
          <Link
            href={item.link}
            aria-haspopup={item.megaMenu ? 'true' : undefined}
            aria-expanded={item.megaMenu ? openMegaMenuId === item.id : undefined}
            className={cn(
              'hover:text-primary',
              openMegaMenuId === item.id && 'text-primary' // Active state
            )}
          >
            {item.label}
            {item.megaMenu && (
              <ChevronDown aria-hidden="true" focusable="false" />
            )}
          </Link>

          {/* CRITICAL: pointer-events-none when hidden prevents click interception */}
          {item.megaMenu && (
            <div
              className={cn(
                'absolute top-full left-0 transition-all duration-200',
                'will-change-opacity will-change-transform', // GPU acceleration
                openMegaMenuId === item.id
                  ? 'visible opacity-100 pointer-events-auto'
                  : 'invisible opacity-0 pointer-events-none' // Key fix!
              )}
            >
              {/* Menu content */}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

**Key Elements:**

1. **State Management**
   - `openMegaMenuId` tracks which mega menu is open (only one at a time)
   - `megaMenuTimeoutRef` manages delayed close timing

2. **Pointer Events Control** (CRITICAL)
   - `pointer-events-auto` when visible → menu is interactive
   - `pointer-events-none` when hidden → prevents click interception during transitions
   - This is the key fix that CSS-only approaches cannot achieve

3. **Delayed Close**
   - 150ms delay before hiding prevents accidental dismissal when moving mouse between items
   - Timeout is cleared if user hovers another menu (prevents flicker)
   - Cleanup in `useEffect` prevents memory leaks

4. **Keyboard Navigation**
   - `Escape` key closes open mega menu
   - Maintains keyboard accessibility

5. **ARIA Attributes**
   - `aria-haspopup="true"` → announces menu trigger to screen readers
   - `aria-expanded="true/false"` → announces current menu state
   - `aria-hidden="true"` on decorative icons
   - `focusable="false"` prevents icon focus

6. **Performance**
   - `will-change-opacity` and `will-change-transform` hint GPU acceleration
   - Minimizes layout thrashing during transitions

**When to Use:**
- Any dropdown, mega menu, or tooltip with hover interactions
- Components where CSS-only hover causes timing issues
- Navigation menus with complex nested content
- Situations requiring precise control over interaction timing

**Accessibility Requirements:**
- ✅ Keyboard navigation (Escape closes menu)
- ✅ ARIA attributes for screen readers
- ✅ Visual active state feedback
- ✅ Decorative icons hidden from assistive tech

**Reference Implementation:**
- `client/src/components/template/header.tsx:76-360` (TemplateHeader mega menu)

**Learned From:** TODO #[number] - Header navigation click failures (2026-01-02)

---

### Toast Notifications: WCAG Compliance (NEW - 2026-01-16)

**Rule:** Toast notifications MUST be properly announced to screen readers via ARIA live regions, and meet WCAG AA color contrast requirements.

**Context:** Radix UI Toast v1.2.7 has a known accessibility issue where toasts can be set to `aria-live="off"`, preventing screen reader announcements. The `type` prop controls ARIA announcement behavior and must be mapped to toast severity.

#### Radix Toast Type Prop Mapping

```typescript
// Radix Toast type prop controls ARIA live region behavior
type="foreground" → aria-live="assertive"  // Immediate announcement (critical toasts)
type="background" → aria-live="polite"     // Announce at next opportunity (info toasts)
```

#### Anti-Pattern

```tsx
// ❌ WRONG - No type prop, defaults to "foreground" for ALL toasts
const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
      // ← Missing type prop! All toasts interrupt screen readers
    />
  );
});
```

**Problems:**
- All toasts use `aria-live="assertive"` (immediate interruption)
- Screen readers interrupt users for non-critical notifications
- Info toasts are treated with same urgency as error toasts
- No semantic distinction between toast severities

#### Correct Pattern

```tsx
// ✅ CORRECT - Map variant to appropriate ARIA live region behavior
const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  // WCAG Compliance: Map variant to Radix Toast type for proper ARIA announcements
  // - "foreground" → aria-live="assertive" (immediate announcement for critical toasts)
  // - "background" → aria-live="polite" (announce at next opportunity for info toasts)
  // See: https://github.com/radix-ui/primitives/issues/3634
  const toastType = variant === 'destructive' ? 'foreground' : 'background';

  return (
    <ToastPrimitives.Root
      ref={ref}
      type={toastType}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
```

#### WCAG AA Color Contrast Requirements

**Design tokens are already compliant:**

```typescript
// Light mode (verified WCAG AA compliant)
--color-background: 0 0% 100%;           // White
--color-foreground: 222 47% 11%;         // Slate 900
// Contrast ratio: >15:1 ✅

--color-destructive: 0 84% 60%;          // Red 500
--color-destructive-foreground: 210 40% 98%; // Slate 50
// Contrast ratio: >8:1 ✅

// Dark mode (verified WCAG AA compliant)
--color-background: 222 47% 11%;         // Slate 900
--color-foreground: 210 40% 98%;         // Slate 50
// Contrast ratio: >14:1 ✅
```

**WCAG AA Requirements:**
- Normal text (< 18pt): 4.5:1 minimum contrast ratio
- Large text (≥ 18pt): 3:1 minimum contrast ratio
- UI components: 3:1 minimum contrast ratio

**PriceCompare Design System:**
- All design tokens exceed WCAG AA minimums
- High contrast mode available for AAA compliance (7:1 ratio)
- Use design tokens (`bg-background`, `text-foreground`) NOT hex colors

#### Usage Examples

```tsx
// Success toast (polite announcement)
toast({
  title: 'Added to watchlist',
  description: 'Product has been added to your watchlist.',
  // variant defaults to 'default' → type="background" → aria-live="polite"
});

// Error toast (assertive announcement)
toast({
  title: 'Error',
  description: 'Failed to update watchlist',
  variant: 'destructive', // → type="foreground" → aria-live="assertive"
});
```

#### E2E Testing

```typescript
// E2E accessibility scan on toast viewport
test('should have no WCAG A/AA violations in toast notifications', async ({ page }) => {
  // Trigger toast
  await page.getByRole('button', { name: /add to watchlist/i }).click();

  // Wait for toast to appear
  await page.getByText(/added to/i).first().waitFor({ state: 'visible', timeout: 5000 });

  // Scan toast viewport for violations
  const hasRadixViewport = (await page.locator('[data-radix-toast-viewport]').count()) > 0;
  const include = hasRadixViewport ? '[data-radix-toast-viewport]' : '[role="status"]';

  const results = await runA11yScan(page, { include });
  expect(results.violations).toEqual([]);
});
```

**Key Testing Points:**
- Toast viewport has `[data-radix-toast-viewport]` attribute
- Toast root has `role="status"` or `role="alert"`
- Toast root has `aria-live="polite"` or `aria-live="assertive"` (NOT `aria-live="off"`)
- Close button has `aria-label="Close"`
- Color contrast meets WCAG AA minimums

**Reference Implementation:**
- `client/src/components/ui/toast.tsx:41-60` (Toast component with type mapping)
- `client/src/components/ui/toaster.tsx` (Toast provider and viewport)
- `e2e/accessibility.spec.ts:138-203` (Toast accessibility E2E test)

**Learned From:** TODO_231 Phase 6 - Toast Notification WCAG Compliance (2026-01-16)

**Resources:**
- [Radix UI Toast Accessibility](https://www.radix-ui.com/primitives/docs/components/toast#accessibility)
- [GitHub Issue #3634: Toast aria-live="off" bug](https://github.com/radix-ui/primitives/issues/3634)
- [WCAG 2.1 Success Criterion 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

### Authentication Pattern (Modal-Based)

**Added:** 2025-12-11 (Phase 1.1 E2E Test Expansion)

This application uses **modal-based authentication** via the `AuthModal` component, NOT route-based pages (`/login`, `/register`). All components must use this pattern for consistency.

**Key Points:**
- Main app uses `AuthModal` for login/register flows
- No `/login` or `/register` routes exist in main app
- Template components may use different patterns (intentional variation)

#### Anti-Pattern

```typescript
// ❌ WRONG - Hardcoded link to non-existent route
import { Link } from '@/components/ui/link';

function Header() {
  return (
    <nav>
      <Link href="/login">  {/* ← 404 ERROR! Route doesn't exist */}
        <User className="h-5 w-5" />
        <span>My account</span>
      </Link>
    </nav>
  );
}
```

**Problems:**
- Clicking navigates to `/login` which returns 404
- Inconsistent UX (modals elsewhere, routes here)
- Breaks authentication flow

#### Correct Pattern

```typescript
// ✅ CORRECT - Modal-based auth pattern
import { useState } from 'react';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { AuthModal } from '@/components/auth/auth-modal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';

function Header() {
  // Auth state
  const { data: user } = useAuth();
  const logoutMutation = useLogout();

  // Modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Handlers
  const handleOpenAuth = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <nav>
      {user ? (
        // LOGGED IN: Dropdown with avatar, username, admin panel (if admin), logout
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {user.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm lg:inline">{user.username}</span>
              <ChevronDown className="hidden h-3 w-3 lg:inline" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user.role === 'admin' && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // NOT LOGGED IN: Button that opens auth modal
        <button
          onClick={handleOpenAuth}
          className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-accent"
        >
          <User className="h-5 w-5" />
          <span className="hidden text-sm lg:inline">My account</span>
        </button>
      )}

      {/* AuthModal component */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
      />
    </nav>
  );
}
```

#### AuthModal Props Interface

**CRITICAL:** `AuthModal` uses specific prop names. Using wrong props will cause TypeScript errors.

```typescript
// ✅ CORRECT Props
interface AuthModalProps {
  isOpen: boolean;              // NOT 'open'
  onClose: () => void;          // NOT 'onOpenChange'
  defaultMode: 'login' | 'register';  // NOT 'mode' or 'onModeChange'
}

// Usage
<AuthModal
  isOpen={showAuthModal}
  onClose={() => setShowAuthModal(false)}
  defaultMode={authMode}
/>

// ❌ WRONG - These props don't exist
<AuthModal
  open={showAuthModal}          // ❌ TypeScript error
  onOpenChange={setShowAuthModal}  // ❌ TypeScript error
  mode={authMode}               // ❌ TypeScript error
  onModeChange={setAuthMode}    // ❌ TypeScript error
/>
```

#### Key Elements

1. ✅ Import `useAuth` and `useLogout` from `@/hooks/use-auth`
2. ✅ Import `AuthModal` from `@/components/auth/auth-modal`
3. ✅ Local state for modal visibility: `useState(false)`
4. ✅ Local state for auth mode: `useState<'login' | 'register'>('login')`
5. ✅ Conditional rendering based on `user` presence
6. ✅ Logged-in: Dropdown with avatar, username, logout
7. ✅ Logged-out: Button that opens `AuthModal` (NOT link to `/login`)
8. ✅ Admin-only features gated by `user.role === 'admin'`
9. ✅ Proper TypeScript types for all state
10. ✅ Correct `AuthModal` props: `isOpen`, `onClose`, `defaultMode`

#### Common Mistakes

**❌ Mistake 1: Wrong AuthModal Props**
```typescript
// Uses 'open' instead of 'isOpen'
<AuthModal open={showAuthModal} ... />  // TypeScript error
```
**Fix:** Use `isOpen`, `onClose`, `defaultMode` (see Props Interface above)

**❌ Mistake 2: Link to Non-Existent Route**
```typescript
<Link href="/login">My Account</Link>  // 404 error
```
**Fix:** Use button with `onClick` that opens `AuthModal`

**❌ Mistake 3: No Conditional Rendering**
```typescript
// Always shows "Sign In" even when logged in
<button onClick={handleOpenAuth}>Sign In</button>
```
**Fix:** Conditional rendering - show dropdown when `user` exists, button when `user` is null

**❌ Mistake 4: Missing Admin Panel Check**
```typescript
// Shows admin panel to all users
<DropdownMenuItem asChild>
  <Link href="/admin">Admin Panel</Link>
</DropdownMenuItem>
```
**Fix:** Wrap in `{user.role === 'admin' && ...}` conditional

#### Template Components Exception

**Note:** Components in `client/src/components/template/` may use different auth patterns intentionally (e.g., `TemplateHeader` was refactored to use this pattern). This is acceptable as template components demonstrate pattern variations.

#### Detection Rule

```bash
# Find hardcoded /login or /register links (anti-pattern in main app)
grep -rn 'href="/login"' client/src/components --exclude-dir=template
grep -rn 'href="/register"' client/src/components --exclude-dir=template

# Find AuthModal usage with wrong props
grep -rn "AuthModal" client/src --include="*.tsx" -A5 | grep "open="
grep -rn "AuthModal" client/src --include="*.tsx" -A5 | grep "onOpenChange="
```

#### Reference Implementation

**See:** `client/src/components/shared-navigation.tsx` - Complete example of correct modal-based auth pattern with all features.

**See Also:** `client/src/components/template/header.tsx` - Recently refactored to use this pattern (Phase 1.1 E2E test fix).

---

## React Query Patterns

### Authentication Guards for React Query Hooks (NEW - 2026-01-06)

**When:** Creating React Query hooks that call authenticated API endpoints

**Added:** 2026-01-06 (TODO_014 follow-up - authentication guard audit)

**Problem:** React Query hooks without authentication guards (`enabled: !!user`) make API calls immediately on mount, even when users are unauthenticated. When these hooks call authenticated endpoints, the server returns `401 Unauthorized` with a `WWW-Authenticate: Basic` header, which triggers the browser's native HTTP Basic Auth dialog. This modal dialog blocks the entire page, preventing users from interacting with ANY content - even public product images that should be visible.

**Root Cause:** The `enabled` option in React Query defaults to `true`, meaning queries execute immediately unless explicitly disabled. Without checking authentication state first, hooks make requests before knowing if the user is logged in.

**Impact:**
- ❌ Browser shows modal authentication popup blocking entire UI
- ❌ Unnecessary API calls that always return 401
- ❌ Poor user experience on public pages
- ❌ Race conditions where queries execute before auth state loads

#### Anti-Pattern: Missing Authentication Guard

```typescript
// ❌ WRONG - No authentication check
export function useNotifications() {
  return useQuery<NotificationData>({
    queryKey: ['/api/notifications'],
    queryFn: () => apiRequest('/api/notifications'),
    // Missing: enabled: !!user
  });
}
```

**What happens:**
1. Component mounts on page load (e.g., product detail page)
2. Hook executes query immediately
3. `/api/notifications` requires authentication (`withAuth` middleware)
4. Server returns `401` with `WWW-Authenticate: Basic realm="PriceCompare API"`
5. Browser shows HTTP Basic Auth popup dialog
6. Popup is modal - blocks entire page including product images
7. User thinks images aren't loading, but they're just hidden behind auth dialog

#### Correct Pattern: Always Guard Authenticated Endpoints

```typescript
// ✅ CORRECT - Check authentication before querying
import { useAuth } from './use-auth';

export function useNotifications() {
  const { data: user } = useAuth();

  return useQuery<NotificationData>({
    queryKey: ['/api/notifications'],
    queryFn: () => apiRequest('/api/notifications'),
    enabled: !!user, // Only fetch if user is authenticated
  });
}
```

**Why this works:**
- Query only runs when `user` exists (authenticated state)
- Prevents 401 responses that trigger browser auth dialog
- No unnecessary API calls for unauthenticated users
- React Query automatically runs query when `enabled` transitions from `false` → `true` (user logs in)

#### Compound Conditions: Multiple Requirements

**When a hook needs BOTH authentication AND other data:**

```typescript
// ✅ CORRECT - Combine all required conditions with &&
export function useIsWatching(productId: number | null) {
  const { data: user } = useAuth();

  return useQuery<IsWatchingResponse>({
    queryKey: [`/api/community/is-watching/${productId}`],
    queryFn: () => apiRequest(`/api/community/is-watching/${productId}`),
    enabled: !!productId && !!user, // Both productId AND user required
  });
}
```

**Rules for compound conditions:**
- Use `&&` when ALL conditions must be true
- Check data requirements first, auth state last: `!!productId && !!currentPrice && !!user`
- Never use `||` (OR) - that defeats the guard purpose

#### How to Identify Which Hooks Need Guards

**Method 1: Check Server Route Middleware**

```typescript
// In server/routes/notifications.ts
app.get('/api/notifications', withAuth(async (req, res) => {
  // ← Uses withAuth middleware
  const notifications = await getNotifications(req.user.id);
  sendSuccess(res, notifications);
}));
```

**Rule:** If route uses `withAuth` or `flexibleAuth + withAuth`, the corresponding React Query hook MUST have `enabled: !!user`.

**Method 2: Look for User-Specific Data**

Endpoints returning user-specific data always require authentication:
- ✅ `/api/notifications` - user's notifications
- ✅ `/api/watchlists` - user's watchlists
- ✅ `/api/smart-alerts/analytics` - user's alert analytics
- ✅ `/api/wishlists` - user's wishlists
- ❌ `/api/products/:id` - public product data
- ❌ `/api/community/leaderboard` - public community data

**Method 3: Test in Browser DevTools**

1. Open page while logged out
2. Check Network tab for 401 responses
3. If you see `WWW-Authenticate: Basic` header → hook needs guard

#### Checklist for New Authenticated Hooks

When creating a new React Query hook for an authenticated endpoint:

- [ ] Import `useAuth` from './use-auth'
- [ ] Call `const { data: user } = useAuth()` at top of hook
- [ ] Add `enabled: !!user` to query config (or `enabled: !!requiredData && !!user` for compound conditions)
- [ ] Add comment explaining authentication requirement
- [ ] Verify server route uses `withAuth` middleware
- [ ] Test: Page doesn't show auth popup when logged out
- [ ] Test: Hook fetches data correctly when logged in

#### Audit Methodology (How We Found 15 Vulnerable Hooks)

**Step 1: List all React Query hook files**
```bash
find client/src/hooks -name "*.ts" -type f
```

**Step 2: Filter to files using React Query**
```bash
grep -l "useQuery\|useMutation\|useInfiniteQuery" client/src/hooks/*.ts
```

**Step 3: For each file, check for authenticated endpoints**
```bash
# Look for hooks calling authenticated endpoints
grep -n "apiRequest.*('/api/" client/src/hooks/use-notifications.ts

# Check if server route requires auth
grep -A 5 "'/api/notifications'" server/routes/*.ts | grep "withAuth"
```

**Step 4: Verify authentication guard**
```bash
# Search for enabled: !!user pattern
grep -n "enabled.*!!user" client/src/hooks/use-notifications.ts
```

**Step 5: Code review after fixes**
- Run automated code review to catch hooks missed in audit
- Check for similar naming patterns (`useWatchList` vs `useWatchLists`)
- Verify all hooks in modified files, not just targeted ones

**Results from our audit:**
- 15 React Query hook files examined
- 15 vulnerable hooks found (13 in initial audit + 2 in code review)
- 4 files modified: use-community.ts, use-notifications.ts, use-smart-alerts.ts, use-wishlist.ts
- 100% fixed with zero regressions

#### Real-World Example: TODO_014 Bug

**Original issue:**
- Product detail page called `useWatchLists()` unconditionally
- Hook queried `/api/watchlists` (authenticated endpoint)
- When unauthenticated, server returned 401 with `WWW-Authenticate: Basic`
- Browser showed HTTP Basic Auth popup
- Popup blocked entire page including product images
- Users reported "images not loading" but images were rendering correctly under the popup

**Fix:**
```typescript
// Before
export function useWatchLists() {
  return useQuery<WatchList[]>({
    queryKey: ['/api/watchlists'],
    queryFn: () => apiRequest('/api/watchlists'),
  });
}

// After
export function useWatchLists() {
  const { data: user } = useAuth();

  return useQuery<WatchList[]>({
    queryKey: ['/api/watchlists'],
    queryFn: () => apiRequest('/api/watchlists'),
    enabled: !!user, // Only fetch if user is authenticated
  });
}
```

**Result:**
- ✅ No more auth popups on public pages
- ✅ Product images visible immediately
- ✅ Hooks fetch data correctly after login

#### Related Documentation

- **Audit Report:** `docs/AUTHENTICATION_GUARD_AUDIT_2026-01-06.md` - Complete list of 15 fixed hooks
- **Original Bug:** `todos/archive/2026-01-06-TODO_014_COMPLETE.md` - Product image visibility issue
- **Security Patterns:** `docs/04_SECURITY_PATTERNS.md` - Server-side authentication middleware

#### Key Takeaways

1. **ALWAYS use `enabled: !!user`** for hooks calling authenticated endpoints
2. **Check server middleware** to identify which endpoints require authentication
3. **Combine conditions with `&&`** when multiple requirements exist
4. **Audit systematically** using grep + server route verification
5. **Code review catches what audits miss** - run review after bulk fixes

---

### Mutation Best Practices

**When:** Using React Query mutations for API calls

#### Anti-Pattern
```typescript
// ❌ WRONG - No query invalidation, no error handling
const createMutation = useMutation({
  mutationFn: async (data) => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Comprehensive mutation pattern
const createMutation = useMutation({
  mutationFn: async (data: CreateInput) => {
    return apiRequest<{ id: number }>('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  onSuccess: () => {
    // Invalidate ALL affected queries
    void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/related'] });

    toast({
      title: "Success",
      description: "Resource created successfully",
    });

    onOpenChange(false);
  },
  onError: (error: Error) => {
    toast({
      title: "Failed",
      description: error.message || "Please try again later",
      variant: "destructive",
    });
  },
});
```

**Key Elements:**
1. ✅ Typed input/output interfaces
2. ✅ Use `apiRequest` helper (handles CSRF, auth)
3. ✅ `void` keyword for fire-and-forget invalidations (ESLint compliance)
4. ✅ Invalidate ALL affected queries (list + stats + related)
5. ✅ Toast for success/error feedback
6. ✅ Close dialog on success only
7. ✅ Error type properly defined

---

### Query Invalidation Strategy

```typescript
// When creating/updating/deleting a resource, invalidate:
void queryClient.invalidateQueries({ queryKey: ['/api/resources'] }); // List view
void queryClient.invalidateQueries({ queryKey: ['/api/resources', id] }); // Detail view
void queryClient.invalidateQueries({ queryKey: ['/api/stats'] }); // Dashboard stats
void queryClient.invalidateQueries({ queryKey: ['/api/related-resources'] }); // Related data
```

**Common Mistakes:**

#### ❌ Mistake 1: No Query Invalidation
```typescript
// Creates alert but watchlist doesn't update
const createMutation = useMutation({
  mutationFn: createAlert,
  onSuccess: () => {
    onOpenChange(false); // Dialog closes but data stale
  }
});
```
**Fix:** Always invalidate related queries

#### ❌ Mistake 2: Missing Query Invalidation
```typescript
onSuccess: () => setIsEditing(false)
```
**Fix:** Invalidate all affected queries

---

### Optimistic Updates with Rollback (NEW - 2026-01-06)

**When:** Mutations where instant UI feedback significantly improves perceived performance (e.g., adding to cart, liking, bookmarking, incrementing counters).

**Source:** TODO_013 watchlist integration - Reduced perceived latency from 200-500ms to 0ms with optimistic updates.

**Benefits:**
- **0ms perceived latency** - UI updates instantly before API call completes
- **Better UX** - Users see immediate feedback instead of loading spinners
- **Reduced API calls** - Combined with minimal invalidation strategy (6 → 1 API calls)
- **Resilient** - Automatic rollback on error maintains data consistency

#### Anti-Pattern: Wait for API Response

```typescript
// ❌ WRONG - User sees loading spinner for 200-500ms
const addToWatchList = useMutation({
  mutationFn: async ({ listId, productId }) => {
    return apiRequest(`/api/watchlists/${listId}/products`, {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },
  onSuccess: () => {
    // Triggers 6 API refetches - slow!
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId] });
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId, 'products'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/community/watches'] });
    void queryClient.invalidateQueries({ queryKey: [`/api/community/watch-count/${productId}`] });
    void queryClient.invalidateQueries({ queryKey: [`/api/community/is-watching/${productId}`] });
  }
});
```

**Problems:**
- User waits 200-500ms for network round-trip
- Loading spinner interrupts interaction flow
- 6 API refetches after success (over-invalidation)
- Poor UX on slow connections

#### Correct Pattern: Optimistic Update with Rollback

```typescript
// ✅ CORRECT - Instant UI update with automatic rollback on error
export function useAddProductToWatchList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, productId }: { listId: number; productId: number }) => {
      return apiRequest<ProductWatch>(`/api/watchlists/${listId}/products`, {
        method: 'POST',
        body: JSON.stringify({ productId }),
      });
    },

    // PERFORMANCE: Optimistic update for instant feedback
    onMutate: async ({ listId }) => {
      // 1. Cancel outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/watchlists'] });

      // 2. Snapshot previous value for rollback
      const previousWatchlists = queryClient.getQueryData(['/api/watchlists']);

      // 3. Optimistically update cache (instant UI feedback)
      queryClient.setQueryData(['/api/watchlists'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((wl: { id: number; watchCount?: number }) =>
          wl.id === listId
            ? { ...wl, watchCount: (wl.watchCount || 0) + 1 }
            : wl
        );
      });

      // 4. Return context for rollback
      return { previousWatchlists };
    },

    onError: (_err, _variables, context) => {
      // Rollback on error - restore previous cache state
      if (context?.previousWatchlists !== undefined) {
        queryClient.setQueryData(['/api/watchlists'], context.previousWatchlists);
      }
    },

    onSuccess: () => {
      // PERFORMANCE: Only invalidate what's displayed on current page
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });

      // REMOVED: These 5 invalidations are unnecessary for current view
      // Only invalidate queries that are actually being displayed
    }
  });
}
```

**Key Elements:**

1. **`onMutate`** - Runs immediately before mutation
   - Cancel outgoing queries to prevent race conditions
   - Snapshot current cache for rollback
   - Update cache optimistically (user sees instant change)
   - Return context object for error handler

2. **`onError`** - Automatic rollback on failure
   - Restore previous cache state from context
   - Maintains data consistency even when API fails
   - User sees instant revert to previous state

3. **`onSuccess`** - Minimal invalidation
   - Only invalidate queries displayed on current page
   - Remove unnecessary invalidations (performance optimization)
   - Combine with optimistic update for best UX

4. **Type Safety** - Properly type the cache data
   - Use `unknown` and type guards for cache operations
   - Define interfaces for optimistic update structures

**When to Use Optimistic Updates:**

✅ **Good candidates:**
- Adding to cart, watchlist, favorites (increment counters)
- Liking/unliking posts (toggle boolean)
- Simple mutations with predictable outcomes
- High-frequency user interactions

❌ **Bad candidates:**
- Mutations with complex server-side logic (calculated fields)
- Operations that might fail validation
- Mutations returning unpredictable data from server
- Multi-step workflows with dependencies

**Performance Impact (Measured from TODO_013):**
- **Perceived latency:** 200-500ms → 0ms (instant)
- **API calls per mutation:** 6 → 1 (83% reduction)
- **User experience:** Loading spinner → Instant feedback
- **Cache efficiency:** Reduced invalidations prevent unnecessary refetches

**Common Mistakes:**

#### ❌ Mistake 1: Not Canceling Queries
```typescript
onMutate: async ({ listId }) => {
  // Missing query cancellation - race condition!
  const previous = queryClient.getQueryData(['/api/watchlists']);
  queryClient.setQueryData(['/api/watchlists'], (old) => /* update */);
  return { previous };
}
```
**Fix:** Always cancel queries first: `await queryClient.cancelQueries({ queryKey: [...] })`

#### ❌ Mistake 2: Not Handling Rollback
```typescript
onMutate: async ({ listId }) => {
  // No context returned - can't rollback!
  queryClient.setQueryData(['/api/watchlists'], (old) => /* update */);
}
```
**Fix:** Return context object with snapshot: `return { previousWatchlists }`

#### ❌ Mistake 3: Over-Invalidation After Optimistic Update
```typescript
onSuccess: () => {
  // Invalidating 6 queries defeats the purpose of optimistic update!
  void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
  void queryClient.invalidateQueries({ queryKey: ['/api/watchlists', listId] });
  // ... 4 more invalidations
}
```
**Fix:** Only invalidate queries displayed on current page (1-2 queries max)

**References:**
- Implementation: `client/src/hooks/use-community.ts` (useAddProductToWatchList)
- Usage: `client/src/pages/product-detail-new.tsx` (watchlist integration)
- TODO: `todos/TODO_013_watchlist_integration_product_detail.md`
- React Query docs: https://tanstack.com/query/latest/docs/react/guides/optimistic-updates

---

### useQuery vs useMutation for GET Operations (NEW - 2025-12-12)

**Source**: Code review session - Architectural pattern violation using useMutation for GET request

**CRITICAL**: `useMutation` is for operations that modify server state (POST, PUT, DELETE). For GET operations - even those triggered manually (downloads, exports) - use `useQuery` with `enabled: false`.

#### The Problem: useMutation for Downloads/Exports

When implementing features like "Export to CSV" or "Download Report", developers sometimes use `useMutation` because they want to trigger the request manually on button click:

```typescript
// client/src/hooks/use-community.ts - WRONG
export function useExportWatchLists() {
  return useMutation({
    mutationFn: async () => {
      // This is a GET request!
      const response = await apiRequest<ExportData>('/api/watchlists/export');
      return response;
    },
    // ...
  });
}

// Usage in component - WRONG
const exportMutation = useExportWatchLists();
<Button onClick={() => exportMutation.mutate()}>Export</Button>
```

**Problems with this approach**:
1. **Semantic violation**: `useMutation` implies data modification (POST/PUT/DELETE)
2. **No caching**: GET responses should be cacheable; mutations bypass React Query cache
3. **Wrong mental model**: Other developers expect mutations to change server state
4. **Incorrect loading states**: `isPending` vs `isLoading` semantics differ
5. **Missing refetch capabilities**: Queries can be refetched; mutations must be re-mutated

#### The Solution: useQuery with `enabled: false`

For manually-triggered GET operations, use `useQuery` with `enabled: false` and call `refetch()`:

```typescript
// client/src/hooks/use-community.ts - CORRECT
export function useExportWatchLists() {
  return useQuery({
    queryKey: ['/api/watchlists/export'],
    queryFn: async () => {
      const response = await apiRequest<ExportData>('/api/watchlists/export');
      return response;
    },
    enabled: false,  // Don't fetch automatically
    staleTime: 0,    // Always fetch fresh data for exports
  });
}

// Usage in component - CORRECT
const { data, isLoading, refetch } = useExportWatchLists();
<Button
  onClick={() => void refetch()}
  disabled={isLoading}
>
  {isLoading ? 'Exporting...' : 'Export'}
</Button>
```

#### Decision Matrix: useQuery vs useMutation

| HTTP Method | Operation Type | Use This | Example |
|-------------|---------------|----------|---------|
| GET | Auto-fetch on mount | `useQuery` (default) | Product list, user profile |
| GET | Manual trigger | `useQuery` + `enabled: false` | Export CSV, download report |
| POST | Create resource | `useMutation` | Create user, add product |
| PUT/PATCH | Update resource | `useMutation` | Update settings, edit profile |
| DELETE | Remove resource | `useMutation` | Delete item, remove user |

#### Common Patterns

**Pattern 1: Export/Download Button**
```typescript
export function useDownloadReport() {
  return useQuery({
    queryKey: ['/api/reports/download'],
    queryFn: () => apiRequest<Blob>('/api/reports/download'),
    enabled: false,
  });
}

// Component
const { refetch, isFetching } = useDownloadReport();
<Button onClick={() => void refetch()}>
  {isFetching ? 'Downloading...' : 'Download Report'}
</Button>
```

**Pattern 2: Search on Demand**
```typescript
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: ['/api/products/search', query],
    queryFn: () => apiRequest<Product[]>(`/api/products/search?q=${query}`),
    enabled: query.length >= 3,  // Only search when query is 3+ chars
  });
}
```

**Pattern 3: Lazy Load Data**
```typescript
export function useProductDetails(productId: number | null) {
  return useQuery({
    queryKey: ['/api/products', productId],
    queryFn: () => apiRequest<Product>(`/api/products/${productId}`),
    enabled: productId !== null,  // Only fetch when we have an ID
  });
}
```

#### Detection Rule

Add to code review checklist:

```bash
# Find useMutation with GET-like operations
grep -rn "useMutation" client/src/hooks/ --include="*.ts" -A 5 | grep -E "(export|download|fetch|search|get)"

# These patterns should use useQuery instead
```

#### Migration Pattern

When fixing existing `useMutation` for GET operations:

```typescript
// Before
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      return apiRequest<ExportData>('/api/data/export');
    },
  });
}

// After
export function useExportData() {
  return useQuery({
    queryKey: ['/api/data/export'],
    queryFn: async () => {
      return apiRequest<ExportData>('/api/data/export');
    },
    enabled: false,
    staleTime: 0,
  });
}

// Update component usage:
// Before: const { mutate, isPending } = useExportData();
// After:  const { refetch, isFetching } = useExportData();
```

**Reference**: This pattern was identified during code review of `client/src/hooks/use-community.ts` (lines 491-523) where `useExportWatchLists` used `useMutation` for a GET operation.

---

### Async Handler ESLint Compliance

**When:** Using async functions in React event handlers or React Query callbacks

#### Anti-Pattern
```typescript
// ❌ WRONG - Floating promise ESLint error
const createMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] }); // ← Returns promise
  }
});

<Button onClick={handleCreateWatchList}> // ← Async function not awaited
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Use void operator for fire-and-forget
const createMutation = useMutation({
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
  }
});

<Button onClick={() => void handleCreateWatchList()}>
  Create
</Button>
```

**When to use `void`:**
- Query invalidations in mutation callbacks (fire-and-forget)
- Background operations that don't need error handling
- Event handlers where you don't want to propagate promise

**When NOT to use `void`:**
- Operations you need to `await` for sequencing
- Operations where you need to catch errors
- Operations where you need the return value

---

### Cursor-Based Pagination

**When:** Implementing infinite scroll for large datasets

#### Anti-Pattern
```typescript
// ❌ WRONG - Hard limit, no pagination
async getWatchedProducts(userId: number): Promise<WatchedProduct[]> {
  return db.select()
    .from(productWatches)
    .where(eq(productWatches.userId, userId))
    .limit(100); // Hard limit - can't load more
}
```

#### Correct Pattern - Backend

```typescript
// ✅ CORRECT - Cursor-based pagination with metadata
interface WatchedProductsOptions {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
  limit?: number;
  cursor?: number; // Last product watch ID from previous page
}

interface WatchedProductsResult {
  products: WatchedProductInfo[];
  hasMore: boolean;
  nextCursor: number | null;
}

async getWatchedProducts(
  userId: number,
  options?: WatchedProductsOptions
): Promise<WatchedProductsResult> {
  const sortBy = options?.sortBy || 'priceDropPercent';
  const limit = Math.min(options?.limit || 50, 100); // Respect bounds
  const cursor = options?.cursor;
  const fetchLimit = limit + 1; // Fetch +1 to detect hasMore

  // Build query with cursor filtering
  const results = await db
    .select({
      id: productWatches.id, // ← Include for cursor pagination
      productId: productWatches.productId,
      // ... other fields
    })
    .from(productWatches)
    .where(
      cursor
        ? and(
            eq(productWatches.userId, userId),
            gt(productWatches.id, cursor) // ← Cursor filter
          )
        : eq(productWatches.userId, userId)
    )
    .limit(fetchLimit); // Fetch limit + 1

  // Process results...
  const enrichedResults = results.map(/* ... */);

  // Implement deterministic sort with secondary key
  enrichedResults.sort((a, b) => {
    switch (sortBy) {
      case 'priceDropPercent':
        const priceDiff = b.priceDropPercent - a.priceDropPercent;
        return priceDiff !== 0 ? priceDiff : a.id - b.id; // ← Secondary sort
      case 'savings':
        const savingsDiff = b.savingsPotential - a.savingsPotential;
        return savingsDiff !== 0 ? savingsDiff : a.id - b.id;
      case 'dateAdded':
        const dateDiff = b.addedAt.getTime() - a.addedAt.getTime();
        return dateDiff !== 0 ? dateDiff : a.id - b.id;
      default:
        return 0;
    }
  });

  // Detect hasMore and calculate nextCursor
  const hasMore = enrichedResults.length > limit;
  const resultProducts = hasMore ? enrichedResults.slice(0, limit) : enrichedResults;
  const nextCursor = hasMore && resultProducts.length > 0
    ? resultProducts[resultProducts.length - 1].id
    : null;

  return {
    products: resultProducts,
    hasMore,
    nextCursor,
  };
}
```

**Key Elements (Backend):**
1. ✅ Fetch limit + 1 pattern to detect `hasMore`
2. ✅ Use `gt(productWatches.id, cursor)` for cursor filtering
3. ✅ Return `{ products, hasMore, nextCursor }` envelope
4. ✅ Respect limit bounds (min 1, max 100)
5. ✅ Deterministic sort with secondary key (prevents pagination bugs)
6. ✅ Include `id` field in result for cursor calculation

#### Correct Pattern - API Route

```typescript
// ✅ CORRECT - Route accepts cursor and limit parameters
app.get("/api/watchlists/products", withAuth(async (req, res) => {
  try {
    const userId = req.user.id;
    const sortBy = req.query.sortBy as 'priceDropPercent' | 'savings' | 'dateAdded' | undefined;

    // Validate pagination parameters
    const cursor = req.query.cursor
      ? parseIntSafe(req.query.cursor as string, 'cursor', { min: 1 })
      : undefined;
    const limit = req.query.limit
      ? parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 })
      : 50;

    const result = await storage.getWatchedProducts(userId, { sortBy, cursor, limit });

    sendSuccess(res, result); // Returns { products, hasMore, nextCursor }
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'GetWatchedProducts');
  }
}));
```

#### Correct Pattern - Frontend Hook

```typescript
// ✅ CORRECT - useInfiniteQuery for cursor pagination
export function useWatchedProducts(options?: {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
}) {
  return useInfiniteQuery({
    queryKey: ['/api/watchlists/products', options?.sortBy || 'priceDropPercent'],
    queryFn: async ({ pageParam }: { pageParam: number | null }) => {
      const sortBy = options?.sortBy || 'priceDropPercent';
      const params = new URLSearchParams({ sortBy });
      if (pageParam !== null) {
        params.append('cursor', String(pageParam));
      }
      const url = `/api/watchlists/products?${params.toString()}`;
      return apiRequest<{
        products: WatchedProduct[];
        hasMore: boolean;
        nextCursor: number | null
      }>(url);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}
```

**Key Elements (Frontend Hook):**
1. ✅ Use `useInfiniteQuery` (not `useQuery`)
2. ✅ Type `pageParam` explicitly
3. ✅ `getNextPageParam` returns `undefined` when no more pages
4. ✅ `initialPageParam: null` for first page
5. ✅ Let TypeScript infer types (no explicit generics)
6. ✅ Query key includes sort option for cache separation

#### Correct Pattern - UI Component

```typescript
// ✅ CORRECT - Infinite scroll with react-intersection-observer
import { useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';

export function PriceWatchPage() {
  const [sortBy, setSortBy] = useState<SortOption>('priceDropPercent');

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWatchedProducts({ sortBy });

  // Flatten paginated products
  const products = useMemo(() => {
    if (!data || !data.pages) return [];
    return data.pages.flatMap((page: { products: WatchedProduct[] }) => page.products);
  }, [data]);

  // Infinite scroll trigger
  const { ref: infiniteScrollRef } = useInView({
    threshold: 0.1,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  // ... filter logic

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product: WatchedProduct) => (
          <ProductCard key={product.productId} product={product} />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {hasNextPage && (
        <div ref={infiniteScrollRef} className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Optional: show loading state for next page */}
      {isFetchingNextPage && !hasNextPage && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </>
  );
}
```

**Key Elements (UI):**
1. ✅ Import `useInView` from `react-intersection-observer`
2. ✅ Flatten `data.pages` with `flatMap`
3. ✅ Trigger `fetchNextPage()` when trigger div enters viewport
4. ✅ Check `hasNextPage && !isFetchingNextPage` before fetching
5. ✅ Use `void` operator to mark fire-and-forget promise
6. ✅ Show loading spinner at trigger point
7. ✅ Type `page` parameter in flatMap

#### Common Pagination Mistakes

**❌ Mistake 1: No Secondary Sort Key**
```typescript
results.sort((a, b) => b.price - a.price); // Indeterminate for equal prices
```
**Fix:** Always add secondary sort on ID (see [Deterministic Sorting](#deterministic-sorting-for-pagination))

**❌ Mistake 2: Forgetting Limit + 1**
```typescript
.limit(limit); // Can't detect hasMore
```
**Fix:** Fetch `limit + 1` and slice

**❌ Mistake 3: Wrong getNextPageParam**
```typescript
getNextPageParam: (lastPage) => lastPage.nextCursor, // Returns null instead of undefined
```
**Fix:** Return `undefined` when no more pages

**❌ Mistake 4: Missing ID in Result**
```typescript
// Storage doesn't return id field
{ productId, name, price } // ← Missing id for cursor!
```
**Fix:** Include `id: productWatches.id` in select

**❌ Mistake 5: Type Mismatch**
```typescript
interface WatchedProduct {
  productId: number;
  // ❌ Missing id field!
}
```
**Fix:** Add `id: number` to match API response

---

## Form Handling

### Dialog Component Design

**When:** Creating modal dialogs for user input

#### Anti-Pattern
```typescript
// ❌ WRONG - No validation, no loading states, no error handling
function CreateDialog({ open, onClose }) {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify({ value })
    });
    onClose();
  };

  return <Dialog open={open}>...</Dialog>;
}
```

#### Correct Pattern

```typescript
// ✅ CORRECT - Complete dialog pattern
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateDialogProps {
  // Specific, well-typed props
  resourceId: number;
  resourceName: string;
  currentValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateInput {
  resourceId: number;
  value: number;
}

export function CreateDialog({
  resourceId,
  resourceName,
  currentValue,
  open,
  onOpenChange
}: CreateDialogProps) {
  // Smart defaults
  const defaultValue = Math.round(currentValue * 0.9 * 100) / 100;
  const [value, setValue] = useState<number>(defaultValue);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Query mutation with proper error handling
  const createMutation = useMutation({
    mutationFn: async (data: CreateInput) => {
      return apiRequest<{ id: number }>('/api/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate ALL relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      toast({
        title: "Success",
        description: `Resource created for ${resourceName}`,
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Client-side validation
  const handleCreate = () => {
    if (value <= 0) {
      toast({
        title: "Invalid value",
        description: "Value must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (value >= currentValue) {
      toast({
        title: "Invalid value",
        description: "Value should be lower than current",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      resourceId,
      value,
    });
  };

  // Reset to default when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setValue(defaultValue);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create Resource
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Name - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Resource
            </Label>
            <p className="text-sm font-medium mt-1 line-clamp-2">
              {resourceName}
            </p>
          </div>

          {/* Current Value - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Current Value
            </Label>
            <p className="text-lg font-bold mt-1">
              ${currentValue.toFixed(2)}
            </p>
          </div>

          {/* Input with constraints */}
          <div>
            <Label htmlFor="value" className="text-sm font-medium">
              Target Value:
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-medium text-muted-foreground">$</span>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                max={currentValue}
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
                autoFocus
              />
            </div>
            {/* Real-time calculation display */}
            <p className="text-xs text-muted-foreground mt-1">
              {value > 0 && value < currentValue
                ? `Save $${(currentValue - value).toFixed(2)} (${Math.round(((currentValue - value) / currentValue) * 100)}% off)`
                : '\u00A0' // Non-breaking space to maintain layout
              }
            </p>
          </div>
        </div>

        {/* Actions with disabled states */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || value <= 0 || value >= currentValue}
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Elements:**
1. ✅ Well-typed props interface
2. ✅ Smart default values
3. ✅ React Query mutation with error handling
4. ✅ Query invalidation (ALL relevant queries)
5. ✅ Toast notifications for feedback
6. ✅ Client-side validation
7. ✅ Disabled states during mutation
8. ✅ Reset state when dialog opens
9. ✅ Real-time calculations
10. ✅ Accessible (labels, focus, semantic HTML)

**Check:** Dialog components should have ALL these elements.

---

### Inline Editing Pattern

**When:** Implementing inline editing of field values without navigation

#### Anti-Pattern
```typescript
// ❌ WRONG - Always shows edit button, no state management
<div>
  <span>${targetPrice}</span>
  <Button onClick={() => navigate(`/edit/${id}`)}>Edit</Button>
</div>
```

#### Correct Pattern

**Backend: Include Edit Data in List Response**
```typescript
// ✅ CORRECT - Include editable field data in list query
const results = await db.select({
  id: productWatches.id,
  // ... other fields
  // Alert details for inline editing
  alertId: sql<number | null>`
    (SELECT id FROM ${priceAlerts}
     WHERE ${priceAlerts.productId} = ${products.id}
       AND ${priceAlerts.userId} = ${userId}
     ORDER BY ${priceAlerts.createdAt} DESC
     LIMIT 1)
  `.as('alert_id'),
  alertTargetPrice: sql<string | null>`
    (SELECT ${priceAlerts.targetPrice} FROM ${priceAlerts}
     WHERE ${priceAlerts.productId} = ${products.id}
       AND ${priceAlerts.userId} = ${userId}
     ORDER BY ${priceAlerts.createdAt} DESC
     LIMIT 1)
  `.as('alert_target_price'),
});

// Type assertion: Drizzle returns numeric fields as strings, convert to number for API response
alertTargetPrice: r.alertTargetPrice ? parseFloat(r.alertTargetPrice) : null,
```

**Frontend: Inline Editing UI Pattern**
```typescript
// ✅ CORRECT - Complete inline editing pattern
export function ItemCard({ item }: ItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedValue, setEditedValue] = useState<number>(item.value || 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Query mutation
  const updateMutation = useMutation({
    mutationFn: async (newValue: number) => {
      if (!item.id) throw new Error('No ID available');
      return apiRequest<{ id: number }>(`/api/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ value: newValue }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/items'] });
      toast({ title: "Value updated", description: `New value: ${editedValue}` });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    // Client-side validation
    if (editedValue <= 0) {
      toast({ title: "Invalid value", description: "Value must be > 0", variant: "destructive" });
      return;
    }
    updateMutation.mutate(editedValue);
  };

  const handleCancel = () => {
    setEditedValue(item.value || 0);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setEditedValue(item.value || 0);
    setIsEditing(true);
  };

  return (
    <Card>
      {/* Conditional rendering based on field existence */}
      {item.value !== null && (
        <div className="mt-3 pt-3 border-t border-border">
          {isEditing ? (
            // Editing mode
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Value:</span>
                <Input
                  type="number"
                  step="0.01"
                  value={editedValue}
                  onChange={(e) => setEditedValue(parseFloat(e.target.value) || 0)}
                  className="h-8"
                  autoFocus
                  disabled={updateMutation.isPending}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending || editedValue <= 0}
                >
                  <Check className="w-3 h-3 mr-1" />
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                >
                  <XCircle className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            // Display mode
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">${item.value.toFixed(2)}</span>
              <Button variant="ghost" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
```

**Key Elements:**
1. ✅ Edit button shown only when field exists (conditional rendering)
2. ✅ Local state for editing mode (`isEditing`, `editedValue`)
3. ✅ React Query mutation with error handling
4. ✅ Client-side validation before mutation
5. ✅ Disabled states during mutation
6. ✅ Reset state on cancel (restore original value)
7. ✅ Auto-focus on input when editing starts
8. ✅ Toast notifications for success/error
9. ✅ Query invalidation after successful update

#### Common Inline Editing Mistakes

**❌ Mistake 1: No Conditional Rendering**
```typescript
// Always shows edit button, even when field is null
<Button onClick={handleEdit}>Edit</Button>
```
**Fix:** Only render when field exists

**❌ Mistake 2: No State Reset on Cancel**
```typescript
const handleCancel = () => setIsEditing(false); // editedValue not reset!
```
**Fix:** Reset edited value to original on cancel

**❌ Mistake 3: No Client Validation**
```typescript
// Sends invalid data to server
updateMutation.mutate(editedValue);
```
**Fix:** Validate before mutation

**❌ Mistake 4: No Loading State**
```typescript
<Button onClick={handleSave}>Save</Button>
```
**Fix:** Disable during mutation, show "Saving..."

---

### Decimal Field Handling

**When:** Working with PostgreSQL numeric/decimal fields and JavaScript numbers (CRITICAL)

#### Problem

PostgreSQL stores decimals as strings in Drizzle ORM. Frontend expects numbers. Without proper conversion, type mismatches occur.

#### Anti-Pattern
```typescript
// ❌ WRONG - No type conversion
const targetPrice: number = dbResult.targetPrice; // Type error!
```

#### Correct Pattern

**Backend: Convert on Read**
```typescript
// ✅ CORRECT - Document type conversion
return {
  // Type assertion: Drizzle returns numeric fields as strings, convert to number for API response
  targetPrice: r.targetPrice ? parseFloat(r.targetPrice) : null,
};
```

**Backend: Convert on Write**
```typescript
// ✅ CORRECT - Convert to string with fixed decimals
const validatedData = schema.parse(req.body); // number from Zod
await storage.update({
  targetPrice: validatedData.targetPrice.toFixed(2), // Convert to string
});
```

**Frontend: Round to Avoid Floating Point Errors**
```typescript
// ✅ CORRECT - Round to match backend validation
const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const parsed = parseFloat(e.target.value);
  // Round to 2 decimals to match Zod .multipleOf(0.01)
  const rounded = isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  setEditedPrice(rounded);
};
```

**Why This Matters:**
- Prevents floating point artifacts (99.98999999999999)
- Matches backend validation exactly (.multipleOf(0.01))
- Ensures consistent display/storage

**Backend Validation Pattern:**
```typescript
// ✅ CORRECT - Zod validation + type conversion
import { z } from "zod";

const createAlertSchema = z.object({
  productId: z.number()
    .int('Product ID must be an integer')
    .min(1, 'Product ID must be positive'),
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places'),
  notifyForum: z.boolean().optional().default(false),
});

app.post('/api/alerts', csrfProtection, withAuth(async (req, res) => {
  try {
    // PHASE 0 PATTERN: Validation at route layer
    const validatedData = createAlertSchema.parse(req.body);

    // Verify related entity exists
    const product = await storage.getProductById(validatedData.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const alert = await storage.createAlert({
      userId: req.user.id,
      productId: validatedData.productId,
      targetPrice: validatedData.targetPrice.toFixed(2), // ← Convert to string for decimal
      notifyForum: validatedData.notifyForum,
    });

    sendSuccess(res, alert, 201);
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'CreateAlert');
  }
}));
```

**Key Steps:**
1. ✅ Zod schema with `.multipleOf(0.01)` for decimal precision
2. ✅ Validate at route layer (Phase 0 pattern)
3. ✅ Verify foreign key references exist (prevents FK failures)
4. ✅ Convert number to string with `.toFixed(2)` for Drizzle decimal
5. ✅ Use standardized response helpers

**Schema Pattern for Updates:**
```typescript
const updateAlertSchema = z.object({
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places')
    .optional(),
  isActive: z.boolean().optional(),
  notifyForum: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// In PATCH handler
const validatedData = updateAlertSchema.parse(req.body);
const updates = {
  ...validatedData,
  targetPrice: validatedData.targetPrice?.toFixed(2), // Optional chaining
};
```

---

## State Management

### Local State vs Server State

**Local State:** Component-specific UI state (modals, form inputs, tabs)
**Server State:** Data from APIs (products, users, watchlists)

#### ✅ CORRECT - React Query for Server State
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetching data
function ProductList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiRequest<Product[]>('/api/products'),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return <div>{data?.map(product => ...)}</div>;
}

// Mutating data
function DeleteProduct({ productId }: { productId: number }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/products/${productId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      // Invalidate and refetch
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    },
  });

  return (
    <Button
      onClick={() => deleteMutation.mutate()}
      disabled={deleteMutation.isPending}
    >
      Delete
    </Button>
  );
}
```

#### ✅ CORRECT - useState for Local State
```typescript
function ModalExample() {
  // UI state - use useState
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('details');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        {/* ... */}
      </Tabs>
    </Dialog>
  );
}
```

---

### Component Integration Pattern

**When:** Integrating dialog components into parent components

#### Anti-Pattern
```typescript
// ❌ WRONG - Prop drilling, no state management
function ParentCard({ product, showDialog, setShowDialog }) {
  return (
    <Card>
      <Button onClick={() => setShowDialog(true)}>Open</Button>
      <CreateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        productId={product.id}
        productName={product.name}
        currentPrice={product.price}
      />
    </Card>
  );
}
```

#### Correct Pattern
```typescript
// ✅ CORRECT - Local state, conditional rendering, clear separation
import { useState } from 'react';
import { CreateDialog } from '../dialogs/create-dialog';

export function ResourceCard({ resource, onRemove }: ResourceCardProps) {
  // Local state for dialog visibility
  const [showDialog, setShowDialog] = useState(false);

  return (
    <Card>
      {/* Existing card content */}

      {/* Conditional button (only when action is available) */}
      {resource.status === 'pending' && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDialog(true)}
          >
            <Icon className="w-4 h-4 mr-2" />
            Action Label
          </Button>
        </div>
      )}

      {/* Dialog component */}
      <CreateDialog
        resourceId={resource.id}
        resourceName={resource.name}
        currentValue={resource.value}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </Card>
  );
}
```

**Key Elements:**
1. ✅ Local state management (no prop drilling)
2. ✅ Conditional rendering based on state
3. ✅ Clear separation of concerns
4. ✅ Dialog receives only what it needs
5. ✅ Accessible button with icon + label

---

## API Integration Patterns

### Centralized API Client

```typescript
// lib/api-client.ts
import { getCsrfToken } from './csrf';

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(error.error, response.status, error.code);
  }

  return response.json();
}

// Usage
const products = await apiRequest<Product[]>('/api/products');

const newProduct = await apiRequest<Product>('/api/products', {
  method: 'POST',
  body: JSON.stringify(productData),
});
```

---

### Watchlist Hook Ownership (NEW - 2025-12-16)

Watchlist-related hooks exist in **two places** for historical reasons. To avoid contract drift, treat these files as having different “ownership”:

- `client/src/hooks/useWatchList.ts`: **Price Watch dashboard** data (stats + infinite lists via `/api/watchlists/products`, `/api/watchlists/stats`). Keep types aligned to the server watchlist schema (`name`, `description`, `color`, `icon`, `isDefault`, `sortOrder`).
- `client/src/hooks/use-community.ts`: **Watchlist manager / community flows** (watchlist CRUD, list products, import/export, sharing). This is where sharing hooks live.

**Contract rule (lists):** list endpoints should return named properties (e.g. `{ watchLists }`) inside the server success envelope; client hooks should **unwrap** and return `WatchList[]` to callers.

---

### Error Handling

```typescript
function ProductView({ id }: { id: number }) {
  const { data, error, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => apiRequest<Product>(`/api/products/${id}`),
  });

  if (isLoading) {
    return <ProductSkeleton />;
  }

  if (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return <NotFound message="Product not found" />;
      }
      if (error.status === 403) {
        return <AccessDenied />;
      }
    }
    return <ErrorDisplay error={error} />;
  }

  return <ProductDetails product={data} />;
}
```

#### Pattern: Type-Safe Error Details Extraction (NEW - 2025-12-23)

**Context:** Frontend error handlers that need to access rich error metadata from ApiError.details field for user-friendly error messages or conditional UI logic.

**Problem:** The `ApiError.details` field can be either:
- `string` - Development-only error details (stack traces, debug info)
- `Record<string, unknown>` - Rich error metadata for client handling (error codes, limits, retry timing)

Without type narrowing, TypeScript cannot guarantee property access is safe, leading to type errors or unsafe `any` assertions.

**Preferred Pattern:**

```typescript
// client/src/lib/queryClient.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: string | Record<string, unknown>  // Flexible type
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// client/src/components/price-analytics/price-alert-modal.tsx
const mutation = useMutation({
  mutationFn: async () => {
    return apiRequest<PriceAlert>('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
  },
  onError: (error: Error) => {
    // Type-safe error details extraction from ApiError
    // Type assertion: ApiError.details can be string | Record, narrowing to object for property access
    const apiError = error as Error & { details?: string | Record<string, unknown> };
    const details = typeof apiError.details === 'object' ? apiError.details : undefined;

    // Handle alert limit error with specific message
    if (details?.code === 'ALERT_LIMIT_REACHED') {
      toast({
        title: 'Alert Limit Reached',
        description: `You can only have ${details.limit || 50} active alerts. Delete some alerts to create new ones.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  },
});
```

**Anti-Pattern:**

```typescript
// ❌ WRONG - Accessing details properties without type narrowing
onError: (error: Error & { details?: string | Record<string, unknown> }) => {
  // TypeScript error: Property 'code' does not exist on type 'string | Record<string, unknown>'
  if (error.details?.code === 'ALERT_LIMIT_REACHED') {
    // ...
  }
}

// ❌ WRONG - Using 'any' type assertion (disables type safety)
onError: (error: any) => {
  if (error.details?.code === 'ALERT_LIMIT_REACHED') {
    // No type checking - could break silently
  }
}

// ❌ WRONG - Hardcoding details as object only
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, unknown>  // Too restrictive
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
// Problem: Cannot accept development-only string details like stack traces
```

**Rationale:**

- **Type Safety**: `typeof` check narrows `string | Record<string, unknown>` to `Record<string, unknown>`
- **IDE Autocomplete**: After narrowing, TypeScript knows `details` is an object and allows property access
- **Flexibility**: ApiError supports both development strings and rich client metadata
- **Fail-Safe**: If details is a string, `details` becomes `undefined` and conditional checks short-circuit safely
- **No `any` Types**: Maintains strict TypeScript compliance (project has zero-tolerance for `any`)
- **Future-Proof**: Pattern scales to additional error metadata fields (retryAfter, locked, etc.)

**When to Use:**

- React Query mutation error handlers that need structured error data
- Form validation error displays
- Rate limiting or quota error messages
- Account lockout notifications
- Any error handler that needs to access specific error properties

**Related:**
- See `ERROR_HANDLING_PATTERNS.md` for backend error response structure
- See `API_PATTERNS.md` for sendError() middleware patterns with rich metadata
- See `TYPESCRIPT_PATTERNS.md` for type narrowing and assertion best practices
- See `.eslintrc.json` for strict type safety rules (no-explicit-any, no-unsafe-*)

**Source:** Commits ce38f21 and e0cfe72, 2025-12-23

---

## Performance Patterns

### Client-Side Data Aggregation Anti-Pattern

#### ❌ WRONG - Fetching All Data Then Aggregating on Client

**Problem:** When you need aggregated or filtered data, NEVER fetch all records and process them client-side. This violates storage layer abstraction and causes massive performance issues.

```typescript
// THIS IS A CRITICAL ANTI-PATTERN!
function PriceWatchDashboard() {
  // Fetches ALL watch lists with ALL products (potentially 1000s of records)
  const { data: watchLists } = useQuery({
    queryKey: ['watchlists'],
    queryFn: async () => {
      const result = await apiRequest<{ watchLists: WatchList[] }>('/api/watchlists');
      return result.watchLists;
    },
  });

  // Client-side aggregation - WRONG!
  const allProducts = useMemo(() => {
    if (!watchLists) return [];

    const products = [];
    for (const list of watchLists) {
      for (const product of list.products) {
        products.push(product);
      }
    }
    return products;
  }, [watchLists]);

  // Sort/filter on client - WRONG!
  const topPriceDrops = allProducts
    .sort((a, b) => b.priceDropPercent - a.priceDropPercent)
    .slice(0, 10);

  return <ProductList products={topPriceDrops} />;
}
```

**Why this is terrible:**
1. **Data overfetch**: Transfers potentially 100x more data than needed
2. **Memory bloat**: Loads all watch lists into browser memory
3. **Slow rendering**: React re-renders on massive dataset changes
4. **Violates abstraction**: Bypasses storage layer's responsibility
5. **Duplicate logic**: Same aggregation needed elsewhere requires duplication
6. **No pagination**: Can't efficiently paginate aggregated results

#### ✅ CORRECT - Dedicated Backend Endpoint

**Solution:** Create a backend endpoint that returns exactly the data needed, properly aggregated and filtered.

```typescript
// server/routes/watch-list-routes.ts
app.get("/api/watchlists/products", withAuth(async (req, res) => {
  const userId = req.session.userId;
  const sortBy = req.query.sortBy as string || 'priceDropPercent';
  const limit = parseIntOptional(req.query.limit) || 10;

  // Storage layer handles aggregation efficiently
  const products = await storage.getWatchedProducts(userId, {
    sortBy,
    limit,
    includeOffers: true,
  });

  res.json({ products });
}));

// server/storage.ts
async getWatchedProducts(
  userId: number,
  options: { sortBy?: string; limit?: number }
): Promise<WatchedProduct[]> {
  // Single efficient query with aggregation
  return db.select({
    productId: productWatches.productId,
    productName: products.name,
    currentPrice: sql<number>`MIN(${productOffers.price})`,
    priceDropPercent: sql<number>`...calculation...`,
    // ... other fields
  })
    .from(productWatches)
    .innerJoin(watchLists, eq(productWatches.watchListId, watchLists.id))
    .innerJoin(products, eq(productWatches.productId, products.id))
    .leftJoin(productOffers, eq(products.id, productOffers.productId))
    .where(eq(watchLists.userId, userId))
    .groupBy(productWatches.productId, products.name)
    .orderBy(desc(sql`...`))
    .limit(options.limit || 10);
}

// client/src/pages/PriceWatchDashboard.tsx
function PriceWatchDashboard() {
  // Fetches ONLY the 10 products with biggest price drops
  const { data } = useQuery({
    queryKey: ['watchlists', 'products', { sortBy: 'priceDropPercent' }],
    queryFn: () => apiRequest('/api/watchlists/products?sortBy=priceDropPercent&limit=10'),
  });

  return <ProductList products={data?.products || []} />;
}
```

**Benefits:**
- Transfers only needed data (10 products vs potentially 1000s)
- Database performs aggregation efficiently
- Single source of truth in storage layer
- Properly cacheable with React Query
- Easy to paginate, filter, or sort server-side

#### Detection Rule
```bash
# Find components fetching multiple collections then iterating
grep -r "useQuery.*watchlists" client/src | xargs grep -l "for.*of.*watchlists"
grep -r "\.map.*\.map" client/src  # Nested iterations often indicate client-side aggregation
```

---

### Deterministic Sorting for Pagination

**When:** Sorting data for cursor-based pagination

#### Anti-Pattern
```typescript
// ❌ WRONG - No secondary sort key
results.sort((a, b) => {
  return b.priceDropPercent - a.priceDropPercent; // What if equal?
});
```

**Problem:** When two items have equal sort values, order is indeterminate. This causes:
- Items appearing in different order on refresh
- Duplicate items across pages
- Skipped items when paginating

#### Correct Pattern
```typescript
// ✅ CORRECT - Deterministic sort with secondary key
results.sort((a, b) => {
  // Primary sort: price drop percent (descending)
  const primaryDiff = b.priceDropPercent - a.priceDropPercent;

  // Secondary sort: ID (ascending) for determinism
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

**Why this matters:**
- Pagination cursors are based on IDs
- If sort order changes, cursor becomes invalid
- Secondary sort ensures stable ordering across pagination

**General Pattern:**
```typescript
results.sort((a, b) => {
  const primaryDiff = /* primary comparison */;
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

### Lazy Loading for Bundle Size Optimization

**When:** Large pages with heavy components, modals, or below-the-fold content

**Context:** Bundle sizes >600KB trigger build warnings and impact performance. Use React.lazy() and Suspense to split code and reduce initial bundle size.

**Added:** 2025-12-26 (Home page optimization: 655KB → 597KB)

#### ❌ WRONG - Loading Everything Upfront
```typescript
// Imports ALL components regardless of visibility
import { TemplateHeader, HeroGrid, FeaturesBar } from '@/components/template';
import { ProductSection, CategoryCarousel, Footer } from '@/components/template';
import { CartModal, SearchModal, MobileMenu } from '@/components/template/modals';

function HomePage() {
  return (
    <div>
      <TemplateHeader />
      <HeroGrid />
      <FeaturesBar />
      {/* Below the fold - user hasn't scrolled yet */}
      <ProductSection />
      <CategoryCarousel />
      <Footer />
      {/* Modals - not even opened yet! */}
      <CartModal isOpen={cartOpen} />
      <SearchModal isOpen={searchOpen} />
    </div>
  );
}
```

**Problems:**
- Loads 20+ components on initial page load (600KB+ bundle)
- Below-the-fold content delays above-the-fold rendering
- Modals loaded even if never opened
- Build warnings about chunk size
- Slow First Contentful Paint (FCP)

#### ✅ CORRECT - Lazy Load Below-the-Fold & Modals
```typescript
import { useState, lazy, Suspense } from 'react';

// ABOVE THE FOLD - Eager loaded (critical for FCP)
import { TemplateHeader, HeroGrid, FeaturesBar } from '@/components/template';

// BELOW THE FOLD - Lazy loaded
const ProductSection = lazy(() =>
  import('@/components/template').then(m => ({ default: m.ProductSection }))
);
const CategoryCarousel = lazy(() =>
  import('@/components/template').then(m => ({ default: m.CategoryCarousel }))
);
const Footer = lazy(() =>
  import('@/components/template').then(m => ({ default: m.TemplateFooter }))
);

// MODALS - Lazy loaded (only opened on user action)
const CartModal = lazy(() =>
  import('@/components/template/modals').then(m => ({ default: m.CartModal }))
);
const SearchModal = lazy(() =>
  import('@/components/template/modals').then(m => ({ default: m.SearchModal }))
);

function SectionLoadingFallback() {
  return <div className="bg-muted h-48 w-full animate-pulse rounded-lg" />;
}

function HomePage() {
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div>
      {/* Above-the-fold: Eager loaded */}
      <TemplateHeader onOpenCart={() => setCartOpen(true)} />
      <HeroGrid />
      <FeaturesBar />

      {/* Below-the-fold: Lazy loaded with Suspense */}
      <Suspense fallback={<SectionLoadingFallback />}>
        <ProductSection />
        <CategoryCarousel />
        <Footer />
      </Suspense>

      {/* Modals: Lazy loaded (null fallback since invisible) */}
      <Suspense fallback={null}>
        <CartModal isOpen={cartOpen} onClose={() => setCartOpen(false)} />
        <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>
    </div>
  );
}
```

**Benefits:**
- ✅ Reduced initial bundle: 655KB → 597KB (58.88 KB reduction, 9% smaller)
- ✅ Eliminated build warning (under 600KB threshold)
- ✅ Faster FCP - above-the-fold content loads immediately
- ✅ Below-the-fold content loads progressively as user scrolls
- ✅ Modals only load when user opens them (~30KB deferred)
- ✅ Better caching - vendor bundles unchanged, only home chunk updates

**Key Principles:**
1. **Above-the-fold eager** - Header, hero, critical navigation
2. **Below-the-fold lazy** - Product sections, carousels, footer
3. **Modals lazy** - Only load when user interaction requires them
4. **Loading fallbacks** - Use skeleton loaders for visible sections, `null` for modals
5. **Named exports** - Use `.then(m => ({ default: m.ComponentName }))` for barrel exports

**Suspense Strategies:**
```typescript
// Single Suspense for multiple components (loads together)
<Suspense fallback={<SectionLoadingFallback />}>
  <ProductSection />
  <CategoryCarousel />
  <Footer />
</Suspense>

// Individual Suspense (loads independently - more granular)
<Suspense fallback={<SectionLoadingFallback />}>
  <ProductSection />
</Suspense>
<Suspense fallback={<SectionLoadingFallback />}>
  <CategoryCarousel />
</Suspense>

// Null fallback for invisible components
<Suspense fallback={null}>
  <CartModal isOpen={false} />
</Suspense>
```

**Performance Budget Enforcement:**
```json
// package.json
{
  "scripts": {
    "check-size": "bundlesize"
  },
  "bundlesize": [
    {
      "path": "./dist/public/assets/index-*.js",
      "maxSize": "600 KB",
      "compression": "none"
    }
  ]
}
```

**Testing:**
```typescript
// e2e/bundle-optimization.spec.ts
test('above-the-fold content loads immediately', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('text=/Hero/i')).toBeVisible({ timeout: 5000 });
});

test('below-the-fold sections lazy load correctly', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect(page.locator('text=/Best Sellers/i')).toBeVisible({ timeout: 3000 });
});
```

**Real-World Results:**
- Home page (HomeNew): 655.86 KB → 596.98 KB
- Build warning eliminated
- TypeScript compiles cleanly
- All E2E tests pass
- No console errors during lazy loading

**Verification Checklist:**
- [ ] Run `npm run build` to create production bundle
- [ ] Run `npm run check-size` to verify bundle sizes (must be under 600KB threshold)
- [ ] Run `npm run test:e2e:bundle` to verify lazy loading in production mode
  - **CRITICAL**: Use `test:e2e:bundle`, NOT `test:e2e` (dev server incompatible)
  - Bundle tests verify chunk files at `/assets/*.js` which only exist in production
  - Running with `test:e2e` will fail with 401 errors and 0 loaded chunks
  - See "E2E Environment-Specific Configuration" in `docs/08_TESTING_PATTERNS.md`
- [ ] Check Network tab in DevTools (scroll page to trigger lazy loads)
- [ ] Verify no console errors during lazy loading
- [ ] Confirm separate chunk files for lazy components (not in main bundle)

**Why Production Tests Required:**
- Vite dev server serves transformed modules on-the-fly (no physical chunks)
- Production server serves static chunk files from `dist/public/assets/`
- Bundle optimization tests verify physical chunk files exist and load correctly
- Test environment must match what's being tested (production behavior)

**See Also:**
- `client/src/pages/home-new.tsx` - Reference implementation
- `e2e/bundle-optimization.spec.ts` - E2E test suite
- `playwright.bundle.config.ts` - Production-specific test configuration
- `docs/08_TESTING_PATTERNS.md` - E2E Environment-Specific Configuration pattern
- `docs/LEARNINGS_BUNDLE_OPTIMIZATION_E2E_TEST_FIX.md` - Investigation details
- `todos/002-completed-frontend-bundle-size-optimization.md` - Full implementation details

---

## Common Anti-Patterns

### Hardcoded Colors (CRITICAL)

**NEVER use hardcoded hex colors in Tailwind classes.** Use design tokens from `@theme` in `index.css`.

#### ❌ WRONG - Hardcoded Hex Colors
```tsx
// THIS WILL FAIL PRE-COMMIT HOOKS!
<div className="bg-[#3B82F6] text-[#FFFFFF]">
  Price Alert
</div>

<div className="border-[#E5E7EB] hover:bg-[#F3F4F6]">
  Product Card
</div>

<Button className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]">
  Get Deal
</Button>
```

**Problems:**
- Violates design system architecture (single source of truth)
- Breaks dark mode (hardcoded colors don't adapt)
- Fails pre-commit hooks (automated enforcement)
- Creates maintenance burden (color changes require manual updates)
- Inconsistent UX across components

#### ✅ CORRECT - Use Design Tokens
```tsx
// Use semantic design tokens
<div className="bg-primary text-primary-foreground">
  Price Alert
</div>

<div className="border-border hover:bg-muted">
  Product Card
</div>

// Use gradient utilities
<Button className="gradient-brand text-white">
  Get Deal
</Button>
```

**Acceptable Exceptions:**
1. **Chart colors** - Data visualization (e.g., `<Line stroke="#3b82f6" />`)
2. **User-selected colors** - Custom preferences (e.g., label colors)
3. **Third-party integrations** - External library requirements

**See:** `docs/DESIGN_SYSTEM.md` for complete design token reference.

---

### Hardcoded Values

#### ❌ WRONG - Hardcoded IDs and Constants

```typescript
// THIS WILL FAIL CODE REVIEW!
function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['watchlist', 1],  // Hardcoded watchlist ID!
    queryFn: () => apiRequest('/api/watchlists/1'),
  });

  // Works only for user with watchlist ID 1
  // Breaks for all other users!
}

// More examples of hardcoding
const DEFAULT_USER_ID = 42;  // WRONG
const ADMIN_ID = 1;          // WRONG
const CATEGORY_ELECTRONICS = 5;  // WRONG
```

**Problems:**
- Works only in specific test scenarios
- Breaks for real users
- Copy-paste bugs when reusing code
- Hard to debug (why is it always fetching watchlist 1?)

#### ✅ CORRECT - Use Dynamic Values

```typescript
// Get from URL params
function WatchlistPage() {
  const { id } = useParams<{ id: string }>();
  const watchlistId = parseIntSafe(id, 'watchlistId', { min: 1 });

  const { data } = useQuery({
    queryKey: ['watchlist', watchlistId],
    queryFn: () => apiRequest(`/api/watchlists/${watchlistId}`),
  });
}

// Get from user context
function DashboardPage() {
  const { user } = useAuth();  // Get authenticated user

  const { data } = useQuery({
    queryKey: ['watchlists', user.id],
    queryFn: () => apiRequest(`/api/users/${user.id}/watchlists`),
    enabled: !!user,
  });
}

// Get from props
function ProductCard({ productId }: { productId: number }) {
  const { data } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => apiRequest(`/api/products/${productId}`),
  });
}
```

#### Detection Rule
```bash
# Find hardcoded numeric IDs in API calls
grep -r "apiRequest.*\/[0-9]" client/src

# Find hardcoded IDs in useQuery
grep -r "queryKey:.*\[.*[0-9]" client/src
```

---

## CSS & Tailwind 4 Patterns

This project uses **Tailwind CSS v4** with the Vite plugin (`@tailwindcss/vite`). Configuration is CSS-first using the `@theme` directive.

### Theme Configuration

**Location:** `client/src/index.css`

All design tokens are defined in the `@theme` block using CSS custom properties:

```css
@import 'tailwindcss';

@theme {
  /* Brand Colors (HSL format for opacity support) */
  --color-primary: 217 91% 60%;           /* Blue 500 */
  --color-primary-hover: 217 91% 55%;
  --color-primary-foreground: 0 0% 100%;
  --color-secondary: 38 92% 50%;          /* Amber 500 */
  --color-secondary-hover: 38 92% 45%;
  --color-secondary-foreground: 0 0% 100%;

  /* Semantic Colors */
  --color-destructive: 0 84% 60%;
  --color-success: 142 71% 45%;
  --color-warning: 38 92% 50%;
  --color-error: 0 84% 60%;
  --color-info: 199 89% 48%;

  /* Promotional Colors (for CTAs, banners) */
  --color-promo: 0 82% 71%;               /* Coral/Salmon */
  --color-promo-hover: 0 82% 66%;
  --color-promo-foreground: 0 0% 100%;

  /* Extended Font Sizes */
  --font-size-2xs: 0.625rem;              /* 10px - badges, small labels */

  /* Border Radius */
  --radius: 1rem;
  --radius-lg: 1.5rem;
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

**Key Points:**
- Use HSL format for colors to support opacity modifiers (`bg-primary/50`)
- Add new tokens to `@theme` instead of using arbitrary values
- Document what each token represents with comments

---

### Custom Utility Classes

Define reusable utilities in `@layer components` within `index.css`:

```css
@layer components {
  /* Extra small text - 10px for badges and compact labels */
  .text-2xs {
    font-size: var(--font-size-2xs);
    line-height: 1;
  }

  /* Promotional button styling */
  .btn-promo {
    background-color: hsl(var(--color-promo));
    color: hsl(var(--color-promo-foreground));
  }

  .btn-promo:hover {
    background-color: hsl(var(--color-promo-hover));
  }

  /* Gradient utilities */
  .gradient-brand {
    background: linear-gradient(to right, hsl(var(--color-primary)), hsl(var(--color-secondary)));
  }
}
```

**When to Create Custom Utilities:**
- Pattern repeated 3+ times across components
- Complex multi-property styling
- Semantic meaning (`.btn-promo` vs `bg-[#ff6b6b]`)

---

### Avoiding Arbitrary Values

**NEVER use arbitrary values when a theme token exists or can be created.**

#### ❌ WRONG - Hardcoded Arbitrary Values

```tsx
// Hardcoded hex colors - breaks design system
<button className="bg-[#ff6b6b] hover:bg-[#ff5252] text-white">
  Subscribe
</button>

// Hardcoded font size - inconsistent, unmaintainable
<span className="text-[10px] font-bold">
  SALE
</span>

// Arbitrary spacing that should be standard
<div className="p-[13px] mt-[7px]">
  Content
</div>
```

#### ✅ CORRECT - Use Theme Tokens

```tsx
// Use semantic utility class
<button className="btn-promo rounded-lg px-6 py-3.5 font-semibold transition-colors">
  Subscribe
</button>

// Use defined font size token
<span className="text-2xs font-bold">
  SALE
</span>

// Use standard Tailwind spacing
<div className="p-3 mt-2">
  Content
</div>
```

#### When to Create New Theme Tokens

If you find yourself needing an arbitrary value repeatedly:

1. **Add the token to `@theme`:**
```css
@theme {
  --font-size-2xs: 0.625rem;  /* 10px */
  --color-promo: 0 82% 71%;   /* Coral */
}
```

2. **Create a utility class if needed:**
```css
@layer components {
  .text-2xs {
    font-size: var(--font-size-2xs);
    line-height: 1;
  }
}
```

3. **Update components to use the token:**
```tsx
// Before: text-[10px]
// After:  text-2xs
<span className="text-2xs font-bold">Badge</span>
```

---

### Detection Rules

```bash
# Find hardcoded hex colors in className
grep -r "bg-\[#" client/src --include="*.tsx"
grep -r "text-\[#" client/src --include="*.tsx"
grep -r "border-\[#" client/src --include="*.tsx"

# Find arbitrary font sizes (likely need tokens)
grep -r "text-\[.*px\]" client/src --include="*.tsx"

# Find inline styles with colors (should use Tailwind)
grep -r "style=.*backgroundColor" client/src --include="*.tsx"
grep -r "style=.*color:" client/src --include="*.tsx"
```

---

### Tailwind 4 Migration Notes

If migrating from Tailwind v3:

| v3 Pattern | v4 Pattern |
|------------|------------|
| `@tailwind base;` | `@import 'tailwindcss';` |
| `@tailwind components;` | (included in import) |
| `@tailwind utilities;` | (included in import) |
| `tailwind.config.js` theme | `@theme { }` in CSS |
| `bg-opacity-50` | `bg-black/50` |
| `text-opacity-50` | `text-black/50` |
| `@layer utilities { }` | `@utility name { }` (for variants) |

**Current Setup:**
- Uses `@tailwindcss/vite` plugin (not PostCSS)
- Configuration in `index.css` via `@theme`
- Legacy `tailwind.config.ts` exists for `tailwindcss-animate` plugin

---

### Large-Scale Design Token Migration Strategy

**Context:** When consolidating multiple conflicting color systems or migrating from hardcoded colors to design tokens across 100+ instances in 50+ files.

**Problem:** Bulk find/replace can break builds, miss edge cases, or cause visual regressions. Direct configuration changes before component migration can cause Tailwind to not recognize classes during the migration phase.

**✅ Preferred Approach (Phased Migration):**

```
PHASE 1: Color System Consolidation
  1. Audit current usage
     - grep -r "template\." client/src --include="*.tsx"
     - Count violations by file and pattern

  2. Choose winning system (document decision in DESIGN_SYSTEM.md)
     - Example: @theme system wins over template.* colors

  3. ⚠️ CRITICAL ORDER: Migrate component usage FIRST
     - Update all component files to use new classes
     - Old classes MUST still exist in config during this step
     - Use Edit tool for file-by-file changes (NOT sed)

  4. Remove from config AFTER components migrated
     - Only after grep confirms zero usage
     - Update tailwind.config.ts or index.css @theme

  5. VERIFICATION CHECKPOINT (MANDATORY):
     - npm run build (zero warnings required)
     - grep -r "old-pattern" client/src (zero matches)
     - Manual UI spot check (3-5 key pages in light + dark mode)

PHASE 2: Design Token Enforcement
  1. Create semantic token mapping
     - green-600 → text-success
     - red-100 → bg-destructive/10
     - Document mapping in DESIGN_SYSTEM.md

  2. Prioritize files (high-traffic pages first)
     - Landing page, product detail, search results

  3. File-by-file migration (use Edit tool)
     - Read file with Read tool
     - Edit with exact string replacement
     - NEVER use sed or bulk replace

  4. Document acceptable exceptions
     - Chart colors (data visualization)
     - User-selected colors (preferences)
     - Third-party library constraints

  5. VERIFICATION CHECKPOINT (MANDATORY):
     - npm run build
     - Count remaining violations (should decrease)
     - Spot check updated pages

PHASE 3: Cleanup & Documentation
  1. Remove orphaned CSS files
  2. Document necessary !important usage
  3. Update DESIGN_SYSTEM.md with final architecture
  4. Codify learnings to pattern docs

  5. FINAL VERIFICATION:
     - npm run build (zero warnings)
     - npm test (all tests pass)
     - Dark mode visual check
     - Light mode visual check
```

**❌ Anti-Pattern (What NOT to Do):**

```bash
# ❌ WRONG - Remove from config BEFORE migrating components
# This causes Tailwind to not recognize classes during migration!
# Step 1: Update tailwind.config.ts (removes template colors)
# Step 2: Update components (classes not recognized - build fails!)

# ❌ WRONG - Global sed replacement without verification
sed -i 's/bg-green-600/bg-success/g' client/src/**/*.tsx
# Missing: opacity patterns, context-specific usage, edge cases

# ❌ WRONG - Skipping verification checkpoints
# Phase 1 complete, immediately start Phase 2
# (If Phase 1 broke something, Phase 2 compounds the error)
```

**Rationale:**
- **Component-first order** prevents Tailwind from losing class definitions mid-migration
- **File-by-file approach** catches context-specific edge cases that sed misses
- **Verification checkpoints** prevent cascading failures
- **Phased approach** makes rollback easier if issues found
- **Systematic documentation** ensures team alignment and prevents rework

**Success Metrics from TODO 008:**
- 442 violations eliminated (47 template.* + 395 hardcoded colors)
- 60+ files updated without breaking builds
- 93.2% reduction in hardcoded colors
- Zero visual regressions
- Completed in 6-8 hours (aligned with 1-day estimate)

*Source: TODO 008 CSS Architecture Consolidation*
*Added: 2025-12-30*

---

### Component-First Configuration-Last Migration Order

**Context:** Migrating from one Tailwind color system to another (e.g., template.* colors to @theme tokens).

**Problem:** Removing colors from configuration before updating components causes Tailwind to not recognize the classes, resulting in build failures and broken styles.

**✅ Preferred Approach:**

```
CORRECT ORDER:
1. Migrate component files
   - Change template.primary-600 → bg-primary in all .tsx files
   - Old classes still work (defined in config)

2. VERIFY all components migrated
   - grep -r "template\." client/src (zero matches)
   - npm run build (verify build succeeds)

3. Remove from configuration
   - Update tailwind.config.ts or index.css @theme
   - Remove old template.* color definitions

4. VERIFY build still works
   - npm run build (should still succeed)
   - No missing class warnings
```

**❌ Anti-Pattern:**

```
WRONG ORDER (causes migration failures):
1. ❌ Remove template.* from tailwind.config.ts
   - Tailwind no longer generates template.* classes

2. ❌ Attempt to migrate components
   - Components still use template.primary-600
   - Tailwind doesn't recognize the class (not in config!)
   - Build fails or styles missing
   - Developer confusion about what went wrong
```

**Why This Matters:**

Tailwind CSS generates utility classes **only for tokens defined in configuration**. During migration:

- **Old classes still used in components** → Need old config entries to generate classes
- **Remove config too early** → Tailwind stops generating those classes
- **Components fail to compile** → Missing class definitions
- **Migration blocked** → Can't proceed until config restored

**Correct Flow:**
```
Config has OLD classes → Components use OLD classes ✅ (works)
Config has OLD classes → Components use NEW classes ✅ (works, old unused)
Config has NEW classes → Components use NEW classes ✅ (works)
Config has NEW classes → Components use OLD classes ❌ (FAILS - class undefined)
```

**Verification Commands:**

```bash
# Before removing from config, ensure zero usage:
grep -r "template\." client/src --include="*.tsx"
# Expected: No matches found

# After migration, verify build:
npm run build
# Expected: Build succeeds, no class warnings
```

*Source: TODO 008 CSS Architecture Consolidation (Phase 1)*
*Added: 2025-12-30*

---

### Semantic Design Token Mapping Strategy

**Context:** Replacing Tailwind utility colors (green-600, red-100, blue-50) with semantic design tokens during large-scale design system migration.

**Problem:** Need consistent, maintainable mapping from utility colors to semantic tokens that preserves visual intent and supports dark mode.

**✅ Preferred Approach (Semantic Mapping):**

```tsx
// SUCCESS STATES (green → success)
// Solid backgrounds
bg-green-600 → bg-success
bg-green-500 → bg-success
text-green-600 → text-success
border-green-500 → border-success

// Transparent backgrounds (opacity pattern)
bg-green-100 → bg-success/10  // 10% opacity
bg-green-50 → bg-success/5     // 5% opacity
bg-green-200 → bg-success/20   // 20% opacity

// ERROR/DESTRUCTIVE STATES (red → destructive)
bg-red-600 → bg-destructive
bg-red-100 → bg-destructive/10
text-red-600 → text-destructive
border-red-500 → border-destructive

// INFO STATES (blue → info)
bg-blue-600 → bg-info
bg-blue-50 → bg-info/5
text-blue-600 → text-info

// WARNING STATES (yellow/amber → warning)
bg-yellow-600 → bg-warning
bg-amber-100 → bg-warning/10
text-yellow-600 → text-warning

// MUTED/NEUTRAL (gray → muted)
text-gray-400 → text-muted-foreground
bg-gray-100 → bg-muted/10
bg-gray-50 → bg-muted/5
border-gray-200 → border-border
```

**Opacity Pattern Convention:**

```tsx
// Use /N for N% opacity backgrounds
bg-success/10  // 10% success color
bg-success/5   // 5% success color
bg-destructive/20  // 20% destructive color

// Benefits:
// - Consistent with Tailwind 4 opacity syntax
// - Works with HSL color format in @theme
// - Supports dark mode automatically
```

**Context-Specific Mapping:**

```tsx
// Price drops / savings (positive financial outcome)
text-green-600 → text-success ✅

// Stock availability
"In Stock" bg-green-100 → bg-success/10 ✅
"Out of Stock" bg-red-100 → bg-destructive/10 ✅
"Limited Stock" bg-yellow-100 → bg-warning/10 ✅

// Buttons
bg-green-600 hover:bg-green-700 → bg-success hover:bg-success/90 ✅

// Badges
bg-blue-100 text-blue-800 → bg-info/10 text-info ✅
```

**❌ Anti-Pattern:**

```tsx
// ❌ WRONG - Inconsistent mapping
bg-green-600 → bg-green-600  // Still hardcoded!
bg-green-100 → bg-green-50   // Wrong direction

// ❌ WRONG - Lost semantic meaning
text-success → text-green-600  // Backward migration!

// ❌ WRONG - Manual opacity calculation
bg-green-100 → bg-[hsl(142,71%,45%,0.1)]  // Use bg-success/10 instead

// ❌ WRONG - Mixing systems
bg-success text-green-600  // Inconsistent - use text-success
```

**Acceptable Exceptions:**

1. **Data Visualization (Charts):**
   ```tsx
   // ✅ ACCEPTABLE - Chart-specific colors
   <Line stroke="#3b82f6" dataKey="price" />
   <Bar fill="#10b981" dataKey="sales" />
   // Reason: Chart libraries need specific hex colors for data clarity
   ```

2. **User-Selected Colors:**
   ```tsx
   // ✅ ACCEPTABLE - User preference data
   <div style={{ backgroundColor: userPreferences.labelColor }} />
   // Reason: User's personal choice, not design system color
   ```

3. **Third-Party Library Constraints:**
   ```tsx
   // ✅ ACCEPTABLE - Library requirement
   <ExternalComponent color={entry.color || '#000000'} />
   // Reason: External library API requires hex color string
   ```

**Rationale:**
- **Semantic tokens** enable theme-wide color changes without touching components
- **Opacity pattern** provides consistent transparency levels
- **Dark mode support** automatic when using HSL-based tokens
- **Maintainability** improved - change token value once vs 100 components
- **Accessibility** easier to enforce WCAG contrast requirements centrally

**Migration Verification:**

```bash
# Find remaining hardcoded colors (should decrease with each file)
grep -r "bg-green-" client/src --include="*.tsx" | wc -l
grep -r "bg-red-" client/src --include="*.tsx" | wc -l
grep -r "text-blue-" client/src --include="*.tsx" | wc -l

# Target: 0 matches (except documented exceptions)
```

*Source: TODO 008 CSS Architecture Consolidation (Phase 2 - 395 colors migrated)*
*Added: 2025-12-30*

---

### Phase-Gated Refactoring with Verification Checkpoints

**Context:** Large refactorings that touch 50+ files and could cascade failures if errors occur (e.g., design system migrations, API refactors, dependency upgrades).

**Problem:** Without verification checkpoints, a single error in Phase 1 can compound with Phase 2 changes, making root cause diagnosis difficult and rollback complex.

**✅ Preferred Approach (Phase-Gated with Mandatory Verification):**

**Checkpoint Requirements (ALL must pass before next phase):**

```bash
# 1. Build Verification (zero warnings tolerance)
npm run build
# Expected: Build succeeded, 0 warnings

# 2. Automated Verification (pattern-specific)
# Example for CSS migration:
grep -r "old-pattern" client/src --include="*.tsx"
# Expected: 0 matches found

# Example for API migration:
grep -r "deprecated-api-call" server/routes --include="*.ts"
# Expected: 0 matches found

# 3. Manual Spot Check (prevent visual regressions)
# - Load 3-5 key pages in browser
# - Test light mode (all pages)
# - Test dark mode (all pages)
# - Verify no broken styles
# - Verify no console errors
# - Check mobile responsive (if applicable)

# 4. Test Suite (if tests exist for changed area)
npm test
# Expected: All tests pass
```

**Phase Progression Rules:**

```
Phase 1 Complete
  ↓
All Verification Checks Pass?
  ├─ NO → Fix issues, re-verify, DO NOT proceed
  └─ YES → Proceed to Phase 2

Phase 2 Complete
  ↓
All Verification Checks Pass?
  ├─ NO → Fix issues, re-verify, DO NOT proceed
  └─ YES → Proceed to Phase 3

Phase 3 Complete
  ↓
FINAL Verification (all checks + additional)
  - npm run build && npm test
  - Full manual regression test
  - Dark + light mode
  - Performance check (if applicable)
```

**Example: CSS Architecture Consolidation (TODO 008):**

```
PHASE 1: Template Color Removal (47 violations)
  - Migrate components from template.* to @theme
  - Update tailwind.config.ts

  ✅ CHECKPOINT 1:
    - npm run build ✓
    - grep -r "template\." client/src (0 matches) ✓
    - Spot check: Landing page, Product detail, Search (light+dark) ✓

  Result: PASS → Proceed to Phase 2

PHASE 2: Hardcoded Color Token Replacement (395 violations)
  - Replace green-600 → text-success (60+ files)
  - Replace red-100 → bg-destructive/10

  ✅ CHECKPOINT 2:
    - npm run build ✓
    - grep -r "bg-green-|text-green-" count: 395 → 24 (94% reduction) ✓
    - Spot check: Updated pages (light+dark) ✓

  Result: PASS → Proceed to Phase 3

PHASE 3: Cleanup & Documentation
  - Remove orphaned CSS files
  - Document !important usage
  - Update DESIGN_SYSTEM.md

  ✅ FINAL CHECKPOINT:
    - npm run build && npm test ✓
    - Full UI regression test ✓
    - Dark mode check (all pages) ✓
    - Documentation review ✓

  Result: PASS → Mark TODO complete
```

**❌ Anti-Pattern (Checkpoint Skipping):**

```
❌ WRONG - Skip verification, compound errors:

Phase 1: Remove template colors from config
  (Config change breaks 10 components)

Phase 2: Start hardcoded color migration
  (Now have 2 sources of errors mixed together)

Phase 3: Try to fix everything at once
  (Can't tell which errors from Phase 1 vs Phase 2)
  (Rollback unclear - revert Phase 2? Phase 1? Both?)

Result:
  - Diagnosis time: 2+ hours
  - Rollback complexity: High
  - Developer frustration: High
  - Risk of introducing new bugs: High
```

**❌ Anti-Pattern (Insufficient Verification):**

```
❌ WRONG - Build check only:

Phase 1 Complete
  ✓ npm run build (passes)
  ✗ Skipped: grep verification
  ✗ Skipped: manual UI check

Issue: Build passes but visual regressions introduced
  - Button colors wrong in dark mode
  - Missing hover states on links
  - Discovered in Phase 3 (too late, mixed with other changes)
```

**Rationale:**
- **Prevents cascading errors** - Catch issues before they compound
- **Clear rollback points** - Know exactly which phase introduced issue
- **Faster debugging** - Smaller changesets to investigate
- **Higher confidence** - Each phase validated before proceeding
- **Better documentation** - Checkpoint results provide audit trail
- **Reduced risk** - Incremental validation vs big-bang testing

**Time Investment:**
- Verification overhead: ~10-15 minutes per phase
- Time saved on debugging: 1-3 hours (prevents compound errors)
- Net benefit: Positive (especially for 50+ file changes)

**When to Use:**
- ✅ 50+ files affected
- ✅ Multiple logical phases
- ✅ Critical systems (auth, payments, design system)
- ✅ API contract changes
- ✅ Dependency major version upgrades

**When NOT Necessary:**
- Single file changes
- Isolated component updates
- Non-critical experimental features

*Source: TODO 008 CSS Architecture Consolidation (3-phase migration, 60+ files, zero regressions)*
*Added: 2025-12-30*

---

## Testing Patterns

### Dialog Components

**Required Test Coverage:**

```typescript
describe('Dialog Component', () => {
  it('should open when trigger clicked', () => {
    // Test dialog opens
  });

  it('should close on cancel', () => {
    // Test cancel button
  });

  it('should close on successful submission', () => {
    // Test successful submit closes dialog
  });

  it('should stay open on error', () => {
    // Test error handling
  });

  it('should show loading state during mutation', () => {
    // Test isPending state
  });

  it('should disable buttons during mutation', () => {
    // Test disabled state
  });

  it('should reset to default values when reopened', () => {
    // Test state reset
  });

  it('should validate input before submission', () => {
    // Test validation
  });

  it('should show error toast on failure', () => {
    // Test error feedback
  });

  it('should show success toast on completion', () => {
    // Test success feedback
  });

  it('should invalidate correct queries', () => {
    // Test query invalidation
  });
});
```

### Inline Editing

```typescript
describe('Inline Editing', () => {
  it('should show edit button only when field exists', () => {
    const { getByLabelText } = render(<ItemCard item={{ id: 1, value: null }} />);
    expect(() => getByLabelText('Edit')).toThrow();

    const { getByLabelText: getButton } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    expect(getButton('Edit')).toBeInTheDocument();
  });

  it('should enter editing mode on edit button click', () => {
    const { getByLabelText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    expect(getByRole('textbox')).toBeInTheDocument();
  });

  it('should validate input before saving', async () => {
    const { getByLabelText, getByText } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '-5' } });
    fireEvent.click(getByText('Save'));
    // Mutation should NOT be called
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it('should reset value on cancel', () => {
    const { getByLabelText, getByText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '60' } });
    fireEvent.click(getByText('Cancel'));
    // Should exit editing mode and reset value
    expect(getByText('$50.00')).toBeInTheDocument();
  });

  it('should invalidate queries on successful save', async () => {
    const { getByLabelText, getByText, getByRole } = render(<ItemCard item={{ id: 1, value: 50 }} />);
    fireEvent.click(getByLabelText('Edit'));
    fireEvent.change(getByRole('textbox'), { target: { value: '45' } });
    fireEvent.click(getByText('Save'));
    await waitFor(() => {
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/items'] });
    });
  });
});
```

### Pagination

```typescript
describe('getWatchedProducts - Pagination', () => {
  it('should return hasMore=true when more products exist', async () => {
    // Create 5 products, fetch limit 2
    const result = await storage.getWatchedProducts(userId, { limit: 2 });

    expect(result.products).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeGreaterThan(0);
  });

  it('should return hasMore=false on last page', async () => {
    const result = await storage.getWatchedProducts(userId, { limit: 10 });

    expect(result.products).toHaveLength(5); // Only 5 products exist
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('should fetch second page using nextCursor', async () => {
    const page1 = await storage.getWatchedProducts(userId, { limit: 2 });
    const page2 = await storage.getWatchedProducts(userId, {
      limit: 2,
      cursor: page1.nextCursor!
    });

    expect(page2.products[0].id).not.toBe(page1.products[0].id);
    expect(page2.products[0].id).not.toBe(page1.products[1].id);
  });

  it('should handle empty results', async () => {
    const result = await storage.getWatchedProducts(userWithNoProducts);

    expect(result.products).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
```

---

## Frontend Checklist

### General
- [ ] **No client-side data aggregation** - Use dedicated endpoints
- [ ] **Design system compliance** - Use color tokens, not hardcoded values
- [ ] **No hardcoded IDs** - Use dynamic values from params/props/context
- [ ] **Reuse existing components** - Search before creating new ones
- [ ] **Zero `any` types** - See `docs/01_TYPESCRIPT_PATTERNS.md`

### State Management
- [ ] **React Query for server state** - Not useState
- [ ] **useState for local UI state** - Modals, tabs, form inputs
- [ ] **Proper query invalidation** - All affected queries

### Forms & Dialogs
- [ ] **Dialog pattern complete** - All 10 key elements (validation, loading, error handling, etc.)
- [ ] **Inline editing conditional** - Only show when field exists
- [ ] **Decimal handling correct** - Round on input, convert on API call
- [ ] **Client-side validation** - Before mutations
- [ ] **Loading states** - Show during mutations

### API & Performance
- [ ] **Centralized API client** - Use apiRequest helper
- [ ] **Proper error handling** - Handle all error states
- [ ] **ESLint compliance** - `void` for fire-and-forget promises
- [ ] **Cursor pagination** - For large datasets
- [ ] **Deterministic sorting** - Secondary sort on ID

### CSS & Tailwind
- [ ] **No arbitrary hex colors** - Use theme tokens (`bg-primary`, not `bg-[#3B82F6]`)
- [ ] **No arbitrary font sizes** - Use `text-2xs` for 10px, not `text-[10px]`
- [ ] **New tokens in @theme** - Add reusable values to CSS, not arbitrary
- [ ] **Custom utilities documented** - In `@layer components`
- [ ] **Dark mode tested** - Verify theme works in both modes

### UI/UX
- [ ] **Loading states** - Show skeletons/spinners
- [ ] **Dark mode support** - Test in both themes
- [ ] **Accessibility** - WCAG AA compliance
- [ ] **Conditional rendering** - Only render when needed

---

## Related Documentation

- [CLAUDE.md](/Users/williamtower/projects/PriceCompare/CLAUDE.md) - Main project guidelines
- [docs/01_TYPESCRIPT_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/01_TYPESCRIPT_PATTERNS.md) - Type safety patterns
- [docs/02_DATABASE_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/02_DATABASE_PATTERNS.md) - Database best practices
- [docs/03_API_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/03_API_PATTERNS.md) - Backend API patterns
- [docs/04_SECURITY_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/04_SECURITY_PATTERNS.md) - Security best practices
- [docs/06_ERROR_HANDLING_PATTERNS.md](/Users/williamtower/projects/PriceCompare/docs/06_ERROR_HANDLING_PATTERNS.md) - Error handling
- [docs/COMPONENT_GUIDE.md](/Users/williamtower/projects/PriceCompare/docs/COMPONENT_GUIDE.md) - Component architecture
- [docs/API_DOCUMENTATION.md](/Users/williamtower/projects/PriceCompare/docs/API_DOCUMENTATION.md) - API endpoint reference

---

**Pattern Consolidation History:**
- **v1.0** (2025-11-26): Initial FRONTEND_PATTERNS.md covering design system, component reuse, anti-patterns
- **v2.0** (2025-11-29): Merged React Query patterns (mutations, pagination, async handlers), form handling (dialogs, inline editing), and decimal handling from PHASE1_WATCHLIST_PATTERNS.md
- **v2.1** (2025-12-08): Added CSS & Tailwind 4 patterns section with theme tokens, custom utilities, and arbitrary value guidance
