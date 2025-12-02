# TODO: Manual Testing - Verify Cache Hits with Redis CLI

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 5

---

## Problem Statement

Manually test that caching works correctly by monitoring Redis with MONITOR command and verifying cache keys are created and retrieved.

---

## Testing Procedure

```bash
# Terminal 1: Start Redis monitoring
redis-cli MONITOR

# Terminal 2: Start app
npm run dev

# Terminal 3: Make requests
# Test 1: Product detail (cache miss)
curl http://localhost:5000/api/products/1
# Redis MONITOR should show: SET product:full:1 ...

# Test 2: Same product (cache hit)
curl http://localhost:5000/api/products/1
# Redis MONITOR should show: GET product:full:1

# Test 3: Search (cache miss)
curl "http://localhost:5000/api/products/search?category=Electronics"
# Redis MONITOR should show: SET product:search:{hash} ...

# Test 4: Same search (cache hit)
curl "http://localhost:5000/api/products/search?category=Electronics"
# Redis MONITOR should show: GET product:search:{hash}

# Test 5: Retailers (cache miss then hit)
curl http://localhost:5000/api/retailers
# First: SET retailer:all
# Second: GET retailer:all
```

**Verify:**
- Cache keys follow documented format
- First call creates cache entry (SET)
- Subsequent calls retrieve from cache (GET)
- TTLs are correct: `redis-cli TTL product:full:1` (should be ~300s)

---

## Acceptance Criteria

- [ ] Redis MONITOR shows cache SET operations on first calls
- [ ] Redis MONITOR shows cache GET operations on repeated calls
- [ ] Cache keys match documented format
- [ ] TTLs are correct (verify with `redis-cli TTL <key>`)
- [ ] All 5 cached methods tested (product, search, retailers x2, user)
- [ ] Document results in this file or create test report

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 5
**Dependencies:** Tasks 006-010, 016-018
**Type:** Manual testing, no code changes
