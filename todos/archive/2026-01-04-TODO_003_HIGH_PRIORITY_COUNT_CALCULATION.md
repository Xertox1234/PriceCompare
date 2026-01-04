# TODO 003: Calculate highPriorityCount from Product Watches

**Priority**: P2
**File(s)**: `client/src/hooks/use-community.ts`
**Line**: 593
**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

The community hook returns a hardcoded `0` for high priority watch count:

```typescript
highPriorityCount: 0, // TODO: Calculate from product watches
```

This means the UI cannot display accurate counts of high-priority watched products.

## Root Cause

Placeholder value added during initial implementation, calculation logic was not prioritized.

## Solution Approach

Calculate actual high-priority count based on product watch criteria (e.g., price drop threshold, user-defined priority).

## Implementation Steps

### Step 1: Define High Priority Criteria

- [ ] Determine what makes a watch "high priority"
  - Options: user-set flag, significant price drop, near target price, etc.
- [ ] Document criteria in code comments

### Step 2: Update API (if needed)

- [ ] Add endpoint or extend existing endpoint to return priority counts
- [ ] Or calculate client-side if data is already available

### Step 3: Update Hook

- [ ] Replace hardcoded `0` with actual calculation
- [ ] Ensure efficient computation (avoid N+1 patterns)

### Step 4: Add Tests

- [ ] Test priority calculation logic
- [ ] Test edge cases (no watches, all high priority, etc.)

## Technical Details

```typescript
// Option A: Calculate from existing watch data
const highPriorityCount = watches.filter(w => 
  w.priority === 'high' || 
  (w.currentPrice && w.targetPrice && w.currentPrice <= w.targetPrice)
).length;

// Option B: Request from API
const { data } = useQuery({
  queryKey: ['watch-stats'],
  queryFn: () => api.get('/api/watchlists/stats')
});
const highPriorityCount = data?.highPriorityCount ?? 0;
```

## Checklist

- [ ] High priority criteria defined
- [ ] Calculation implemented
- [ ] Tests added
- [ ] UI displays accurate count

## Success Criteria

- [ ] `highPriorityCount` reflects actual data
- [ ] Performance acceptable (no excessive recalculations)
- [ ] Tests validate calculation logic
