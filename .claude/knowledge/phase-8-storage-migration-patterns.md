# Phase 8 Storage Layer Migration Patterns

**Date**: 2025-11-27
**Context**: Patterns codified from Phase 8 storage layer migration (5 services, 43 db operations, 40+ new storage methods)

This document captures the lessons learned and best practices from migrating services to the storage layer abstraction pattern.

---

## Migration Summary

**Phase 8 Achievements:**
- Migrated 5 services from direct `db` access to `storage` layer abstraction
- Created 40+ new storage methods across 4 domain repositories
- Achieved 100% architecture compliance (Routes -> Services -> Storage -> Database)
- Fixed critical issues identified during code review

**Services Migrated:**
1. `smart-notification-service.ts` (4 db operations)
2. `price-snapshot-service.ts` (5 db operations)
3. `notification-service.ts` (13 db operations)
4. `smart-alerts-service.ts` (9 db operations)
5. `price-history-service.ts` (12 db operations)

**Storage Domains Enhanced:**
1. `NotificationStorage` (14 methods) - NEW domain created
2. `PriceStorage` (17 methods added)
3. `ProductStorage` (2 methods added)
4. `RetailerStorage` (1 method added)

---

## 1. Storage Layer Migration Pattern

### Pattern Description
When migrating services to the storage layer, follow this systematic approach to ensure consistency and prevent regressions.

### Migration Steps

```typescript
// Step 1: Analyze all db operations in the service
// Search for: db.select, db.insert, db.update, db.delete, db.transaction

// Step 2: Check if storage methods already exist
// Avoid duplication - check storage.ts and domain repositories

// Step 3: Create domain storage methods with proper patterns
// - Input validation
// - Try-catch error handling
// - Proper return types
// - JSDoc documentation

// Step 4: Add to all required interfaces
// - IStorage interface (server/storage.ts)
// - DatabaseStorage delegation
// - MemStorage stubs

// Step 5: Replace service db calls with storage calls
// Before:
const result = await db.select().from(notifications).where(eq(notifications.userId, userId));

// After:
const result = await storage.getNotificationsByUserId(userId);

// Step 6: Remove unused imports
// Remove: import { db } from "../db"
// Remove: unused schema imports
```

### Implementation Example

```typescript
// In domain repository (e.g., notification-storage.ts)
export class NotificationStorage extends BaseStorage {
  /**
   * Get notifications for a user with pagination
   * @param userId - The user ID to fetch notifications for
   * @param limit - Maximum number of notifications to return
   * @param offset - Number of notifications to skip
   */
  async getNotificationsByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    // Input validation
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    try {
      return await this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      this.handleError(error, 'getNotificationsByUserId');
    }
  }
}
```

---

## 2. Transaction Preservation Pattern

### Pattern Description
Complex transactions can be moved to the storage layer while preserving isolation levels and retry logic.

### SERIALIZABLE Isolation for Race Conditions

```typescript
// Pattern: Daily limit enforcement with SERIALIZABLE
async createNotification(data: NotificationInsert): Promise<Notification> {
  const DAILY_LIMIT = 3;

  try {
    return await this.db.transaction(async (tx) => {
      // Check daily count with SERIALIZABLE to prevent race conditions
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [countResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, data.userId),
          gte(notifications.createdAt, todayStart)
        ));

      // Type assertion: Drizzle count() returns string, convert to number
      const count = Number(countResult?.count || 0);

      if (count >= DAILY_LIMIT) {
        throw new Error(`Daily notification limit (${DAILY_LIMIT}) reached`);
      }

      // Insert notification
      const [notification] = await tx
        .insert(notifications)
        .values(data)
        .returning();

      return notification;
    }, {
      isolationLevel: 'serializable'  // Prevents concurrent limit violations
    });
  } catch (error) {
    this.handleError(error, 'createNotification');
  }
}
```

### Retry Logic for SERIALIZABLE Conflicts

```typescript
import { retryWithBackoff } from '../utils/retry';

// Pattern: Wrap SERIALIZABLE transactions with retry logic
async createAlertWithRetry(data: AlertInsert): Promise<Alert> {
  return retryWithBackoff(
    async () => this.createAlert(data),
    {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      // Only retry on serialization failures
      shouldRetry: (error) =>
        error.message?.includes('could not serialize') ||
        error.code === '40001'
    }
  );
}
```

