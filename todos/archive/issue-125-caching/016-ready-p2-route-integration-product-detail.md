# TODO: Route Integration - Product Detail Endpoint

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 1

---

## Problem Statement

Update `GET /api/products/:id` route to use cached `storageCache.getProductById()` instead of direct storage call.

---

## Implementation

```typescript
// In server/routes/product-routes.ts
import { storageCache } from '../services/storage-cache';

app.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });

    // ✅ Use cached wrapper instead of storage
    const product = await storageCache.getProductById(id);

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
  }
});
```

**Change:** Replace `storage.getProductById()` with `storageCache.getProductById()`

---

## Acceptance Criteria

- [ ] Import `storageCache` in product-routes.ts
- [ ] Replace `storage.getProductById()` with `storageCache.getProductById()`
- [ ] Endpoint functionality unchanged
- [ ] TypeScript compilation passes
- [ ] Manual testing confirms caching works

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 1
**Dependencies:** Task 006 (cached method must exist)
