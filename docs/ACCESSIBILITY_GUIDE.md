# Accessibility Implementation Guide

## Overview
Insightify is built with accessibility as a core requirement, targeting WCAG 2.1 AA compliance. This document outlines our accessibility implementation and standards.

## Accessibility Standards

### WCAG 2.1 AA Compliance
We target Level AA compliance across all four principles:

1. **Perceivable**: Information must be presentable in ways users can perceive
2. **Operable**: Interface components must be operable by all users
3. **Understandable**: Information and UI operation must be understandable
4. **Robust**: Content must be robust enough for various assistive technologies

## Implementation Details

### Navigation and Focus Management

#### Skip Links
```typescript
// Skip to main content link in App.tsx
<a 
  href="#main-content" 
  className="skip-link focus-visible"
  tabIndex={0}
>
  Skip to main content
</a>
```

**Features:**
- Hidden by default, visible on focus
- Direct keyboard access to main content
- High contrast focus indicator

#### Focus Indicators
```css
.focus-visible {
  @apply outline-none ring-2 ring-primary ring-offset-2 ring-offset-background;
}
```

**Implementation:**
- 2px ring around focused elements
- High contrast colors
- Offset for better visibility
- Applied to all interactive elements

#### Keyboard Navigation
- **Tab order**: Logical sequential navigation
- **Enter/Space**: Activate buttons and links
- **Escape**: Close modals and dropdowns
- **Arrow keys**: Navigate within components

### Semantic HTML Structure

#### Landmarks
```typescript
// Main content area
<main id="main-content" role="main">
  {/* Page content */}
</main>

// Site header
<header role="banner">
  {/* Navigation and branding */}
</header>

// Search functionality
<div role="search">
  {/* Search form */}
</div>

// Complementary content
<aside role="complementary" aria-label="Product filters">
  {/* Filter sidebar */}
</aside>

// Site footer
<footer role="contentinfo">
  {/* Footer content */}
</footer>
```

#### Headings Hierarchy
- **H1**: Page title (one per page)
- **H2**: Major sections
- **H3**: Subsections
- **H4-H6**: Further subdivisions as needed

### ARIA Implementation

#### Labels and Descriptions
```typescript
// Search input with proper labeling
<Input
  type="search"
  aria-label="Search for products"
  placeholder="Search for products to compare prices..."
/>

// Button with descriptive label
<Button
  aria-label={`Add ${product.name} to comparison`}
  onClick={onAddToComparison}
>
  <Scale className="h-4 w-4" aria-hidden="true" />
</Button>

// Form sections with fieldset/legend
<fieldset>
  <legend>Price Range</legend>
  {/* Price range inputs */}
</fieldset>
```

#### Live Regions
```typescript
// Loading state announcements
<section 
  aria-label="Loading products" 
  role="status" 
  aria-live="polite"
>
  {/* Loading content */}
</section>

// Dynamic content updates
<div aria-live="polite" aria-atomic="true">
  {products.length} results found
</div>
```

#### Modal Dialogs
```typescript
<div 
  role="dialog" 
  aria-label="Product comparison"
  aria-modal="true"
>
  {/* Modal content */}
</div>
```

### Visual Accessibility

#### Color and Contrast
```css
/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --border: hsl(0, 0%, 0%);
    --ring: hsl(0, 0%, 0%);
  }
  
  .dark {
    --border: hsl(0, 0%, 100%);
    --ring: hsl(0, 0%, 100%);
  }
}
```

**Color Standards:**
- Minimum 4.5:1 contrast ratio for normal text
- Minimum 3:1 contrast ratio for large text
- Color never used as the only indicator
- High contrast mode support

#### Typography
```css
body {
  @apply font-sans antialiased;
  line-height: 1.6; /* Improved readability */
}

/* Responsive text scaling */
@media (max-width: 640px) {
  .mobile-text {
    font-size: 16px; /* Prevent zoom on mobile */
  }
}
```

#### Motion and Animation
```css
/* Respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Form Accessibility

#### Input Labeling
```typescript
// Explicit labels for all inputs
<Label htmlFor="min-price" className="sr-only">
  Minimum price