### ON CONFLICT for Concurrent Insert Prevention

```typescript
// Pattern: Upsert to prevent duplicate notifications
async upsertNotification(data: NotificationInsert): Promise<Notification> {
  try {
    const [result] = await this.db
      .insert(notifications)
      .values(data)
      .onConflictDoUpdate({
        target: [notifications.userId, notifications.type, notifications.relatedEntityId],
        set: {
          content: data.content,
          updatedAt: new Date()
        }
      })
      .returning();

    return result;
  } catch (error) {
    this.handleError(error, 'upsertNotification');
  }
}
```

---

## 3. Batch Query Pattern (N+1 Prevention)

### Pattern Description
Prevent N+1 queries by creating batch storage methods that fetch related data efficiently.

### Batch Fetch with inArray()

```typescript
// Pattern: Batch fetch retailers by IDs
async getRetailersByIds(ids: number[]): Promise<Retailer[]> {
  // Input validation
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  // Validate all IDs are positive integers
  for (const id of ids) {
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error(`Invalid retailer ID in batch: ${id}`);
    }
  }

  try {
    return await this.db
      .select()
      .from(retailers)
      .where(inArray(retailers.id, ids));
  } catch (error) {
    this.handleError(error, 'getRetailersByIds');
  }
}
```

### Using Batch Methods in Services

```typescript
// Before (N+1 query - BAD):
async processOffers(offers: Offer[]) {
  for (const offer of offers) {
    // N queries!
    const retailer = await storage.getRetailerById(offer.retailerId);
    offer.retailerName = retailer?.name;
  }
}

// After (Batch query - GOOD):
async processOffers(offers: Offer[]) {
  // Single query for all retailers
  const retailerIds = [...new Set(offers.map(o => o.retailerId))];
  const retailers = await storage.getRetailersByIds(retailerIds);

  // O(1) lookups with Map
  const retailerMap = new Map(retailers.map(r => [r.id, r]));

  for (const offer of offers) {
    const retailer = retailerMap.get(offer.retailerId);
    offer.retailerName = retailer?.name;
  }
}
```

### JOIN Queries for Related Data

```typescript
// Pattern: Get all offers with retailer details in single query
async getAllOffersWithDetails(): Promise<OfferWithRetailer[]> {
  try {
    return await this.db
      .select({
        id: productOffers.id,
        productId: productOffers.productId,
        price: productOffers.price,
        url: productOffers.url,
        retailerId: productOffers.retailerId,
        retailerName: retailers.name,
        retailerLogo: retailers.logo,
        retailerDomain: retailers.domain,
      })
      .from(productOffers)
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id));
  } catch (error) {
    this.handleError(error, 'getAllOffersWithDetails');
  }
}
```

---

## 4. Type Safety in Storage Layer

### SQL Type Assertions with Documentation

```typescript
// Pattern: Document type assertions for SQL aggregates
async getNotificationCount(userId: number): Promise<number> {
  const result = await this.db
    .select({ count: sql`count(*)` })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  // Type assertion: Drizzle returns count(*) as string, convert to number
  return Number(result[0]?.count || 0);
}

// Pattern: Document type assertions for JSON fields
async getProductWithEmbedding(id: number): Promise<ProductWithEmbedding | null> {
  const [product] = await this.db
    .select()
    .from(products)
    .where(eq(products.id, id));

  if (!product) return null;

  return {
    ...product,
    // Type assertion: Drizzle stores JSON field as unknown, cast to expected vector format
    embedding: (product.embedding as number[] | null) || null,
  };
}
```

### Proper Type Definitions

```typescript
// In storage/types.ts
export interface NotificationWithDetails {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
  // Related entity details
  relatedEntityType?: 'product' | 'alert' | 'deal' | null;
  relatedEntityId?: number | null;
}

// In domain repository
async getNotificationWithDetails(id: number): Promise<NotificationWithDetails | null> {
  // Implementation returns properly typed result
}
```

---

