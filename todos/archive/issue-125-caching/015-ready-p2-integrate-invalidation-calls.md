# TODO: Integrate Invalidation Calls into Storage Layer

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 3, Task 5

---

## Problem Statement

Update storage layer methods to call cache invalidation after successful updates. This ensures caches stay consistent with database state.

---

## Implementation Locations

**Product Operations:**
```typescript
// In storage.ts
async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product> {
  const result = await db.update(products)...;

  // Invalidate cache after successful update
  await storageCache.invalidateProductCache(id);

  return result;
}
```

**Apply to:**
- `storage.updateProduct()` → `invalidateProductCache()`
- `storage.deleteProduct()` → `invalidateProductCache()`
- `storage.updateRetailer()` → `invalidateRetailerCache()`
- `storage.deleteRetailer()` → `invalidateRetailerCache()`
- `storage.updateUser()` → `invalidateUserCache()`

**Pattern:**
1. Perform database operation
2. If successful, call invalidation (await or fire-and-forget)
3. Return result

**Error Handling:**
- Invalidation failures should NOT break updates
- Already handled gracefully in invalidation methods
- Can use `void storageCache.invalidate...()` for fire-and-forget

---

## Acceptance Criteria

- [ ] `updateProduct()` calls `invalidateProductCache()`
- [ ] `deleteProduct()` calls `invalidateProductCache()`
- [ ] `updateRetailer()` calls `invalidateRetailerCache()`
- [ ] `deleteRetailer()` calls `invalidateRetailerCache()`
- [ ] `updateUser()` calls `invalidateUserCache()`
- [ ] Invalidation happens AFTER successful DB operation
- [ ] TypeScript compilation passes
- [ ] Existing tests still pass

---

## Notes

**Source:** GitHub issue #125, Phase 3, Task 5
**Dependencies:** Tasks 011-014 (all invalidation methods)
**Testing:** Verify cache cleared after updates (manual Redis CLI check)
