# TODO 006: Fix Product Routes Discussion Count Tests

**Priority**: P2 - Medium
**File**: `server/routes/__tests__/product-routes.test.ts`
**Failures**: 2 tests
**Estimated Time**: 1 hour
**Status**: Not Started

## Failing Tests

1. ✗ `should include discussion count in results`
2. ✗ `should include discussion count`

## Root Cause

Product queries don't include `discussionCount` field that tests expect. Need to add LEFT JOIN to comments/discussions table and count records.

## Fix Strategy

Add discussion count to product queries using LEFT JOIN and aggregate.

### Step 1: Identify Where to Fix

- [ ] Check if storage layer or route handles query
  ```bash
  grep -n "getProduct\|searchProducts" server/routes/product-routes.ts
  grep -n "getProduct\|searchProducts" server/storage/domains/product-storage.ts
  ```

### Step 2: Add Discussion Count Query

**Option A: In Storage Layer** (recommended)

```typescript
// server/storage/domains/product-storage.ts
import { discussions } from '@shared/schema'; // or comments, depending on schema

async getProductById(productId: number) {
  const result = await this.db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      imageUrl: products.imageUrl,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      // Add discussion count
      discussionCount: sql<number>`
        COUNT(DISTINCT ${discussions.id})::int
      `.as('discussion_count'),
    })
    .from(products)
    .leftJoin(discussions, eq(discussions.productId, products.id))
    .where(eq(products.id, productId))
    .groupBy(products.id)
    .limit(1);

  return result[0] || null;
}

async searchProducts(query: string, options?: SearchOptions) {
  return await this.db
    .select({
      ...products,
      discussionCount: sql<number>`
        COUNT(DISTINCT ${discussions.id})::int
      `.as('discussion_count'),
    })
    .from(products)
    .leftJoin(discussions, eq(discussions.productId, products.id))
    .where(ilike(products.name, `%${query}%`))
    .groupBy(products.id)
    .limit(options?.limit || 20)
    .offset(options?.offset || 0);
}
```

**Option B: In Route** (if not using storage layer)

```typescript
// server/routes/product-routes.ts
import { discussions } from '@shared/schema';

app.get('/api/products/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

  const result = await db
    .select({
      ...products,
      discussionCount: sql<number>`COUNT(${discussions.id})::int`,
    })
    .from(products)
    .leftJoin(discussions, eq(discussions.productId, products.id))
    .where(eq(products.id, id))
    .groupBy(products.id);

  if (result.length === 0) {
    return sendError(res, 'Product not found', 404);
  }

  sendSuccess(res, result[0]);
});
```

### Step 3: Update TypeScript Types

```typescript
// shared/schema.ts or types file
export interface ProductWithDiscussions extends Product {
  discussionCount: number;
}
```

## Checklist

- [ ] Find product query methods
  ```bash
  grep -rn "getProductById\|searchProducts" server/storage/
  grep -rn "GET.*products\|/api/products" server/routes/product-routes.ts
  ```

- [ ] Check if `discussions` or `comments` table exists
  ```bash
  grep -n "discussions\|comments.*Table" shared/schema.ts
  ```

- [ ] Add LEFT JOIN to discussions table

- [ ] Add COUNT aggregate for discussionCount

- [ ] Add GROUP BY for products.id

- [ ] Update TypeScript types

- [ ] Test query manually
  ```sql
  SELECT
    p.*,
    COUNT(d.id) as discussion_count
  FROM products p
  LEFT JOIN discussions d ON d.product_id = p.id
  GROUP BY p.id;
  ```

- [ ] Run tests
  ```bash
  npm test server/routes/__tests__/product-routes.test.ts -- -t "discussion count"
  ```

- [ ] Run full product tests
  ```bash
  npm test server/routes/__tests__/product-routes.test.ts
  ```

- [ ] Verify performance (add index if needed)
  ```sql
  CREATE INDEX IF NOT EXISTS idx_discussions_product_id
  ON discussions(product_id);
  ```

## Common Issues

1. **Table Name**: Might be `comments` not `discussions`
2. **Missing GROUP BY**: Aggregate requires GROUP BY
3. **Wrong Alias**: Use `.as('discussion_count')` for SQL alias
4. **Type Mismatch**: Cast to `::int` for PostgreSQL
5. **Performance**: May need index on `discussions.product_id`

## Success Criteria

- [ ] Both tests pass
- [ ] `discussionCount` field present in responses
- [ ] Count is accurate (matches manual query)
- [ ] Query performance <100ms
- [ ] Works with 0 discussions (returns 0, not null)

## Estimated Timeline

- Investigation: 15 minutes
- Implementation: 20 minutes
- Type updates: 10 minutes
- Testing: 15 minutes

**Total**: ~1 hour
