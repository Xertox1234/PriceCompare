# Database Patterns & Anti-Patterns

**Version:** 2.10
**Last Updated:** 2025-12-26
**Changelog:**
- 2.10 (2025-12-26): Added 4 transaction boundary patterns from TODO 004 (transaction-aware error handling, row count validation, interface passthrough, inline vs abstraction trade-off)
- 2.9 (2025-12-24): Added agent storage layer patterns (find-or-create with metadata, upsert, bulk operations, historical optimization)
- 2.8 (2025-12-23): Expanded storage layer ID validation pattern with code examples from Feature 3.3
- 2.7 (2025-12-23): Added verification commands and migration pattern to Foreign Key Cascade Rules section
- 2.6 (2025-12-23): Added storage layer ID validation pattern

**Migrated From:**
- `docs/DATABASE_PATTERNS.md` (v1.0)
- `.claude/knowledge/storage-refactoring-patterns.md`
- `.claude/knowledge/phase-8-storage-migration-patterns.md`
- `.claude/knowledge/storage-review-patterns.md`
- `docs/PHASE0_WATCHLIST_PATTERNS.md` (NULL-safe constraints)
- `docs/PHASE1_WATCHLIST_PATTERNS.md` (pagination/sorting)

**Maintainer:** Claude Code / Development Team
**Status:** Active
**Related Patterns:** [SECURITY_PATTERNS.md, API_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md, ERROR_HANDLING_PATTERNS.md]
**Related Learnings:** [LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md (test fixture security markers), LEARNINGS_TODO_001_REDIS_SIMPLIFICATION.md (Redis-native patterns), LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md (UTC date handling)]

---

## Table of Contents

