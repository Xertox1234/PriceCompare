# TODO: Add TypeScript Types and Interfaces

## Priority: P3 (Nice-to-Have)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 1, Task 5

---

## Problem Statement

Add comprehensive TypeScript types and interfaces for the `StorageCacheService` to ensure type safety, improve IDE autocomplete, and document the API surface. This includes types for cache tiers, filter hashing, and method signatures.

**Current State:**
- Basic TypeScript usage in StorageCacheService
- No explicit type definitions for cache tiers
- Literal string types used inline (e.g., 'HOT' | 'WARM' | 'COLD' | 'STATIC')
- Filter types are generic `Record<string, unknown>`

**Why This Matters:**
- **Type Safety**: Compile-time validation prevents runtime errors
- **IDE Support**: Better autocomplete and IntelliSense
- **Documentation**: Types serve as inline API documentation
- **Refactoring**: Makes codebase changes safer
- **Consistency**: Enforces consistent usage across the codebase

---

## Findings

**Location:** `server/services/storage-cache.ts` (type definitions at top of file)

**Problem Scenario:**

1. **Invalid Tier Values:**
   ```typescript
   // Without type definition
   cachedGet(key, fetchFn, 300, 'warm'); // Runtime error - should be 'WARM'

   // With type definition
   type CacheTier = 'HOT' | 'WARM' | 'COLD' | 'STATIC';
   cachedGet(key, fetchFn, 300, 'warm'); // ❌ TypeScript error at compile time
   ```

2. **Generic Type Inference:**
   ```typescript
   // Without explicit types, return type might be inferred as any
   const product = await cachedGet(key, fetchFn, 300, 'WARM');
   // Type: any? Product? unknown?

   // With generic constraint
   const product = await cachedGet<Product>(key, fetchFn, 300, 'WARM');
   // Type: Product ✓
   ```

3. **Filter Type Documentation:**
   ```typescript
   // Generic Record doesn't document expected structure
   hashFilters(filters: Record<string, unknown>)

   // Specific type documents expected fields
   interface ProductSearchFilters {
     category?: string;
     minPrice?: number;
     maxPrice?: number;
     keyword?: string;
     retailerId?: number;
     sortBy?: string;
   }
   ```

**Related Files:**
- `server/services/storage-cache.ts` - Implementation location
- `shared/schema.ts` - Import Product, Retailer, SafeUser types
- `server/storage.ts:650-700` - Search filters interface

---

## Proposed Solutions

### Option 1: Comprehensive Type Definitions (Recommended)

```typescript
import type { Product, Retailer, SafeUser } from '@shared/schema';

/**
 * Cache tier classification for TTL and invalidation strategies.
 *
 * - HOT: Frequently accessed, very short TTL (30s-1min)
 * - WARM: Regularly accessed, moderate TTL (5-15min)
 * - COLD: Occasionally accessed, longer TTL (30-60min)
 * - STATIC: Rarely changes, very long TTL (60min+)
 */
export type CacheTier = 'HOT' | 'WARM' | 'COLD' | 'STATIC';

/**
 * Configuration options for AdvancedCacheService initialization.
 */
interface CacheConfig {
  namespace: string;
  defaultTTL: number;
}

/**
 * Generic filter object for search queries.
 * Allows any key-value pairs for flexible filtering.
 */
export type SearchFilters = Record<string, unknown>;

/**
 * Product-specific search filters with documented fields.
 */
export interface ProductSearchFilters extends SearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  keyword?: string;
  retailerId?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';
  limit?: number;
  offset?: number;
}

/**
 * Cached data wrapper with metadata.
 */
interface CachedData<T> {
  data: T;
  cachedAt: Date;
  tier: CacheTier;
}
```

- **Pros**:
  - Comprehensive type coverage
  - Self-documenting API
  - Prevents common mistakes
  - Excellent IDE support
  - Exportable for use in route handlers
- **Cons**:
  - More upfront work
  - Need to maintain type definitions
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Minimal Type Definitions

