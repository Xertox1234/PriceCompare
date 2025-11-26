# Storage Layer Refactoring Patterns

**Date**: 2025-11-26
**Context**: Patterns established during Phase 1 storage layer refactoring (7,035-line god object decomposition)

This document codifies the patterns, strategies, and best practices for incrementally decomposing large monolithic files into modular architectures while maintaining zero breaking changes.

---

## Phase 1 Results Summary

**Original**: `server/storage.ts` - 7,035 lines, 86+ methods, 69 type definitions
**Extracted**:
- `server/storage/types.ts` - 845 lines (69 type definitions)
- `server/storage/base-storage.ts` - 74 lines (abstract base class)
- `server/storage/index.ts` - 111 lines (facade with roadmap)

**Achievement**: Zero breaking changes, TypeScript compilation passes, pre-commit security checks pass.

## Phase 2 Results Summary

**PR**: #138 - User Domain Extraction
**Extracted**:
- `server/storage/domains/user-storage.ts` - 476 lines (15 methods)

**Methods Extracted**:
- Basic: getUserCount, getUserByIdSafe, registerUser
- Auth: resetPassword, createUserWithTransaction
- Profile: updateUserProfile, updateUserTrustLevel, suspendUser
- Admin: getAllUsers, getAdminAnalyticsOverview, getUserGrowthData, getForumActivityData, getTopCategories

**Files Modified**:
- `server/storage.ts` - Reduced from 7,035 to ~6,535 lines (delegation pattern)

**Key Learnings**:
1. **Type Consistency Critical**: IStorage interface must use specialized types, not inline types
2. **Parameter Required-ness**: Fix optional parameters when they should be required (getTopCategories limit)
3. **Security Markers Everywhere**: All passwordHash references need `// SECURITY: NEVER expose` markers
4. **Code Review Catches Issues**: Type mismatches found during review phase, not compilation

**Statistics**: 15/86 methods extracted (~17% progress), 2 files changed, 506 insertions(+), 235 deletions(-)

---

## 1. Facade Pattern for Incremental Migration

### Pattern Description
When decomposing a large monolithic file, use the Facade pattern to maintain backward compatibility while enabling incremental extraction.

### Implementation
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

### Why This Works
- **No import changes required**: Consumers can continue importing from `server/storage` OR `server/storage/index`
- **Incremental extraction**: Move types first, then base class, then domain repositories
- **Testable migrations**: Each extraction can be tested independently
- **Rollback safety**: If extraction causes issues, the facade can be reverted

### Anti-Pattern
```typescript
// WRONG - Breaking change: moving and renaming without re-exports
// Old import: import { storage } from './storage'
// New location: import { storage } from './storage/index'
// Result: All existing imports break!
```

---

## 2. Centralized Type Extraction

### Pattern Description
Extract all type definitions to a dedicated `types.ts` file, organized by domain with comprehensive documentation.

### File Structure
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

### Documentation Requirements
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

---

## 3. Abstract Base Class Pattern

### Pattern Description
Create an abstract base class that provides common utilities, error handling, and documentation for all domain repositories.

### Implementation
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

### Implementation Guidance Pattern
The 7-point implementation guidance serves as in-code documentation for future developers:

1. **Input Validation** - References parseIntSafe utility
2. **N+1 Prevention** - Explicitly states the batch query requirement
3. **Security** - Uses pre-commit-hook-compatible marker
4. **Error Handling** - Clarifies responsibility split (storage vs routes)
5. **Transactions** - References atomicity requirements
6. **Retry Logic** - Points to utility for transient errors
7. **Logging** - Ensures consistent observability

---

## 4. Domain Roadmap Documentation

### Pattern Description
Include a detailed roadmap in the facade file showing the planned domain extraction with method counts and responsibilities.