1. [Storage Layer Architecture](#1-storage-layer-architecture)
2. [Critical Anti-Patterns (COMMIT BLOCKERS)](#2-critical-anti-patterns-commit-blockers)
3. [Query Optimization](#3-query-optimization)
4. [Transaction Patterns](#4-transaction-patterns)
5. [Schema Design Patterns](#5-schema-design-patterns)
   - 5.1 [Foreign Key Cascade Rules](#51-foreign-key-cascade-rules-mandatory)
   - 5.2 [NULL-Safe UNIQUE Constraints](#52-null-safe-unique-constraints-phase-0-pattern)
   - 5.3 [Timestamp vs Timestamptz](#53-timestamp-vs-timestamptz-critical)
   - 5.4 [Application-Layer UTC Date Handling (NEW)](#54-application-layer-utc-date-handling-new---2025-12-09)
6. [Type Safety in Queries](#6-type-safety-in-queries)
7. [Production Bugs Catalog](#7-production-bugs-catalog)
8. [Migration Patterns](#8-migration-patterns)
9. [Redis-Native Patterns](#9-redis-native-patterns-new---2025-12-05)

---

## 1. Storage Layer Architecture

**Status:** MANDATORY as of Phase 8 completion (2025-11-27)
**Compliance:** 100% (5/5 services migrated, 43/43 db operations abstracted)

### Overview

All database access MUST flow through the storage layer abstraction. Services should NEVER import `db` directly.

**Correct Architecture:**
```
Route → Service → Storage → Database
```

**Migration Status:**
- ✅ 5/5 services migrated (100%)
- ✅ 43/43 database operations abstracted
- ✅ 40+ storage methods created
- ❌ 1 documented exception: `price-aggregation-service.ts`

### ❌ ANTI-PATTERN: Direct Database Access in Services

```typescript
// ❌ WRONG - Service imports db directly
import { db } from "../db";
import { products } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function getProduct(id: number) {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return product;
}
```

**Problems:**
- Mixed concerns (business logic + data access)
- Difficult to test (requires database)
- No centralized query optimization
- Violates architecture pattern

### ✅ CORRECT PATTERN: Storage Layer Abstraction

**Service Layer** (`server/services/product-service.ts`):
```typescript
// ✅ CORRECT - Service uses storage abstraction
import { storage } from "../storage";

export async function getProduct(id: number) {
  // Business logic only - data access delegated to storage
  const product = await storage.getProductById(id);

  if (!product) {
    throw new Error(`Product ${id} not found`);
  }

  return product;
}
```

**Storage Layer** (`server/storage/domains/product-storage.ts`):
```typescript
export class ProductStorage extends BaseStorage {
  /**
   * Get product by ID
   * @param id - Product ID (validated as positive integer)
   */
  async getProductById(id: number): Promise<Product | null> {
    try {
      // Input validation
      this.validateProductId(id);

      // Data access only
      const [product] = await this.db
        .select()
        .from(products)
        .where(eq(products.id, id))
        .limit(1);

      return product || null;
    } catch (error) {
      this.handleError(error, 'getProductById');
    }
  }
}
```

**Storage Facade** (`server/storage.ts`):
```typescript
export interface IStorage {
  // Interface contract
  getProductById(id: number): Promise<Product | null>;
}

export class DatabaseStorage implements IStorage {
  private productStorage: ProductStorage;

  async getProductById(id: number): Promise<Product | null> {
    // Delegation to domain storage
    return this.productStorage.getProductById(id);
  }
}
```

### Storage Layer Benefits

1. **Separation of Concerns**
   - Services: Business logic, validation, orchestration
   - Storage: Data access, queries, transactions

2. **Testability**
   - Mock storage layer in service tests
   - Test storage layer independently

3. **Type Safety**
   - Full TypeScript support
   - Interface contracts enforced

4. **Consistency**
   - All database queries in one place
   - Centralized optimization
   - Consistent error handling

5. **Maintainability**
   - Easy to refactor queries
   - Clear boundaries between layers

### Migration Pattern

When migrating services to storage layer:

**Step 1:** Analyze database usage
```bash
grep -n "await db\." server/services/your-service.ts
```

**Step 2:** Check for existing storage methods
```bash
grep -n "methodName" server/storage.ts
```

**Step 3:** Create storage methods if needed
```typescript
// In appropriate domain storage class
async getYourData(params): Promise<Result> {
  try {
    // Validation
    this.validateParams(params);

    // Query
    return await this.db.select()...;
  } catch (error) {
    this.handleError(error, 'getYourData');
  }
}
```

**Step 4:** Add to all required interfaces
```typescript
// server/storage.ts - IStorage interface
getYourData(params): Promise<Result>;

// server/storage.ts - DatabaseStorage class
async getYourData(params): Promise<Result> {
  return this.yourDomainStorage.getYourData(params);
}

// server/storage.ts - MemStorage class (testing stub)
async getYourData(params): Promise<Result> {
  return mockResult; // or throw new Error('Not supported in memory storage');
}
```

**Step 5:** Migrate service
```typescript
// Remove
- import { db } from "../db";
- import { schema tables } from "@shared/schema";

// Add
+ import { storage } from "../storage";

// Replace
- await db.select()...
+ await storage.getYourData(params)
```

**Step 6:** Verify
```bash
npm run check  # TypeScript compilation
grep -n "import.*\bdb\b" server/services/your-service.ts  # Should be empty
```

### Documented Exception

**File:** `server/services/price-aggregation-service.ts`

**Reason:** Complex transaction context passing between private helper methods. The service uses transactions with shared context passed to multiple private methods, making storage layer abstraction impractical without significant refactoring.

**Justification:** Documented in CLAUDE.md. This is the ONLY service allowed to use direct `db` access.

### Domain Storage Integration Completeness (CRITICAL - Issue #178)

**KEY INSIGHT: Creating abstractions is NOT the same as using them.**

A storage layer migration can appear complete because all pieces exist, but fail because the integration step is missing. The migration must be verified end-to-end.

#### The Complete Integration Chain

All five steps must be verified for a migration to be complete:

```
Step 1: Domain Class     → server/storage/domains/<domain>-storage.ts EXISTS
Step 2: Interface        → IStorage interface has method signatures
Step 3: Property         → private <domain>Storage: <Domain>Storage;
Step 4: Constructor      → this.<domain>Storage = new <Domain>Storage(db);
Step 5: Delegation       → return this.<domain>Storage.<method>(...args);
```

**Missing ANY step = incomplete migration (even if code compiles)**

#### Common Integration Failures

**Failure 1: Created But Never Instantiated**
```typescript
// File exists, class implemented perfectly...
// BUT DatabaseStorage never creates an instance
export class DatabaseStorage {
  // MISSING: private agentStorage: AgentStorage;
  constructor() {
    // MISSING: this.agentStorage = new AgentStorage(db);
  }
}
```

**Failure 2: Delegation Bypasses Domain Storage**
```typescript
// Property exists, constructor instantiates...
// BUT delegation method uses db directly!
async createAgentSession(data: InsertAgentSession): Promise<AgentSession> {
  const [session] = await db.insert(...).returning();  // WRONG!
  return session;
  // SHOULD BE: return this.agentStorage.createAgentSession(data);
}
```

**Failure 3: Type Signature Divergence**
```typescript
// Interface uses schema types
createAgentSession(data: InsertAgentSession): Promise<AgentSession>;

// Domain uses inline type (subtly incompatible)
async createAgentSession(data: {
  agentType: string;  // Missing other fields!
}): Promise<AgentSession>
```

#### Verification Commands

```bash
# For each domain storage, verify the complete chain:
for domain in agent notification price product retailer user watchlist job-lock; do
  class_name=$(echo "$domain" | sed 's/-//g')Storage
  echo "=== Checking $class_name ==="

  # Check each step
  test -f "server/storage/domains/${domain}-storage.ts" && echo "  [OK] Domain class" || echo "  [MISSING] Domain class"
  grep -q "private ${domain}Storage" server/storage.ts && echo "  [OK] Property" || echo "  [MISSING] Property"
  grep -q "this.${domain}Storage = new" server/storage.ts && echo "  [OK] Constructor" || echo "  [MISSING] Constructor"
done

# Find delegation methods that bypass domain storage
grep -n "return this\." server/storage.ts | grep -v "Storage\." | head -20
```

#### Review Checklist

When reviewing storage layer migrations, verify:

- [ ] Domain storage class exists and extends BaseStorage
- [ ] IStorage interface has all method signatures with schema types
- [ ] DatabaseStorage has property: `private <domain>Storage`
- [ ] DatabaseStorage constructor instantiates: `this.<domain>Storage = new`
- [ ] ALL delegation methods use `this.<domain>Storage.<method>(...)`
- [ ] NO delegation methods use `db` directly
- [ ] Type signatures match exactly between interface and implementation
- [ ] TypeScript compilation passes (`npm run check`)

**Reference:** `docs/LEARNINGS_TODO_178_STORAGE_LAYER_MIGRATION_COMPLETENESS.md`

### Input Validation in Storage Layer

All public storage methods MUST validate inputs:

```typescript
async getNotificationCountByType(
  userId: number,
  type: string,
  sinceDate: Date
): Promise<number> {
  try {
    // Validate userId
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new Error(`Invalid userId: ${userId}. Must be positive integer.`);
    }

    // Validate type
    if (!type || typeof type !== 'string') {
      throw new Error(`Invalid type: ${type}. Must be non-empty string.`);
    }

    // Validate date
    if (!(sinceDate instanceof Date) || isNaN(sinceDate.getTime())) {
      throw new Error(`Invalid sinceDate: ${sinceDate}. Must be valid Date.`);
    }

    // Query
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.type, type),
        gte(notifications.createdAt, sinceDate)
      ));

    // Type assertion: Drizzle returns count(*) as string, convert to number
    return Number(result[0]?.count || 0);
  } catch (error) {
    this.handleError(error, 'getNotificationCountByType');
    return 0;
  }
}
```

#### Pattern: Simplified ID Validation (NEW - 2025-12-23)

**Context:** Storage layer methods that accept userId, productId, or other entity IDs as parameters.

**Problem:** Entity IDs must be positive integers (database primary keys start at 1). Invalid IDs (0, negative, null, undefined) cause meaningless database queries and can indicate bugs in calling code.

**Preferred Pattern:**

```typescript
async countUserAlerts(userId: number): Promise<number> {
  // Input validation: Prevent invalid queries
  if (!userId || userId < 1) {
    throw new Error(`Invalid userId: ${userId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, userId));

  // Type assertion: Drizzle's sql<number> returns count(*) as number at runtime
  return Number(result[0].count);
}

async countUserAlertsForProduct(userId: number, productId: number): Promise<number> {
  // Input validation: Prevent invalid queries
  if (!userId || userId < 1) {
    throw new Error(`Invalid userId: ${userId}`);
  }
  if (!productId || productId < 1) {
    throw new Error(`Invalid productId: ${productId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.productId, productId)
    ));

  // Type assertion: Drizzle's sql<number> returns count(*) as number at runtime
  return Number(result[0].count);
}
```

**Anti-Pattern:**

```typescript
// ❌ WRONG - No validation, allows invalid queries
async countUserAlerts(userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, userId)); // Could query with userId=0 or negative

  return Number(result[0].count);
}
```

**Rationale:**

- **Fail Fast**: Catches bugs early with clear error messages rather than returning empty results
- **Simplified Check**: Uses `!userId || userId < 1` instead of `!Number.isFinite(userId) || userId <= 0`
  - TypeScript already guarantees `userId` is a number type
  - `!userId` catches 0 (falsy), null, undefined
  - `userId < 1` catches negative numbers
- **Performance**: Prevents unnecessary database round-trips for invalid IDs
- **Debugging**: Error message includes the invalid value for easier troubleshooting
- **Database Protection**: PostgreSQL primary keys start at 1, so 0 or negative is always invalid

**When to Use Simplified vs Comprehensive Validation:**

- **Simplified (`!id || id < 1`)**: Use for ID parameters where TypeScript already enforces number type
- **Comprehensive (`!Number.isFinite(id) || id <= 0`)**: Use when accepting `any` or `unknown` types, or in validation utilities

**Related:**
- See Section 6 "Type Safety in Queries" for sql<number> type assertions
- See `parseIntSafe()` in `server/utils/validation-helpers.ts` for route-level validation
- See `SECURITY_PATTERNS.md` for input validation at API boundaries

**Source:** Commits ce38f21 and e0cfe72, 2025-12-23

### Storage Layer Constants

Use constants from `server/utils/constants.ts` instead of magic numbers:

```typescript
import { NOTIFICATION, STORAGE_VALIDATION } from "../utils/constants";

// ❌ WRONG - Magic numbers
if (notificationCount >= 3) { ... }
const dedup = await redis.setex(key, 6 * 60 * 60, '1');

// ✅ CORRECT - Named constants
if (notificationCount >= NOTIFICATION.SMART_ALERT_DAILY_LIMIT) { ... }
const dedup = await redis.setex(key, NOTIFICATION.DEDUP_TTL_HOURS * 60 * 60, '1');
```

**Available Constants (Phase 8):**
- `NOTIFICATION.*` - Notification limits and TTLs
- `TRANSACTION_RETRY.*` - Retry logic configuration
- `STORAGE_VALIDATION.*` - Input validation bounds
- `DATA_RETENTION.*` - Data retention policies

### Find-or-Create with Metadata Enhancement

**Context:** When agent systems or scrapers discover new entities (products, retailers) that may or may not exist, and need to create them with rich metadata on first insert.

**Problem:** Basic find-or-create patterns only handle minimal fields. When creating new entities from scraping/discovery, you need to populate additional metadata (descriptions, images, logos, etc.) without requiring separate update calls.

**✅ Preferred Approach:**

```typescript
// Storage layer method with optional metadata parameter
async findOrCreateProduct(
  name: string,
  category?: string,
  metadata?: { description?: string; brand?: string; image?: string }
): Promise<Product> {
  try {
    // Try to find existing product
    const existing = await this.db.query.products.findFirst({
      where: eq(products.name, name),
    });

    if (existing) {
      this.logSuccess('findOrCreateProduct', { productId: existing.id, found: true });
      return existing;
    }

    // Create with all available metadata
    const [product] = await this.db
      .insert(products)
      .values({
        name,
        category: category || null,
        description: metadata?.description || null,
        brand: metadata?.brand || null,
        image: metadata?.image || null,
        model: null,
        embedding: null,
        embeddingUpdatedAt: null,
      })
      .returning();

    this.logSuccess('findOrCreateProduct', { productId: product.id, found: false });
    return product;
  } catch (error) {
    this.handleError(error, 'findOrCreateProduct');
  }
}

// Agent usage
const product = await storage.findOrCreateProduct(
  data.title,
  inferredCategory,
  {
    description: data.description,
    brand: data.brand,
    image: data.imageUrl,
  }
);
```

**❌ Anti-Pattern:**

```typescript
// Separate find and create with update
const existing = await storage.getProductByName(name);
if (existing) {
  return existing;
} else {
  const product = await storage.createProduct({ name, category });
  // Requires second round-trip to add metadata
  await storage.updateProduct(product.id, {
    description: data.description,
    brand: data.brand,
    image: data.imageUrl,
  });
  return product;
}
```

**Rationale:**
- **Backward Compatible**: Optional metadata parameter doesn't break existing callers
- **Single Round-Trip**: All data inserted in one query
- **Rich Initial Data**: Prevents incomplete records that need patching
- **Agent-Friendly**: Scrapers can provide all discovered data at once

**Related Patterns:**
- See Upsert Pattern for create-or-update semantics
- See Transaction Patterns for multi-entity creation

*Source: Agent Storage Layer Migration (Issue #178), Session 2025-12-24*
*Added: 2025-12-24*

---

### Upsert Pattern for Product Offers

**Context:** When scraping or updating product offers where the same product-retailer combination may be encountered multiple times.

**Problem:** Naive insert fails with unique constraint violations. Naive "check then insert/update" creates race conditions and N+1 queries.

**✅ Preferred Approach:**

```typescript
// Atomic upsert using onConflictDoUpdate
async upsertProductOffer(offerData: {
  productId: number;
  retailerId: number;
  price: string;
  availability: string | null;
  productUrl: string;
  lastLinkCheck: Date;
}): Promise<ProductOffer> {
  // Input validation
  if (!Number.isInteger(offerData.productId) || offerData.productId <= 0) {
    throw new Error(`Invalid productId: ${offerData.productId}`);
  }
  if (!Number.isInteger(offerData.retailerId) || offerData.retailerId <= 0) {
    throw new Error(`Invalid retailerId: ${offerData.retailerId}`);
  }

  try {
    const [offer] = await this.db
      .insert(productOffers)
      .values(offerData)
      .onConflictDoUpdate({
        target: [productOffers.productId, productOffers.retailerId],
        set: {
          price: offerData.price,
          availability: offerData.availability,
          productUrl: offerData.productUrl,
          lastLinkCheck: offerData.lastLinkCheck,
          updatedAt: new Date(),
        },
      })
      .returning();

    this.logSuccess('upsertProductOffer', {
      offerId: offer.id,
      productId: offerData.productId,
      retailerId: offerData.retailerId,
    });
    return offer;
  } catch (error) {
    this.handleError(error, 'upsertProductOffer');
  }
}
```

**❌ Anti-Pattern:**

```typescript
// Race-prone check-then-act
const existing = await db.select()
  .from(productOffers)
  .where(
    and(
      eq(productOffers.productId, productId),
      eq(productOffers.retailerId, retailerId)
    )
  )
  .limit(1);

if (existing.length > 0) {
  await db.update(productOffers)
    .set({ price, availability, productUrl })
    .where(eq(productOffers.id, existing[0].id));
} else {
  await db.insert(productOffers).values({ productId, retailerId, price, availability, productUrl });
}
```

**Rationale:**
- **Atomic Operation**: Single SQL query eliminates race conditions
- **Duplicate-Safe**: Handles concurrent scrapers gracefully
- **Input Validation**: Prevents invalid IDs from corrupting data
- **Audit Trail**: Returns full offer object for logging

**Related Patterns:**
- See Transaction Patterns for multi-table upserts
- See Input Validation in Storage Layer for ID validation

*Source: Extraction Agent Migration (Issue #178), Session 2025-12-24*
*Added: 2025-12-24*

---

### Bulk Operations with Validation

**Context:** When agents need to create multiple entities in a single operation (e.g., bulk insert trending products from discovery).

**Problem:** Individual inserts are slow (N round-trips). Unlimited batch sizes can cause memory/performance issues. No validation on batch size can cause OOM errors or database timeouts.

**✅ Preferred Approach:**

```typescript
async bulkCreateTrendingProducts(
  products: InsertTrendingProduct[]
): Promise<TrendingProduct[]> {
  // Input validation
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('Products array is required and cannot be empty');
  }
  if (products.length > 100) {
    throw new Error(`Batch size too large: ${products.length}. Maximum is 100.`);
  }

  try {
    const results = await this.db.insert(trendingProducts).values(products).returning();
    this.logSuccess('bulkCreateTrendingProducts', { count: results.length });
    return results;
  } catch (error) {
    this.handleError(error, 'bulkCreateTrendingProducts');
  }
}

// Caller handles batching
const BATCH_SIZE = 100;
for (let i = 0; i < allProducts.length; i += BATCH_SIZE) {
  const batch = allProducts.slice(i, i + BATCH_SIZE);
  await storage.bulkCreateTrendingProducts(batch);
}
```

**❌ Anti-Pattern:**

```typescript
// No batch size limits - can cause OOM
async bulkCreateTrendingProducts(products: InsertTrendingProduct[]): Promise<void> {
  // 10,000 products? Database timeout or OOM
  await this.db.insert(trendingProducts).values(products);
}

// Individual inserts - N round-trips
for (const product of products) {
  await storage.createTrendingProduct(product);
}
```

**Rationale:**
- **Performance**: Batch inserts are 10-100x faster than individual inserts
- **Bounded Memory**: Max 100 items prevents OOM errors
- **Clear Error Messages**: Tells caller exactly what went wrong
- **Returns Created IDs**: Enables follow-up operations on inserted entities

**Input Validation Rules:**
- Non-empty array check
- Maximum batch size: 100 items (adjust per table complexity)
- Element validation via Drizzle schema
- Caller responsible for batching large datasets

**Related Patterns:**
- See Transaction Patterns for atomic batch operations
- See Input Validation for per-element validation

*Source: Discovery Agent Migration (Issue #178), Session 2025-12-24*
*Added: 2025-12-24*

---

### Historical Data Optimization Pattern

**Context:** When generating AI content (search queries, recommendations, etc.) where historical performance data exists that could replace expensive AI generation.

**Problem:** Always using AI generation for queries is slow and expensive. Historical data analysis is often more accurate than cold AI generation for common queries.

**✅ Preferred Approach:**

```typescript
async optimizeQueriesForProduct(productName: string): Promise<string[]> {
  try {
    // 1. Check historical queries that performed well
    const historicalQueries = await storage.getHistoricalSearchQueries(productName, 10);

    // 2. Use historical data if available
    if (historicalQueries.length > 0) {
      logger.debug('Using historical queries for optimization', {
        productName,
        count: historicalQueries.length,
      });
      return historicalQueries;
    }

    // 3. Fall back to AI generation for new products
    logger.debug('No historical queries found, generating new queries', { productName });
    return this.generateSearchQueries(productName);
  } catch (error) {
    logger.error('Query optimization failed', {
      error: error instanceof Error ? error.message : String(error),
      productName,
    });
    // 4. Graceful degradation on error
    return this.generateSearchQueries(productName);
  }
}

// Storage layer - get high-performing historical queries
async getHistoricalSearchQueries(productName: string, limit: number): Promise<string[]> {
  if (!productName || productName.trim().length === 0) {
    throw new Error('Product name is required');
  }
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and 100.`);
  }

  try {
    const results = await this.db
      .select({ queryText: searchQueries.queryText })
      .from(searchQueries)
      .where(ilike(searchQueries.queryText, `%${productName}%`))
      .orderBy(desc(searchQueries.avgResults), desc(searchQueries.lastUsed))
      .limit(limit);

    return results.map((r) => r.queryText);
  } catch (error) {
    this.handleError(error, 'getHistoricalSearchQueries');
  }
}
```

**❌ Anti-Pattern:**

```typescript
// Always use AI generation - slow and expensive
async optimizeQueriesForProduct(productName: string): Promise<string[]> {
  // No historical data check - wastes API calls
  return this.generateSearchQueries(productName);
}

// No fallback on error - fails hard
async optimizeQueriesForProduct(productName: string): Promise<string[]> {
  const historical = await storage.getHistoricalSearchQueries(productName, 10);
  // Throws if empty or error - breaks user experience
  if (historical.length === 0) {
    throw new Error('No historical data available');
  }
  return historical;
}
```

**Rationale:**
- **Cost Optimization**: Historical queries are free vs. AI API costs
- **Performance**: Database lookup ~10ms vs. AI generation ~500-2000ms
- **Accuracy**: Real performance data beats AI guessing
- **Graceful Degradation**: Multiple fallback layers prevent failures
- **Observability**: Logs decision path for debugging

**Performance Metrics:**
- Historical lookup: ~10ms average
- AI generation: ~500-2000ms average
- Cost savings: $0.002 per query avoided

**Related Patterns:**
- See Caching Patterns for Redis integration
- See AI Integration Patterns for rate limiting

*Source: Search Agent Optimization (Issue #178), Session 2025-12-24*
*Added: 2025-12-24*

---

## 2. Critical Anti-Patterns (COMMIT BLOCKERS)

These patterns will **FAIL pre-commit hooks** and must be fixed before committing.

### 2.1 N+1 Query Pattern (COMMIT BLOCKER)

#### ❌ NEVER DO THIS - Queries Inside Loops
```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
const products = await db.select().from(products);
for (const product of products) {
  // N queries executed - one for each product!
  const offers = await db.select()
    .from(productOffers)
    .where(eq(productOffers.productId, product.id));

  // Even worse - nested N+1
  for (const offer of offers) {
    const retailer = await db.select()
      .from(retailers)
      .where(eq(retailers.id, offer.retailerId));
  }
}
```

#### ✅ CORRECT - Use JOINs
```typescript
// Single query with JOIN
const productsWithOffersAndRetailers = await db
  .select({
    product: products,
    offer: productOffers,
    retailer: retailers,
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId))
  .leftJoin(retailers, eq(productOffers.retailerId, retailers.id));
```

#### ✅ CORRECT - Use Batch Fetching with IN Clause
```typescript
// Fetch all products first
const productList = await db.select().from(products);
const productIds = productList.map(p => p.id);

// Single query for all offers
const allOffers = await db.select()
  .from(productOffers)
  .where(inArray(productOffers.productId, productIds));

// Group offers by product in memory
const offersByProduct = allOffers.reduce((acc, offer) => {
  if (!acc[offer.productId]) acc[offer.productId] = [];
  acc[offer.productId].push(offer);
  return acc;
}, {});
```

#### ✅ BEST - Use Map for O(1) Lookups in Batch Processing
```typescript
// Optimal pattern for batch operations with related data
async getUserWishlistItems(userId: number) {
  const items = await db.select().from(wishlistItems)
    .where(eq(wishlistItems.userId, userId));

  if (items.length === 0) return [];

  // Single query for all related data
  const productIds = items.map(item => item.productId);
  const allOffers = await db.select()
    .from(productOffers)
    .where(inArray(productOffers.productId, productIds));

  // Use Map for O(1) lookups instead of nested loops
  const offersByProduct = new Map<number, ProductOffer[]>();
  allOffers.forEach(offer => {
    if (!offersByProduct.has(offer.productId)) {
      offersByProduct.set(offer.productId, []);
    }
    offersByProduct.get(offer.productId)!.push(offer);
  });

  // Attach offers to items efficiently
  return items.map(item => ({
    ...item,
    offers: offersByProduct.get(item.productId) || []
  }));
}
```

**Performance comparison:**
- N+1 queries: O(N) database roundtrips
- Nested loops: O(N*M) time complexity
- Map lookup: O(1) lookups, O(N+M) total time

#### ✅ BEST - Use array_agg() for Grouped Data
```typescript
// Single query returns nested data structure
const productsWithPrices = await db
  .select({
    productId: products.id,
    productName: products.name,
    offers: sql<Array<{
      retailerId: number;
      price: number;
      url: string;
    }>>`
      COALESCE(
        json_agg(
          json_build_object(
            'retailerId', ${productOffers.retailerId},
            'price', ${productOffers.price},
            'url', ${productOffers.url}
          ) ORDER BY ${productOffers.price} ASC
        ) FILTER (WHERE ${productOffers.id} IS NOT NULL),
        '[]'::json
      )`
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId))
  .groupBy(products.id);
```

### 2.2 Password Hash Exposure (COMMIT BLOCKER)

#### ❌ NEVER DO THIS - Select All Fields
```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
const user = await db.select()
  .from(users)
  .where(eq(users.id, userId));
// This returns passwordHash field - SECURITY VULNERABILITY!

// Also bad - selecting everything
const allUsers = await db.select().from(users);
```

#### ✅ CORRECT - Explicit Field Selection
```typescript
// Always explicitly select fields, excluding passwordHash
const user = await db.select({
  id: users.id,
  email: users.email,
  username: users.username,
  createdAt: users.createdAt,
  // SECURITY: Never expose passwordHash
}).from(users)
  .where(eq(users.id, userId));

// For multiple users
const userList = await db.select({
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  // SECURITY: Never expose passwordHash
}).from(users);
```

#### ✅ CORRECT - Auth-Specific Query with passwordHash
```typescript
// Only in auth.ts for password verification
async function verifyPassword(email: string, password: string) {
  // SECURITY: passwordHash only used for verification, never exposed
  const [user] = await db.select({
    id: users.id,
    passwordHash: users.passwordHash, // Only here for verification
  }).from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  // Never return passwordHash to caller
  return isValid ? { id: user.id } : null;
}
```

### 2.3 Promise.all vs Promise.allSettled for Batch Operations

#### ❌ ANTI-PATTERN - Promise.all Fails Entire Operation
```typescript
// If one retailer stats query fails, entire operation fails
async getRetailersWithStats() {
  const retailers = await db.select().from(retailers);

  // One failure = entire operation fails
  const enriched = await Promise.all(
    retailers.map(async (retailer) => {
      const stats = await getComplexStats(retailer.id); // Could fail
      return { ...retailer, stats };
    })
  );

  return enriched;
}
```

#### ✅ CORRECT - Promise.allSettled for Graceful Degradation
```typescript
async getRetailersWithStats() {
  const retailers = await db.select().from(retailers);

  const results = await Promise.allSettled(
    retailers.map(async (retailer) => {
      try {
        const stats = await getComplexStats(retailer.id);
        return { ...retailer, stats };
      } catch (error) {
        log(`Failed to get stats for retailer ${retailer.id}:`, error);
        // Return retailer with fallback data
        return {
          ...retailer,
          stats: { clicks: 0, conversions: 0, revenue: 0 }
        };
      }
    })
  );

  // Process results - successful items continue, failures logged
  const successful = results
    .filter(result => result.status === 'fulfilled')
    .map(result => (result as PromiseFulfilledResult<any>).value);

  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    log(`${failed.length} retailers failed to enrich, continuing with ${successful.length} successful`);
  }

  return successful;
}
```

**When to use Promise.allSettled:**
- Processing lists where individual failures shouldn't stop the whole operation
- Data enrichment where partial data is better than no data
- Batch API calls where some might fail
- Report generation that should continue despite partial failures

---

## 3. Query Optimization

### 3.1 Batch Insert Pattern (CRITICAL - 20x Performance)

**Status:** MANDATORY for bulk insert operations
**Reference:** See [`PATTERNS_BATCH_INSERT_OPTIMIZATION.md`](./PATTERNS_BATCH_INSERT_OPTIMIZATION.md) for comprehensive guide
**Performance:** 20x improvement (1,000ms → 50ms for 500 records)

#### Quick Reference

**❌ ANTI-PATTERN - Sequential Inserts (N+1)**
```typescript
// Executes N database queries (500 queries for 500 records)
for (const record of records) {
  await storage.insertPriceHistory(record);
}
// Performance: 500 queries × 2ms = 1,000ms
```

**✅ CORRECT - Batch Insert**
```typescript
// Executes 1 database query (regardless of record count)
await storage.insertPriceHistoryBatch(records);
// Performance: 1 query × 50ms = 50ms (20x faster)
```

**Key Benefits:**
- **20x faster:** Single query vs N queries
- **Atomic:** All records inserted or none (automatic transaction)
- **Lower load:** 500x fewer database connections
- **Scalable:** Supports 10,000+ records with proper batching

**Implementation Checklist:**
1. Add batch insert method to domain storage class
2. Add to IStorage interface
3. Expose through main Storage class
4. Update InMemoryStorage mock
5. Replace sequential loops with batch call
6. Add comprehensive tests (7 minimum)

**See full pattern documentation:** [`PATTERNS_BATCH_INSERT_OPTIMIZATION.md`](./PATTERNS_BATCH_INSERT_OPTIMIZATION.md)

---

### 3.2 Database Aggregations

#### ❌ WRONG - Count in Application
```typescript
// Fetches all records to count them
const products = await db.select({ id: products.id })
  .from(products)
  .where(eq(products.categoryId, categoryId));

const count = products.length; // Inefficient!
```

#### ✅ CORRECT - Count in Database
```typescript
const [result] = await db.select({
  count: sql<number>`count(*)::int`
}).from(products)
  .where(eq(products.categoryId, categoryId));

const count = result.count;
```

### 3.2 Database Grouping

#### ❌ WRONG - Group in Application
```typescript
// Fetch all data
const allPrices = await db.select()
  .from(priceHistory);

// Group in memory (slow and memory-intensive)
const byProduct = allPrices.reduce((acc, price) => {
  if (!acc[price.productId]) {
    acc[price.productId] = [];
  }
  acc[price.productId].push(price);
  return acc;
}, {});
```

#### ✅ CORRECT - Group in Database
```typescript
const pricesByProduct = await db.select({
  productId: priceHistory.productId,
  avgPrice: sql<number>`avg(${priceHistory.price})::numeric`,
  minPrice: sql<number>`min(${priceHistory.price})::numeric`,
  maxPrice: sql<number>`max(${priceHistory.price})::numeric`,
  priceCount: sql<number>`count(*)::int`,
  prices: sql<number[]>`array_agg(${priceHistory.price} ORDER BY ${priceHistory.recordedAt})`,
}).from(priceHistory)
  .where(gte(priceHistory.recordedAt, thirtyDaysAgo))
  .groupBy(priceHistory.productId);
```

### 3.3 Batch Operations

#### ✅ CORRECT - Batch Inserts
```typescript
const BATCH_SIZE = 100;

// Process large datasets in chunks
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);

  await db.insert(products)
    .values(batch)
    .onConflictDoUpdate({
      target: products.sku,
      set: {
        name: sql`excluded.name`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });
}
```

### 3.4 Parallel Independent Queries

#### ❌ WRONG - Sequential Independent Queries
```typescript
const user = await db.select().from(users).where(eq(users.id, userId));
const products = await db.select().from(products).limit(10);
const notifications = await db.select().from(notifications);
// Total time = query1 + query2 + query3
```

#### ✅ CORRECT - Parallel Execution
```typescript
const [user, products, notifications] = await Promise.all([
  db.select().from(users).where(eq(users.id, userId)),
  db.select().from(products).limit(10),
  db.select().from(notifications).where(eq(notifications.userId, userId)),
]);
// Total time = max(query1, query2, query3)
```

---

## 4. Transaction Patterns

### 4.1 When Transactions Are MANDATORY

Transactions are required whenever you have 2+ related database operations that must succeed or fail together.

#### Pattern 1: Create Parent + Children
```typescript
// ✅ CORRECT - Atomic creation
await db.transaction(async (tx) => {
  // Create forum topic
  const [topic] = await tx.insert(forumTopics)
    .values({
      title,
      categoryId,
      authorId: userId,
    })
    .returning();

  // Create first post (must succeed or topic shouldn't exist)
  await tx.insert(forumPosts)
    .values({
      topicId: topic.id,
      content,
      authorId: userId,
    });

  // Update user stats
  await tx.update(users)
    .set({
      postCount: sql`${users.postCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(users.id, userId));
});

// ❌ WRONG - Partial updates possible
const [topic] = await db.insert(forumTopics).values(data).returning();
// If this fails, topic exists without post!
await db.insert(forumPosts).values({ topicId: topic.id });
```

#### Pattern 2: Check-Then-Act (Race Conditions)
```typescript
// ✅ CORRECT - Prevents race conditions with SERIALIZABLE
await db.transaction(async (tx) => {
  // Check current state
  const [current] = await tx.select({
    count: sql<number>`count(*)::int`
  }).from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.status, 'active')
    ));

  // Enforce limit based on check
  if (current.count >= 10) {
    throw new Error('Maximum active alerts reached');
  }

  // Create new alert (guaranteed count is still valid)
  await tx.insert(priceAlerts).values(alertData);
}, {
  isolationLevel: 'serializable', // Prevent concurrent modifications
});
```

#### Pattern 3: Update + Audit Trail
```typescript
// ✅ CORRECT - Atomic update with history
await db.transaction(async (tx) => {
  // Get current price for history
  const [current] = await tx.select({
    price: productOffers.price,
  }).from(productOffers)
    .where(eq(productOffers.id, offerId))
    .for('update'); // Lock row

  // Update current price
  await tx.update(productOffers)
    .set({
      price: newPrice,
      lastChecked: new Date(),
    })
    .where(eq(productOffers.id, offerId));

  // Record price change
  await tx.insert(priceHistory).values({
    productId,
    retailerId,
    price: newPrice,
    previousPrice: current.price,
    changePercent: ((newPrice - current.price) / current.price) * 100,
  });

  // Trigger alerts if price dropped
  if (newPrice < current.price) {
    await tx.insert(notifications).values({
      userId,
      type: 'price_drop',
      title: 'Price dropped!',
      content: `Price reduced from $${current.price} to $${newPrice}`,
    });
  }
});
```

### 4.2 Transaction Isolation Levels

PostgreSQL supports multiple isolation levels. Understanding when to use each is critical for data integrity.

#### Isolation Levels Explained

| Level | Prevents | Use Case | Performance |
|-------|----------|----------|-------------|
| **READ COMMITTED** (default) | Dirty reads | Most operations | Fast |
| **REPEATABLE READ** | Non-repeatable reads | Consistent snapshots | Moderate |
| **SERIALIZABLE** | All anomalies | Race conditions in check-then-act | Slowest |

#### When to Use SERIALIZABLE (CRITICAL)

Use SERIALIZABLE when concurrent transactions could violate business rules even if each transaction is individually correct.

**Pattern: Check-Then-Act with Limits**
```typescript
// ✅ CORRECT - Prevents race conditions with SERIALIZABLE
await db.transaction(async (tx) => {
  // Check current count
  const [result] = await tx.select({
    count: sql<number>`count(*)::int`
  }).from(productWatches)
    .where(eq(productWatches.watchListId, watchListId));

  // Business rule: Maximum 100 products per watch list
  if (result.count >= 100) {
    throw new Error('Watch list is full (maximum 100 products)');
  }

  // Add product - SERIALIZABLE ensures count is still valid
  await tx.insert(productWatches).values({
    watchListId,
    productId,
  });
}, {
  isolationLevel: 'serializable', // MANDATORY for race condition prevention
});
```

**Without SERIALIZABLE - Race Condition Example:**
```typescript
// ❌ WRONG - Race condition possible with default READ COMMITTED
// Time: T1                          Time: T2
// User A checks count = 99          User B checks count = 99
// User A inserts (count now 100)    User B inserts (count now 101) ❌ VIOLATED LIMIT!
await db.transaction(async (tx) => {
  const count = await tx.select(...);
  if (count >= 100) throw new Error('Full');
  await tx.insert(...); // Race condition!
});
// Missing: { isolationLevel: 'serializable' }
```

#### Common SERIALIZABLE Use Cases

**1. Limit Enforcement**
```typescript
// Maximum alerts per user
await db.transaction(async (tx) => {
  const [result] = await tx.select({
    count: sql<number>`count(*)::int`
  }).from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.status, 'active')
    ));

  if (result.count >= 10) {
    throw new Error('Maximum 10 active alerts per user');
  }

  await tx.insert(priceAlerts).values(alertData);
}, {
  isolationLevel: 'serializable', // Prevents concurrent limit violations
});
```

**2. Sequential Numbering**
```typescript
// Post numbers must be sequential within a topic
await db.transaction(async (tx) => {
  const [lastPost] = await tx.select({
    postNumber: forumPosts.postNumber
  }).from(forumPosts)
    .where(eq(forumPosts.topicId, topicId))
    .orderBy(desc(forumPosts.postNumber))
    .limit(1);

  const nextNumber = (lastPost?.postNumber ?? 0) + 1;

  await tx.insert(forumPosts).values({
    topicId,
    postNumber: nextNumber, // Must be sequential
    content,
  });
}, {
  isolationLevel: 'serializable', // Prevents gaps in numbering
});
```

**3. Conditional Updates**
```typescript
// Update only if condition still holds
await db.transaction(async (tx) => {
  const [product] = await tx.select({
    stock: products.stock
  }).from(products)
    .where(eq(products.id, productId))
    .for('update'); // Lock row

  if (product.stock < quantity) {
    throw new Error('Insufficient stock');
  }

  await tx.update(products)
    .set({ stock: product.stock - quantity })
    .where(eq(products.id, productId));
}, {
  isolationLevel: 'serializable', // Ensures stock check is still valid
});
```

#### Default READ COMMITTED is Fine For:

**1. Simple Multi-Step Operations (No Conditionals)**
```typescript
// Create parent + children - no race condition risk
await db.transaction(async (tx) => {
  const [product] = await tx.insert(products).values(data).returning();

  // No check-then-act - just insert with product.id
  await tx.insert(productOffers).values(offers.map(o => ({
    productId: product.id,
    ...o,
  })));
});
// No isolationLevel needed - default READ COMMITTED is fine
```

**2. Operations on Locked Records**
```typescript
// Primary key lookups with updates - already exclusive
await db.transaction(async (tx) => {
  const [user] = await tx.select()
    .from(users)
    .where(eq(users.id, userId))
    .for('update'); // Row lock - no concurrent modification

  await tx.update(users)
    .set({ lastLogin: new Date() })
    .where(eq(users.id, userId));
});
```

#### Performance Considerations

- **SERIALIZABLE transactions are slower** - use only when necessary
- They can fail with serialization errors - implement retry logic
- Default READ COMMITTED is adequate for 95% of operations
- Use SERIALIZABLE when business rules MUST be enforced atomically

#### Detecting Missing SERIALIZABLE

Ask these questions:
1. Does the transaction check a count/limit before inserting?
2. Does it read a value and make a decision based on it?
3. Could concurrent transactions violate a business rule?
4. Does it calculate sequential numbers?

If **YES** to any → Use `isolationLevel: 'serializable'`

### 4.3 What NOT to Include in Transactions

#### ❌ WRONG - External Calls in Transaction
```typescript
await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(data).returning();

  // DON'T DO THIS - Email could fail and lock the transaction
  await sendWelcomeEmail(user.email);

  // DON'T DO THIS - HTTP request in transaction
  await fetch('https://api.example.com/notify', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id }),
  });
});
```

#### ✅ CORRECT - External Calls After Transaction
```typescript
// Complete database work first
const user = await db.transaction(async (tx) => {
  const [newUser] = await tx.insert(users).values(data).returning();
  await tx.insert(userProfiles).values({ userId: newUser.id });
  return newUser;
});

// External calls after successful commit
try {
  await sendWelcomeEmail(user.email);
} catch (error) {
  log.error('Failed to send welcome email:', error);
  // Email failure doesn't affect user creation
}
```

### 4.4 Transaction-Aware Error Handling Pattern (NEW - 2025-12-26)

**Context:** Storage methods that can be called both inside and outside transactions need asymmetric error handling.

**Problem:** If a storage method catches and logs errors when called inside a transaction, the transaction will silently commit despite failures, violating atomicity guarantees.

**✅ Preferred Approach:**
```typescript
// Storage method that supports optional transaction context
async createProduct(
  productData: InsertProduct,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<Product> {
  try {
    // Use transaction if provided, otherwise use default db connection
    const database = tx ?? this.db;

    const [product] = await database
      .insert(products)
      .values(productData)
      .returning();

    return product;
  } catch (error) {
    // CRITICAL: Re-throw when in transaction to trigger rollback
    if (tx) {
      throw error;
    }
    // Normal error handling when NOT in transaction
    this.handleError(error, 'createProduct');
  }
}
```

**❌ Anti-Pattern (Silent Transaction Success):**
```typescript
// WRONG - Catches error even when in transaction
async createProduct(productData: InsertProduct, tx?: Transaction): Promise<Product> {
  try {
    const database = tx ?? this.db;
    const [product] = await database.insert(products).values(productData).returning();
    return product;
  } catch (error) {
    // BUG: Always logs and swallows error, even in transaction!
    this.handleError(error, 'createProduct');
    // Transaction commits despite error ❌
  }
}

// Usage - transaction silently succeeds despite error
await db.transaction(async (tx) => {
  await storage.createProduct(invalidData, tx); // Error caught and logged
  await storage.updateRelatedRecord(id, data, tx); // This still executes!
  // Transaction commits ❌ - partial state persisted
});
```

**Rationale:**
- **Inside transaction**: Error MUST propagate to trigger rollback (data integrity)
- **Outside transaction**: Error should be logged for observability (monitoring)
- Asymmetric handling provides both correctness and observability
- Single method supports both transaction and non-transaction contexts

**Related Patterns:**
- See Section 4.6 for row count validation in transactions
- See `docs/08_TESTING_PATTERNS.md` for transaction testing patterns

*Source: TODO 004 - Transaction Boundaries Implementation*
*Added: 2025-12-26*

### 4.5 Row Count Validation in Transactions (NEW - 2025-12-26)

**Context:** UPDATE operations in PostgreSQL succeed silently even when matching 0 rows, which can cause orphaned state in multi-step transactions.

**Problem:** If a transaction updates a record that doesn't exist, SQL returns success (0 rows affected). Without explicit validation, the transaction commits with orphaned state.

**✅ Preferred Approach:**
```typescript
// Storage method with row count validation
async updateTrendingProduct(
  productId: number,
  updates: Partial<TrendingProduct>,
  tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]
): Promise<void> {
  try {
    const database = tx ?? this.db;

    const result = await database
      .update(trendingProducts)
      .set(updates)
      .where(eq(trendingProducts.id, productId))
      .returning({ id: trendingProducts.id }); // Get affected rows

    // CRITICAL: Validate row count when in transaction
    if (tx && result.length === 0) {
      throw new Error(`Trending product with id ${productId} not found`);
    } else if (!tx && result.length === 0) {
      // Log warning for visibility outside transactions
      logger.warn('updateTrendingProduct: no rows updated', {
        productId,
        updates: Object.keys(updates),
      });
    }

    this.logSuccess('updateTrendingProduct', { productId, updates });
  } catch (error) {
    if (tx) {
      throw error; // Re-throw to trigger rollback
    }
    this.handleError(error, 'updateTrendingProduct');
  }
}

// Usage - atomic operation with validation
await db.transaction(async (tx) => {
  const product = await storage.createProduct(productData, tx);

  // If this fails (0 rows), entire transaction rolls back
  await storage.updateTrendingProduct(
    trendingProductId,
    { productId: product.id, status: 'scraped' },
    tx
  );
});
```

**❌ Anti-Pattern (Silent Success with Orphaned State):**
```typescript
// WRONG - No row count validation
async updateTrendingProduct(productId: number, updates: Partial<TrendingProduct>, tx?: Transaction): Promise<void> {
  const database = tx ?? this.db;

  // This succeeds even if productId doesn't exist (0 rows updated)
  await database
    .update(trendingProducts)
    .set(updates)
    .where(eq(trendingProducts.id, productId));

  // No validation - silent success ❌
}

// Usage - creates orphaned product
await db.transaction(async (tx) => {
  const product = await storage.createProduct(productData, tx);

  // This "succeeds" but updates 0 rows (wrong ID)
  await storage.updateTrendingProduct(999999, { productId: product.id }, tx);

  // Transaction commits ❌
  // Result: product exists but not linked to trending record
});
```

**Rationale:**
- SQL UPDATE with 0 matches is not an error in PostgreSQL (by design)
- Multi-step transactions require explicit validation to prevent orphaned state
- Warning logs outside transactions provide observability without breaking idempotency
- Use `.returning()` to get affected rows (zero-cost in PostgreSQL)

**When to Use:**
- ✅ UPDATE operations inside transactions with foreign key dependencies
- ✅ Multi-step operations where later steps depend on earlier ones
- ❌ Idempotent UPSERT operations (silent success is acceptable)
- ❌ Single-step operations outside transactions

**Related Patterns:**
- See Section 4.4 for transaction-aware error handling
- See Section 4.7 for inline vs abstraction trade-offs

*Source: TODO 004 - Transaction Boundaries Implementation*
*Added: 2025-12-26*

### 4.6 Interface Layer Transaction Passthrough Pattern (NEW - 2025-12-26)

**Context:** When storage methods support optional transaction contexts, ALL interface layers must pass through the `tx` parameter, or transactions will silently break.

**Problem:** PriceCompare uses a facade pattern (`Storage` class → domain storage classes). If any layer fails to pass through the `tx` parameter, transactions won't work despite correct implementation in the domain layer.

**✅ Preferred Approach (3-Layer Passthrough):**
```typescript
// Layer 1: Domain storage method signature
// File: server/storage/domains/product-storage.ts
export class ProductStorage extends BaseStorage {
  async createProduct(
    product: InsertProduct,
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]  // Transaction type
  ): Promise<Product> {
    const database = tx ?? this.db;
    const [result] = await database.insert(products).values(product).returning();
    return result;
  }
}

// Layer 2: Interface definition
// File: server/storage.ts
export interface IStorage {
  createProduct(
    product: InsertProduct,
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]  // MUST match domain signature
  ): Promise<Product>;
}

// Layer 3: Wrapper implementation (facade)
// File: server/storage.ts
export class Storage implements IStorage {
  private productStorage: ProductStorage;

  async createProduct(
    product: InsertProduct,
    tx?: Parameters<Parameters<typeof db.transaction>[0]>[0]  // MUST match interface
  ): Promise<Product> {
    return this.productStorage.createProduct(product, tx);  // MUST pass through tx
  }
}

// Usage - transaction works correctly
await db.transaction(async (tx) => {
  const product = await storage.createProduct(productData, tx); // ✅ tx reaches domain layer
});
```

**❌ Anti-Pattern (Missing Layer Update):**
```typescript
// Layer 1: Domain storage - CORRECT
async createProduct(product: InsertProduct, tx?: Transaction): Promise<Product> { ... }

// Layer 2: Interface definition - MISSING TX PARAMETER ❌
export interface IStorage {
  createProduct(product: InsertProduct): Promise<Product>;  // No tx parameter!
}

// Layer 3: Wrapper - MISSING TX PARAMETER ❌
export class Storage implements IStorage {
  async createProduct(product: InsertProduct): Promise<Product> {  // No tx parameter!
    return this.productStorage.createProduct(product);  // tx NOT passed through ❌
  }
}

// Usage - transaction silently ignored
await db.transaction(async (tx) => {
  const product = await storage.createProduct(productData, tx);
  // tx parameter exists but never reaches domain layer ❌
  // Operation executes outside transaction ❌
});
```

**Rationale:**
- Facade pattern requires parameter passthrough at ALL layers
- TypeScript won't catch missing parameters if interface is incomplete
- Silent failure: transaction wrapper exists but doesn't execute atomically
- Must update 3 locations for every transaction-enabled method

**Checklist for Transaction Support:**
1. ✅ Domain storage method has `tx?` parameter
2. ✅ `IStorage` interface includes `tx?` parameter
3. ✅ `Storage` class wrapper passes through `tx?` parameter
4. ✅ Test double (`MemStorage`) has matching signature for test compatibility

**Related Patterns:**
- See Section 1 for Storage Layer Architecture overview
- See Section 4.4 for transaction-aware error handling
- See `docs/08_TESTING_PATTERNS.md` for MemStorage stub patterns

*Source: TODO 004 - Transaction Boundaries Implementation*
*Added: 2025-12-26*

### 4.7 Inline Transaction vs Storage Abstraction Trade-off (NEW - 2025-12-26)

**Context:** When adding transaction boundaries, you must decide whether to wrap the transaction inline at the call site or create a storage method abstraction.

**Problem:** Over-abstracting creates unnecessary indirection, hides transaction boundaries, and increases test surface area. Under-abstracting creates code duplication when multiple callers need the same transaction logic.

**✅ Preferred Approach (Inline for Single Caller):**
```typescript
// Call site: coordinator-agent.ts
// Operation used in EXACTLY ONE PLACE - use inline transaction
await db.transaction(async (tx) => {
  // Step 1: Create product record
  const createdProduct = await storage.createProduct(productData, tx);

  if (createdProduct) {
    // Step 2: Atomic link - if this fails, product creation rolls back
    await storage.updateTrendingProduct(
      trendingProduct.id,
      {
        productId: createdProduct.id,
        status: 'scraped',
      },
      tx
    );

    logger.info(`Successfully processed trending product`);
  }
});

// BENEFITS:
// ✅ Transaction boundary visible to maintainers
// ✅ No hidden side effects (clear what's in the transaction)
// ✅ 75% fewer LOC than storage method approach
// ✅ No unnecessary test surface area
```

**✅ Preferred Approach (Storage Method for Multiple Callers):**
```typescript
// Storage layer: agent-storage.ts
// Operation used in 2+ places - extract to storage method
export class AgentStorage extends BaseStorage {
  async createProductFromTrendingProduct(
    trendingProduct: TrendingProduct,
    offerData: InsertProductOffer[]
  ): Promise<Product> {
    try {
      return await this.db.transaction(async (tx) => {
        // Step 1: Create the product
        const [product] = await tx.insert(products).values({
          name: trendingProduct.name,
          category: trendingProduct.category,
        }).returning();

        // Step 2: Create product offers
        if (offerData.length > 0) {
          await tx.insert(productOffers).values(
            offerData.map((offer) => ({ ...offer, productId: product.id }))
          );
        }

        // Step 3: Update trending product status
        await tx.update(trendingProducts)
          .set({ status: 'processed', productId: product.id })
          .where(eq(trendingProducts.id, trendingProduct.id));

        return product;
      });
    } catch (error) {
      this.handleError(error, 'createProductFromTrendingProduct');
    }
  }
}

// BENEFITS:
// ✅ Reusable across multiple callers
// ✅ Encapsulates complex business logic
// ✅ Single source of truth for this workflow
// ✅ Easier to test in isolation
```

**❌ Anti-Pattern (Premature Abstraction):**
```typescript
// WRONG - Creating storage method for single caller
// File: agent-storage.ts
async createProductAndLinkToTrending(
  productData: InsertProduct,
  trendingProductId: number
): Promise<Product> {
  return await this.db.transaction(async (tx) => {
    const product = await this.createProduct(productData, tx);
    await this.updateTrendingProduct(trendingProductId, { productId: product.id }, tx);
    return product;
  });
}

// File: coordinator-agent.ts (ONLY caller)
const product = await storage.createProductAndLinkToTrending(productData, trendingProduct.id);

// PROBLEMS:
// ❌ Transaction boundary hidden from maintainers
// ❌ Method name doesn't fully reveal side effects (updates trending_products)
// ❌ Adds indirection without value (only 1 caller)
// ❌ Increases test surface area unnecessarily
// ❌ 75% more LOC than inline approach
```

**Decision Tree:**

```
Is the transaction logic used in 2+ places?
├── YES → Extract to storage method
│   ├── Complex business logic? → Storage method
│   └── Simple 2-3 operations? → Consider inline (wait for 2nd caller)
│
└── NO (single caller) → Inline transaction at call site
    ├── Transaction boundary visible
    ├── No hidden side effects
    └── Extract when 2nd caller appears (YAGNI)
```

**Rationale:**
- **Inline transactions**: Prioritize clarity and simplicity for single-use operations
- **Storage methods**: Prioritize reusability and encapsulation for multi-caller operations
- YAGNI principle: Don't create abstractions until you need them (2+ callers)
- Performance: Both approaches have identical performance characteristics

**When to Refactor:**
- ✅ 2nd caller appears → Extract inline transaction to storage method
- ✅ Complex business logic (5+ operations) → Extract even for single caller
- ❌ "Might be reused someday" → Keep inline until actually needed

**Related Patterns:**
- See Section 4.4 for transaction-aware error handling in storage methods
- See Section 4.5 for row count validation patterns
- See `docs/03_API_PATTERNS.md` for service layer patterns

*Source: TODO 004 - Transaction Boundaries Implementation, Plan Review by DHH/Kieran/Simplicity Reviewers*
*Added: 2025-12-26*

---

## 5. Schema Design Patterns

### 5.1 Foreign Key Cascade Rules (MANDATORY)

#### ❌ WRONG - No Cascade Rules
```typescript
// THIS WILL CAUSE DATA CORRUPTION!
productId: integer("product_id")
  .references(() => products.id)
  .notNull(),
```

#### ✅ CORRECT - Explicit Cascade Rules
```typescript
// Child records deleted with parent
productId: integer("product_id")
  .references(() => products.id, { onDelete: 'cascade' })
  .notNull(),

// Reference nullified but record preserved
authorId: integer("author_id")
  .references(() => users.id, { onDelete: 'set null' }),

// Deletion prevented if children exist (rare)
categoryId: integer("category_id")
  .references(() => categories.id, { onDelete: 'restrict' })
  .notNull(),
```

#### When to Use Each Cascade Type

**CASCADE - Ownership Relationships**
```typescript
// Product offers are meaningless without product
productOffers: {
  productId: integer("product_id")
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
}

// User's watchlist items deleted with user
watchListItems: {
  userId: integer("user_id")
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
}
```

**SET NULL - Preserve for History**
```typescript
// Forum posts remain but author anonymized
forumPosts: {
  authorId: integer("author_id")
    .references(() => users.id, { onDelete: 'set null' }),
}

// Orders remain for accounting even if product deleted
orders: {
  productId: integer("product_id")
    .references(() => products.id, { onDelete: 'set null' }),
}
```

#### Detection Rule for Code Review

Flag any foreign key reference without explicit cascade rules:

```bash
# Search for foreign keys without onDelete in schema
grep -rn "\.references(" shared/schema.ts | grep -v "onDelete"

# Search for foreign keys in migrations without ON DELETE
grep -rn "REFERENCES" migrations/ | grep -v "ON DELETE"
```

#### Verification Commands

```bash
# Check existing foreign keys in database for missing cascade rules
# Connect to PostgreSQL and run:
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule  -- Shows: CASCADE, SET NULL, RESTRICT, or NO ACTION
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

# Flag foreign keys with NO ACTION (PostgreSQL default - should be explicit)
# If delete_rule = 'NO ACTION', add explicit cascade rule
```

#### Migration Pattern for Adding Cascade Rules

```sql
-- Add cascade rule to existing foreign key
ALTER TABLE product_offers
  DROP CONSTRAINT IF EXISTS product_offers_product_id_fkey;

ALTER TABLE product_offers
  ADD CONSTRAINT product_offers_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE;

-- Verify cascade rule was applied
SELECT delete_rule
FROM information_schema.referential_constraints
WHERE constraint_name = 'product_offers_product_id_fkey';
-- Should return: CASCADE
```

---

### 5.2 NULL-Safe UNIQUE Constraints (Phase 0 Pattern)

**The Problem: PostgreSQL NULL Semantics**

PostgreSQL treats NULL as distinct in UNIQUE constraints. This means `UNIQUE(user_id, product_id, watch_list_id)` allows **multiple rows** with the same `user_id` and `product_id` when `watch_list_id` is NULL.

```sql
-- PostgreSQL allows BOTH inserts (NULL != NULL)
INSERT INTO product_watches (user_id, product_id, watch_list_id) VALUES (1, 100, NULL);
INSERT INTO product_watches (user_id, product_id, watch_list_id) VALUES (1, 100, NULL);
-- Result: Data integrity violation - duplicate products for same user!
```

**Solution: Dual Constraint Architecture**

Use a **partial unique index** for the NULL case combined with a **standard unique constraint** for the non-NULL case.

#### ✅ CORRECT - Dual Constraint Pattern
```sql
-- Step 1: Drop flawed three-column constraint
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS unique_user_product_list;

-- Step 2: Partial unique index for NULL case
CREATE UNIQUE INDEX unique_user_product_no_list
  ON product_watches(user_id, product_id)
  WHERE watch_list_id IS NULL;

-- Step 3: Standard constraint for non-NULL case
ALTER TABLE product_watches
  ADD CONSTRAINT unique_user_product_list
  UNIQUE(user_id, product_id, watch_list_id);

-- Step 4: Document the purpose
COMMENT ON INDEX unique_user_product_no_list IS
  'Prevents duplicate products when not assigned to a list';
COMMENT ON CONSTRAINT unique_user_product_list ON product_watches IS
  'Prevents duplicate products within the same watch list';
```

#### ❌ WRONG - Simple Unique Constraint with Nullable Column
```sql
-- This DOES NOT prevent duplicates when watch_list_id IS NULL
ALTER TABLE product_watches
  ADD CONSTRAINT unique_watch
  UNIQUE(user_id, product_id, watch_list_id);
```

**When to Apply This Pattern:**

Apply dual constraint architecture when:
- A UNIQUE constraint includes **nullable foreign keys**
- **Optional relationships** need uniqueness enforcement
- A **parent record is optional** but duplicates should still be prevented
- Table has columns like `parent_id`, `list_id`, `group_id` that can be NULL

**Detection Rule for Code Review:**

Flag any UNIQUE constraint that includes nullable columns:

```typescript
// REVIEW FLAG: Nullable column in unique constraint
watchListId: integer("watch_list_id")
  .references(() => watchLists.id, { onDelete: 'set null' })
  // WARNING: If this is in a unique constraint, partial index needed

// Check schema for unique constraints with nullable columns
grep -rn "unique.*Id.*null\|UNIQUE.*_id.*NULL" shared/schema.ts migrations/
```

**Error Handling for Constraint Violations:**

When the dual constraints catch violations, handle them gracefully:

```typescript
catch (error: unknown) {
  if (error instanceof Error && 'code' in error) {
    const dbError = error as { code?: string; constraint?: string };

    if (dbError.code === '23505') { // Unique violation
      // Check multiple sources (defensive - driver differences)
      const constraintName = (dbError.constraint || '').toLowerCase();
      const errorMsg = error.message.toLowerCase();

      if (constraintName.includes('unique_user_product') ||
          errorMsg.includes('unique_user_product')) {
        logger.warn('Duplicate detected', { userId, productId });
        throw new Error('Product already added');  // Return 400, not 500
      }
    }
  }
  this.handleError(error, 'operation');
}
```

**Reference Implementation:** See `migrations/0019_fix_product_watches_unique_constraint.sql` for complete example.

### 5.3 Timestamp vs Timestamptz (CRITICAL)

**Status:** Active issue in production - requires migration
**Affected Tables:** `password_reset_tokens`, `job_locks`, others TBD
**Root Cause:** Schema uses `timestamp` without timezone, causing ambiguous comparisons

#### The Problem: Timestamp Without Timezone

PostgreSQL has two timestamp types with **critically different behavior**:
- `timestamp` (without timezone) - Stores value as-is, no timezone metadata
- `timestamptz` (with timezone) - Stores UTC internally, converts to display timezone

When comparing `timestamp` columns with timezone-aware functions like `NOW()`, PostgreSQL performs implicit timezone conversion that can cause bugs.

#### ❌ ANTI-PATTERN - timestamp without timezone

**Schema:**
```typescript
// shared/schema.ts - WRONG
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),  // ❌ No timezone
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Problem:**
```typescript
// JavaScript creates UTC Date
const expiresAt = new Date(Date.now() + 3600000);  // 1 hour from now (UTC)

// PostgreSQL stores it in timestamp (no timezone metadata)
await db.insert(passwordResetTokens).values({ expiresAt });

// Later: Query with NOW() (returns timestamptz)
const valid = await db.select()
  .from(passwordResetTokens)
  .where(sql`expires_at > NOW()`);  // ❌ Comparing timestamp to timestamptz

// PostgreSQL implicitly converts timestamp to server's local timezone
// If server timezone != UTC, comparison gives wrong result!
```

**Real-World Impact:**
- If server timezone is PST (UTC-8):
  - JavaScript stores `2024-01-01 12:00:00` (UTC)
  - PostgreSQL treats it as `2024-01-01 12:00:00` (PST)
  - Token expires 8 hours earlier than intended
- Expired tokens appear valid (or vice versa)
- Different behavior in dev (UTC) vs production (non-UTC timezone)

#### ✅ CORRECT PATTERN 1 - Use timestamptz in Schema

**Schema (Recommended):**
```typescript
// shared/schema.ts - CORRECT
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),  // ✅ With timezone
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

**Benefits:**
- Stores UTC internally, eliminates ambiguity
- Comparisons with `NOW()` work without workarounds
- Automatic timezone conversion for display
- PostgreSQL best practice

**Migration:**
```sql
-- Safe migration (preserves existing UTC timestamps)
ALTER TABLE password_reset_tokens
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE password_reset_tokens
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';
```

#### ✅ CORRECT PATTERN 2 - Explicit Timezone Handling (Workaround)

If schema migration isn't possible immediately, use explicit timezone handling in queries:

**Storage Layer:**
```typescript
// server/storage.ts - Workaround for timestamp without timezone
async validatePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  // Input validation
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new Error('Invalid token: must be non-empty string');
  }

  // NOTE: expiresAt is stored as timestamp without timezone (bug in schema)
  // JavaScript Date objects are UTC, but PostgreSQL treats timestamp without timezone as local time
  // We need to explicitly tell PostgreSQL that the stored timestamp IS in UTC
  const result = await db.execute(
    sql`
      SELECT *
      FROM password_reset_tokens
      WHERE token = ${token}
        AND is_used = false
        AND (expires_at AT TIME ZONE 'UTC') > NOW()  -- ✅ Explicit UTC
      LIMIT 1
    `
  );

  // Type assertion: db.execute() returns raw PostgreSQL rows as unknown type
  const row = result.rows[0] as unknown;
  if (!row) return null;

  // Type assertion: Map PostgreSQL snake_case columns to TypeScript camelCase structure
  const dbRow = row as {
    id: number;
    user_id: number;
    token: string;
    expires_at: Date;
    is_used: boolean;
    // ... other fields
  };

  return {
    id: dbRow.id,
    userId: dbRow.user_id,
    token: dbRow.token,
    expiresAt: dbRow.expires_at,
    isUsed: dbRow.is_used,
    // ... other fields
  };
}
```

**Cleanup Method (Consistent Approach):**
```typescript
async cleanupExpiredPasswordResetTokens(): Promise<number> {
  // Use PostgreSQL NOW() with AT TIME ZONE for consistency with validatePasswordResetToken()
  // NOTE: expiresAt is timestamp without timezone (schema bug), so we need explicit UTC handling
  const result = await db.execute(
    sql`
      DELETE FROM password_reset_tokens
      WHERE (expires_at AT TIME ZONE 'UTC') < NOW()
      RETURNING id
    `
  );
  return result.rowCount || 0;
}
```

**Why `AT TIME ZONE 'UTC'` Works:**
- Tells PostgreSQL: "treat this timestamp AS IF it's in UTC"
- Converts to `timestamptz` for comparison with `NOW()`
- Eliminates server timezone dependency

#### ❌ ANTI-PATTERN - Inconsistent Timezone Handling

```typescript
// WRONG: Validation uses PostgreSQL NOW(), cleanup uses JavaScript Date
async validatePasswordResetToken(token: string) {
  // Uses PostgreSQL NOW() with AT TIME ZONE
  const result = await db.execute(
    sql`WHERE (expires_at AT TIME ZONE 'UTC') > NOW()`
  );
}

async cleanupExpiredPasswordResetTokens() {
  // Uses JavaScript Date (different timezone handling!)
  const result = await db.delete(passwordResetTokens)
    .where(lt(passwordResetTokens.expiresAt, new Date()));  // ❌ Inconsistent
}
```

**Problem:** Different methods use different timezone handling strategies, causing subtle bugs.

#### ✅ CORRECT - Consistent Timezone Handling

**Rule:** Use same approach for validation AND cleanup.

```typescript
// Both methods use PostgreSQL NOW() with AT TIME ZONE
async validatePasswordResetToken(token: string) {
  return db.execute(sql`WHERE (expires_at AT TIME ZONE 'UTC') > NOW()`);
}

async cleanupExpiredPasswordResetTokens() {
  return db.execute(sql`WHERE (expires_at AT TIME ZONE 'UTC') < NOW()`);
}
```

#### Detection Rule for Code Review

**Flag these patterns:**
1. `timestamp(` without `, { withTimezone: true }` in schema
2. Comparisons with `NOW()` on `timestamp` columns
3. Mixed timezone handling (some methods use `NOW()`, others use `new Date()`)

**Audit Command:**
```bash
# Find all timestamp columns without timezone
grep "timestamp(" shared/schema.ts | grep -v "withTimezone: true"

# Find comparisons with NOW()
grep -r "NOW()" server/ | grep -E "(timestamp|expires|created)"

# Find mixed patterns (both NOW() and new Date())
grep -A 5 -B 5 "NOW()" server/storage.ts | grep "new Date()"
```

#### When to Use Each Approach

| Approach | When to Use | Migration Effort |
|----------|-------------|------------------|
| **timestamptz in schema** | New tables, major refactor | High (schema migration) |
| **AT TIME ZONE workaround** | Existing tables, quick fix | Low (query changes only) |

**Recommendation:**
- **Short-term:** Use `AT TIME ZONE` workaround for existing tables
- **Long-term:** Migrate to `timestamptz` in schema during next major version

#### Related Bugs Catalog

**Production Issue:** Password reset tokens appeared valid after expiration
- **Root Cause:** `timestamp` vs `timestamptz` comparison
- **Fix:** Added `AT TIME ZONE 'UTC'` to queries
- **Learnings:** See `docs/LEARNINGS_TODO_005_AUTH_EXPIRED_TOKEN.md`

**Similar Issues Found:**
- `server/storage/domains/job-lock-storage.ts` - Same pattern in job locks
- Other tables TBD (needs full audit)

### 5.4 Application-Layer UTC Date Handling (NEW - 2025-12-09)

**Source**: Issue #179 - Price aggregation service timezone inconsistency
**Related**: `docs/08_TESTING_PATTERNS.md` (Server-Side UTC Date Handling section)

While Section 5.3 covers **database-level** timestamp handling, this section covers **application-layer** date calculations in JavaScript/TypeScript services.

#### The Problem: Local vs UTC Date Methods

JavaScript Date objects have two sets of methods: **local timezone** and **UTC**. Using local methods in server-side code causes timezone-dependent behavior:

```typescript
// WRONG - Local timezone methods (behavior varies by server location)
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);  // Local timezone!
yesterday.setHours(0, 0, 0, 0);

// Different servers produce different UTC values:
// - Server in PST: yesterday = Dec 8, 08:00:00 UTC
// - Server in UTC: yesterday = Dec 8, 00:00:00 UTC
// - Server in EST: yesterday = Dec 8, 05:00:00 UTC
```

#### ✅ CORRECT - UTC-First Service Pattern

**ALL service-layer date calculations MUST use UTC methods:**

```typescript
// server/services/price-aggregation-service.ts

// Date range calculation - Use Date.UTC()
private getDayDateRange(year: number, month: number, day: number) {
  // Use UTC to ensure consistent behavior across all server timezones
  const startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  return { startDate, endDate };
}

// Date extraction - Use UTC getters
const year = currentDate.getUTCFullYear();
const month = currentDate.getUTCMonth() + 1;  // 0-indexed to 1-indexed
const day = currentDate.getUTCDate();

// Date arithmetic - Use UTC setters
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
currentDate.setUTCDate(currentDate.getUTCDate() + 1);
```

#### Local vs UTC Method Reference

| Operation | Local (WRONG) | UTC (CORRECT) |
|-----------|---------------|---------------|
| Create date | `new Date(year, month, day)` | `new Date(Date.UTC(year, month, day))` |
| Get year | `getFullYear()` | `getUTCFullYear()` |
| Get month | `getMonth()` | `getUTCMonth()` |
| Get day | `getDate()` | `getUTCDate()` |
| Set day | `setDate()` | `setUTCDate()` |
| Set time | `setHours()` | `setUTCHours()` |

#### Common Anti-Pattern: Mixed Operations

```typescript
// ❌ WRONG - Mixing local and UTC (subtle bug)
const date = new Date();
date.setUTCDate(date.getDate() - 1);  // getDate() is local!

// ✅ CORRECT - Consistent UTC operations
const date = new Date();
date.setUTCDate(date.getUTCDate() - 1);  // Both UTC
```

#### When This Pattern Applies

**USE UTC methods for:**
- Date range calculations (start/end of day)
- Date arithmetic (adding/subtracting days)
- Storing dates in database (`recordedAt`, `createdAt`)
- Date comparisons and grouping

**Use LOCAL timezone for:**
- User-facing display (convert FROM UTC to user's timezone)
- Parsing user input (then immediately convert TO UTC)

#### Test Consistency Requirement

**CRITICAL**: Tests MUST use the same timezone handling as services:

```typescript
// If service uses UTC, test MUST use UTC
describe('PriceAggregationService', () => {
  it('should aggregate yesterday data', async () => {
    // ✅ CORRECT - Test uses UTC (matches service)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(12, 0, 0, 0);  // Noon UTC

    await db.insert(priceHistory).values({
      productId: testProduct.id,
      recordedAt: yesterday,
    });

    // Service also uses UTC internally - values will match
    const count = await service.calculateDailyAggregates();
    expect(count).toBe(1);
  });
});
```

**Reference:** `docs/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md` for complete debugging timeline and implementation details.

---

## 6. Type Safety in Queries

### 6.1 Integer Parsing Safety (ZERO TOLERANCE)

**Rule**: NEVER use raw `parseInt()` or `Number()` for user input or database values without validation.

#### ❌ ANTI-PATTERN - No Validation
```typescript
// Can return NaN, no validation
const id = parseInt(req.params.id);
const count = parseInt(userCount[0].count as string);
const limit = Number(req.query.limit);
```

#### ✅ CORRECT - For Route Parameters
```typescript
// Validated, throws on invalid input
import { parseIntSafe } from '../utils/validation-helpers';
const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
```

#### ✅ CORRECT - For SQL Count Results
```typescript
// Safe type checking with default
const count = userCount[0]?.count;
const numericCount = typeof count === 'number' ? count : (count ? Number(count) : 0);
```

**Why This Matters:**
- SQL count() returns string or number depending on driver
- parseInt() returns NaN on invalid input (fails silently)
- Type guards prevent runtime errors

**Detection Rule for Code Review:**
- Flag: ANY use of `parseInt(` or `Number(` without immediately following `|| 0` or `?? 0`
- Exception: Safe if preceded by `typeof count === 'number' ? count :`
- Suggest: Use parseIntSafe or type guard pattern

### 6.2 Type Assertion Documentation (MANDATORY)

**Rule**: ALL type assertions (`as` casts) MUST have inline comments explaining WHY.

#### ❌ ANTI-PATTERN - No Explanation
```typescript
// No explanation for cast
embedding: (product.embedding as number[] | null) || null,
const prices = offers.filter(p => p !== null) as number[];
```

#### ✅ CORRECT - Comment Explains
```typescript
// Comment explains Drizzle-specific behavior
// Type assertion: Drizzle stores JSON field as unknown, cast to expected vector array format
embedding: (product.embedding as number[] | null) || null,

// Comment explains filter() guarantees
// Type assertion: filter() removes nulls, TypeScript needs explicit cast to number[]
const prices = offers
  .filter(p => p !== null) as number[];
```

**Comment Format:**
```typescript
// Type assertion: [reason why cast is needed]
// Cast needed: [reason why cast is safe]
// Double type assertion needed: [reason for as unknown as pattern]
```

**Why This Matters:**
- Per TYPESCRIPT_PATTERNS.md, all type assertions need justification
- Helps future developers understand when assertion can be removed
- Documents Drizzle ORM quirks and database-specific behaviors

**Detection Rule for Code Review:**
- Flag: ANY `as SomeType` without comment in previous 1 line
- Exception: Simple casts like `as const` or `as any` (but flag `as any` separately)
- Suggest: Add "Type assertion: [reason]" comment

**Common Valid Reasons:**
- "Drizzle stores JSON field as unknown, cast to expected format"
- "filter() removes nulls, TypeScript needs explicit cast"
- "SQL json_agg() returns unknown, cast through unknown to target type"
- "Database returns string|number for count, safe cast after type guard"

### 6.3 Null vs Undefined Consistency (CRITICAL FOR APIS)

**Rule**: Use `| null` for database/API "not found", not `| undefined`.

#### ❌ ANTI-PATTERN - Inconsistent Return Types
```typescript
// Inconsistent return types for similar operations
interface IStorage {
  getRetailerById(id: number): Promise<Retailer | undefined>;  // Old pattern
  getProductById(id: number): Promise<Product | null>;         // New pattern
}
```

#### ✅ CORRECT - Consistent Null Pattern
```typescript
// Consistent null for "not found"
interface IStorage {
  getRetailerById(id: number): Promise<Retailer | null>;
  getProductById(id: number): Promise<Product | null>;
}

// Implementation:
async getRetailerById(id: number): Promise<Retailer | null> {
  const [result] = await db.select().from(retailers).where(eq(retailers.id, id)).limit(1);
  return result || null;  // Explicit null for "not found"
}
```

**Semantic Distinction:**
- **Use `| null`**: Database operations, API responses, "not found" scenarios
  - Represents: "Queried but no data exists"
  - Examples: getById(), findByEmail(), lookupUser()

- **Use `| undefined`**: Optional parameters, configuration, "not provided" scenarios
  - Represents: "Value was not provided" or "feature disabled"
  - Examples: function params, optional config fields

**Why This Matters:**
- `null` aligns with SQL NULL semantics
- Consistency makes API predictable for consumers
- Clear distinction: null = "searched but empty", undefined = "not searched"

**Detection Rule for Code Review:**
- Flag: Mixed `| undefined` and `| null` for similar CRUD operations in same interface
- Suggest: "Use | null for database operations (represents 'not found')"
- Check: All getById, update, delete methods should return `T | null`

### 6.4 SQL Aggregate Type Handling

**Rule**: SQL aggregates (count, sum, avg) can return string or number. Always handle both.

#### ❌ ANTI-PATTERN - Assumes Number
```typescript
// Assumes count is always number
const userCount = await tx.select({ count: sql`count(*)` }).from(users);
isFirstUser = userCount[0].count === 0;  // Type error if count is string
```

#### ✅ CORRECT - Type Guard Handles Both
```typescript
// Type guard handles both string and number
const userCount = await tx.select({ count: sql`count(*)` }).from(users);
const count = userCount[0]?.count;
const numericCount = typeof count === 'number' ? count : (count ? Number(count) : 0);
isFirstUser = numericCount === 0;
```

**Why This Matters:**
- PostgreSQL drivers may return count as string (e.g., "42")
- Type coercion can fail if not handled properly
- Optional chaining (?.) prevents undefined errors

**Pattern for Different Aggregates:**
```typescript
// COUNT - always returns non-null, default to 0
const count = typeof result.count === 'number' ? result.count : Number(result.count || 0);

// SUM/AVG - can be null if no rows
const avg = result.avg ? (typeof result.avg === 'number' ? result.avg : Number(result.avg)) : null;
```

### 6.5 Cursor-Based Pagination with Deterministic Sorting

**When:** Implementing infinite scroll for large datasets (Phase 1.2)

#### ❌ ANTI-PATTERN - No Secondary Sort Key
```typescript
// No secondary sort key
results.sort((a, b) => {
  return b.priceDropPercent - a.priceDropPercent; // What if equal?
});
```

**Problem:** When two items have equal sort values, order is indeterminate. This causes:
- Items appearing in different order on refresh
- Duplicate items across pages
- Skipped items when paginating

#### ✅ CORRECT - Deterministic Sort with Secondary Key
```typescript
// Deterministic sort with secondary key
results.sort((a, b) => {
  // Primary sort: price drop percent (descending)
  const primaryDiff = b.priceDropPercent - a.priceDropPercent;

  // Secondary sort: ID (ascending) for determinism
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

**Why this matters:**
- Pagination cursors are based on IDs
- If sort order changes, cursor becomes invalid
- Secondary sort ensures stable ordering across pagination

**General Pattern:**
```typescript
results.sort((a, b) => {
  const primaryDiff = /* primary comparison */;
  return primaryDiff !== 0 ? primaryDiff : a.id - b.id;
});
```

---

## 7. Production Bugs Catalog

**Context:** Bugs discovered during forum storage API testing migration (2025-11-28)

### 7.1 Stale Object Reference After UPDATE (CRITICAL)

**Rule:** When you UPDATE a record within a transaction and need to return the updated values, you MUST use `.returning()` and reassign the variable. Never return a stale object captured before the UPDATE.

#### ❌ ANTI-PATTERN - Returns Stale Object
```typescript
// Returns stale object with old values
async createTopicWithFirstPost(topicData: TopicInsert, postData: PostInsert): Promise<Topic> {
  return await db.transaction(async (tx) => {
    // Step 1: Create topic
    const [topic] = await tx.insert(forumTopics).values(topicData).returning();
    // topic.postCount is 0 here (default value)

    // Step 2: Create post
    await tx.insert(forumPosts).values({ topicId: topic.id, ...postData });

    // Step 3: Update the topic's postCount
    await tx.update(forumTopics)
      .set({ postCount: 1, lastPostAt: new Date() })
      .where(eq(forumTopics.id, topic.id));
    // NO .returning() - the update is applied to DB but not captured!

    // ❌ BUG: Returns original 'topic' object with postCount=0
    return topic;
  });
}
```

#### ✅ CORRECT - Use .returning() and Reassign
```typescript
// Use .returning() and reassign variable
async createTopicWithFirstPost(topicData: TopicInsert, postData: PostInsert): Promise<Topic> {
  return await db.transaction(async (tx) => {
    // Step 1: Create topic
    let [topic] = await tx.insert(forumTopics).values(topicData).returning();

    // Step 2: Create post
    await tx.insert(forumPosts).values({ topicId: topic.id, ...postData });

    // Step 3: Update AND CAPTURE the updated topic
    // BUG FIX: Use .returning() to get the updated values
    const [updatedTopic] = await tx.update(forumTopics)
      .set({ postCount: 1, lastPostAt: new Date() })
      .where(eq(forumTopics.id, topic.id))
      .returning();  // <-- CRITICAL: Capture updated values

    // ✅ Return the updated topic with correct postCount=1
    return updatedTopic;
  });
}
```

**Why This Happens:**
- JavaScript objects are captured by reference at assignment time
- Drizzle's `.returning()` returns the row state at INSERT time
- Subsequent UPDATEs modify the database but not the captured object
- Without `.returning()` on UPDATE, you return stale data

**Detection Rule for Code Review:**
- Flag: Any transaction that does INSERT + UPDATE on same table but returns the INSERT result
- Flag: `await tx.update(...).set(...).where(...)` without `.returning()` when the result is needed
- Pattern to look for: Variable from INSERT returned after UPDATE on same record

**Test Verification Pattern:**
```typescript
it('should return topic with postCount=1 after creation', async () => {
  const result = await storage.createTopicWithFirstPost(topicData, postData);

  // This test catches the stale object bug
  expect(result.postCount).toBe(1);  // Would fail with 0 if bug exists
});
```

### 7.2 Derived Field Truncation for Database Constraints (CRITICAL)

**Rule:** When generating derived fields (slugs, codes, identifiers) from user input, ALWAYS truncate to fit database constraints BEFORE insertion. Never assume user input will naturally fit within field limits.

#### ❌ ANTI-PATTERN - No Truncation
```typescript
// No truncation, will fail for long titles
async createTopic(topicData: TopicInsert): Promise<Topic> {
  // Generate slug from title
  const slug = topicData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // ❌ BUG: 500-char title creates 500-char slug
  // Database constraint: slug VARCHAR(255)
  // This INSERT will fail with constraint violation!
  const [topic] = await db.insert(forumTopics).values({
    ...topicData,
    slug,  // Could be 500 characters!
  }).returning();

  return topic;
}
```

#### ✅ CORRECT - Truncate Slug to Fit Constraint
```typescript
// Truncate slug to fit constraint
async createTopic(topicData: TopicInsert): Promise<Topic> {
  // Generate slug from title
  // Truncate to ensure it fits in VARCHAR(255) database constraint
  const MAX_SLUG_LENGTH = 250;  // Leave room for random suffix if needed
  const slug = topicData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, MAX_SLUG_LENGTH);  // <-- CRITICAL: Truncate

  const [topic] = await db.insert(forumTopics).values({
    ...topicData,
    slug,  // Guaranteed to fit in VARCHAR(255)
  }).returning();

  return topic;
}
```

**Common Derived Fields to Check:**
- **Slugs**: Generated from titles/names (truncate to 250-255)
- **Username/handle**: May be derived or sanitized (truncate to column limit)
- **Reference codes**: Generated from multiple fields (check combined length)
- **File paths**: Concatenated directory + filename (check OS limits too)
- **Search keys**: Generated from multiple fields (truncate to index limit)

**Detection Rule for Code Review:**
- Flag: Any `.replace()` or transformation chain without `.substring()` or `.slice()`
- Flag: String concatenation used in INSERT without length validation
- Check: What's the VARCHAR limit on the target column?

**Related Schema Pattern:**
```typescript
// In schema.ts - Document the constraint
export const forumTopics = pgTable('forum_topics', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }),  // Up to 500 chars
  slug: varchar('slug', { length: 255 }),    // NOTE: Must truncate derived slug!
  // ...
});
```

### 7.3 Drizzle ORM Error Code Detection (CRITICAL)

**Rule:** When implementing retry logic for Drizzle ORM database errors, check BOTH `error.message` patterns AND `error.cause.code` for PostgreSQL error codes. Drizzle wraps PostgreSQL errors in a cause property.

#### ❌ ANTI-PATTERN - Only Checks Message
```typescript
// Only checks error message, misses wrapped PostgreSQL error codes
export const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // This pattern misses Drizzle-wrapped errors!
  return message.includes('could not serialize') ||
         message.includes('deadlock detected');
};
```

#### ✅ CORRECT - Check Both Message and Cause Code
```typescript
// Check both message patterns AND PostgreSQL error codes
export const isTransientDatabaseError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  // Step 1: Check PostgreSQL error codes from error.cause (Drizzle wrapping)
  const cause = (error as unknown as { cause?: { code?: string } }).cause;
  if (cause?.code) {
    const pgErrorCode = cause.code;
    // PostgreSQL error codes for retryable errors:
    // 40001 = serialization_failure (SERIALIZABLE transaction conflict)
    // 40P01 = deadlock_detected
    // 08000-08999 = connection errors
    // 53000-53999 = insufficient resources
    const retryableCodes = ['40001', '40P01'];
    if (retryableCodes.includes(pgErrorCode)) {
      return true;
    }
  }

  // Step 2: Also check message patterns as fallback
  const message = error.message.toLowerCase();
  const transientPatterns = [
    'could not serialize',
    'deadlock detected',
    'connection refused',
    'connection terminated',
    // ... other patterns
  ];

  return transientPatterns.some(pattern => message.includes(pattern));
};
```

**PostgreSQL Error Code Reference:**
| Code | Name | When Retryable |
|------|------|----------------|
| 40001 | serialization_failure | SERIALIZABLE transaction conflict - RETRY |
| 40P01 | deadlock_detected | Deadlock - RETRY |
| 08000-08999 | connection errors | Connection issues - RETRY |
| 23505 | unique_violation | Data conflict - DO NOT RETRY |
| 23503 | foreign_key_violation | Data integrity - DO NOT RETRY |

**Why Drizzle Wraps Errors:**
- Drizzle ORM catches PostgreSQL errors and wraps them in JavaScript Error objects
- The original PostgreSQL error is preserved in `error.cause`
- `error.message` may be transformed/simplified by Drizzle
- `error.cause.code` contains the raw PostgreSQL SQLSTATE error code

**Detection Rule for Code Review:**
- Flag: Retry logic that only checks `error.message` without checking `error.cause`
- Flag: `isRetryable` functions without PostgreSQL error code handling
- Pattern to verify: Uses `(error as unknown as { cause?: { code?: string } }).cause?.code`

**Test Pattern for Retry Logic:**
```typescript
it('should retry on SERIALIZABLE conflict (error code 40001)', async () => {
  // Simulate Drizzle-wrapped PostgreSQL error
  const serialError = new Error('database error');
  (serialError as { cause?: { code: string } }).cause = { code: '40001' };

  expect(isTransientDatabaseError(serialError)).toBe(true);
});

it('should not retry on unique violation (error code 23505)', async () => {
  const uniqueError = new Error('unique constraint violation');
  (uniqueError as { cause?: { code: string } }).cause = { code: '23505' };

  expect(isTransientDatabaseError(uniqueError)).toBe(false);
});
```

---

## 8. Test Isolation Patterns

### 8.1 Test Database Cleanup with TRUNCATE CASCADE (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_001 + TODO_002 test fixes)

**Problem:** Using `db.delete()` for test cleanup causes:
- Data pollution between tests (sequences not reset)
- Foreign key constraint violations (wrong cleanup order)
- Slow cleanup (multiple DELETE queries)
- Flaky tests (data leaks between test runs)

#### ❌ ANTI-PATTERN - Individual Deletes

```typescript
beforeEach(async () => {
  // ❌ WRONG - Slow, doesn't reset sequences, order-dependent
  await db.delete(priceAlerts);
  await db.delete(notifications);
  await db.delete(productOffers);
  await db.delete(products);
  await db.delete(retailers);
  await db.delete(users);
  // Auto-increment IDs continue from previous test!
  // Foreign key order matters - easy to get wrong
});
```

**Symptoms:**
- Tests pass individually but fail as suite
- "Foreign key constraint violation" errors
- ID values incrementing across tests (ID 1, then 42, then 137)
- Expected 1 record, found 3 (data from previous tests)

#### ✅ CORRECT - TRUNCATE CASCADE Pattern

```typescript
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.CSRF_SECRET = 'test-csrf-secret-for-testing';

  // ✅ CORRECT - Fast, reliable, resets sequences
  // Clean database - TRUNCATE CASCADE for complete cleanup
  await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

  // Reset mocks if using Vitest
  vi.clearAllMocks();

  // Continue with test data setup...
});
```

**Key Benefits:**
1. **RESTART IDENTITY** - Resets auto-increment sequences (IDs start at 1)
2. **CASCADE** - Handles foreign key cascades automatically
3. **Speed** - Single command per table (10x faster than DELETE)
4. **Reliability** - No foreign key order issues
5. **Isolation** - Each test starts with clean slate

#### Cleanup Order Guidelines

**Children before parents** (although CASCADE handles this automatically):

```typescript
// 1. Child tables (have foreign keys TO other tables)
await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);

// 2. Parent tables (other tables reference these)
await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
```

#### Pre-Commit Hook Detection (WARNING 18 - NEW Phase 5)

The pre-commit hook (v3.4) detects `db.delete()` usage in test cleanup hooks and flags it with WARNING 18.

**Detection Pattern:**
- Hook searches for test files with BOTH cleanup hooks AND `db.delete()` usage
- Files with `beforeEach`/`afterEach`/`beforeAll`/`afterAll` AND `db.delete()` are flagged

**Bypass for Legitimate Delete Tests:**

When testing actual delete functionality (not cleanup), add the bypass comment:

```typescript
// ✅ BYPASS - Testing delete functionality explicitly
describe('Delete User API', () => {
  it('should delete user by ID', async () => {
    // This delete is the TEST SUBJECT, not cleanup
    await db.delete(users).where(eq(users.id, 1)); // Testing delete functionality

    // Verify deletion worked
    const result = await db.select().from(users).where(eq(users.id, 1));
    expect(result.length).toBe(0);
  });
});
```

**When to Use Bypass:**
- Testing the delete functionality itself (integration tests for DELETE endpoints)
- Testing cascade behavior (verifying children are deleted with parent)
- Testing soft delete implementations

**When NOT to Use Bypass:**
- Cleanup in `beforeEach`/`afterEach` - use TRUNCATE CASCADE instead
- Resetting test state - use TRUNCATE CASCADE
- Any cleanup operation - use TRUNCATE CASCADE

### 8.2 Test Data Type Safety (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 fix)

**Problem:** Zod schemas enforce strict type checking - strings don't coerce to numbers.

#### ❌ ANTI-PATTERN - Wrong Data Types

```typescript
it('should create alert', async () => {
  const response = await request(app)
    .post('/api/alerts')
    .set('Cookie', authCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      productId: testProductId,
      targetPrice: '249.99', // ❌ WRONG - String instead of number
      notifyForum: false,
    });

  // Response: 400 validation error
});
```

#### ✅ CORRECT - Proper Types

```typescript
it('should create alert', async () => {
  const response = await request(app)
    .post('/api/alerts')
    .set('Cookie', authCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({
      productId: testProductId,
      targetPrice: 249.99, // ✅ CORRECT - Number matches schema
      notifyForum: false,
    });

  expect(response.status).toBe(201);
});
```

**Rule:** Match test data types to Zod schema types exactly.

| Zod Schema | ✅ Test Data | ❌ Wrong Type |
|------------|--------------|---------------|
| `z.number().positive()` | `249.99` | `'249.99'` |
| `z.boolean()` | `false` | `'false'` |
| `z.number().int()` | `123` | `'123'` |
| `z.string()` | `'Test'` | `123` |

### 8.3 CSRF Middleware Order in Tests (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 fix)

**Problem:** CSRF middleware runs BEFORE auth middleware, affecting error codes in tests.

#### ❌ ANTI-PATTERN - Wrong Error Expectation

```typescript
it('should require authentication (POST /api/alerts)', async () => {
  const response = await request(app)
    .post('/api/alerts')
    .send({ productId: testProductId, targetPrice: 249.99 });

  // ❌ WRONG - Expects 401 (auth) but gets 403 (CSRF)
  expect(response.status).toBe(401);
});
```

**Why:** Middleware pipeline order is: CSRF → Auth → Route Handler

#### ✅ CORRECT - Expect CSRF Error First

```typescript
it('should require authentication (POST /api/alerts)', async () => {
  const response = await request(app)
    .post('/api/alerts')
    .send({ productId: testProductId, targetPrice: 249.99 });

  // ✅ CORRECT - CSRF runs before auth, so 403
  expect(response.status).toBe(403);
  expect(response.body.error).toContain('CSRF');
});

it('should require CSRF token', async () => {
  const response = await request(app)
    .post('/api/alerts')
    .set('Cookie', authCookie) // Authenticated but no CSRF token
    .send({ productId: testProductId, targetPrice: 249.99 });

  expect(response.status).toBe(403);
  expect(response.body.error).toContain('CSRF');
});
```

**Error Code Order:**
1. **403** - CSRF token missing (CSRF middleware fails)
2. **401** - Not authenticated (auth middleware fails)
3. **400** - Validation error (route validation fails)
4. **200/201** - Success

### 8.4 CSRF Mock Standardization (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 fix)

**Problem:** Even mocked middleware must use standardized response helpers.

#### ❌ ANTI-PATTERN - Manual JSON Responses

```typescript
vi.mock('../middleware/security', () => ({
  csrfProtection: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-csrf-token']) {
      // ❌ WRONG - Manual JSON response
      return res.status(403).json({ error: 'CSRF token missing' });
    }
    next();
  },
}));
```

#### ✅ CORRECT - Use sendError() Helper

```typescript
import { sendError } from '../utils/api-response';

vi.mock('../middleware/security', () => ({
  csrfProtection: (req: Request, res: Response, next: NextFunction) => {
    if (!req.headers['x-csrf-token']) {
      // ✅ CORRECT - Use standardized helper
      sendError(res, 'CSRF token missing or invalid', 403);
      return;
    }
    next();
  },
}));
```

**Why:** Ensures consistent error response format across all endpoints and tests.

### 8.5 Test Cleanup Verification Pattern

**Optional but recommended** - Verify cleanup worked:

```typescript
afterEach(async () => {
  // Verify cleanup worked
  const alertCount = await db.select({ count: sql<number>`count(*)` })
    .from(priceAlerts);

  const notificationCount = await db.select({ count: sql<number>`count(*)` })
    .from(notifications);

  const countNum = typeof alertCount[0]?.count === 'number'
    ? alertCount[0].count
    : Number(alertCount[0]?.count || 0);

  const notifCountNum = typeof notificationCount[0]?.count === 'number'
    ? notificationCount[0].count
    : Number(notificationCount[0]?.count || 0);

  if (countNum > 0) {
    console.error(`❌ ${countNum} alerts remain after test`);
  }

  if (notifCountNum > 0) {
    console.error(`❌ ${notifCountNum} notifications remain`);
  }
});
```

---

## 9. Migration Patterns

### 8.1 Facade Pattern for Incremental Migration

**When:** Decomposing a large monolithic file while maintaining backward compatibility

#### Implementation
```typescript
// server/storage/index.ts (Facade)
/**
 * Storage Layer Facade
 *
 * IMPORTANT: This facade maintains ZERO breaking changes - all existing imports continue to work.
 */

// Re-export the IStorage interface (will be assembled from domain interfaces in later phases)
export type { IStorage } from "../storage";

// Re-export all type definitions from the new centralized types module
export * from "./types";

// Re-export the base storage class for domain repositories (Phase 2+)
export { BaseStorage } from "./base-storage";

// For now, re-export from parent to maintain backward compatibility
export { storage } from "../storage";
```

**Why This Works:**
- **No import changes required**: Consumers can continue importing from `server/storage` OR `server/storage/index`
- **Incremental extraction**: Move types first, then base class, then domain repositories
- **Testable migrations**: Each extraction can be tested independently
- **Rollback safety**: If extraction causes issues, the facade can be reverted

### 8.2 Centralized Type Extraction

**Pattern:** Extract all type definitions to a dedicated `types.ts` file, organized by domain with comprehensive documentation.

#### File Structure
```typescript
// server/storage/types.ts

/**
 * Storage Layer Type Definitions
 *
 * IMPORTANT NOTES:
 * - **Price fields are strings**: Matches schema.ts Decimal type mapping (PostgreSQL numeric -> string)
 * - **SafeUser type**: Intentionally excludes passwordHash (SECURITY: NEVER expose)
 * - **Input validation**: All storage methods should validate numeric inputs (see CLAUDE.md)
 * - **Null handling**: Explicit `| null` matches database schema nullable columns
 *
 * Phase 1: Foundation - Extracted from monolithic storage.ts
 */

import type {
  PriceHistory,
  Retailer,
  Product,
  // ... schema imports
} from "@shared/schema";

// ============================================================================
// Job Lock Types
// ============================================================================

export interface JobLock {
  id: number;
  jobName: string;
  // ...
}

// ============================================================================
// Price History Types
// ============================================================================

export interface PriceHistoryWithDetails extends PriceHistory {
  retailerName: string;
  retailerLogo: string | null;
}

// ... domain-grouped types continue
```

**Documentation Requirements:**

Every types file MUST include:

1. **IMPORTANT NOTES section**: Explain non-obvious design decisions
   - Decimal/string mappings for PostgreSQL
   - Security-sensitive type exclusions
   - Validation expectations
   - Null handling conventions

2. **Domain separators**: Use comment blocks to group related types
   ```typescript
   // ============================================================================
   // Domain Name Types
   // ============================================================================
   ```

3. **Security markers**: Use pre-commit-hook-compatible markers
   ```typescript
   // SafeUser type: Intentionally excludes passwordHash (SECURITY: NEVER expose)
   export interface SafeUser {
     id: number;
     username: string;
     email: string;
     // passwordHash explicitly omitted
   }
   ```

4. **Phase markers**: Track migration progress
   ```typescript
   * Phase 1: Foundation - Extracted from monolithic storage.ts
   ```

### 8.3 Abstract Base Class Pattern

**Pattern:** Create an abstract base class that provides common utilities, error handling, and documentation for all domain repositories.

#### Implementation
```typescript
// server/storage/base-storage.ts

/**
 * Base Storage Class
 *
 * IMPLEMENTATION GUIDANCE FOR PHASE 2+ DOMAIN REPOSITORIES:
 *
 * 1. **Input Validation**: Validate all numeric IDs are positive (use parseIntSafe for request params)
 * 2. **N+1 Prevention**: Use explicit field selection and JOINs, never query in loops
 * 3. **Security**: NEVER expose passwordHash (SECURITY: NEVER expose) - always use SafeUser type
 * 4. **Error Handling**: Use handleError() for storage errors; routes must use createErrorResponse()
 * 5. **Transactions**: Wrap multi-step operations in db.transaction() for atomicity
 * 6. **Retry Logic**: Handle transient DB errors with retryWithBackoff utility
 * 7. **Logging**: Use logSuccess() for completed operations to maintain consistency
 *
 * Phase 1: Foundation - Extracted from monolithic storage.ts
 */

import type { db } from "../db";
import { logger } from "../utils/logger";

// Type alias for the database connection
type Database = typeof db;

export abstract class BaseStorage {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  protected handleError(error: unknown, operation: string): never {
    logger.error(`${operation} failed`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  protected logSuccess(operation: string, details?: Record<string, unknown>): void {
    logger.info(`${operation} completed successfully`, details);
  }
}
```

**Implementation Guidance Pattern:**

The 7-point implementation guidance serves as in-code documentation for future developers:

1. **Input Validation** - References parseIntSafe utility
2. **N+1 Prevention** - Explicitly states the batch query requirement
3. **Security** - Uses pre-commit-hook-compatible marker
4. **Error Handling** - Clarifies responsibility split (storage vs routes)
5. **Transactions** - References atomicity requirements
6. **Retry Logic** - Points to utility for transient errors
7. **Logging** - Ensures consistent observability

### 7.4 Database Triggers in Testing (CRITICAL)

**Date Discovered**: 2025-12-02 (TODO_003)
**Rule:** Database triggers can create "phantom data" that appears in tests without explicit creation. Always check for triggers when unexpected data appears, and clean up trigger-created data in test setup.

#### Common Trigger Problem: Auto-Created Default Records

**Symptom:**
- Tests expect specific count, get more records than created
- Records appear with specific names/flags (`isDefault: true`, `name: "My Watches"`)
- Data exists without explicit INSERT in test code

**Root Cause:**
```sql
-- migrations/0008_add_watch_lists.sql
CREATE TRIGGER trigger_create_default_watch_list
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_watch_list();

-- This trigger automatically creates a watchlist when user is inserted!
CREATE FUNCTION create_default_watch_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO watch_lists (user_id, name, description, is_default)
  VALUES (NEW.id, 'My Watches', 'Default watch list', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### ❌ ANTI-PATTERN - Ignoring Trigger Effects

```typescript
// Test creates user but doesn't account for trigger
beforeEach(async () => {
  [testUser] = await db.insert(users).values({
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hash',
  }).returning();
  // Hidden: Trigger just created a default watchlist!
});

// ❌ Test fails - expected 2, got 3 (2 explicit + 1 from trigger)
it('should return all watch lists for user', async () => {
  await db.insert(watchLists).values([
    { userId: testUser.id, name: 'List 1' },
    { userId: testUser.id, name: 'List 2' },
  ]);

  const lists = await storage.getUserWatchLists(testUser.id);
  expect(lists).toHaveLength(2); // FAILS: Got 3!
});
```

#### ✅ CORRECT - Clean Up Trigger Data in Test Setup

```typescript
/**
 * NOTE: Database trigger auto-creates default watchlist on user insert
 * - Trigger: trigger_create_default_watch_list
 * - Migration: migrations/0008_add_watch_lists.sql (lines 45-55)
 * - Creates watchlist with name="My Watches", isDefault=true
 * - We delete this in beforeEach cleanup to isolate tests
 */
beforeEach(async () => {
  // Create test user
  [testUser] = await db.insert(users).values({
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hash',
  }).returning();

  // Delete auto-created default watchlist (created by trigger)
  // This ensures tests start with a clean slate and test explicit creation
  await db.delete(watchLists).where(eq(watchLists.userId, testUser.id));
});

// ✅ Test passes - only explicit watchlists counted
it('should return all watch lists for user', async () => {
  await db.insert(watchLists).values([
    { userId: testUser.id, name: 'List 1' },
    { userId: testUser.id, name: 'List 2' },
  ]);

  const lists = await storage.getUserWatchLists(testUser.id);
  expect(lists).toHaveLength(2); // PASSES: Got 2!
});
```

#### Discovery Pattern for Triggers

When tests have "phantom data":

```bash
# Search for triggers in migrations
grep -rn "CREATE TRIGGER" migrations/

# Search for trigger functions
grep -rn "CREATE FUNCTION" migrations/

# Find what the trigger creates
grep -rn "My Watches\|isDefault.*true" migrations/
```

**Common Trigger Patterns to Watch For:**

| Trigger Type | What It Does | Test Impact |
|--------------|--------------|-------------|
| **Default record creation** | Creates initial records (profiles, settings, watchlists) | Count assertions fail |
| **Audit trail** | Creates audit/log records | More records than expected |
| **Cascade updates** | Updates related tables | Unexpected field values |
| **Data validation** | Rejects or modifies inserts | Tests fail unexpectedly |
| **Denormalization** | Updates cached counts | Computed fields don't match |

#### Testing Strategies for Triggers

**Strategy 1: Delete Trigger Data (Recommended)**
```typescript
// Clean up auto-created data in beforeEach
await db.delete(tableName).where(eq(tableName.isDefault, true));
```

**Pros**: ✅ Tests explicit behavior, ✅ Maintains production trigger, ✅ Clean test isolation
**Cons**: ❌ Requires understanding trigger behavior

**Strategy 2: Filter Trigger Data in Assertions**
```typescript
// Filter out default records in test
const nonDefaultLists = lists.filter(l => !l.isDefault);
expect(nonDefaultLists).toHaveLength(2);
```

**Pros**: ✅ No setup changes
**Cons**: ❌ Hides production behavior, ❌ Clutters every test

**Strategy 3: Environment Check in Trigger (NOT Recommended)**
```sql
-- Add environment check to trigger function
CREATE FUNCTION create_default_watch_list() RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.environment', true) != 'test' THEN
    INSERT INTO watch_lists (...) VALUES (...);
  END IF;
  RETURN NEW;
END;
```

**Pros**: ✅ No test changes needed
**Cons**: ❌ Production code for test concerns, ❌ Harder to test actual prod behavior, ❌ Requires config management

**Verdict**: Use Strategy 1 (delete in beforeEach) - it's explicit, maintainable, and tests real behavior.

#### Documentation Requirements

When working with database triggers in tests:

1. **Document the trigger** in test comments:
   ```typescript
   /**
    * NOTE: Database trigger auto-creates [entity] on [event]
    * - Trigger: trigger_name
    * - Migration: migrations/NNNN_file.sql (lines XX-YY)
    * - Creates [what it creates]
    * - We [how we handle it in tests]
    */
   ```

2. **Comment cleanup strategy**:
   ```typescript
   // Delete auto-created [entity] (created by trigger_name)
   // This ensures tests start with a clean slate
   ```

3. **Reference in migration file**:
   ```sql
   -- NOTE: This trigger creates default records
   -- Test cleanup: Tests delete these in beforeEach
   CREATE TRIGGER trigger_name ...
   ```

#### Related Testing Patterns

- **Test Isolation**: See `LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md` for TRUNCATE CASCADE patterns
- **Storage Layer Testing**: See `LEARNINGS_TODO_003_STORAGE_WATCHLIST_FIX.md` for trigger discovery process
- **Database Cleanup**: Section 7.1 for transaction boundaries in tests

**Reference Issue**: TODO_003 - Storage watchlist test fixes (2025-12-02)

---

## 9. Redis-Native Patterns (NEW - 2025-12-05)

**Context:** Account lockout middleware refactoring (TODO_001) reduced 623 LOC to 150 LOC (76% reduction) by using Redis-native TTL features instead of reimplementing expiration logic.

**Reference:** `docs/LEARNINGS_TODO_001_REDIS_SIMPLIFICATION.md`

### 9.1 Platform-Feature-First Principle

**Before implementing custom expiration/caching logic, ask:**

1. Does Redis already solve this? (TTL, EXPIRE, SETEX)
2. Does PostgreSQL already solve this? (pg_cron, table partitioning)
3. What edge cases does the platform already handle?

### 9.2 Over-Engineering Signals (Flag Immediately)

```typescript
// SIGNAL 1: Dual storage backends
const fallbackCache = new Map<string, CacheEntry>();  // In-memory fallback
await redis.set(key, value);  // Redis primary
// PROBLEM: Maintaining two storage systems for same data

// SIGNAL 2: Manual cleanup intervals
setInterval(() => {
  for (const [key, value] of cache.entries()) {
    if (value.expiresAt < Date.now()) cache.delete(key);
  }
}, CLEANUP_INTERVAL);
// PROBLEM: Reimplementing what Redis EXPIRE does automatically

// SIGNAL 3: Custom TTL tracking
interface CacheEntry {
  value: string;
  createdAt: number;
  expiresAt: number;  // Manual TTL tracking
  lastAccess: number; // LRU tracking
}
// PROBLEM: Redis handles TTL natively via EXPIRE

// SIGNAL 4: Memory exhaustion prevention
const MAX_ENTRIES = 10000;
if (cache.size > MAX_ENTRIES) {
  // Sort by lastAccess, remove oldest 20%...
}
// PROBLEM: Redis maxmemory + maxmemory-policy handles this
```

### 9.3 Redis-Native Patterns (CORRECT)

#### Pattern 1: Atomic Counter with TTL (Rate Limiting, Lockout)

```typescript
// Increment counter atomically, set TTL on first access
const attempts = await redis.incr(key);
if (attempts === 1) {
  await redis.expire(key, TTL_SECONDS);  // Redis handles cleanup
}
```

**Why this works:**
- `INCR` is atomic (race-condition safe)
- `EXPIRE` triggers automatic deletion (no cleanup intervals needed)
- Single storage backend (no dual Map + Redis)

#### Pattern 2: Lock Flag with Automatic Expiration

```typescript
// Set locked flag that auto-expires (no manual cleanup)
if (attempts >= MAX_ATTEMPTS) {
  await redis.setex(`locked:${email}`, LOCKOUT_SECONDS, '1');
}

// Check existence (simpler than parsing values)
const isLocked = await redis.exists(`locked:${email}`);
```

**Why this works:**
- `SETEX` = atomic SET + EXPIRE in single command
- Flag auto-deletes after TTL (no cleanup logic needed)
- `EXISTS` is O(1) and avoids parsing

#### Pattern 3: Graceful Degradation (Fail Open)

```typescript
const redis = getRedisClient();
if (!redis) {
  // Fail open for security enhancements (not requirements)
  return { locked: false };
}
```

**Decision Framework:**

| Feature Type | Fail Mode | Rationale |
|--------------|-----------|-----------|
| Account lockout | Fail open | Enhancement - better to allow login than block legitimate users |
| Rate limiting | Fail open | Enhancement - service availability over perfect limiting |
| Session storage | Fail closed | Requirement - no fallback acceptable |
| Authentication | Fail closed | Requirement - security-critical |

### 9.4 Simplification Mapping

| What You Built | What Redis Provides |
|----------------|---------------------|
| Manual TTL tracking (expiresAt field) | `EXPIRE key seconds` |
| setInterval cleanup | Automatic key expiration (passive + active) |
| Memory cap with LRU eviction | `maxmemory` + `maxmemory-policy allkeys-lru` |
| GET-check-SET race condition handling | `INCR` (atomic), `SETEX` (atomic) |
| JSON parsing for simple counters | `INCR`/`DECR` native integer operations |
| Sync/async function pairs | Async-only (modern pattern) |

### 9.5 Anti-Pattern: JSON for Simple Values

```typescript
// WRONG: Parsing JSON for simple counter
const data = await redis.get(key);
const parsed = JSON.parse(data || '{"count": 0}');
parsed.count++;
await redis.set(key, JSON.stringify(parsed));
// PROBLEMS: Race condition, unnecessary serialization

// CORRECT: Use Redis native integer operations
const count = await redis.incr(key);  // Atomic, returns integer
```

### 9.6 When NOT to Simplify

Keep custom logic when:

1. **Business logic varies by environment** - Platform features are opinionated
2. **Data must persist beyond Redis restart** - Use PostgreSQL instead
3. **Complex state machines** - May need explicit transition control
4. **Audit logging required** - Needs persistence, not TTL
5. **Graceful degradation IS the primary path** - When Redis is expected to be unavailable frequently

### 9.7 Metrics from TODO_001

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines of Code | 623 | 150 | 76% reduction |
| Functions | 12 | 5 | 58% reduction |
| Storage Backends | 2 (Redis + Map) | 1 (Redis) | 50% reduction |
| Cleanup Logic | Manual (setInterval) | Automatic (TTL) | Eliminated |
| Code Review Issues | 0 | 1 (minor - parseInt radix) | Validates approach |

**Key Insight:** Simpler code using platform primitives = more reliable code.

---

## 10. When NOT to Optimize (Critical Decision Framework)

### 10.1 The Background Job Exception

**Anti-Pattern:** Optimizing non-user-facing operations that perform adequately

**Real-World Example:** Date-range aggregation loop (TODO_003)

#### ❌ PREMATURE OPTIMIZATION

```typescript
// Current: Simple loop processing one day per transaction
while (currentDate <= endDate) {
  await db.transaction(async (tx) => {
    // Query for this single day
    const priceData = await tx.select(...)
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, dayStart))
      .where(lt(priceHistory.recordedAt, dayEnd));

    // Aggregate and insert for this day
    if (priceData.length > 0) {
      await tx.insert(priceAggregatesDaily).values(aggregates);
    }
  });

  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
}
```

**Performance:** 90-day range = ~9 seconds (in background job)

**Developer says:** "This is N+1! We need to optimize it to 500ms!"

**Reality check:**
- ✅ Simple loop - anyone can understand it
- ✅ Per-day error isolation - day 45 fails, days 46-90 still process
- ✅ Incremental logging - see which day is processing
- ✅ Force re-aggregation - easy to re-run specific days
- ✅ Works correctly - tested, debugged, production-ready
- ⚠️ Runs in **weekly background job** - not user-facing
- ⚠️ 9 seconds for 90 days = **100ms per day** - perfectly adequate

#### ✅ CORRECT DECISION: Keep the Loop

**Rationale:**
1. **Context matters:** Background jobs can take seconds without user impact
2. **Simplicity has value:** Error isolation, debuggability, maintainability
3. **No measured problem:** No user complaints, no production bottlenecks
4. **Risk vs reward:** Trading battle-tested code for 8.5 seconds in a weekly job

### 10.2 Decision Framework: Is Optimization Worth It?

Ask these questions **in order** before optimizing:

#### Question 1: Is it user-facing?
- **NO** → De-prioritize optimization (background jobs, admin tools, scheduled tasks)
- **YES** → Continue to Question 2

#### Question 2: Is performance measured as inadequate?
- **NO** → Don't optimize (speculation doesn't count)
- **YES** → Continue to Question 3

**What counts as "measured":**
- Profiling data with actual timings
- Production metrics showing slowness
- User complaints about slow load times
- P95/P99 latency metrics exceeding SLAs

**What DOESN'T count:**
- "It feels slow"
- "At 10x scale it will be slow" (you don't have 10x scale)
- "This is an N+1 pattern" (not all N+1s are problems)
- Theoretical performance calculations

#### Question 3: Does it block critical paths?
- **NO** → De-prioritize (can users complete their task despite slowness?)
- **YES** → Continue to Question 4

#### Question 4: Have you tried the simple fixes first?

**Before rewriting queries, try:**
1. **Add indexes** - 90% of "slow queries" are missing indexes
2. **Adjust batch size** - Process 10 days instead of 1, don't jump to complex SQL
3. **Add progress indicators** - If user-facing, show "Processing... 45% complete"
4. **Run less frequently** - Does daily aggregation need to run hourly?
5. **Add caching** - Can you cache the result for 5 minutes?

**Only if all simple fixes fail → Consider complex optimization**

### 10.3 Cost-Benefit Analysis Template

When proposing optimization, document:

| Factor | Current | Proposed | Trade-off |
|--------|---------|----------|-----------|
| **Performance** | 9s (background job) | 500ms | +8.5s saved |
| **Code complexity** | Simple loop (9/10 readability) | Complex SQL (5/10 readability) | -4 points |
| **Error isolation** | Per-day (can retry single day) | All-or-nothing (90 days fail together) | Lost capability |
| **Debugging ease** | Logs show which day processing | Single query, unclear where it fails | Harder to debug |
| **Business logic** | Median, volatility, day-over-day | SQL can't handle (must move to app) | Added complexity |
| **Testing burden** | Simple assertions | Complex edge cases (timezone, concurrent inserts) | +3-4 test cases |
| **Risk of bugs** | Low (battle-tested) | Medium (new complex SQL) | Production risk |

**Decision:** Keep simple code. 8.5 seconds in weekly background job doesn't justify the complexity cost.

### 10.4 Real-World Patterns That Justify Optimization

**DO optimize when:**

✅ **User-facing P95 latency > 200ms**
```typescript
// User clicks "View Product" → sees loading spinner for 3 seconds
// This MUST be optimized (join tables, add indexes, cache)
```

✅ **N+1 in request-response cycle**
```typescript
// GET /api/products returns 100 products
// For each product, make 1 query to fetch price
// → 101 queries blocking HTTP response
```

✅ **Blocking critical business operations**
```typescript
// Checkout process waits for inventory check
// Inventory query takes 5 seconds
// → Users abandon cart
```

✅ **Exponential scaling (10x data = 100x time)**
```typescript
// 100 products = 1s
// 1,000 products = 100s (not 10s)
// → Algorithm is O(n²), must fix
```

**DON'T optimize when:**

❌ **Background jobs performing adequately**
```typescript
// Nightly report generation takes 2 minutes
// Runs at 3am, nobody watches it
// → Not worth the complexity
```

❌ **Admin tools with low usage**
```typescript
// Admin gap-filling endpoint takes 5 seconds
// Used once per month by 1 admin
// → Admin can wait 5 seconds
```

❌ **Theoretical future scale**
```typescript
// "At 10x users, this will be slow"
// You have 50 users today
// → Solve 10x problems when you have 10x users
```

❌ **Non-blocking background processing**
```typescript
// Email sending after signup takes 500ms
// User sees "Check your email" immediately
// → 500ms is fine, user doesn't wait
```

### 10.5 The "60-Second Rule" for Background Jobs

**Guideline:** Background jobs under 60 seconds rarely need optimization.

**Rationale:**
- Scheduled jobs run when users aren't waiting
- Error retry logic can handle occasional slowness
- Complexity cost outweighs marginal gains
- Resources can be added (more RAM, faster DB) when needed

**When to revisit:**
- Job exceeds 60 seconds (measured, not estimated)
- Job must run more frequently (hourly → every 5 min)
- Job becomes user-facing (batch → real-time)
- Users complain about stale data

**Example from TODO_003:**
```
Current: 90-day aggregation = 9 seconds (weekly background job)
Threshold: 60 seconds
Decision: Deferred until exceeds threshold OR context changes
Priority: P3 (nice-to-have)
```

### 10.6 Pattern: Defer Optimization, Document Threshold

When deferring optimization, document the decision:

```markdown
## TODO_XXX: [Feature] Performance Optimization

**Status:** deferred
**Priority:** P3 (Nice-to-have)

**Current Performance:**
- 90-day aggregation: 9 seconds
- Context: Weekly background job (not user-facing)
- Impact: None (users don't wait for this)

**Threshold for Revisiting:**
- Job exceeds 60 seconds (measured with profiling), OR
- Job becomes user-facing, OR
- Users complain about stale data, OR
- We reach 10x scale (whichever comes first)

**Why Deferred:**
- Background job context makes 9s acceptable
- Current code is simple, maintainable, correct
- No measured user impact
- Optimization adds complexity without proportional benefit

**If Optimization Becomes Necessary:**
1. Add index on (recorded_at, product_id, retailer_id, aggregated_at)
2. Profile to identify actual bottleneck
3. Try 10-day batching (simple) before complex SQL (complex)
```

### 10.7 Multi-Agent Review Pattern (TODO_003 Case Study)

**Context:** Price aggregation loop proposed for optimization

**Review Process:** Three specialized agents analyzed in parallel:
1. **DHH Rails Reviewer** - Pragmatic web development philosophy
2. **Code Simplicity Reviewer** - YAGNI and complexity analysis
3. **Kieran Technical Reviewer** - Code quality and correctness

**Unanimous Finding:** Premature optimization

**Key Insights:**
- **DHH:** "9 seconds for weekly background job is not slow. Ship features instead."
- **Simplicity:** "Current code clarity: 9/10. Proposed: 5/10. Trading maintainability for 8.5s."
- **Kieran:** "Proposed SQL omits median, volatility, day-over-day change. Will break production."

**Decision:** Deferred to P3. Focus on user-facing features.

**Pattern Codified:** Background jobs under 60s rarely justify optimization complexity.

---

## Review Checklist for Database Code

When reviewing database-related code, check:

### Security
- [ ] No passwordHash in SELECT queries (use explicit field list)
- [ ] No raw parseInt/Number without validation
- [ ] All user input validated via Zod or parseIntSafe

### Type Safety
- [ ] All `as` casts have explanatory comments
- [ ] Consistent null vs undefined usage
- [ ] SQL aggregates handled with type guards

### Database Patterns
- [ ] No N+1 queries (no queries in loops)
- [ ] Multi-step operations use transactions
- [ ] Batch operations use inArray() or JOINs
- [ ] Map() used for O(1) lookups in batch processing

### Documentation
- [ ] Complex type assertions documented
- [ ] Database-specific quirks explained (e.g., Drizzle JSON handling)
- [ ] Validation helpers referenced when used

### Architecture
- [ ] No direct `db` imports in services (except documented exceptions)
- [ ] All database access through `storage.*` methods
- [ ] Service layer has business logic, storage layer has data access
- [ ] Methods added to IStorage interface, DatabaseStorage, and MemStorage

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [Pre-commit Hook](.git/hooks/pre-commit) - Automated checks
- [Storage Layer](../server/storage.ts) - Database abstraction
- [Schema](../shared/schema.ts) - Database schema definitions
- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) - Password hash handling, input validation
- [TYPESCRIPT_PATTERNS.md](TYPESCRIPT_PATTERNS.md) - Type safety, avoiding `any`, type assertions
- [API_PATTERNS.md](API_PATTERNS.md) - Route organization, middleware pipeline, caching, pagination
