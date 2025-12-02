# TODO: Manual Testing - Verify Cache Invalidation on Updates

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 7

---

## Problem Statement

Verify that cache invalidation works correctly when products, retailers, or users are updated.

---

## Testing Procedure

```bash
# Test 1: Product update invalidation
# 1. Fetch product (populate cache)
curl http://localhost:5000/api/products/1

# 2. Verify cache exists
redis-cli GET product:full:1
# Should return JSON

# 3. Update product via admin/API
curl -X PATCH http://localhost:5000/api/products/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Product Name"}'

# 4. Verify cache cleared
redis-cli GET product:full:1
# Should return: (nil)

# 5. Fetch again (should be cache miss)
curl http://localhost:5000/api/products/1
# Should show updated name


# Test 2: Retailer update invalidation
# 1. Fetch retailers (populate cache)
curl http://localhost:5000/api/retailers

# 2. Verify cache
redis-cli GET retailer:all

# 3. Update retailer
curl -X PATCH http://localhost:5000/api/retailers/1 \
  -d '{"name": "Updated Retailer"}'

# 4. Verify both caches cleared
redis-cli GET retailer:all  # Should be (nil)
redis-cli GET retailer:id:1 # Should be (nil)


# Test 3: Price change invalidation
# (Trigger price snapshot or manually update offer)
# Verify product cache cleared after price update
```

---

## Acceptance Criteria

- [ ] Product update clears product:full:{id} cache
- [ ] Product update clears product:search:* caches
- [ ] Retailer update clears retailer:id:{id} and retailer:all
- [ ] User update clears user:safe:{id}
- [ ] Delete operations also clear caches
- [ ] Subsequent fetches return updated data

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 7
**Dependencies:** Tasks 011-015
**Type:** Manual testing
