# Tailwind CSS v4 Migration Plan

## Current Issues Identified

### Critical Issues
1. **Duplicate Dark Mode Configuration** - Two `.dark` class definitions in index.css
2. **Inconsistent Color Usage** - Mix of hard-coded colors vs semantic tokens
3. **Inline Styles Mixed with Tailwind** - Custom styles that should use utilities
4. **Under-utilization of CSS Variables** - Not leveraging Tailwind v4's semantic tokens

### Component-Specific Issues
- Card components using hard-coded colors instead of semantic tokens
- Product pages mixing inline styles with Tailwind classes
- Forum components inconsistent with color token usage
- Filter components not using proper border/background tokens

## Migration Strategy

### Phase 1: CSS Foundation Cleanup (30 minutes)
1. **Remove duplicate dark mode configuration**
2. **Optimize CSS variable definitions**
3. **Establish semantic token standards**
4. **Clean up theme configuration**

### Phase 2: Component Standardization (45 minutes)
1. **Update Card component to use semantic tokens**
2. **Standardize all UI components with proper tokens**
3. **Replace hard-coded colors throughout application**
4. **Remove inline styles in favor of Tailwind utilities**

### Phase 3: Application-Wide Implementation (30 minutes)
1. **Update all page components**
2. **Standardize product and forum components**
3. **Ensure consistent dark mode support**
4. **Validate responsive design patterns**

## Implementation Checklist

### CSS Foundation
- [ ] Remove duplicate `.dark` class definition
- [ ] Optimize CSS variable organization
- [ ] Establish semantic color token standards
- [ ] Clean up theme configuration structure

### Component Updates
- [ ] Update Card component with semantic tokens
- [ ] Standardize Button component variants
- [ ] Update Input/Form components
- [ ] Fix Dialog/Modal components
- [ ] Update Badge/Avatar components

### Page Components
- [ ] Products page styling standardization
- [ ] Forum page semantic token usage
- [ ] Home page component consistency
- [ ] Admin dashboard color tokens

### Utility Replacements
- [ ] Replace `bg-white dark:bg-gray-800` with `bg-card`
- [ ] Replace `text-gray-900 dark:text-white` with `text-foreground`
- [ ] Replace `border-gray-200 dark:border-gray-700` with `border-border`
- [ ] Replace inline styles with Tailwind utilities

## Semantic Token Standards

### Background Colors
- `bg-background` - Main page background
- `bg-card` - Card/container backgrounds
- `bg-popover` - Dropdown/popover backgrounds
- `bg-muted` - Subtle backgrounds
- `bg-accent` - Accent backgrounds

### Text Colors
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `text-card-foreground` - Card text
- `text-popover-foreground` - Popover text
- `text-accent-foreground` - Accent text

### Border Colors
- `border-border` - Standard borders
- `border-input` - Input borders
- `border-ring` - Focus rings

### Best Practices
1. Always use semantic tokens over hard-coded colors
2. Leverage CSS variables for consistent theming
3. Use Tailwind utilities instead of inline styles
4. Maintain consistent component patterns
5. Test both light and dark modes

## Success Criteria
- No duplicate CSS configurations
- All components use semantic tokens
- No inline styles mixed with Tailwind
- Consistent dark mode support
- Improved maintainability and performance