## 5. Error Handling Consistency

### Standard Error Handling Pattern

```typescript
// Pattern: Consistent error handling in all storage methods
async someMethod(param: number): Promise<Result> {
  // Input validation first
  if (!Number.isFinite(param) || param <= 0) {
    throw new Error(`Invalid param: ${param}`);
  }

  try {
    // Database operation
    const result = await this.db.select()...;
    return result;
  } catch (error) {
    // Use base class error handler
    this.handleError(error, 'someMethod');
  }
}
```

### Using logger Instead of console.error

```typescript
// Pattern: Use structured logging
import { logger } from '../../utils/logger';

protected handleError(error: unknown, operation: string): never {
  logger.error(`Storage operation failed`, {
    operation,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  throw error;
}
```

### Return Sensible Defaults

```typescript
// Pattern: Return empty array on error for list operations
async getNotifications(userId: number): Promise<Notification[]> {
  try {
    return await this.db.select()...;
  } catch (error) {
    logger.error('Failed to get notifications', { userId, error });
    return []; // Sensible default for list operations
  }
}

// Pattern: Return null on error for single item operations
async getNotificationById(id: number): Promise<Notification | null> {
  try {
    const [result] = await this.db.select()...;
    return result || null;
  } catch (error) {
    logger.error('Failed to get notification', { id, error });
    return null;
  }
}

// Pattern: Return 0 on error for count operations
async getNotificationCount(userId: number): Promise<number> {
  try {
    const result = await this.db.select({ count: sql`count(*)` })...;
    return Number(result[0]?.count || 0);
  } catch (error) {
    logger.error('Failed to count notifications', { userId, error });
    return 0;
  }
}
```

---

## 6. Domain Organization Pattern

### Pattern Description
Group related operations into domain repositories for maintainability and clarity.

### Domain Repository Structure

```
server/storage/
  domains/
    notification-storage.ts   # Notification-related operations
    price-storage.ts          # Price history, alerts, snapshots
    product-storage.ts        # Products, offers, search
    retailer-storage.ts       # Retailer CRUD
    user-storage.ts           # User management
  base-storage.ts             # Abstract base class
  types.ts                    # Shared type definitions
  index.ts                    # Facade with re-exports
```

### Domain Repository Template

```typescript
// server/storage/domains/notification-storage.ts
import { eq, and, desc, gte, sql, inArray } from 'drizzle-orm';
import { notifications } from '@shared/schema';
import { BaseStorage } from '../base-storage';
import type { Notification, NotificationInsert } from '../types';

/**
 * Notification Storage Domain
 *
 * Handles all notification-related database operations including:
 * - CRUD operations for notifications
 * - Deduplication logic
 * - Daily limit enforcement
 * - Batch operations
 *
 * Phase 8: Created during storage layer migration
 */
export class NotificationStorage extends BaseStorage {
  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async getNotificationById(id: number): Promise<Notification | null> { ... }
  async createNotification(data: NotificationInsert): Promise<Notification> { ... }
  async markAsRead(id: number): Promise<boolean> { ... }
  async deleteNotification(id: number): Promise<boolean> { ... }

  // ============================================================================
  // Query Operations
  // ============================================================================

  async getNotificationsByUserId(userId: number): Promise<Notification[]> { ... }
  async getUnreadCount(userId: number): Promise<number> { ... }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async markAllAsRead(userId: number): Promise<number> { ... }
  async deleteOldNotifications(days: number): Promise<number> { ... }

  // ============================================================================
  // Deduplication
  // ============================================================================

  async findDuplicateNotification(
    userId: number,
    type: string,
    entityId: number,
    hoursWindow: number
  ): Promise<Notification | null> { ... }
}
```

---

## 7. Anti-Patterns to Avoid

### Anti-Pattern 1: Direct DB Access in Services

```typescript
// WRONG - Service imports db directly
import { db } from '../db';
import { notifications } from '@shared/schema';

class NotificationService {
  async getNotifications(userId: number) {
    return db.select().from(notifications).where(eq(notifications.userId, userId));
  }
}

// CORRECT - Service uses storage abstraction
import { storage } from '../storage';

class NotificationService {
  async getNotifications(userId: number) {
    return storage.getNotificationsByUserId(userId);
  }
}
```