</Label>
<Input
  id="min-price"
  type="number"
  aria-label="Minimum price"
/>

// Radio button groups
<RadioGroup aria-labelledby="rating-legend">
  <legend id="rating-legend">Minimum Rating</legend>
  {/* Radio options */}
</RadioGroup>
```

#### Error Handling
```typescript
// Form validation with screen reader support
<Input
  aria-invalid={errors.email ? 'true' : 'false'}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <span id="email-error" role="alert" className="error-text">
    {errors.email.message}
  </span>
)}
```

### Screen Reader Support

#### Screen Reader Only Content
```css
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

.sr-only:focus {
  @apply static w-auto h-auto p-1 m-0 overflow-visible whitespace-normal;
  clip: auto;
}
```

#### Descriptive Content
```typescript
// Product ratings with screen reader text
<div className="flex rating-star" aria-label={`${rating} out of 5 stars`}>
  {Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={starClass}
      aria-hidden="true" // Decorative icons
    />
  ))}
</div>

// Hidden descriptive text
<span className="sr-only">
  Product has {offers.length} price offers from different retailers
</span>
```

### Touch and Mobile Accessibility

#### Touch Targets
```css
/* Minimum 44px touch targets */
button, a, input, select, [role="button"] {
  min-height: 44px;
  min-width: 44px;
}
```

#### Responsive Design
- Scalable text (no fixed pixel sizes)
- Horizontal scrolling avoided
- Zoom support up to 200%
- Touch-friendly spacing

## Testing Procedures

### Automated Testing
```bash
# Install axe-core for accessibility testing
npm install --save-dev @axe-core/react

# Run accessibility tests
npm run test:a11y
```

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Ensure logical tab order
- [ ] Verify focus indicators are visible
- [ ] Test escape key functionality
- [ ] Verify no keyboard traps

#### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)

#### Visual Testing
- [ ] Verify color contrast ratios
- [ ] Test with Windows High Contrast mode
- [ ] Test at 200% zoom level
- [ ] Verify readability without images

#### Motor Accessibility
- [ ] Test with switch navigation
- [ ] Verify click target sizes
- [ ] Test with voice control
- [ ] Test with eye tracking

### Browser Testing
Test accessibility across:
- Chrome/Edge with screen reader
- Firefox with screen reader
- Safari with VoiceOver
- Mobile browsers with assistive technology

## Common Patterns

### Loading States
```typescript
// Accessible loading indicator
<div
  role="status"
  aria-live="polite"
  aria-label="Loading products"
>
  <Skeleton className="w-full h-48" />
  <span className="sr-only">Loading product information</span>
</div>
```

### Error States
```typescript
// Error messaging with proper semantics
<div role="alert" className="error-message">
  <AlertCircle className="h-5 w-5" aria-hidden="true" />
  <div>
    <h3 className="font-semibold">Error loading products</h3>
    <p className="text-sm">{error.message}</p>
  </div>
</div>
```

### Data Tables
```typescript
// Accessible data presentation
<table role="table" aria-label="Product comparison">
  <caption className="sr-only">
    Comparison of {products.length} products
  </caption>
  <thead>
    <tr>
      <th scope="col">Product</th>
      <th scope="col">Price</th>
      <th scope="col">Retailer</th>
    </tr>
  </thead>
  <tbody>
    {/* Table rows */}
  </tbody>
</table>
```

## Resources and References

### WCAG Guidelines
- [WCAG 2.1 AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1)
- [WebAIM Accessibility Checklist](https://webaim.org/standards/wcag/checklist)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Web Accessibility Evaluator](https://wave.webaim.org/)
- [Lighthouse Accessibility Audit](https://developers.google.com/web/tools/lighthouse)

### Screen Readers
- [NVDA (Free)](https://www.nvaccess.org/download/)
- [JAWS (Commercial)](https://www.freedomscientific.com/products/software/jaws/)
- VoiceOver (Built into macOS/iOS)

Last Updated: December 25, 2024