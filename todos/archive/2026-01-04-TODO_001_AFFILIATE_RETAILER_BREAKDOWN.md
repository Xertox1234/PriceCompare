# TODO 001: Add Retailer Breakdown to Affiliate Agent

**Priority**: P3
**File(s)**: `server/agents/affiliate-agent.ts`
**Line**: 350
**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

The affiliate agent's metrics currently has a placeholder for retailer breakdown that returns an empty object:

```typescript
byRetailer: {} as Record<string, number>, // TODO: Add retailer breakdown
```

This means affiliate performance metrics cannot be segmented by retailer.

## Root Cause

Feature was not prioritized during initial implementation.

## Solution Approach

Implement retailer-level aggregation for affiliate link tracking metrics.

## Implementation Steps

### Step 1: Update Storage Layer

- [ ] Add method to aggregate affiliate clicks by retailer
- [ ] Add method to aggregate affiliate conversions by retailer

### Step 2: Update Affiliate Agent

- [ ] Populate `byRetailer` with actual retailer breakdown data
- [ ] Ensure efficient query (single aggregation, not N+1)

### Step 3: Add Tests

- [ ] Unit tests for retailer breakdown calculation
- [ ] Verify aggregation accuracy

## Technical Details

```typescript
// Expected output format
byRetailer: {
  'Amazon': 150,
  'Best Buy': 75,
  'Walmart': 45
}
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
- [ ] No performance regression (use GROUP BY, not loops)

## Success Criteria

- [ ] `byRetailer` returns actual breakdown data
- [ ] All existing affiliate agent tests pass
- [ ] New tests cover retailer breakdown
