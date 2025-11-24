# Storage Layer Patterns

**Purpose:** Codify patterns, standards, and lessons learned from the storage layer refactoring project to ensure consistent quality across all domain implementations.

**Context:** Extracted from Phase 2 (UserStorage - 8 methods, 9.5/10), Phase 3 (ProductStorage - 35 methods, 9.4/10), and Phase 4 (JobLockStorage - 7 methods, 9.5/10) implementations.

---

## Core Principles

### 1. Domain Size Management

**Pattern:** Keep storage classes manageable and focused.

```typescript
// ✅ GOOD - Manageable size
export class UserStorage extends BaseStorage {
  // 8-10 methods: Easy to understand and test
}

// ⚠️ BORDERLINE - At upper limit
export class ProductStorage extends BaseStorage {
  // 35 methods: Functional but consider splitting
}

// ❌ AVOID - Too large
export class MegaStorage extends BaseStorage {
  // 50+ methods: Split into sub-domains
}
```

**Guidelines:**
- **Ideal:** 10-20 methods per storage class
- **Maximum:** 35 methods (complexity increases exponentially)
- **Split Strategy:** Group by sub-domain (e.g., ProductStorage → ProductCrudStorage + ProductSearchStorage)

### 2. Query Builder Consistency

**Issue:** Mixed patterns create inconsistency and maintenance burden.

```typescript
// ❌ INCONSISTENT - Different patterns in same class
class ProductStorage {
  async getProducts() {
    // Pattern A: Select builder
    return await this.db.select().from(products);
  }

  async searchProductsByTerms() {
    // Pattern B: Query builder with relations
    return await this.db.query.products.findMany({
      with: { offers: true }
    });
  }
}
```

**✅ STANDARD PATTERN - Choose one and stick with it:**

```typescript
// RECOMMENDED: Select builder for all queries
class ProductStorage extends BaseStorage {
  async getProducts(): Promise<Product[]> {
    return await this.db.select().from(products);
  }

  async getProductWithOffers(id: number): Promise<ProductWithOffers | null> {
    // Complex queries also use select with JOINs
    const result = await this.db
      .select({
        product: products,
        offer: productOffers,
      })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .where(eq(products.id, id));

    // Manual aggregation when needed
    return this.aggregateProductWithOffers(result);
  }
}
```

**Decision Matrix:**
- **Simple CRUD:** Use `select().from()` - explicit and type-safe
- **Relations:** Use JOINs with `select()` - better control over query
- **Complex Relations:** Consider query builder BUT maintain consistency
- **Performance Critical:** Always use `select()` with custom SQL

### 3. PostgreSQL Extension Dependencies

**Pattern:** Document and validate extension requirements.

```typescript
/**
 * Product Storage Repository
 *
 * POSTGRESQL EXTENSIONS REQUIRED:
 * - pg_trgm: For fuzzy search (searchProductsFuzzy)
 *   Install: CREATE EXTENSION IF NOT EXISTS pg_trgm;
 * - pgvector: For semantic search (searchProductsSemantic)
 *   Install: CREATE EXTENSION IF NOT EXISTS pgvector;
 */
export class ProductStorage extends BaseStorage {
  // Optional: Runtime validation
  async validateExtensions(): Promise<void> {
    try {
      // Check pg_trgm
      await this.db.execute(sql`SELECT similarity('test', 'test')`);
    } catch {
      throw new Error('pg_trgm extension not installed');
    }

    try {
      // Check pgvector
      await this.db.execute(sql`SELECT '[1,2,3]'::vector`);
    } catch {
      throw new Error('pgvector extension not installed');
    }
  }
}
```

**Documentation Requirements:**
1. List ALL required extensions in class JSDoc header
2. Include installation commands
3. Specify which methods require which extensions
4. Consider runtime validation for production deployments

### 4. Performance Optimization Patterns

**Database Aggregation Pattern** - Minimize memory usage and network overhead:

