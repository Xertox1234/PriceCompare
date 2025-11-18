---
status: ready
priority: p1
issue_id: "013"
tags: [database, transactions, data-integrity, acid, code-review]
dependencies: []
---

# Add Transaction Boundaries to Multi-Step Operations

## Problem Statement

**CRITICAL DATA INTEGRITY ISSUE**: Most route handlers perform multi-step database operations without transaction protection. If any step fails, the database is left in an inconsistent partial state. This violates ACID properties and can lead to data corruption, orphaned records, and inconsistent relationships.

**Impact:** Partial updates, inconsistent state, data corruption, difficult debugging

## Findings

Discovered during comprehensive code audit by data-integrity-guardian agent on 2025-11-18.

**Pattern Analysis:**
- ✅ Good: `price-aggregation-service.ts` properly uses transactions
- ❌ Bad: Most route handlers lack transaction protection

**Critical Missing Transactions:**

1. **Alert Deletion** (`/server/routes/alert-routes.ts:64-78`):
```typescript
// ❌ NO TRANSACTION - Vulnerable to partial deletion
app.delete("/api/price-alerts/:id", withAuth(async (req, res) => {
  const deleted = await forumStorage.deletePriceAlert(alertId, user.id);
  // What if notification cleanup fails?
  // Result: Alert deleted but notifications remain (orphaned)
}));
```

2. **Product Creation** with offers:
```typescript
// ❌ NO TRANSACTION
const product = await storage.createProduct(productData);
await storage.createProductOffer(product.id, offerData);
// What if offer creation fails? Product exists without offers
```

3. **User Registration** with initial setup:
```typescript
// ❌ NO TRANSACTION
const user = await storage.createUser(userData);
await storage.createUserProfile(user.id);
await storage.sendWelcomeEmail(user.email);
// What if profile creation fails? User exists but incomplete
```

4. **Forum Post** with mentions:
```typescript
// ❌ NO TRANSACTION
const post = await storage.createForumPost(postData);
await storage.createMentions(post.id, mentions);
await storage.createNotifications(mentions);
// What if notification creation fails? Post and mentions exist but users not notified
```

**Impact Scenarios:**

**Scenario 1: Failed Notification Cleanup**
```typescript
// Step 1: Delete alert (succeeds)
await db.delete(priceAlerts).where(eq(priceAlerts.id, 123));

// Step 2: Delete notifications (FAILS due to network error)
await db.delete(notifications).where(eq(notifications.alertId, 123));
// ❌ Alert deleted but 5 notifications remain orphaned
```

**Scenario 2: Concurrent Updates**
```typescript
// User A and User B update same product simultaneously
// Without transaction isolation, updates interleave:
// A: Read product (price: $100)
// B: Read product (price: $100)
// A: Update to $90
// B: Update to $95
// Result: Last write wins, A's update lost
```

## Proposed Solutions

### Option 1: Wrap Critical Operations in Transactions (Recommended)

**Pros:**
- Ensures atomicity (all-or-nothing)
- Prevents partial updates
- Database handles rollback automatically
- Standard SQL pattern

**Cons:**
- Slight performance overhead
- Must identify all multi-step operations

**Effort:** Medium (1 week to audit and fix all routes)

**Risk:** Low (Drizzle handles transactions correctly)

**Implementation:**

```typescript
// ✅ FIXED: Alert deletion with transaction
app.delete("/api/price-alerts/:id", withAuth(async (req, res) => {
  try {
    await db.transaction(async (tx) => {
      // Step 1: Delete alert
      const deleted = await tx.delete(priceAlerts)
        .where(and(
          eq(priceAlerts.id, alertId),
          eq(priceAlerts.userId, user.id)
        ))
        .returning();

      if (deleted.length === 0) {
        throw new Error("Alert not found or unauthorized");
      }

      // Step 2: Delete related notifications
      await tx.delete(notifications)
        .where(eq(notifications.relatedAlertId, alertId));

      // Both succeed or both rollback automatically
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete alert', { error });
    res.status(500).json({ error: "Failed to delete alert" });
  }
}));

// ✅ FIXED: Product creation with transaction
app.post("/api/products", withAuth(async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      // Step 1: Create product
      const [product] = await tx.insert(products)
        .values(productData)
        .returning();

      // Step 2: Create initial offer
      const [offer] = await tx.insert(productOffers)
        .values({ productId: product.id, ...offerData })
        .returning();

      return { product, offer };
    });

    res.json(result);
  } catch (error) {
    // Transaction rolled back automatically
    logger.error('Failed to create product', { error });
    res.status(500).json({ error: "Failed to create product" });
  }
}));

// ✅ FIXED: Forum post with mentions
app.post("/api/forum/posts", withAuth(async (req, res) => {
  try {
    const result = await db.transaction(async (tx) => {
      // Step 1: Create post
      const [post] = await tx.insert(forumPosts)
        .values(postData)
        .returning();

      // Step 2: Create mentions
      if (mentions.length > 0) {
        await tx.insert(forumMentions)
          .values(mentions.map(m => ({ postId: post.id, userId: m })));
      }

      // Step 3: Create notifications
      if (mentions.length > 0) {
        await tx.insert(notifications)
          .values(mentions.map(m => ({
            userId: m,
            type: 'mention',
            postId: post.id
          })));
      }

      return post;
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to create post', { error });
    res.status(500).json({ error: "Failed to create post" });
  }
}));
```

