# TODO: Manual Testing - Graceful Degradation with Redis Disabled

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 8

---

## Problem Statement

Verify application continues working when Redis is unavailable (graceful degradation to storage layer).

---

## Testing Procedure

```bash
# Test 1: Start without Redis
# 1. Stop Redis
redis-cli shutdown

# 2. Start app (development mode - should use in-memory fallback)
npm run dev
# Check logs: Should show warnings about Redis unavailable

# 3. Test endpoints still work
curl http://localhost:5000/api/products/1
# Should return data (from database, not cache)

curl http://localhost:5000/api/products/search?category=Electronics
# Should work

# 4. Verify no errors in response
# Application should function normally, just slower


# Test 2: Redis failure during operation
# 1. Start app WITH Redis
npm run dev

# 2. Make successful cached request
curl http://localhost:5000/api/products/1

# 3. Kill Redis mid-operation
redis-cli shutdown

# 4. Make another request
curl http://localhost:5000/api/products/1
# Should work (falls back to storage)
# Check logs: Should show cache error warnings

# 5. Restart Redis
redis-server

# 6. Make request
curl http://localhost:5000/api/products/1
# Should resume caching
```

**Expected Behavior:**
- App starts without Redis (dev mode: in-memory fallback)
- Endpoints return correct data (from database)
- No 500 errors to users
- Warnings logged but app stable
- Resumes caching when Redis available again

---

## Acceptance Criteria

- [ ] App starts successfully without Redis (dev mode)
- [ ] All endpoints return correct data without Redis
- [ ] No user-facing errors (500s)
- [ ] Warnings logged appropriately
- [ ] App recovers when Redis becomes available
- [ ] Cache resumes working after Redis restart

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 8
**Dependencies:** Task 003 (graceful fallback implementation)
**Critical:** This validates production resilience
