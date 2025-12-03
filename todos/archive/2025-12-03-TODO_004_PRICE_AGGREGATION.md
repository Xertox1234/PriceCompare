# TODO 004: Fix Price Aggregation Service Tests

**Priority**: P2 - Medium
**File**: `server/services/__tests__/price-aggregation-service.test.ts`
**Failures**: 4 tests
**Estimated Time**: 1-2 hours
**Status**: Not Started

## Failing Tests

1. ✗ `should aggregate a date range correctly`
2. ✗ `should continue on failure for individual dates`
3. ✗ `should return correct count of aggregates created`
4. ✗ `should handle invalid date ranges gracefully`

## Error Message

```
Error: this.db.select(...).from(...).limit is not a function
```

## Root Cause

Mock database object doesn't implement complete Drizzle ORM query chain. When tests mock `db`, they don't include all query builder methods.

## Fix Approaches

### Option A: Use Real Test Database (Recommended)

Most reliable approach - use actual test database instead of mocks:

```typescript
import { db } from '../../db';
import { priceAggregates, priceHistory } from '@shared/schema';

describe('Price Aggregation Service', () => {
  beforeEach(async () => {
    // Clean database
    await db.delete(priceAggregates);
    await db.delete(priceHistory);

    // Insert test data
    await db.insert(priceHistory).values([
      {
        productId: 1,
        price: '299.99',
        recordedAt: new Date('2025-01-01'),
      },
      // ... more test data
    ]);
  });

  it('should aggregate a date range correctly', async () => {
    const service = new PriceAggregationService(db);
    const result = await service.aggregateDateRange(
      new Date('2025-01-01'),
      new Date('2025-01-31')
    );

    expect(result.aggregatesCreated).toBe(31);
  });
});
```

### Option B: Complete Mock Chain

If mocking is required, implement full Drizzle query chain:

```typescript
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          offset: vi.fn().mockResolvedValue([/* mock data */])
        })
      })
    })
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue([/* mock data */])
      })
    })
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([])
  })
};
```

## Checklist

- [ ] Read current test file
  ```bash
  code server/services/__tests__/price-aggregation-service.test.ts
  ```

- [ ] Identify how `db` is currently mocked
  ```bash
  grep -n "mock.*db\|vi.mock.*db" server/services/__tests__/price-aggregation-service.test.ts
  ```

- [ ] **Recommended**: Refactor to use real test database
  - [ ] Remove all `db` mocks
  - [ ] Import real `db` from `../../db`
  - [ ] Add `beforeEach` cleanup for test tables
  - [ ] Insert real test data
  - [ ] Run actual aggregation queries

- [ ] **Alternative**: Fix mock chain
  - [ ] Identify all Drizzle methods used
  - [ ] Implement complete mock chain
  - [ ] Add `.limit()` method to mock
  - [ ] Add `.offset()` method if needed
  - [ ] Test mock returns expected data

- [ ] Update test assertions to match real behavior

- [ ] Run tests
  ```bash
  npm test server/services/__tests__/price-aggregation-service.test.ts
  ```

- [ ] Verify tests pass 3 times
  ```bash
  for i in {1..3}; do
    npm test server/services/__tests__/price-aggregation-service.test.ts
  done
  ```

## Common Issues

1. **Incomplete Mock Chain**: Missing methods like `.limit()`, `.offset()`, `.onConflictDoNothing()`
2. **Mock Data Mismatch**: Mock returns wrong data structure
3. **Async Handling**: Mock doesn't return Promise correctly
4. **Service Dependencies**: Service needs other tables (products, offers)

## Success Criteria

- [ ] All 4 tests pass
- [ ] Tests use either real DB or complete mocks
- [ ] Tests are maintainable (favor real DB)
- [ ] Tests run quickly (<2 seconds)
- [ ] No "is not a function" errors

## Estimated Timeline

- Investigation: 20 minutes
- Refactor to real DB: 30-45 minutes
- Test data setup: 15-30 minutes
- Testing & fixes: 20-30 minutes

**Total**: 1-2 hours