### Option 2: Service Layer Transactions (Alternative)

**Pros:**
- Transactions managed in service layer
- Routes stay thin
- Reusable transaction logic

**Cons:**
- More refactoring required
- Services need transaction-aware methods

**Effort:** Large (2 weeks)

## Recommended Action

**HIGH PRIORITY - PREVENT DATA CORRUPTION**

1. **Audit Phase** (Week 1, Days 1-2):
   - Identify all multi-step operations in routes
   - Document which operations need transactions
   - Prioritize by criticality

2. **Implementation Phase** (Week 1, Days 3-5):
   - Wrap critical operations in transactions:
     - Alert creation/deletion
     - Product + offer creation
     - User registration flow
     - Forum post creation
     - Watchlist operations
   - Test each transaction for proper rollback

3. **Verification Phase** (Week 1, Days 6-7):
   - Simulate failures at each step
   - Verify rollback occurs correctly
   - Check for orphaned data

## Technical Details

**Affected Routes (15+ files):**
- alert-routes.ts (create, update, delete alerts)
- product-routes.ts (create products with offers)
- auth-routes.ts (user registration)
- forum-routes.ts (create posts, topics)
- community-routes.ts (watchlist operations)
- notification-routes.ts (batch operations)

**Related Components:** All components performing multi-table operations

**Database Changes:** None (code-only changes)

## Resources

- Drizzle Transactions: https://orm.drizzle.team/docs/transactions
- ACID Properties: https://en.wikipedia.org/wiki/ACID
- PostgreSQL Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html

## Acceptance Criteria

- [ ] Audit all route handlers for multi-step operations
- [ ] Wrap alert operations in transactions
- [ ] Wrap product creation in transactions
- [ ] Wrap user registration in transactions
- [ ] Wrap forum operations in transactions
- [ ] Wrap watchlist operations in transactions
- [ ] Test rollback by simulating failures
- [ ] Verify no orphaned data after rollback
- [ ] Add transaction usage to CLAUDE.md best practices
- [ ] Run full test suite - all tests pass

## Work Log

### 2025-11-18 - Data Integrity Audit Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Identified missing transaction boundaries in routes
- Analyzed impact of partial updates
- Found good example in price-aggregation-service.ts
- Categorized as P1 CRITICAL for data integrity

**Learnings:**
- price-aggregation-service.ts uses transactions correctly (lines 29, 165)
- Most route handlers lack transaction protection
- Without transactions, multi-step operations are vulnerable
- Database-level cascade rules help but don't replace transaction atomicity

## Notes

**DATA INTEGRITY**: Transactions are the primary mechanism for ensuring data consistency in multi-step operations. Without them, any failure leaves the database in a partially-updated state.

**Testing Transactions**: Simulate failures to verify rollback:
```typescript
// Test helper
async function testTransactionRollback() {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(products).values(productData);
      throw new Error('Simulated failure');
      // This should rollback product insert
    });
  } catch (error) {
    // Verify product was NOT created
    const count = await db.select({ count: sql`count(*)` }).from(products);
    assert(count === previousCount); // Should be unchanged
  }
}
```

**Performance**: Transaction overhead is minimal (<5ms) compared to the cost of data corruption.

**Isolation Levels**: PostgreSQL default is READ COMMITTED, which is appropriate for most operations. Consider SERIALIZABLE for critical operations with high concurrency.

Source: Comprehensive code audit performed on 2025-11-18