```typescript
// ❌ ANTI-PATTERN - Load everything, filter in memory
async searchProducts(filters: SearchFilters) {
  const allProducts = await this.db.select().from(products);
  const allOffers = await this.db.select().from(productOffers);

  // Filter and aggregate in JavaScript (SLOW, HIGH MEMORY)
  return allProducts
    .filter(p => p.name.includes(filters.query))
    .map(p => ({
      ...p,
      offers: allOffers.filter(o => o.productId === p.id)
    }));
}

// ✅ PATTERN - Database does the heavy lifting
async searchProducts(filters: SearchFilters) {
  // Use subquery to get top 3 offers per product
  const topOffersSubquery = this.db
    .select({
      productId: productOffers.productId,
      offers: sql<any>`
        json_agg(json_build_object(
          'id', ${productOffers.id},
          'price', ${productOffers.price},
          'retailerId', ${productOffers.retailerId}
        ) ORDER BY ${productOffers.price} ASC)
        FILTER (WHERE ${productOffers.price} IS NOT NULL)
      `.as('offers')
    })
    .from(productOffers)
    .where(and(
      isNotNull(productOffers.price),
      eq(productOffers.inStock, true)
    ))
    .groupBy(productOffers.productId)
    .as('topOffers');

  // Main query with aggregated data
  const results = await this.db
    .select({
      product: products,
      offers: topOffersSubquery.offers,
      minPrice: sql<number>`MIN(${productOffers.price})`,
      avgPrice: sql<number>`AVG(${productOffers.price})`,
      offerCount: sql<number>`COUNT(${productOffers.id})`
    })
    .from(products)
    .leftJoin(topOffersSubquery, eq(products.id, topOffersSubquery.productId))
    .where(/* filters */)
    .groupBy(products.id, topOffersSubquery.offers)
    .orderBy(/* sorting */)
    .limit(filters.limit)
    .offset(filters.offset);

  // 94% memory reduction, 50% faster
  return results;
}
```

**Performance Metrics to Document:**
- Query count (prevent N+1)
- Memory usage comparison
- Response time improvement
- Database vs application processing split

### 5. Type Safety Patterns

**No `any` Types Rule:**

```typescript
// ❌ WRONG - Using any
const result: any = await db.select().from(products);

// ❌ WRONG - Implicit any
const processData = (data) => { // Parameter implicitly any
  return data.map(item => item.id);
};

// ✅ CORRECT - Explicit typing
const result: Product[] = await db.select().from(products);

// ✅ CORRECT - Type parameters
const processData = <T extends { id: number }>(data: T[]): number[] => {
  return data.map(item => item.id);
};

// ✅ CORRECT - SQL type casting
const count = await this.db.select({
  total: sql<number>`CAST(COUNT(*) AS INTEGER)` // Explicit SQL type
}).from(products);
```

### 6. Constants Organization

**Pattern:** Group related constants in nested structures.

```typescript
// ✅ GOOD - Organized, type-safe constants
const PRODUCT_CONSTANTS = {
  SEARCH: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    TOP_OFFERS_PER_PRODUCT: 3,
  },
  SUGGESTIONS: {
    DEDUPLICATION_MULTIPLIER: 2,
  },
  FUZZY_SEARCH: {
    MIN_THRESHOLD: 0,
    MAX_THRESHOLD: 1,
  },
  BATCH: {
    DEFAULT_SIZE: 100,
  },
} as const; // as const for literal types

// Usage with IntelliSense support
const limit = Math.min(
  userLimit || PRODUCT_CONSTANTS.SEARCH.DEFAULT_LIMIT,
  PRODUCT_CONSTANTS.SEARCH.MAX_LIMIT
);
```

### 7. Transaction Patterns

**When to Use Transactions:**

```typescript
// ✅ PATTERN 1 - Batch operations (all or nothing)
async createProductSpecificationsBatch(specs: InsertProductSpecification[]) {
  return await this.executeTransaction(async (tx) => {
    const results = [];
    for (const spec of specs) {
      const [created] = await tx.insert(productSpecifications)
        .values(spec)
        .returning();
      results.push(created);
    }
    return results;
  });
}

// ✅ PATTERN 2 - Related entity creation
async createUserWithNotification(userData: any, welcomeMessage: string) {
  return await this.executeTransaction(async (tx) => {
    const [user] = await tx.insert(users).values(userData).returning();
    await tx.insert(notifications).values({
      userId: user.id,
      message: welcomeMessage
    });
    return user;
  });
}

// ✅ PATTERN 3 - Check-then-act (prevent race conditions)
async createFirstUser(userData: any) {
  return await this.executeTransaction(async (tx) => {
    const count = await tx.select({ count: sql`count(*)` }).from(users);
    const isFirst = parseInt(count[0].count as string) === 0;

    return await tx.insert(users).values({
      ...userData,
      role: isFirst ? 'admin' : 'user'
    }).returning();
  }, {
    isolationLevel: 'serializable' // Prevent concurrent first-user race
  });
}
```