### Implementation
```typescript
/**
 * Phase 2+ Domain Extraction Roadmap (11 Domain Repositories):
 *
 * 1. **UserStorage** (~15 methods)
 *    - User CRUD, password operations, authentication
 *    - Methods: getUserById, registerUser, resetPassword, updateUserProfile, suspendUser
 *
 * 2. **ProductStorage** (~20 methods)
 *    - Product/offer management, search, specifications
 *    - Methods: getProducts, searchProducts, getProductById, createProduct, getProductOffers
 *
 * 3. **PriceStorage** (~25 methods)
 *    - Price history, aggregates, snapshots, trends
 *    - Methods: getPriceHistory, insertPriceHistory, upsertDailyAggregates, getPriceTrend
 *
 * // ... continue for all 11 domains
 *
 * Future Phase 2+ Structure (Implementation Pattern):
 *
 * import { db } from "../db";
 * import { UserStorage } from "./domains/user-storage";
 * import { ProductStorage } from "./domains/product-storage";
 *
 * export class DatabaseStorage implements IStorage {
 *   private userStorage: UserStorage;
 *   private productStorage: ProductStorage;
 *
 *   constructor(database: Database) {
 *     this.userStorage = new UserStorage(database);
 *     this.productStorage = new ProductStorage(database);
 *   }
 *
 *   // Delegate methods to appropriate domain repositories:
 *   async getUserById(id: number) {
 *     return this.userStorage.getUserById(id);
 *   }
 * }
 */
```

### Roadmap Requirements
1. **Method count estimates** - Helps prioritize extraction order
2. **Responsibility summary** - Clarifies domain boundaries
3. **Example method names** - Makes scope concrete
4. **Implementation pattern** - Shows how delegation will work

---

## 5. Security Documentation Patterns

### Pre-Commit Hook Compatible Markers
Use specific marker phrases that the pre-commit hooks recognize:

```typescript
// CORRECT - Hook-compatible markers
// SECURITY: NEVER expose passwordHash
// SECURITY: Password hash intentionally excluded
// Security: excludes passwordHash

// WRONG - Won't be recognized
// Don't expose passwords
// Hash field omitted for security
```

### SafeUser Type Pattern
```typescript
// ============================================================================
// Safe User Type (Security: excludes passwordHash)
// ============================================================================

/**
 * User type that explicitly excludes sensitive fields.
 * Use this type for all API responses and non-authentication operations.
 */
export interface SafeUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  trustLevel: number | null;
  isActive: boolean | null;
  isSuspended: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  // passwordHash intentionally omitted - SECURITY: NEVER expose
}
```

---

## 6. Error Handling Responsibility Split

### Pattern Description
Storage layer handles database errors; route layer handles response formatting.

### Implementation
```typescript
// Storage layer (base-storage.ts)
protected handleError(error: unknown, operation: string): never {
  // Log with context for debugging
  logger.error(`${operation} failed`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  // Re-throw for route layer to handle
  throw error;
}

// Route layer (using helpers.ts)
import { handleRouteError } from './helpers';

catch (error: unknown) {
  // Single-line standardized error handling
  handleRouteError(res, error, 'GetProduct');
}
```

### Why This Split
- **Storage layer**: Has context about what operation failed
- **Route layer**: Has context about HTTP response format
- **Separation of concerns**: Storage shouldn't know about HTTP
- **Testability**: Storage errors can be unit tested without HTTP mocking

---

## 7. Phase Marker Convention

### Pattern Description
Use consistent phase markers throughout refactored code to track migration progress.

### Format
```typescript
/**
 * Phase N: Phase Name - Brief description
 */

// Examples:
// Phase 1: Foundation - Extracted from monolithic storage.ts
// Phase 2: Domain Extraction - UserStorage, ProductStorage
// Phase 3: Interface Composition - Assemble IStorage from domains
// Phase 4: Migration Complete - Remove legacy storage.ts
```

### Where to Add Phase Markers
1. **File headers** - In JSDoc at top of file
2. **Type definitions** - In IMPORTANT NOTES section
3. **Roadmap comments** - In facade file
4. **PR descriptions** - For tracking in git history

---

## 8. Domain Boundary Identification

### How to Identify Domain Boundaries
1. **Entity ownership**: Which tables are primary for this domain?
2. **Method grouping**: Which methods operate on the same entities?
3. **Transaction boundaries**: Which operations need atomicity together?
4. **Import dependencies**: Which types are used together?

