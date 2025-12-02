# TODO: Manual Testing - Verify Cache Misses Populate Redis

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 6

---

## Problem Statement

Verify that cache misses correctly fetch from database and populate Redis cache for subsequent hits.

---

## Testing Procedure

```bash
# Clear all caches
redis-cli FLUSHDB

# Verify empty
redis-cli KEYS "*"
# Should return: (empty array)

# Make fresh request
curl http://localhost:5000/api/products/1

# Verify cache populated
redis-cli KEYS "*"
# Should show: product:full:1

# Check cache content
redis-cli GET product:full:1
# Should return JSON with product data

# Check TTL
redis-cli TTL product:full:1
# Should be ~300 (5 minutes)

# Make another request (should be cache hit)
curl http://localhost:5000/api/products/1
# Should be much faster
```

**Test all cached methods:**
- Product detail
- Product search
- All retailers
- Retailer by ID
- User by ID

---

## Acceptance Criteria

- [ ] Cache miss fetches from database (verify in logs)
- [ ] Cache populated after miss (verify with Redis CLI)
- [ ] Cache content matches database data
- [ ] TTL set correctly for each cache type
- [ ] Second request hits cache (faster response)

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 6
**Dependencies:** Tasks 006-010, 016-018
**Type:** Manual testing
