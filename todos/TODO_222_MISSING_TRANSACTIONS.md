# TODO 222: Missing Transaction for Multi-Step Operations

**Priority**: P2 - MEDIUM
**File(s)**: `server/storage.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Multi-step database operations are not wrapped in transactions, leading to potential data inconsistency:

1. Creating a product with offers - if offer insertion fails, orphaned product remains
2. User registration with profile - partial user data on failure
3. Price alert with notification - inconsistent state if either fails

**Data Integrity Impact**: Orphaned records, inconsistent state, difficult debugging, data cleanup required.

## Root Cause

Sequential database operations without transactional boundaries - each operation commits independently.

## Solution Approach

1. Identify multi-step operations in storage layer
2. Wrap related operations in `db.transaction()`
3. Ensure rollback on any failure
4. Add tests for transaction behavior

## Implementation Steps

### Step 1: Audit Multi-Step Operations

- [ ] Review `server/storage.ts` for multi-step operations
- [ ] Identify operations that should be atomic
- [ ] Document rollback requirements

### Step 2: Add Transactions to Product Operations

- [ ] `createProductWithOffers()` - atomic product + offers
- [ ] `deleteProduct()` - cascade delete offers, alerts, history
- [ ] `updateProductWithOffers()` - atomic update

### Step 3: Add Transactions to User Operations

- [ ] `createUser()` - user + default settings
- [ ] `deleteUser()` - cascade delete alerts, preferences

### Step 4: Add Transactions to Alert Operations

- [ ] `createPriceAlert()` - alert + initial notification
- [ ] `triggerAlert()` - update alert + send notification

### Step 5: Add Tests

- [ ] Test rollback on failure
- [ ] Test partial failure scenarios
- [ ] Test concurrent transactions

## Technical Details

**Current Implementation (NOT ATOMIC):**
```typescript
async createProductWithOffers(data: ProductCreate): Promise<Product> {
  // Step 1: Create product
  const [product] = await db.insert(products).values(data.product).returning();
  
  // Step 2: Create offers - if this fails, product exists without offers!
  for (const offer of data.offers) {
    await db.insert(productOffers).values({ ...offer, productId: product.id });
  }
  
  return product;
}
```

**Fixed Implementation (ATOMIC):**
```typescript
async createProductWithOffers(data: ProductCreate): Promise<ProductWithOffers> {
  // ✅ Use transaction for atomicity
  return await db.transaction(async (tx) => {
    // Step 1: Create product
    const [product] = await tx.insert(products)
      .values(data.product)
      .returning();
    
    // Step 2: Create offers (batch insert for efficiency)
    const offerValues = data.offers.map(offer => ({
      ...offer,
      productId: product.id,
    }));
    
    const insertedOffers = offerValues.length > 0
      ? await tx.insert(productOffers).values(offerValues).returning()
      : [];
    
    // ✅ If anything fails, entire transaction rolls back
    return {
      ...product,
      offers: insertedOffers,
    };
  });
}
```

**Delete with Cascade (ATOMIC):**
```typescript
async deleteProduct(productId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete in correct order (child tables first)
    
    // 1. Delete price alerts for this product
    await tx.delete(priceAlerts)
      .where(eq(priceAlerts.productId, productId));
    
    // 2. Delete price history
    await tx.delete(priceHistory)
      .where(eq(priceHistory.productId, productId));
    
    // 3. Delete product offers
    await tx.delete(productOffers)
      .where(eq(productOffers.productId, productId));
    
    // 4. Delete product
    const result = await tx.delete(products)
      .where(eq(products.id, productId))
      .returning();
    
    if (result.length === 0) {
      throw new Error(`Product ${productId} not found`);
    }
  });
}
```

**User Registration (ATOMIC):**
```typescript
async createUser(data: UserCreate): Promise<User> {
  return await db.transaction(async (tx) => {
    // 1. Create user
    const [user] = await tx.insert(users)
      .values({
        email: data.email.toLowerCase(),
        username: data.username,
        passwordHash: data.passwordHash,
      })
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        // SECURITY: Never return passwordHash
      });
    
    // 2. Create default user preferences
    await tx.insert(userPreferences)
      .values({
        userId: user.id,
        emailNotifications: true,
        priceDropThreshold: 10, // 10% default
      });
    
    return user;
  });
}
```

**Update with Optimistic Locking:**
```typescript
async updateProductWithOffers(
  productId: number, 
  data: ProductUpdate,
  expectedVersion: number
): Promise<ProductWithOffers> {
  return await db.transaction(async (tx) => {
    // 1. Update product with version check (optimistic locking)
    const [updated] = await tx.update(products)
      .set({
        ...data.product,
        version: sql`${products.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(products.id, productId),
        eq(products.version, expectedVersion)
      ))
      .returning();
    
    if (!updated) {
      throw new ConflictError('Product was modified by another user');
    }
    
    // 2. Replace offers (delete old, insert new)
    await tx.delete(productOffers)
      .where(eq(productOffers.productId, productId));
    
    const offerValues = data.offers.map(offer => ({
      ...offer,
      productId,
    }));
    
    const newOffers = offerValues.length > 0
      ? await tx.insert(productOffers).values(offerValues).returning()
      : [];
    
    return { ...updated, offers: newOffers };
  });
}
```

**Transaction Isolation Levels:**
```typescript
// For critical operations, use serializable isolation
async transferCredits(fromUserId: number, toUserId: number, amount: number) {
  return await db.transaction(async (tx) => {
    // ... transfer logic
  }, {
    isolationLevel: 'serializable', // Prevents phantom reads
  });
}
```

## Checklist

- [ ] Multi-step operations identified
- [ ] Product operations use transactions
- [ ] User operations use transactions
- [ ] Alert operations use transactions
- [ ] Cascade deletes are atomic
- [ ] Tests verify rollback behavior

## Success Criteria

- [ ] All multi-step operations wrapped in transactions
- [ ] Failures trigger complete rollback
- [ ] No orphaned records possible
- [ ] Optimistic locking where needed
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Longer lock times | Medium | Low | Keep transactions short and focused |
| Deadlocks | Low | Medium | Consistent lock ordering, timeout handling |
| Performance impact | Low | Low | Batch operations within transactions |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm transactions are used
  ```bash
  # Verify db.transaction is used for multi-step operations
  grep -n "db.transaction" server/storage.ts | wc -l
  # Should be > 5 transaction blocks
  
  # Verify createProductWithOffers uses transaction
  grep -A 15 "createProductWithOffers" server/storage.ts | grep "transaction"
  ```

- [ ] **File inspection**: Review transaction implementations
  ```bash
  grep -B 2 -A 20 "db.transaction" server/storage.ts | head -60
  ```

### Testing
- [ ] **Run affected tests**: Execute storage tests
  ```bash
  npm test -- storage
  npm test -- transaction
  ```

- [ ] **Rollback test**: Verify rollback on failure
  ```bash
  # Manually test by causing failure in second step
  # Verify first step is rolled back
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
