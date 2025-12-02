# TODO: Add Cache Bypass Option for Admin Users

## Priority: P3 (Nice-to-Have)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 4

---

## Problem Statement

Add optional `?skipCache=1` query parameter to allow admin users to bypass cache and get fresh data directly from database.

---

## Implementation

```typescript
// In cached methods or route handlers
app.get('/api/products/:id', withAuth(async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

  // Admin bypass
  const skipCache = req.query.skipCache === '1' && req.user?.role === 'admin';

  const product = skipCache
    ? await storage.getProductById(id)
    : await storageCache.getProductById(id);

  if (!product) {
    sendError(res, 'Product not found', 404);
    return;
  }

  sendSuccess(res, product);
}));
```

**Use Cases:**
- Admin verifying data after updates
- Debugging cache issues
- Testing without cache interference

---

## Acceptance Criteria

- [x] `?skipCache=1` query parameter supported
- [x] Only works for admin users (role check)
- [x] Falls back to direct storage.* calls
- [x] Works on product, retailer, search endpoints
- [x] TypeScript passes

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 4
**Priority:** P3 - Nice to have but not critical
