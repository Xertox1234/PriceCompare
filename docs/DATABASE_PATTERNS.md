---
Pattern: Database Patterns & Anti-Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [SECURITY_PATTERNS.md, API_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md, ERROR_HANDLING_PATTERNS.md]
---

# Database Patterns & Anti-Patterns

This document codifies database patterns and anti-patterns in the PriceCompare codebase to prevent common mistakes and ensure data integrity.

## Table of Contents
- [Critical Anti-Patterns](#critical-anti-patterns)
- [Transaction Patterns](#transaction-patterns)
- [Query Optimization](#query-optimization)
- [Foreign Key Management](#foreign-key-management)
- [Field Selection Security](#field-selection-security)
- [Drizzle ORM Patterns](#drizzle-orm-patterns)
- [Architecture Decisions](#architecture-decisions)

---

## Critical Anti-Patterns

These patterns will **FAIL pre-commit hooks** and must be fixed before committing.

### 1. N+1 Query Pattern (COMMIT BLOCKER)

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

### 2. Password Hash Exposure (COMMIT BLOCKER)

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

### 2. Promise.all vs Promise.allSettled for Batch Operations

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

## Transaction Patterns

### When Transactions Are MANDATORY

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

### Transaction Isolation Levels

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

### What NOT to Include in Transactions

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

## Query Optimization

### Use Database Aggregations

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

### Use Database Grouping

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

### Batch Operations

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

### Parallel Independent Queries

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

## Foreign Key Management

### Cascade Rules Are MANDATORY

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

### When to Use Each Cascade Type

#### CASCADE - Ownership Relationships
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

#### SET NULL - Preserve for History
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

---

## Field Selection Security

### Storage Layer Pattern

All database access should flow through `storage.ts` to ensure consistent field selection:

```typescript
// server/storage.ts
export class Storage implements IStorage {
  async getUserById(id: number): Promise<User | null> {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      // SECURITY: Never expose passwordHash
    }).from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async getUsers(limit = 50): Promise<User[]> {
    return db.select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      // SECURITY: Never expose passwordHash
    }).from(users)
      .limit(limit);
  }
}
```

### Route Usage Pattern

```typescript
// ✅ CORRECT - Use storage layer
import { storage } from '../storage';

router.get('/api/users/:id', async (req, res) => {
  const user = await storage.getUserById(id);
  res.json(user);
});

// ❌ WRONG - Direct db access in routes
import { db } from '../db';

router.get('/api/users/:id', async (req, res) => {
  // This will trigger pre-commit warning
  const user = await db.select().from(users);
  res.json(user);
});
```

---

## Type Safety and Query Building Patterns

### Avoiding @ts-expect-error in Dynamic Queries

#### ❌ ANTI-PATTERN - Type Suppression
```typescript
// Using @ts-expect-error to hide type issues
let query = db.select().from(products);

if (categoryFilter) {
  // @ts-expect-error - Drizzle types are complex
  query = query.where(eq(products.category, categoryFilter));
}

if (priceFilter) {
  // @ts-expect-error
  query = query.where(lte(products.price, priceFilter));
}

const results = await query;
```

#### ✅ CORRECT - Type-Safe Query Building
```typescript
// Build complete query paths without reassignment
const buildProductQuery = (filters: ProductFilters) => {
  const conditions = [];

  if (filters.category) {
    conditions.push(eq(products.category, filters.category));
  }

  if (filters.maxPrice) {
    conditions.push(lte(products.price, filters.maxPrice));
  }

  const baseQuery = db.select().from(products);

  return conditions.length > 0
    ? baseQuery.where(and(...conditions))
    : baseQuery;
};

const results = await buildProductQuery(filters);
```

#### ✅ ALTERNATIVE - Conditional Chaining Pattern
```typescript
// Use const for immutable query building
const baseQuery = db.select().from(products);

const query = (() => {
  let q = baseQuery;

  if (filters.category) {
    q = q.where(eq(products.category, filters.category));
  }

  if (filters.maxPrice) {
    q = q.where(lte(products.price, filters.maxPrice));
  }

  return q;
})();

const results = await query;
```

**Key Principles:**
- Never use @ts-expect-error without detailed justification
- Build queries functionally rather than imperatively
- Use array of conditions with `and()` for multiple filters
- If type suppression is absolutely necessary, include ticket reference for tracking

## Input Validation Patterns

### Public Function Parameter Validation

#### ❌ ANTI-PATTERN - No Input Validation
```typescript
async getPriceHistoryOptimized(productId: number, days: number, retailerId?: number) {
  // No validation - could receive invalid inputs
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days); // days could be negative!

  return await db.select()
    .from(priceHistory)
    .where(and(
      eq(priceHistory.productId, productId), // productId could be 0 or negative
      gte(priceHistory.recordedAt, startDate)
    ));
}
```

#### ✅ CORRECT - Comprehensive Input Validation
```typescript
async getPriceHistoryOptimized(productId: number, days: number, retailerId?: number) {
  // Validate required parameters
  if (!productId || productId <= 0 || !Number.isInteger(productId)) {
    throw new Error(`Invalid productId: ${productId}. Must be a positive integer.`);
  }

  if (!days || days <= 0 || days > 3650 || !Number.isInteger(days)) {
    throw new Error(`Invalid days: ${days}. Must be an integer between 1 and 3650.`);
  }

  // Validate optional parameters if provided
  if (retailerId !== undefined) {
    if (!retailerId || retailerId <= 0 || !Number.isInteger(retailerId)) {
      throw new Error(`Invalid retailerId: ${retailerId}. Must be a positive integer.`);
    }
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = db.select()
    .from(priceHistory)
    .where(and(
      eq(priceHistory.productId, productId),
      gte(priceHistory.recordedAt, startDate)
    ));

  if (retailerId) {
    query = query.where(eq(priceHistory.retailerId, retailerId));
  }

  return await query;
}
```

**Validation Checklist:**
- ✓ Numeric IDs: Must be positive integers (> 0)
- ✓ Date ranges: Must have reasonable bounds
- ✓ Optional params: Validate only if provided
- ✓ Arrays: Check length to prevent memory issues
- ✓ Strings: Check for empty/null values

## Magic Number Centralization

#### ❌ ANTI-PATTERN - Hardcoded Values
```typescript
// Magic numbers scattered throughout services
async processBatch(items: Item[]) {
  const BATCH_SIZE = 20; // Local constant

  while (items.length > 0) {
    const batch = items.splice(0, 100); // Different batch size!
    await this.processItems(batch);
    await sleep(500); // Magic delay
  }
}

async cleanupOldData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Magic retention period

  await db.delete(oldRecords)
    .where(lt(oldRecords.createdAt, cutoffDate));
}
```

#### ✅ CORRECT - Centralized Constants
```typescript
// In server/utils/constants.ts
export const BATCH_PROCESSING = {
  DEFAULT_BATCH_SIZE: 100,
  SMALL_BATCH_SIZE: 20,
  LARGE_BATCH_SIZE: 500,
  DELAY_MS: 500,
  MAX_CONCURRENT: 5
} as const;

export const DATA_RETENTION = {
  CLEANUP_DAYS: 30,
  ARCHIVE_DAYS: 90,
  PERMANENT_DELETE_DAYS: 365
} as const;

// In service files
import { BATCH_PROCESSING, DATA_RETENTION } from '../utils/constants';

async processBatch(items: Item[]) {
  while (items.length > 0) {
    const batch = items.splice(0, BATCH_PROCESSING.DEFAULT_BATCH_SIZE);
    await this.processItems(batch);
    await sleep(BATCH_PROCESSING.DELAY_MS);
  }
}

async cleanupOldData() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DATA_RETENTION.CLEANUP_DAYS);

  await db.delete(oldRecords)
    .where(lt(oldRecords.createdAt, cutoffDate));
}
```

**Benefits of Centralization:**
- Single source of truth for configuration
- Easy to adjust values globally
- Self-documenting through constant names
- Prevents inconsistencies across codebase

## Drizzle ORM Patterns

### Type-Safe Queries

#### Use Inference for Types
```typescript
// Define return type from query
type ProductWithOffers = typeof productsWithOffersQuery[0];

const productsWithOffersQuery = await db
  .select({
    id: products.id,
    name: products.name,
    offers: sql<Array<{
      price: number;
      retailer: string;
    }>>`json_agg(...)`,
  })
  .from(products);
```

### SQL Template Literals

#### Safe SQL Injection Prevention
```typescript
// ✅ SAFE - Parameterized via template literal
const results = await db.select()
  .from(products)
  .where(sql`${products.name} ILIKE ${'%' + searchTerm + '%'}`);

// ❌ UNSAFE - String concatenation
const results = await db.execute(
  sql.raw(`SELECT * FROM products WHERE name = '${userInput}'`)
);
```

### Complex Conditions

```typescript
// Combining conditions with and/or
const results = await db.select()
  .from(products)
  .where(
    and(
      eq(products.status, 'active'),
      or(
        gte(products.price, minPrice),
        isNull(products.price)
      )
    )
  );
```

### Upsert Pattern

```typescript
await db.insert(products)
  .values(productData)
  .onConflictDoUpdate({
    target: products.sku,
    set: {
      name: sql`excluded.name`,
      price: sql`excluded.price`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    },
  });
```

---

## Performance Considerations

### Index Usage

```typescript
// Ensure queries use indexes
const products = await db.select()
  .from(products)
  .where(eq(products.sku, sku))  // Uses index on sku
  .limit(1);

// Composite index usage
const offers = await db.select()
  .from(productOffers)
  .where(
    and(
      eq(productOffers.productId, productId),
      eq(productOffers.retailerId, retailerId)
    )
  ); // Uses composite index (product_id, retailer_id)
```

### Limit and Pagination

```typescript
// Always use limit for list queries
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const limit = Math.min(
  parseIntOptional(req.query.limit) || DEFAULT_LIMIT,
  MAX_LIMIT
);
const offset = parseIntOptional(req.query.offset) || 0;

const results = await db.select()
  .from(products)
  .limit(limit)
  .offset(offset);
```

---

## Common Mistakes Checklist

- [ ] **N+1 Queries**: No queries inside loops
- [ ] **Password Hash**: Never select without explicit field list
- [ ] **Transactions**: Multi-step operations wrapped in transactions
- [ ] **Foreign Keys**: All have explicit cascade rules
- [ ] **External Calls**: Never inside transactions
- [ ] **Aggregations**: Use SQL, not application code
- [ ] **Batch Size**: Large operations processed in chunks
- [ ] **Type Safety**: No `any` types, use proper Drizzle inference
- [ ] **Storage Layer**: Routes use storage.ts, not direct db access
- [ ] **Error Handling**: Use createErrorResponse for all errors

---

## Architecture Decisions

### Storage Monolith vs Domain Modules (ADR-001)

**Status**: Deferred
**Date**: 2025-11-23
**Related TODO**: #034

#### Context

The `server/storage.ts` file (2714 lines) implements the `IStorage` interface with all database operations. A TODO suggested splitting it into domain modules:

```
server/storage/
  - retailer-storage.ts
  - product-storage.ts
  - price-history-storage.ts
  - watch-list-storage.ts
  - index.ts (re-exports + combined IStorage)
```

#### Analysis

**Current Structure (2714 lines):**
- **IStorage interface**: ~123 lines (lines 7-130)
- **MemStorage class**: ~660 lines (lines 132-791) - mostly stubs for testing
- **DatabaseStorage class**: ~1760 lines (lines 794-2553) - production implementation
- **Type definitions**: ~160 lines (lines 2554-2714)

**Domain Coverage (13 domains):**
1. Retailers (CRUD)
2. Products (CRUD, search)
3. Product Offers
4. Price History (trend analysis)
5. Watch Lists (CRUD, products, stats)
6. Users (admin, registration, password reset)
7. Admin Analytics
8. Forum Operations (topics, posts)
9. Admin Product/Retailer Management
10. Affiliate Management
11. Trending Products
12. Price Analytics (weekly/monthly aggregates)
13. Job Locks

**Dependencies:**
- 19 files import from `server/storage.ts`
- All routes, websocket handlers, jobs, and cache services depend on it

#### Decision: DEFER Split

The refactor is deferred for these reasons:

1. **High Coupling Risk**: Splitting would require updating 19+ import statements and ensuring the combined `IStorage` interface works correctly with split implementations.

2. **MemStorage Maintenance Burden**: Each domain module would need both `DatabaseStorage` and `MemStorage` implementations, doubling the number of files and increasing test complexity.

3. **Shared Patterns Work Well**: The current file uses consistent patterns (transactions, retries, security comments) that benefit from being co-located.

4. **Marginal Benefit**: At 2714 lines, the file is large but navigable. Modern IDEs handle this size well with code folding and Go to Definition.

5. **Risk vs Reward**: A large refactor risks introducing bugs across 19+ files for modest organizational benefit.

#### Recommended Alternative Improvements

Instead of a full split, these targeted improvements can reduce file size:

**1. Extract Type Definitions (~160 lines saved)**
```typescript
// server/storage-types.ts
export interface WatchListWithCount { ... }
export interface PriceTrendAnalysis { ... }
export interface AdminProduct { ... }
// ... all types from lines 2554-2714
```

**2. Remove MemStorage Class (~660 lines saved)**
If tests use database directly or mocks, the MemStorage stub class can be removed:
```typescript
// Before: export class MemStorage implements IStorage { ... }
// After: Remove entirely, use DatabaseStorage + test mocks
```

**3. Extract Complex Queries to Helper Functions**
Large methods like `searchProducts` (200+ lines) can have their SQL building extracted:
```typescript
// server/storage-helpers/search-query-builder.ts
export function buildProductSearchQuery(filters: SearchFilters) {
  // ... complex query building
}
```

#### When to Revisit This Decision

Consider splitting storage.ts if:
- File exceeds **4000 lines**
- A domain module needs **independent versioning** (separate package)
- **Multiple teams** work on different domains simultaneously
- **Circular dependency** issues emerge between domains

#### References
- [TODO #034 discussion]
- [server/storage.ts](../server/storage.ts)

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [Pre-commit Hook](.git/hooks/pre-commit) - Automated checks
- [Storage Layer](../server/storage.ts) - Database abstraction
- [Schema](../shared/schema.ts) - Database schema definitions