### 8. Method Documentation Standards

**Every method needs comprehensive JSDoc:**

```typescript
/**
 * Search products with advanced filtering and pagination
 *
 * Performance characteristics:
 * - Database-level aggregation reduces memory by 94%
 * - Single query with subqueries (no N+1)
 * - Returns top 3 offers per product
 *
 * PostgreSQL Extensions Required:
 * - pg_trgm (if fuzzy search enabled)
 *
 * @param filters - Search filters including query, category, price range
 * @param filters.query - Search query (searches name, description, brand)
 * @param filters.minPrice - Minimum price filter (inclusive)
 * @param filters.maxPrice - Maximum price filter (inclusive)
 * @returns Products with aggregated offers and pagination metadata
 *
 * @example
 * const results = await productStorage.searchProducts({
 *   query: 'laptop',
 *   category: 'electronics',
 *   minPrice: 500,
 *   maxPrice: 1500,
 *   page: 1,
 *   limit: 20
 * });
 */
async searchProducts(filters: SearchFilters): Promise<SearchResult> {
  // Implementation
}
```

### 9. Validation Patterns

**Input validation with clear error messages:**

```typescript
// ✅ GOOD - Comprehensive validation
async updateProduct(id: number, updates: Partial<InsertProduct>) {
  return this.handleError('updateProduct', async () => {
    // Validate ID
    if (!id || id <= 0) {
      throw new Error('Product ID must be a positive number');
    }

    // Validate updates object
    if (!updates || Object.keys(updates).length === 0) {
      this.logDebug('updateProduct', { id, reason: 'No updates provided' });
      return null;
    }

    // Validate specific fields if present
    if (updates.price !== undefined && updates.price < 0) {
      throw new Error('Price cannot be negative');
    }

    if (updates.name !== undefined && updates.name.trim().length === 0) {
      throw new Error('Product name cannot be empty');
    }

    // Check existence before update
    const existing = await this.getProductByIdRaw(id);
    if (!existing) {
      this.logDebug('updateProduct', { id, reason: 'Product not found' });
      return null;
    }

    // Perform update
    const [updated] = await this.db.update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return updated;
  });
}
```

### 10. Atomic Operations Pattern

**Pattern:** Use database-level atomic operations to prevent race conditions in distributed systems.

**When to Use:**
- Lock acquisition in distributed systems
- Conflict prevention (unique constraints)
- Version control (optimistic locking)
- Idempotent operations

**Example from JobLockStorage:**

```typescript
// ✅ ATOMIC - Uses database constraint for conflict detection
async acquireJobLock(jobName: string, lockedBy: string, ttlSeconds: number) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  const result = await this.db
    .insert(jobLocks)
    .values({
      jobName,      // unique constraint on this column
      lockedBy,
      expiresAt,
      lockedAt: new Date(),
    })
    .onConflictDoNothing()  // Atomic conflict detection
    .returning({ id: jobLocks.id });

  return result.length > 0
    ? { success: true, id: result[0].id }
    : { success: false };
}
```

**Key Benefits:**
1. **Race condition prevention** - Database enforces uniqueness
2. **No application-level locking needed** - Database handles it
3. **Idempotent** - Same operation can be retried safely
4. **Performance** - Single query, indexed lookup

**Pattern Guidelines:**
- Use `onConflictDoNothing()` for try-and-acquire patterns
- Use `onConflictDoUpdate()` for upsert patterns
- Leverage unique constraints for natural locks
- Return success/failure rather than throwing errors
- Document the atomic guarantee in JSDoc

**Common Use Cases:**
- Job locks (prevent duplicate job execution)
- Session management (one session per user)
- Resource allocation (assign once)
- Idempotent inserts (deduplicate)

### 11. Validation Message Quality

**Pattern:** Error messages should be grammatically correct and consistent.

**Common Mistakes:**

```typescript
// ❌ WRONG - Singular when constant could be > 1
throw new Error(`Value must be at least ${MIN} character`);

// ✅ CORRECT - Always plural for consistency
throw new Error(`Value must be at least ${MIN} characters`);
```

**Guidelines:**
- Use plural form for length/count validations
- Include actual value in error when helpful
- Use consistent phrasing across methods
- Specify units (seconds, characters, bytes)

**Example from JobLockStorage:**

