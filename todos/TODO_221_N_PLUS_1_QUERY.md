# TODO 221: N+1 Query in Product List Endpoint

**Priority**: P2 - MEDIUM
**File(s)**: `server/product-routes.ts`, `server/storage.ts`
**Estimated Time**: 45 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Product list endpoint fetches offers in a loop instead of using JOIN, causing N+1 query problem:
- 1 query to fetch products
- N queries to fetch offers (one per product)

For 20 products, this means 21 database queries instead of 1.

**Performance Impact**:
- API latency scales linearly with page size
- Database connection pool exhaustion under load
- Poor user experience on product listing pages

## Root Cause

Using `Promise.all()` with individual queries per product instead of a single JOIN query.

## Solution Approach

1. Replace loop queries with single JOIN query
2. Group results in application code
3. Ensure pagination works correctly with JOINs

## Implementation Steps

### Step 1: Identify N+1 Patterns

- [ ] Search for `Promise.all` with map over entities
- [ ] Search for queries inside loops
- [ ] Document all N+1 instances

### Step 2: Fix Product List Endpoint

- [ ] Replace loop with LEFT JOIN query
- [ ] Include retailer data in same query
- [ ] Group results by product in application code

### Step 3: Fix Other N+1 Patterns

- [ ] Review other list endpoints
- [ ] Apply same JOIN pattern where applicable

### Step 4: Add Tests

- [ ] Test correct data returned with JOIN
- [ ] Test pagination works correctly
- [ ] Monitor query count in tests

## Technical Details

**Current Implementation (N+1 QUERY):**
```typescript
app.get('/api/products', async (req, res) => {
  const products = await db.select().from(products).limit(20);
  
  // ❌ N+1: One query per product!
  const productsWithOffers = await Promise.all(
    products.map(async (product) => {
      const offers = await db.select().from(productOffers)
        .where(eq(productOffers.productId, product.id));
      return { ...product, offers };
    })
  );
  
  res.json(productsWithOffers);
});
```

**Fixed Implementation (SINGLE JOIN):**
```typescript
import { eq, desc, sql } from 'drizzle-orm';

app.get('/api/products', async (req, res) => {
  const page = parseIntOptional(req.query.page, 'page', { min: 1 }) ?? 1;
  const limit = parseIntOptional(req.query.limit, 'limit', { min: 1, max: 100 }) ?? 20;
  const offset = (page - 1) * limit;
  
  // ✅ Single query with LEFT JOIN
  const rows = await db
    .select({
      product: products,
      offer: productOffers,
      retailer: retailers,
    })
    .from(products)
    .leftJoin(productOffers, eq(products.id, productOffers.productId))
    .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
    .orderBy(desc(products.createdAt))
    .limit(limit * 10) // Fetch extra to account for multiple offers per product
    .offset(offset);
  
  // ✅ Group results by product in application code
  const grouped = groupByProduct(rows);
  
  // ✅ Apply limit after grouping
  const paginated = grouped.slice(0, limit);
  
  res.json({
    products: paginated,
    page,
    limit,
    hasMore: grouped.length > limit,
  });
});

interface ProductRow {
  product: Product;
  offer: ProductOffer | null;
  retailer: Retailer | null;
}

interface ProductWithOffers extends Product {
  offers: Array<ProductOffer & { retailer: Retailer | null }>;
}

function groupByProduct(rows: ProductRow[]): ProductWithOffers[] {
  const productMap = new Map<number, ProductWithOffers>();
  
  for (const row of rows) {
    if (!productMap.has(row.product.id)) {
      productMap.set(row.product.id, {
        ...row.product,
        offers: [],
      });
    }
    
    if (row.offer) {
      productMap.get(row.product.id)!.offers.push({
        ...row.offer,
        retailer: row.retailer,
      });
    }
  }
  
  return Array.from(productMap.values());
}
```

**Alternative: Batch Query with IN Clause:**
```typescript
// When you need more control over offer fetching
app.get('/api/products', async (req, res) => {
  // Query 1: Get products
  const productList = await db
    .select()
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(limit)
    .offset(offset);
  
  if (productList.length === 0) {
    return res.json({ products: [], page, limit });
  }
  
  // Query 2: Batch fetch all offers for these products (1 query, not N)
  const productIds = productList.map(p => p.id);
  const allOffers = await db
    .select({
      offer: productOffers,
      retailer: retailers,
    })
    .from(productOffers)
    .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
    .where(inArray(productOffers.productId, productIds));
  
  // Group offers by productId
  const offersByProductId = new Map<number, typeof allOffers>();
  for (const row of allOffers) {
    const pid = row.offer.productId;
    if (!offersByProductId.has(pid)) {
      offersByProductId.set(pid, []);
    }
    offersByProductId.get(pid)!.push(row);
  }
  
  // Combine products with their offers
  const productsWithOffers = productList.map(product => ({
    ...product,
    offers: offersByProductId.get(product.id) ?? [],
  }));
  
  res.json({ products: productsWithOffers, page, limit });
});
```

**Using array_agg() for Nested Data:**
```typescript
// Most efficient for complex nested structures
const productsWithOffers = await db.execute(sql`
  SELECT 
    p.*,
    COALESCE(
      json_agg(
        json_build_object(
          'id', po.id,
          'price', po.price,
          'url', po.url,
          'retailer', json_build_object('id', r.id, 'name', r.name)
        )
      ) FILTER (WHERE po.id IS NOT NULL),
      '[]'
    ) as offers
  FROM products p
  LEFT JOIN product_offers po ON p.id = po.product_id
  LEFT JOIN retailers r ON po.retailer_id = r.id
  GROUP BY p.id
  ORDER BY p.created_at DESC
  LIMIT ${limit}
  OFFSET ${offset}
`);
```

## Checklist

- [ ] N+1 patterns identified in codebase
- [ ] Product list uses JOIN instead of loop
- [ ] Results correctly grouped by product
- [ ] Pagination works correctly
- [ ] Other N+1 patterns fixed

## Success Criteria

- [ ] Product list endpoint makes 1-2 queries (not N+1)
- [ ] Response data structure unchanged
- [ ] API latency significantly reduced
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| JOIN returns too many rows | Medium | Low | Limit and paginate at database level |
| Complex grouping logic bugs | Medium | Medium | Comprehensive tests for edge cases |
| Response structure changes | Low | Low | Verify API contract unchanged |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm N+1 patterns removed
  ```bash
  # Search for potential N+1 patterns (should be minimal)
  grep -rn "Promise.all.*map.*await db" server/
  
  # Verify JOINs are used
  grep -rn "leftJoin\|innerJoin" server/product-routes.ts
  ```

- [ ] **File inspection**: Review product list endpoint
  ```bash
  grep -A 30 "'/api/products'" server/product-routes.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute product route tests
  ```bash
  npm test -- product
  ```

- [ ] **Query count verification**: Enable query logging and verify
  ```bash
  # Set DEBUG=drizzle:* and check logs show 1-2 queries for product list
  DEBUG=drizzle:* npm run dev
  curl http://localhost:5000/api/products
  # Logs should show 1-2 queries, not 21+
  ```

### Performance Verification
- [ ] **Latency comparison**: Measure before/after
  ```bash
  # Before fix
  time curl http://localhost:5000/api/products
  
  # After fix (should be significantly faster)
  time curl http://localhost:5000/api/products
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