```typescript
type CacheTier = 'HOT' | 'WARM' | 'COLD' | 'STATIC';
type SearchFilters = Record<string, unknown>;
```

- **Pros**:
  - Quick to implement
  - Covers basic needs
- **Cons**:
  - Less documentation value
  - Misses opportunity for better type safety
  - No ProductSearchFilters specification
- **Effort**: Small (15 min)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Comprehensive Type Definitions**

This provides maximum value for minimal effort and follows TypeScript best practices.

**Implementation Priority:**

1. **Core Types (Required):**
   - `CacheTier` - Used in all cached methods
   - `SearchFilters` - Base type for filter hashing

2. **Interface Types (Recommended):**
   - `ProductSearchFilters` - Documents search API
   - `CacheConfig` - Documents constructor options

3. **Metadata Types (Optional):**
   - `CachedData<T>` - If adding cache metadata later

**Export Strategy:**
- Export `CacheTier` and `ProductSearchFilters` - used by route handlers
- Keep `CacheConfig` internal (only used in constructor)
- Make types available for testing

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (add type definitions)

**Related Components:**
- `@shared/schema` - Import Product, Retailer, SafeUser types
- Route handlers - May import ProductSearchFilters type

**Database Changes:** No

**TypeScript Considerations:**
- Use `type` for simple unions and aliases
- Use `interface` for object shapes (extensibility)
- Export public types for use in route handlers
- Add JSDoc comments for each type
- Use `extends` for type composition (ProductSearchFilters extends SearchFilters)

**Import Strategy:**
```typescript
// At top of storage-cache.ts
import type { Product, Retailer, SafeUser } from '@shared/schema';
import { AdvancedCacheService } from './advanced-cache';

// Type definitions
export type CacheTier = 'HOT' | 'WARM' | 'COLD' | 'STATIC';
// ... rest of types
```

---

## Acceptance Criteria

- [ ] `CacheTier` type defined with JSDoc documentation
- [ ] `SearchFilters` base type defined
- [ ] `ProductSearchFilters` interface defined with all fields
- [ ] `CacheConfig` interface defined (if needed for constructor)
- [ ] Public types exported with `export` keyword
- [ ] JSDoc comments added for each type definition
- [ ] `cachedGet()` method signature uses `CacheTier` type
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] No `any` types used (pre-commit hook enforced)
- [ ] Types importable in route handlers

**Verification:**
```typescript
// In product-routes.ts
import type { ProductSearchFilters, CacheTier } from '../services/storage-cache';

// Should have autocomplete for filter fields
const filters: ProductSearchFilters = {
  category: 'Electronics',
  minPrice: 100,
  sortBy: 'price_asc' // Autocomplete should suggest valid options
};
```

---

## Resources

**Internal References:**
- `shared/schema.ts` - Product, Retailer, SafeUser type definitions
- `server/storage.ts:650-700` - Search filters structure
- `docs/TYPESCRIPT_PATTERNS.md` - Type safety guidelines

**TypeScript Documentation:**
- [Type Aliases vs Interfaces](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#differences-between-type-aliases-and-interfaces)
- [Literal Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types)
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

**Best Practices:**
- [TypeScript Deep Dive - Types](https://basarat.gitbook.io/typescript/type-system)
- [Effective TypeScript - Item 8: Know How to Tell Whether a Symbol Is in the Type Space or Value Space](https://effectivetypescript.com/)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P3 (Nice-to-Have) - code quality enhancement
- Estimated effort: Small (1 hour)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 1, Task 5 - code quality foundation
- Type definitions improve developer experience significantly
- Minimal effort for high impact on maintainability
- Types can be added incrementally without breaking changes

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 1 of 4 (Core Cache Infrastructure)
**Dependencies:** Task 001 (StorageCacheService class must exist)
**Can Be Done Anytime:** This task doesn't block others, can be done in parallel
**Production Impact:** No functional change, improves developer experience