### PriceCompare Domain Breakdown
| Domain | Tables | Method Count | Notes |
|--------|--------|--------------|-------|
| UserStorage | users | ~15 | Auth, profile, suspension |
| ProductStorage | products, productOffers | ~20 | CRUD, search |
| PriceStorage | priceHistory, priceSnapshots, aggregates | ~25 | Complex aggregations |
| WatchListStorage | watchLists, productWatches | ~15 | User collections |
| AlertStorage | priceAlerts | ~8 | Notification triggers |
| ForumStorage | forumTopics, forumPosts, forumCategories | ~10 | Community content |
| CommunityStorage | dealSpottings, userReputation, badges | ~12 | Gamification |
| AffiliateStorage | affiliateLinks, affiliateClicks | ~10 | Revenue tracking |
| JobStorage | jobLocks | ~8 | Background job coordination |
| NotificationStorage | notifications | ~6 | User messaging |
| AnalyticsStorage | various aggregates | ~15 | Reporting, admin stats |

---

## 9. Review Checklist for Storage Refactoring PRs

### Phase 1 (Foundation) Checklist
- [ ] Types extracted to `storage/types.ts` with domain grouping
- [ ] IMPORTANT NOTES section documents design decisions
- [ ] Security markers present and pre-commit-hook compatible
- [ ] Base class provides implementation guidance
- [ ] Facade re-exports maintain backward compatibility
- [ ] Roadmap documents all planned domains
- [ ] Phase markers present in all new files
- [ ] TypeScript compilation passes
- [ ] No breaking changes to existing imports

### Phase 2+ (Domain Extraction) Checklist
- [ ] Domain repository extends BaseStorage
- [ ] Methods delegated through DatabaseStorage (delegation pattern)
- [ ] IStorage interface uses specialized types (not inline types)
- [ ] Domain repository return types match IStorage exactly
- [ ] MemStorage stubs updated with matching types
- [ ] Optional parameters reviewed (should they be required?)
- [ ] Existing tests continue to pass
- [ ] Transaction boundaries respected
- [ ] N+1 queries prevented (no loops with queries)
- [ ] Input validation on all public methods
- [ ] Security markers on all passwordHash references
- [ ] TypeScript compilation passes with zero NEW errors

---

## 10. Common Anti-Patterns to Avoid

### Anti-Pattern 1: Breaking Changes Without Re-exports
```typescript
// WRONG - Moves file without maintaining compatibility
// Old: import { storage } from './storage'
// New: import { storage } from './storage/database-storage'

// CORRECT - Facade maintains both import paths
// server/storage/index.ts re-exports from parent during migration
export { storage } from "../storage";
```

### Anti-Pattern 2: Undocumented Type Decisions
```typescript
// WRONG - No explanation for string type
export interface PriceData {
  price: string;  // Why string?
}

// CORRECT - Documents PostgreSQL decimal mapping
/**
 * IMPORTANT NOTES:
 * - **Price fields are strings**: Matches schema.ts Decimal type mapping (PostgreSQL numeric -> string)
 */
export interface PriceData {
  price: string;  // PostgreSQL numeric -> string
}
```

### Anti-Pattern 3: Missing Security Markers
```typescript
// WRONG - No marker for pre-commit hook
export interface SafeUser {
  id: number;
  // passwordHash not here
}

// CORRECT - Hook-compatible marker
// Security: excludes passwordHash
export interface SafeUser {
  id: number;
  // SECURITY: NEVER expose passwordHash
}
```

### Anti-Pattern 4: Implementation Guidance in Wrong Place
```typescript
// WRONG - Implementation details in types file
// types.ts
export interface JobLock {
  // Use transactions when acquiring locks
  // Remember to validate IDs
}

// CORRECT - Implementation guidance in base class
// base-storage.ts
/**
 * IMPLEMENTATION GUIDANCE FOR PHASE 2+ DOMAIN REPOSITORIES:
 * 5. **Transactions**: Wrap multi-step operations in db.transaction()
 */
```

---

## 11. Type Consistency Pattern (Phase 2 Learning)

### Pattern Description
When extracting domain repositories, ensure IStorage interface, domain repository, and delegation layer all use the same specialized types. Avoid inline type definitions that create impedance mismatches.