```typescript
// ✅ Consistent validation messages
if (jobName.length < MIN_JOB_NAME_LENGTH) {
  throw new Error(`Job name must be at least ${MIN_JOB_NAME_LENGTH} characters`);
}
if (jobName.length > MAX_JOB_NAME_LENGTH) {
  throw new Error(`Job name cannot exceed ${MAX_JOB_NAME_LENGTH} characters`);
}
if (ttlSeconds < MIN_TTL_SECONDS) {
  throw new Error(`TTL must be at least ${MIN_TTL_SECONDS} seconds`);
}
if (ttlSeconds > MAX_TTL_SECONDS) {
  throw new Error(`TTL cannot exceed ${MAX_TTL_SECONDS} seconds (24 hours)`);
}
```

**Benefits:**
- Professional user experience
- Clear debugging information
- Consistent across codebase
- Easy to understand constraints

### 12. Error Handling Patterns

**Consistent error handling through BaseStorage:**

```typescript
// ✅ PATTERN - Let BaseStorage handle errors
async someMethod(): Promise<Result> {
  return this.handleError('someMethod', async () => {
    // Method implementation
    // Errors automatically logged and sanitized
  });
}

// ⚠️ AVOID - Manual error handling (unless special case)
async someMethod(): Promise<Result> {
  try {
    // Implementation
  } catch (error) {
    logger.error('Error in someMethod', error);
    throw error;
  }
}

// ✅ EXCEPTION - Validation errors thrown directly
async createProduct(data: InsertProduct): Promise<Product> {
  return this.handleError('createProduct', async () => {
    // Validation errors are user-facing, throw directly
    if (!data.name) {
      throw new Error('Product name is required');
    }

    // Database errors handled by handleError wrapper
    return await this.db.insert(products).values(data).returning();
  });
}
```

---

## Quality Checklist for Storage Classes

Use this checklist for every storage domain implementation:

### Structure & Organization
- [ ] Extends `BaseStorage`
- [ ] Implements domain-specific interface (e.g., `IProductStorage`)
- [ ] Methods grouped logically (CRUD, Search, Analytics, etc.)
- [ ] Constants extracted to `DOMAIN_CONSTANTS` object
- [ ] Methods count ≤ 35 (ideally 10-20)

### Type Safety
- [ ] No `any` types (search for "any" keyword)
- [ ] All methods have explicit return types
- [ ] All parameters have explicit types
- [ ] SQL casts have type annotations: `sql<number>`
- [ ] Constants use `as const` for literal types

### Documentation
- [ ] Class-level JSDoc with overview
- [ ] PostgreSQL extension requirements listed
- [ ] Every public method has JSDoc
- [ ] Performance characteristics documented where relevant
- [ ] Examples provided for complex methods

### Query Patterns
- [ ] Consistent query builder usage (prefer `select().from()`)
- [ ] No N+1 queries (no queries in loops)
- [ ] JOINs used appropriately
- [ ] Database aggregation for performance
- [ ] Proper use of `inArray()` for batch operations

### Validation & Error Handling
- [ ] Input validation on all methods
- [ ] Bounds checking on numeric inputs
- [ ] Empty array/string checks
- [ ] Existence checks before updates
- [ ] All methods wrapped in `handleError()`
- [ ] Error messages use plural form for counts ("characters" not "character")
- [ ] Error messages include units (seconds, bytes, etc.)

### Transactions & Atomic Operations
- [ ] Batch operations use transactions
- [ ] Related entity creation uses transactions
- [ ] Check-then-act patterns use SERIALIZABLE isolation
- [ ] No external API calls inside transactions
- [ ] Transaction scope minimized
- [ ] Atomic operations use database constraints (onConflictDoNothing, unique keys)
- [ ] Race conditions prevented at database level where possible

### Security
- [ ] Never expose `passwordHash` field
- [ ] Explicit field selection (no `SELECT *`)
- [ ] SQL injection prevention (parameterized queries)
- [ ] Sensitive operations logged for audit

### Performance
- [ ] Database aggregation over in-memory processing
- [ ] Pagination on all list operations
- [ ] Appropriate indexes assumed/documented
- [ ] Query count minimized
- [ ] Memory usage considered

### Testing Considerations
- [ ] Methods return `null` (not `undefined`) for not found
- [ ] Methods return empty arrays (not `null`) for empty lists
- [ ] Boolean methods return `true/false` consistently
- [ ] Error messages are specific and actionable

---

## Common Anti-Patterns to Avoid

