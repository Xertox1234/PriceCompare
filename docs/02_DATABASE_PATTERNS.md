# Database Patterns & Anti-Patterns

**Version:** 2.1
**Last Updated:** 2025-12-03
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
6. [Type Safety in Queries](#6-type-safety-in-queries)
7. [Production Bugs Catalog](#7-production-bugs-catalog)
8. [Migration Patterns](#8-migration-patterns)

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