### Anti-Pattern 2: Missing Input Validation

```typescript
// WRONG - No validation
async getNotificationsByUserId(userId: number): Promise<Notification[]> {
  return this.db.select().from(notifications).where(eq(notifications.userId, userId));
}

// CORRECT - Validate inputs
async getNotificationsByUserId(userId: number): Promise<Notification[]> {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error(`Invalid userId: ${userId}`);
  }
  // ... rest of implementation
}
```

### Anti-Pattern 3: Undocumented Type Assertions

```typescript
// WRONG - Type cast without explanation
const count = Number(result[0]?.count);

// CORRECT - Document why cast is needed
// Type assertion: Drizzle returns count(*) as string, convert to number
const count = Number(result[0]?.count || 0);
```

### Anti-Pattern 4: Using console.error()

```typescript
// WRONG - Console logging
catch (error) {
  console.error('Failed to get notifications:', error);
  throw error;
}

// CORRECT - Structured logging
catch (error) {
  logger.error('Failed to get notifications', {
    userId,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
```

### Anti-Pattern 5: Magic Numbers

```typescript
// WRONG - Hardcoded values
const hoursWindow = 6;
const dailyLimit = 3;

// CORRECT - Use centralized constants
import { NOTIFICATION_DEDUP_TTL_HOURS, SMART_ALERT_DAILY_LIMIT } from '../utils/constants';
const hoursWindow = NOTIFICATION_DEDUP_TTL_HOURS;
const dailyLimit = SMART_ALERT_DAILY_LIMIT;
```

---

## 8. Code Review Checklist

When reviewing storage layer code, check:

### Architecture
- [ ] No direct `db` imports in services (except documented exceptions)
- [ ] All database access through `storage.*` methods
- [ ] Service layer has business logic, storage layer has data access
- [ ] Methods added to IStorage interface, DatabaseStorage, and MemStorage

### Type Safety
- [ ] SQL type assertions have inline comments explaining why
- [ ] No `any` types - use proper TypeScript types
- [ ] Sensitive fields (passwordHash) not exposed in queries
- [ ] Return types explicitly defined on all methods

### Error Handling
- [ ] All storage methods have try-catch blocks
- [ ] Use `this.handleError(error, 'methodName')` pattern
- [ ] Use `logger.error()` not `console.error()`
- [ ] Return sensible defaults on errors

### Performance
- [ ] No N+1 queries - use batch operations with `inArray()` or JOINs
- [ ] Use Map-based lookups for O(1) access
- [ ] Database aggregations preferred over JavaScript post-processing

### Transactions
- [ ] SERIALIZABLE isolation for race conditions (limits, counters)
- [ ] Retry logic for SERIALIZABLE conflicts
- [ ] ON CONFLICT for concurrent insert prevention
- [ ] Transaction boundaries documented in JSDoc

### Input Validation
- [ ] Validate userId, productId as positive integers
- [ ] Validate array lengths before batch operations
- [ ] Use validation helpers from BaseStorage

### Documentation
- [ ] JSDoc on all public methods
- [ ] Domain section comments (// ====... separators)
- [ ] Phase markers for migration tracking

---

## 9. Related Documentation

- **storage-refactoring-patterns.md** - Large file decomposition patterns
- **storage-review-patterns.md** - parseInt safety, type assertions, SQL aggregates
- **DATABASE_PATTERNS.md** - N+1 prevention, transactions, query optimization
- **TYPESCRIPT_PATTERNS.md** - Type safety, avoiding `any`
- **CLAUDE.md** - Project architecture overview

---

## Session Context

**Phase**: Phase 8 - Service Storage Layer Migration
**PR/Branch**: add_scraping
**Services Migrated**: 5
**Storage Methods Created**: 40+
**Domain Repositories Enhanced**: 4

**Key Decisions**:
1. Create NotificationStorage as new domain (14 methods)
2. Preserve SERIALIZABLE transactions for limit enforcement
3. Use batch methods to prevent N+1 queries
4. Centralize constants for magic numbers
5. Standardize error handling with logger