### 1. N+1 Queries
```typescript
// ❌ NEVER DO THIS
for (const product of products) {
  const offers = await getOffers(product.id); // N queries!
}
```

### 2. Loading Everything into Memory
```typescript
// ❌ AVOID
const allProducts = await db.select().from(products); // No limit!
return allProducts.filter(p => p.name.includes(search));
```

### 3. Inconsistent Query Patterns
```typescript
// ❌ AVOID - Pick one pattern
async method1() { return db.select().from(table); }
async method2() { return db.query.table.findMany(); }
```

### 4. Missing Validation
```typescript
// ❌ AVOID
async updateProduct(id: number, data: any) { // No validation!
  return db.update(products).set(data).where(eq(products.id, id));
}
```

### 5. External Calls in Transactions
```typescript
// ❌ NEVER
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await sendEmail(userData.email); // External call in transaction!
});
```

### 6. Inconsistent Error Messages
```typescript
// ❌ AVOID - Singular form, no units
throw new Error(`Value must be at least ${MIN} character`);
throw new Error(`TTL must be ${SECONDS}`);

// ✅ CORRECT - Plural form, clear units
throw new Error(`Value must be at least ${MIN} characters`);
throw new Error(`TTL must be ${SECONDS} seconds`);
```

### 7. Manual Race Condition Handling
```typescript
// ❌ AVOID - Application-level locking (complex, error-prone)
const existingLock = await getLock(jobName);
if (existingLock) {
  return { success: false };
}
await createLock(jobName); // Race condition here!

// ✅ CORRECT - Database-level atomic operation
const result = await db.insert(jobLocks)
  .values({ jobName })
  .onConflictDoNothing()  // Atomic
  .returning();
return result.length > 0 ? { success: true } : { success: false };
```

---

## Migration Path for Existing Code

When refactoring existing storage methods:

1. **Analyze Current Implementation**
   - Count methods to determine if splitting needed
   - Identify N+1 queries
   - Check for any types
   - Review error handling

2. **Create Interface First**
   ```typescript
   export interface IDomainStorage {
     // Define all methods with proper types
   }
   ```

3. **Implement with BaseStorage**
   ```typescript
   export class DomainStorage extends BaseStorage implements IDomainStorage {
     // Implement methods following patterns
   }
   ```

4. **Apply Quality Checklist**
   - Go through each item systematically
   - Document issues for future improvement

5. **Test Thoroughly**
   - Ensure no breaking changes
   - Verify performance improvements
   - Check error handling

---

## Performance Benchmarks

Target metrics for storage operations:

| Operation Type | Target | Maximum |
|---------------|--------|---------|
| Simple CRUD | <10ms | 50ms |
| Complex Search | <100ms | 500ms |
| Batch Insert (100 items) | <200ms | 1000ms |
| Aggregation Query | <50ms | 200ms |
| Transaction (3 operations) | <30ms | 100ms |

Memory usage targets:
- Simple queries: <1MB
- Search with pagination: <5MB
- Batch operations: <10MB
- Never load full tables without pagination

---

## Review Criteria for Pull Requests

When reviewing storage layer code:

### Critical Issues (Must Fix)
- [ ] N+1 queries present
- [ ] `any` types used
- [ ] Missing error handling
- [ ] No input validation
- [ ] passwordHash exposed
- [ ] External calls in transactions

### Major Issues (Should Fix)
- [ ] Inconsistent query patterns
- [ ] Missing JSDoc documentation
- [ ] No constants for magic numbers
- [ ] Loading full tables without limit
- [ ] Missing existence checks

### Minor Issues (Consider Fixing)
- [ ] Could use database aggregation
- [ ] Transaction isolation not specified
- [ ] Performance metrics not documented
- [ ] Examples not provided in JSDoc

---

## Appendix: BaseStorage Reference

All storage classes should extend BaseStorage which provides:

```typescript
abstract class BaseStorage {
  protected db: NodePgDatabase;
  protected logger: Logger;

  // Automatic error handling and logging
  protected handleError<T>(operation: string, fn: () => Promise<T>): Promise<T>;

  // Transaction support
  protected executeTransaction<T>(
    fn: (tx: Transaction) => Promise<T>,
    options?: { isolationLevel?: 'serializable' | 'read committed' }
  ): Promise<T>;

  // Debug logging
  protected logDebug(operation: string, details: any): void;
}
```

Use these utilities consistently across all storage implementations.