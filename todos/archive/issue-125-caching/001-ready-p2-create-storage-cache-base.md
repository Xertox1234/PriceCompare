# TODO: Create storage-cache.ts with Base Structure

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 1, Task 1

---

## Problem Statement

Create the foundational file `server/services/storage-cache.ts` that will house all cached wrapper functions for the storage layer. This establishes the separation of concerns pattern where caching logic lives in the service layer rather than polluting the storage layer.

**Current State:**
- All storage methods hit the database directly on every request
- No caching infrastructure exists at the service layer
- Routes call storage methods directly without any caching layer
- This results in 50-500ms response times for every database query

**Why This Matters:**
- Establishes architectural foundation for all subsequent caching work
- Maintains separation of concerns (caching in service layer, not storage layer)
- Enables 60-80% reduction in database queries for product/retailer endpoints
- Reduces response latency from 50-500ms (DB) to 1-5ms (Redis)

---

## Findings

**Location:** `server/services/storage-cache.ts` (new file)

**Key Requirements:**
- Import `AdvancedCacheService` from `./advanced-cache.ts`
- Import storage methods from `../storage`
- Export an object/class structure for cached wrappers
- Set up TypeScript types and interfaces
- Add JSDoc documentation
- Follow patterns from `CACHING_STRATEGY_GUIDE.md`

**Related Files:**
- `server/services/advanced-cache.ts:322-343` - `getOrSet()` pattern
- `server/services/analytics-cache.ts:28-49` - Cached analytics pattern (reference)
- `server/storage.ts:1408-1575` - Cache specifications (JSDoc)
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Implementation guide

---

## Proposed Solutions

### Option 1: Class-Based Service (Recommended)
- **Pros**:
  - Encapsulates cache instance as private property
  - Clean dependency injection pattern
  - Easier to test with mocks
  - Follows existing service patterns (EmailService, NotificationService)
- **Cons**:
  - Slightly more boilerplate than object export
- **Effort**: Small (1-2 hours)
- **Risk**: Low

### Option 2: Object Export Pattern
- **Pros**:
  - Simpler, more functional approach
  - Less boilerplate
  - Direct function exports
- **Cons**:
  - Harder to mock in tests
  - Cache instance as module-level singleton
- **Effort**: Small (1 hour)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Class-Based Service**

Create `server/services/storage-cache.ts` with:

```typescript
import { AdvancedCacheService } from './advanced-cache';
import { storage } from '../storage';
import type { Product, Retailer, SafeUser } from '@shared/schema';

/**
 * Cached wrapper service for storage layer methods.
 * Implements multi-tier caching (L1 in-memory + L2 Redis) for high-traffic storage operations.
 */
export class StorageCacheService {
  private cache: AdvancedCacheService;

  constructor() {
    this.cache = new AdvancedCacheService({
      namespace: 'storage',
      defaultTTL: 300 // 5 minutes default
    });
  }

  // Cached wrapper methods will be added in subsequent tasks
}

// Export singleton instance
export const storageCache = new StorageCacheService();
```

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (NEW)

**Related Components:**
- `AdvancedCacheService` - Multi-tier caching engine
- `storage.ts` - Database access layer
- Route handlers - Will consume this service in Phase 4

**Database Changes:** No

**TypeScript Considerations:**
- Use strict mode (no `any` types)
- Import types from `@shared/schema`
- Add JSDoc comments for all public methods
- Use generics for type-safe cache operations

---

## Acceptance Criteria

- [ ] File `server/services/storage-cache.ts` created
- [ ] `StorageCacheService` class exported with constructor
- [ ] `AdvancedCacheService` instantiated with namespace 'storage'
- [ ] Singleton instance `storageCache` exported
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] JSDoc comments added to class and constructor
- [ ] No `any` types used (pre-commit hook enforced)
- [ ] Follows patterns from `analytics-cache.ts` reference implementation

---

## Resources

**Internal References:**
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Complete implementation guide
- `server/services/advanced-cache.ts:322-343` - `getOrSet()` pattern
- `server/services/analytics-cache.ts:28-49` - Similar cached service pattern
- `server/config/redis.ts:1-225` - Redis client setup

**External References:**
- [ioredis GitHub Repository](https://github.com/redis/ioredis)
- [Improving Node.js App Performance with Redis Caching](https://betterstack.com/community/guides/scaling-nodejs/nodejs-caching-redis/)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P2 (Important) - foundational infrastructure
- Estimated effort: Small (1-2 hours)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 1, Task 1 - foundation for all subsequent caching work
- Must maintain separation of concerns (service layer vs storage layer)
- Class-based pattern preferred for consistency with existing services

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 1 of 4 (Core Cache Infrastructure)
**Dependencies:** None - this is the foundational task
**Blocks:** Tasks 002-026 (all subsequent caching implementation)