### Problem Identified in Phase 2
```typescript
// WRONG - IStorage interface uses inline types
export interface IStorage {
  getUserGrowthData(): Promise<Array<{ date: string; count: number }>>;
  getForumActivityData(): Promise<Array<{ date: string; count: number }>>;
  getTopCategories(limit?: number): Promise<Array<{ categoryName: string; topicCount: number }>>;
}

// Domain repository uses specialized types
export class UserStorage extends BaseStorage {
  async getUserGrowthData(): Promise<UserGrowthData[]> { ... }
  async getForumActivityData(): Promise<ForumActivityData[]> { ... }
  async getTopCategories(limit: number): Promise<TopCategory[]> { ... }
}

// Result: Type mismatch! TypeScript compiler doesn't catch this during development
// because inline types structurally match specialized types, but creates
// maintenance issues and potential runtime errors.
```

### Correct Pattern
```typescript
// Step 1: Define specialized types in types.ts
export interface UserGrowthData {
  date: string;
  count: number;
}

export interface ForumActivityData {
  date: string;
  count: number;
}

export interface TopCategory {
  categoryName: string;
  topicCount: number;
}

// Step 2: Use specialized types in IStorage interface
export interface IStorage {
  getUserGrowthData(): Promise<UserGrowthData[]>;
  getForumActivityData(): Promise<ForumActivityData[]>;
  getTopCategories(limit: number): Promise<TopCategory[]>;  // Note: limit is required
}

// Step 3: Domain repository uses same types
export class UserStorage extends BaseStorage {
  async getUserGrowthData(): Promise<UserGrowthData[]> { ... }
  async getForumActivityData(): Promise<ForumActivityData[]> { ... }
  async getTopCategories(limit: number): Promise<TopCategory[]> { ... }
}

// Step 4: DatabaseStorage delegation uses same types
async getUserGrowthData(): Promise<UserGrowthData[]> {
  return this.userStorage.getUserGrowthData();
}
```

### Why This Matters
1. **Type Safety**: Specialized types provide better IDE autocomplete and type checking
2. **Maintainability**: Changes to return types only need updating in one place (types.ts)
3. **Documentation**: Named types are self-documenting (UserGrowthData vs anonymous object)
4. **Refactoring**: Easier to find all usages of a type with "Find All References"
5. **Consistency**: Prevents drift between interface and implementation

### Checklist for Type Consistency
- [ ] All return types use specialized types from types.ts
- [ ] No inline type definitions in IStorage interface
- [ ] Domain repository return types match IStorage exactly
- [ ] DatabaseStorage delegation preserves types
- [ ] MemStorage stubs use same types
- [ ] Optional parameters reviewed (should they be required?)

### Optional vs Required Parameters
Phase 2 identified that `getTopCategories(limit?: number)` should be `getTopCategories(limit: number)`:
- **Optional is wrong** when the parameter has no sensible default
- **Required is correct** when omitting the parameter would return unbounded results
- **Review all optional parameters** during extraction to ensure they're intentional

---

## Related Documentation

- **CLAUDE.md** - Project conventions and security requirements
- **DATABASE_PATTERNS.md** - Query optimization, N+1 prevention, transactions
- **SECURITY_PATTERNS.md** - Password hash handling, input validation
- **TYPESCRIPT_PATTERNS.md** - Type safety, avoiding `any`, type assertions
- **storage-review-patterns.md** - Code review checklist for storage layer

---

## Session Context

**Commits**:
- `55b6a83` - Initial Phase 1 foundation (types, base-storage, index)
- `a41505b` - Documentation and guidance improvements

**Files Created**:
- `/server/storage/types.ts` - 845 lines, 69 type definitions
- `/server/storage/base-storage.ts` - 74 lines, abstract base class
- `/server/storage/index.ts` - 111 lines, facade with roadmap

**Key Decisions**:
1. Extract types first (lowest risk, highest reuse)
2. Use facade pattern for zero breaking changes
3. Include implementation guidance in base class
4. Document roadmap in facade for visibility
5. Use pre-commit-hook-compatible security markers
