# Database Patterns & Anti-Patterns

This document codifies database patterns and anti-patterns in the PriceCompare codebase to prevent common mistakes and ensure data integrity.

## Table of Contents
- [Critical Anti-Patterns](#critical-anti-patterns)
- [Transaction Patterns](#transaction-patterns)
- [Query Optimization](#query-optimization)
- [Foreign Key Management](#foreign-key-management)
- [Field Selection Security](#field-selection-security)
- [Drizzle ORM Patterns](#drizzle-orm-patterns)

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

#### When to Use SERIALIZABLE
```typescript
// Use for operations where concurrent execution causes logical errors
await db.transaction(async (tx) => {
  // Examples that need SERIALIZABLE:

  // 1. Sequential numbering
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
  isolationLevel: 'serializable',
});
```

#### Default READ COMMITTED is Fine For:
```typescript
// Simple multi-step operations without conditionals
await db.transaction(async (tx) => {
  // Create product
  const [product] = await tx.insert(products).values(data).returning();

  // Add offers (no race condition risk)
  await tx.insert(productOffers).values(offers.map(o => ({
    productId: product.id,
    ...o,
  })));
});
```

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

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [Pre-commit Hook](.git/hooks/pre-commit) - Automated checks
- [Storage Layer](../server/storage.ts) - Database abstraction
- [Schema](../shared/schema.ts) - Database schema definitions