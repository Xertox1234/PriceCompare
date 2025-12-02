# TODO: Route Integration - Retailer Endpoints

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 4, Task 3

---

## Problem Statement

Update retailer routes to use cached `storageCache.getAllRetailers()` and `storageCache.getRetailerById()`.

---

## Implementation

```typescript
// In server/routes/retailer-routes.ts
import { storageCache } from '../services/storage-cache';

// GET /api/retailers
app.get('/api/retailers', async (req, res) => {
  const retailers = await storageCache.getAllRetailers();
  sendSuccess(res, retailers);
});

// GET /api/retailers/:id
app.get('/api/retailers/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'retailerId', { min: 1 });
  const retailer = await storageCache.getRetailerById(id);

  if (!retailer) {
    sendError(res, 'Retailer not found', 404);
    return;
  }

  sendSuccess(res, retailer);
});
```

---

## Acceptance Criteria

- [ ] Replace `storage.getAllRetailers()` with cached version
- [ ] Replace `storage.getRetailerById()` with cached version
- [ ] TypeScript passes
- [ ] Manual testing confirms caching

---

## Notes

**Source:** GitHub issue #125, Phase 4, Task 3
**Dependencies:** Tasks 008, 009
