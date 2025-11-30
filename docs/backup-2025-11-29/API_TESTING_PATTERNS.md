# API Testing Patterns

**Last Updated**: 2025-11-28
**Status**: Active Guidelines
**Migration Progress**: 3/15+ test suites migrated (89/90 tests passing - 98.9%)

This document codifies patterns and anti-patterns discovered during the API standardization testing migration. These patterns emerged from real bugs found during testing of alert-routes, retailer-routes, and product-routes test suites.

## Table of Contents

1. [Response Validation Helpers](#response-validation-helpers)
2. [Variable Naming Conflicts](#variable-naming-conflicts)
3. [Test Data Setup](#test-data-setup)
4. [Common Pitfalls](#common-pitfalls)
5. [PostgreSQL Type Handling](#postgresql-type-handling)
6. [Response Consistency](#response-consistency)
7. [Drizzle ORM Issues](#drizzle-orm-issues)
8. [Test Structure](#test-structure)

---

## Response Validation Helpers

### ✅ CORRECT - Use Validation Helpers

**ALL route tests MUST use the standardized validation helpers** from `server/__tests__/helpers/response-validators.ts`:

```typescript
import {
  expectSuccessResponse,
  expectErrorResponse,
} from '../../__tests__/helpers/response-validators';

describe('Product Routes', () => {
  it('should return product details', async () => {
    const response = await request(app).get('/api/products/123');

    // ✅ CORRECT - Use validation helper
    const product = expectSuccessResponse<Product>(response, 200);

    expect(product.id).toBe(123);
    expect(product.name).toBeDefined();
  });

  it('should return 404 for non-existent product', async () => {
    const response = await request(app).get('/api/products/999');

    // ✅ CORRECT - Validate error response
    expectErrorResponse(response, 404, 'Product not found');
  });
});
```

### ❌ WRONG - Manual Response Assertions

```typescript
// ❌ WRONG - Don't manually check response structure
it('should return product details', async () => {
  const response = await request(app).get('/api/products/123');

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);  // Manual envelope check
  expect(response.body.data).toBeDefined();  // Manual data check

  const product = response.body.data;  // Manual extraction
  expect(product.id).toBe(123);
});

// ❌ WRONG - Don't access response.body directly
it('should return products', async () => {
  const response = await request(app).get('/api/products');

  const products = response.body;  // Assumes no envelope
  expect(Array.isArray(products)).toBe(true);
});
```

### Why Validation Helpers Matter

1. **Consistency**: All tests validate the same envelope structure
2. **Type Safety**: Helpers provide proper TypeScript typing
3. **Error Detection**: Catches envelope format bugs immediately
4. **Maintainability**: Single source of truth for validation logic
5. **Future-Proof**: If envelope format changes, update one place

---

## Variable Naming Conflicts

### ❌ CRITICAL MISTAKE - Variable Shadowing

**NEVER use a variable name that shadows a table import**:

```typescript
import { retailers } from '@shared/schema';  // Table import

describe('Retailer Routes', () => {
  it('should return retailers', async () => {
    const response = await request(app).get('/api/retailers');

    // ❌ WRONG - 'retailers' shadows the table import
    const retailers = expectSuccessResponse<Array<Retailer>>(response, 200);

    // This will FAIL - 'retailers' now refers to the response variable!
    await db.insert(retailers).values({  // ERROR: Cannot access before initialization
      name: 'Test Retailer'
    });
  });
});
```

### ✅ CORRECT - Use Distinct Variable Names

```typescript
import { retailers } from '@shared/schema';  // Table import

describe('Retailer Routes', () => {
  it('should return retailers', async () => {
    const response = await request(app).get('/api/retailers');

    // ✅ CORRECT - Use 'result' or 'retailerList' to avoid shadowing
    const result = expectSuccessResponse<Array<Retailer>>(response, 200);

    expect(result.length).toBeGreaterThan(0);

    // ✅ Now db operations work correctly
    await db.insert(retailers).values({
      name: 'Test Retailer'
    });
  });
});
```

### Common Variable Naming Patterns

| Table Import | ❌ Avoid | ✅ Use Instead |
|--------------|----------|----------------|
| `retailers` | `retailers` | `result`, `retailerList`, `data` |
| `products` | `products` | `result`, `productList`, `data` |
| `users` | `users` | `result`, `userList`, `data` |
| `priceAlerts` | `priceAlerts` | `result`, `alerts`, `data` |

### Error Symptoms

If you see these errors, you likely have a variable shadowing issue:

```
ReferenceError: Cannot access 'retailers' before initialization
TypeError: Cannot access 'products' before initialization
ReferenceError: Cannot access 'users2' before initialization
```

---

## Test Data Setup

### ✅ CORRECT - Proper Test Data Lifecycle

```typescript
describe('Product Routes', () => {
  let testProduct: Product;
  let testRetailer: Retailer;

  beforeEach(async () => {
    // Clean database
    await db.delete(products);
    await db.delete(retailers);

    // Create test data
    [testRetailer] = await db.insert(retailers).values({
      name: 'Test Retailer',
      website: 'https://example.com'
    }).returning();

    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description'
    }).returning();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(products);
    await db.delete(retailers);
  });

  it('should return product with offers', async () => {
    // Create test offer
    await db.insert(productOffers).values({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '99.99'
    });

    const response = await request(app).get(`/api/products/${testProduct.id}`);

    const result = expectSuccessResponse<ProductWithOffers>(response, 200);
    expect(result.offers.length).toBe(1);
  });
});
```

### Understanding Active vs. All Records

Some endpoints filter data by default (e.g., only active retailers):

```typescript
// In storage layer
async getRetailers(): Promise<Retailer[]> {
  return await db
    .select()
    .from(retailers)
    .where(eq(retailers.isActive, true))  // ✅ Filters to active only
    .orderBy(asc(retailers.name));
}

// In tests - adjust expectations accordingly
it('should return only active retailers', async () => {
  // Create 3 active + 1 inactive
  await db.insert(retailers).values([
    { name: 'Active 1', isActive: true },
    { name: 'Active 2', isActive: true },
    { name: 'Active 3', isActive: true },
    { name: 'Inactive', isActive: false },  // Won't be returned
  ]);

  const response = await request(app).get('/api/retailers');

  const result = expectSuccessResponse<Array<Retailer>>(response, 200);

  // ✅ CORRECT - Expect only active retailers
  expect(result.length).toBe(3);  // Not 4!

  // Verify all are active
  const allActive = result.every(r => r.isActive === true);
  expect(allActive).toBe(true);

  // Verify inactive not included
  const inactive = result.find(r => r.name === 'Inactive');
  expect(inactive).toBeUndefined();
});
```

---

## Common Pitfalls

### 1. Invalid ID Handling

**Endpoints should return 400 for invalid IDs, not 500**:

```typescript
// In route handler
import { parseIntSafe } from './utils/validation-helpers';

app.get('/api/products/:id', async (req, res) => {
  try {
    // ✅ CORRECT - parseIntSafe throws validation error for invalid input
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

    const product = await storage.getProductById(id);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
  } catch (error) {
    // ✅ Validation errors automatically return 400
    sendErrorFromException(res, error, 'GetProduct');
  }
});

// In tests
it('should return 400 for invalid product ID', async () => {
  const response = await request(app).get('/api/products/invalid');

  // ✅ CORRECT - Expect 400, not 500
  expectErrorResponse(response, 400);
});
```

### 2. 404 vs. Null Checks

**Always check for null/undefined before accessing properties**:

```typescript
// ✅ CORRECT - Proper null checking
app.patch('/api/price-alerts/:id', withAuth(async (req, res) => {
  try {
    const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });
    const updates = req.body;

    const updatedAlert = await storage.updatePriceAlert(alertId, req.user.id, updates);

    // ✅ Check if update succeeded (alert exists and user owns it)
    if (!updatedAlert) {
      sendError(res, 'Alert not found or unauthorized', 404);
      return;
    }

    sendSuccess(res, updatedAlert);
  } catch (error) {
    sendErrorFromException(res, error, 'UpdatePriceAlert');
  }
}));

// In tests
it('should return 404 for non-existent alert', async () => {
  const response = await request(app)
    .patch('/api/price-alerts/99999')
    .send({ isActive: false });

  expectErrorResponse(response, 404, 'Alert not found or unauthorized');
});
```

### 3. Error Message Consistency

**Use consistent, user-friendly error messages**:

```typescript
// ✅ CORRECT - Clear, consistent messages
sendError(res, 'Product not found', 404);
sendError(res, 'Alert not found or unauthorized', 404);
sendError(res, 'Invalid product ID', 400);

// ❌ WRONG - Generic or inconsistent messages
sendError(res, 'Not found', 404);
sendError(res, 'Error', 404);
sendError(res, 'Product with ID 123 does not exist', 404);  // Too verbose
```

---

## PostgreSQL Type Handling

### DECIMAL/NUMERIC Values Return as Strings (CRITICAL)

**Problem Found**: PostgreSQL DECIMAL and NUMERIC values return as strings to preserve precision. TypeScript type assertions (`sql<number>`) only affect compile-time, NOT runtime.

```typescript
// WRONG - Type assertion doesn't convert at runtime!
const products = await db.select({
  id: products.id,
  bestPrice: sql<number>`MIN(${productOffers.price})`  // TypeScript thinks number...
}).from(products);

// bestPrice is actually a STRING "99.99" at runtime!
// This causes test failures:
expect(product.bestPrice).toBeGreaterThanOrEqual(50);  // String comparison!
```

### Correct Pattern - Convert in Storage/Route Layer

```typescript
// In storage or route handler
const products = await db.select({
  id: products.id,
  bestPrice: sql<string>`MIN(${productOffers.price})`  // Acknowledge it's string
}).from(products);

// Convert when building response
return products.map(row => ({
  ...row,
  // Type assertion: PostgreSQL DECIMAL returns string, convert to number for API
  bestPrice: typeof row.bestPrice === 'string' ? parseFloat(row.bestPrice) : row.bestPrice,
}));
```

### Test Pattern for Price Fields

```typescript
it('should filter by price range', async () => {
  const response = await request(app)
    .get('/api/products/search')
    .query({ minPrice: '50', maxPrice: '150' });

  const { data } = expectPaginatedResponse<{ bestPrice: number }>(response, 200);

  // Verify type conversion happened
  data.forEach((product: { bestPrice: number }) => {
    expect(typeof product.bestPrice).toBe('number');  // Verify it's a number, not string
    expect(product.bestPrice).toBeGreaterThanOrEqual(50);
    expect(product.bestPrice).toBeLessThanOrEqual(150);
  });
});
```

### Bug Found in Migration

**File**: `server/storage/domains/product-storage.ts:455`

```typescript
// BEFORE (Bug) - Type assertion only, no conversion
bestPrice: row.bestPrice,  // Returns string "99.99"

// AFTER (Fix) - Runtime conversion
bestPrice: typeof row.bestPrice === 'string' ? parseFloat(row.bestPrice) : row.bestPrice,
```

---

## Response Consistency

### All Code Paths Must Return Same Fields

**Problem Found**: Error/edge case paths often omit fields that success paths return.

```typescript
// WRONG - Inconsistent fields between code paths
app.get('/api/products/:id/price-predictions', async (req, res) => {
  const history = await storage.getPriceHistory(productId);

  if (history.length < 7) {
    sendSuccess(res, {
      predictions: [],
      confidence: 'low',
      message: 'Not enough historical data'  // Missing basePrice!
    });
    return;
  }

  sendSuccess(res, {
    predictions: [...],
    confidence: 'high',
    basePrice: 99.99  // Present in success path
  });
});
```

### Correct Pattern

```typescript
// CORRECT - All paths return consistent structure
app.get('/api/products/:id/price-predictions', async (req, res) => {
  const history = await storage.getPriceHistory(productId);

  if (history.length < 7) {
    const lastPrice = history.length > 0 ? parseFloat(history[history.length - 1].price) : 0;
    sendSuccess(res, {
      predictions: [],
      confidence: 'low',
      basePrice: lastPrice,  // Always include basePrice
      message: 'Not enough historical data'
    });
    return;
  }

  sendSuccess(res, {
    predictions: [...],
    confidence: 'high',
    basePrice: 99.99
  });
});
```

### Empty Object Anti-Pattern

**Never return empty objects `{}`** - always provide meaningful acknowledgment data:

```typescript
// WRONG - No meaningful data for client
app.post('/api/analytics/product-view', async (req, res) => {
  await trackView(req.body.productId);
  sendSuccess(res, {});  // Empty object!
});

// CORRECT - Acknowledge the action
app.post('/api/analytics/product-view', async (req, res) => {
  await trackView(req.body.productId);
  sendSuccess(res, { success: true });  // Meaningful acknowledgment
});
```

### Use Correct Response Helper

**Match the helper to the expected response format**:

```typescript
// WRONG - Using sendSuccess for paginated data
const { products, pagination } = await storage.searchProducts(filters);
sendSuccess(res, products);  // Wrong helper!
// Response: { success: true, data: { products, pagination } }

// CORRECT - Use sendPaginated for paginated data
const { products, pagination } = await storage.searchProducts(filters);
sendPaginated(res, products, pagination);
// Response: { success: true, data: [...], meta: { page, limit, total, totalPages } }
```

### Bugs Found in Migration

1. **File**: `server/routes/product-routes.ts:359` - Missing `basePrice` in insufficient data path
2. **File**: `server/routes/product-routes.ts:425` - Empty object `{}` instead of acknowledgment
3. **File**: `server/routes/product-routes.ts:137-138` - `sendSuccess` instead of `sendPaginated`

---

## Drizzle ORM Issues

### Field Selection Bug (Workaround Required)

**Issue**: Drizzle sometimes throws "Cannot convert undefined or null to object" when using explicit field selection in queries with WHERE clauses.

**Error Symptom**:
```typescript
// ❌ This may fail with Drizzle field selection bug
const alerts = await db
  .select({
    id: priceAlerts.id,
    productId: priceAlerts.productId,
    targetPrice: priceAlerts.targetPrice
  })
  .from(priceAlerts)
  .where(and(
    eq(priceAlerts.userId, userId),
    eq(priceAlerts.isActive, true)
  ));
// Error: Cannot convert undefined or null to object
```

**Workaround**:
```typescript
// ✅ WORKAROUND - Use .select() without field specification
const alerts = await db
  .select()  // No explicit fields
  .from(priceAlerts)
  .where(and(
    eq(priceAlerts.userId, userId),
    eq(priceAlerts.isActive, true)
  ));

// Add comment explaining the workaround
// NOTE: Using .select() without field specification to avoid Drizzle field selection bug
// that causes "Cannot convert undefined or null to object" error
```

**When This Happens**:
- Queries with multiple WHERE conditions using `and()` or `or()`
- Queries with complex joins
- Queries returning arrays that might be empty

**Related Issues**:
- Found in `getUserPriceAlerts()` (server/forum-storage.ts:349-356)
- May affect other similar query patterns

---

## Test Structure

### Recommended Test Organization

```typescript
describe('Route Name - Integration Tests', () => {
  let app: Express;
  let testUser: SafeUser;
  let testProduct: Product;

  beforeEach(async () => {
    // 1. Setup test environment
    process.env.NODE_ENV = 'test';

    // 2. Create fresh Express app
    app = express();
    app.use(express.json());

    // 3. Setup session/auth middleware
    app.use(session({ /* ... */ }));
    app.use(passport.initialize());
    app.use(passport.session());

    // 4. Register routes
    registerRoutes(app);

    // 5. Clean database
    await db.delete(products);
    await db.delete(users);

    // 6. Create test data
    [testUser] = await db.insert(users).values({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: await hash('password123')
    }).returning();

    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description'
    }).returning();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(products);
    await db.delete(users);
  });

  describe('GET /api/endpoint', () => {
    it('should return data successfully', async () => {
      const response = await request(app).get('/api/endpoint');

      const result = expectSuccessResponse<DataType>(response, 200);
      expect(result).toBeDefined();
    });

    it('should return 404 for non-existent resource', async () => {
      const response = await request(app).get('/api/endpoint/999');

      expectErrorResponse(response, 404, 'Resource not found');
    });
  });

  describe('POST /api/endpoint', () => {
    it('should create resource successfully', async () => {
      const response = await request(app)
        .post('/api/endpoint')
        .send({ name: 'New Resource' });

      const result = expectSuccessResponse<Resource>(response, 201);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('New Resource');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/endpoint')
        .send({ invalid: 'data' });

      expectErrorResponse(response, 400);
    });
  });
});
```

### Test Categories

Organize tests into logical groups:

1. **Happy Path** - Valid requests succeed
   ```typescript
   describe('GET /api/products - Happy Path', () => {
     it('should return all products');
     it('should return product by ID');
     it('should include related data');
   });
   ```

2. **Error Handling** - Invalid requests fail gracefully
   ```typescript
   describe('GET /api/products - Error Handling', () => {
     it('should return 404 for non-existent product');
     it('should return 400 for invalid ID');
     it('should return 401 for unauthenticated requests');
   });
   ```

3. **Data Validation** - Response structure is correct
   ```typescript
   describe('GET /api/products - Data Validation', () => {
     it('should return valid product schema');
     it('should not expose sensitive fields');
     it('should handle null values correctly');
   });
   ```

4. **Edge Cases** - Boundary conditions work
   ```typescript
   describe('GET /api/products - Edge Cases', () => {
     it('should return empty array when no products exist');
     it('should handle extremely long product names');
     it('should handle unicode characters');
   });
   ```

5. **Performance & Caching** - Response times are acceptable
   ```typescript
   describe('GET /api/products - Performance', () => {
     it('should respond quickly (< 500ms)');
     it('should set appropriate cache headers');
   });
   ```

---

## Migration Checklist

When migrating a route test file to use validation helpers:

- [ ] Import validation helpers (`expectSuccessResponse`, `expectErrorResponse`)
- [ ] Replace all `response.body` accesses with `expectSuccessResponse()`
- [ ] Check for variable naming conflicts with table imports
- [ ] Verify test expectations match actual endpoint behavior (e.g., active-only filtering)
- [ ] Update error status code expectations (400 for validation, 404 for not found)
- [ ] Add TypeScript types to `expectSuccessResponse<Type>()`
- [ ] Run tests to verify all pass
- [ ] Check for Drizzle field selection bugs if tests fail with "Cannot convert undefined or null to object"

---

## Related Documentation

- `server/__tests__/helpers/response-validators.ts` - Validation helper implementations
- `server/utils/api-response.ts` - API response standardization helpers
- `docs/API_PATTERNS.md` - Complete API design patterns
- `docs/DATABASE_PATTERNS.md` - Database query patterns
- `docs/SECURITY_PATTERNS.md` - Security best practices

---

## Examples from Codebase

### Successful Migrations

1. **product-routes.test.ts** - 42/42 tests passing (100%)
   - Fixed PostgreSQL DECIMAL type conversion (bestPrice string -> number)
   - Fixed response consistency (missing basePrice in edge case)
   - Fixed empty object anti-pattern (analytics endpoint)
   - Fixed wrong response helper (sendSuccess vs sendPaginated)

2. **alert-routes.test.ts** - 29/30 tests passing (96.7%)
   - Discovered Drizzle field selection bug
   - Fixed error message consistency
   - Updated status code expectations (400 vs 500)

3. **retailer-routes.test.ts** - 18/18 tests passing (100%)
   - Fixed variable naming conflicts (retailers shadowing)
   - Adjusted test expectations for active-only filtering
   - Comprehensive edge case coverage

### Production Bugs Fixed During Migration

| Bug | File | Issue | Fix |
|-----|------|-------|-----|
| PostgreSQL DECIMAL | product-storage.ts:455 | Price returned as string | parseFloat() conversion |
| Missing field | product-routes.ts:359 | basePrice missing in error path | Add basePrice to all paths |
| Empty object | product-routes.ts:425 | Returned `{}` | Return `{ success: true }` |
| Wrong helper | product-routes.ts:137 | sendSuccess for paginated | Use sendPaginated |
| **Stale object** | forum-storage.ts:209-219 | postCount=0 after UPDATE | Use .returning() on UPDATE |
| **Slug overflow** | forum-storage.ts:164-171 | 500-char slug for VARCHAR(255) | Truncate with substring() |
| **Retry miss** | retry-with-backoff.ts:75-88 | SERIALIZABLE errors not retried | Check error.cause.code |

### Forum Storage Bugs (2025-11-28)

Three critical bugs discovered during forum-routes test migration:

#### Bug #1: Stale Object Reference in Transactions

**Problem**: `createTopicWithFirstPost()` returned topic with `postCount=0` even though UPDATE set it to 1.

**Root Cause**: The variable captured the INSERT result, then UPDATE modified the DB without capturing the updated values.

**Test That Caught It**:
```typescript
it('should return topic with postCount=1', async () => {
  const result = await storage.createTopicWithFirstPost(topicData, postData);
  expect(result.postCount).toBe(1);  // FAILED: Got 0
});
```

**Fix**: Use `.returning()` on UPDATE and return that result.

#### Bug #2: Long Title/Slug Constraint Violation

**Problem**: Creating topic with 500-char title failed with constraint violation on `slug VARCHAR(255)`.

**Root Cause**: Slug generation had no truncation.

**Test That Caught It**:
```typescript
it('should handle maximum length title', async () => {
  const longTitle = 'a'.repeat(500);
  const result = await storage.createTopicWithFirstPost(
    { title: longTitle, ...otherData },
    postData
  );
  // FAILED: Constraint violation on slug
});
```

**Fix**: Truncate slug to `MAX_SLUG_LENGTH = 250` before INSERT.

#### Bug #3: SERIALIZABLE Retry Not Triggered

**Problem**: SERIALIZABLE transaction conflicts returned 500 instead of being retried.

**Root Cause**: `isTransientDatabaseError()` only checked `error.message`, not `error.cause.code`.

**Test That Caught It**:
```typescript
it('should retry on serialization failure', async () => {
  const error = new Error('db error');
  (error as { cause?: { code: string } }).cause = { code: '40001' };

  expect(isTransientDatabaseError(error)).toBe(true);  // FAILED: Got false
});
```

**Fix**: Check PostgreSQL error codes in `error.cause.code`.

---

### Common Issues Found

1. **Invalid ID handling**: Changed from 500 to 400 status codes
2. **Error messages**: Standardized to "Resource not found or unauthorized"
3. **Variable shadowing**: Fixed ~8 instances of table import conflicts
4. **Active filtering**: Updated test expectations to match endpoint behavior
5. **Drizzle bug**: Workaround for field selection in WHERE clauses
6. **PostgreSQL types**: DECIMAL/NUMERIC return as strings - must convert
7. **Response consistency**: All code paths must return same fields
8. **Empty objects**: Never return `{}` - always provide acknowledgment

---

**Remember**: These patterns emerge from real bugs found during testing migration. Following them prevents repeating the same mistakes.
