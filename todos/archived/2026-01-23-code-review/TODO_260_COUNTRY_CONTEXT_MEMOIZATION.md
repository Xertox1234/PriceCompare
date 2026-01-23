# TODO 260: Memoize Country Context Value to Prevent Re-renders

**Priority**: P2 - Important (Performance)
**Effort**: Small (~15 minutes)
**Category**: Performance / React
**Source**: Code Review - Performance Oracle Agent
**Branch**: add_scraping

## Problem Statement

The CountryContext value object is created inline on every render, causing all consumers to re-render when any context value changes. This affects the `Price` component which may be rendered 100+ times in product lists.

## Impact

- All components using `useCountry()` re-render on country change
- Product lists with 100+ Price components cascade re-render
- Performance degrades as product count increases

## Findings

### Non-Memoized Context Value (country-context.tsx:141-151)
```typescript
const value: CountryContextValue = {
  country,
  currency,
  currencySymbol,
  countryData,
  countries,
  setCountry,
  isLoading,
  formatPrice,
};
// New object reference every render → all consumers re-render
```

### Price Component Not Memoized (price.tsx:36-61)
```typescript
export function Price({
  value,
  className,
  strikethrough = false,
  size = 'md',
}: PriceProps) {
  const { formatPrice } = useCountry();
  // ...
}
// Should be wrapped in React.memo
```

## Proposed Solution

### 1. Memoize Context Value
```typescript
// In country-context.tsx
const value = useMemo<CountryContextValue>(() => ({
  country,
  currency,
  currencySymbol,
  countryData,
  countries,
  setCountry,
  isLoading,
  formatPrice,
}), [country, currency, currencySymbol, countryData, countries, setCountry, isLoading, formatPrice]);
```

### 2. Memoize Price Component
```typescript
// In price.tsx
export const Price = React.memo(function Price({
  value,
  className,
  strikethrough = false,
  size = 'md',
}: PriceProps) {
  const { formatPrice } = useCountry();
  // ...
});
```

## Acceptance Criteria

- [ ] Context value wrapped in `useMemo`
- [ ] Price component wrapped in `React.memo`
- [ ] Verify with React DevTools that re-renders are reduced
- [ ] No functional changes to component behavior

## Files to Modify

- `client/src/context/country-context.tsx`
- `client/src/components/ui/price.tsx`

## Verification

Use React DevTools Profiler to compare before/after:
1. Load products page
2. Change country
3. Count re-renders in profiler
4. After fix: Only necessary components should re-render

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - performance oracle agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Country context: `client/src/context/country-context.tsx`
- Price component: `client/src/components/ui/price.tsx`
- React.memo documentation
