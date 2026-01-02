# Phase 1 Continuation Prompt

Copy and paste this prompt to start a new session and continue with Phase 1:

---

I need to implement **Phase 1 (Core UX Improvements)** from the watchlist enhancement plan located at:

```
/Users/williamtower/.claude/plans/snug-whistling-stream.md
```

## Context

**Phase 0 (Critical Bug Fixes) is COMPLETE** ✅

All 4 critical bugs have been fixed, code reviewed (EXCELLENT rating), patterns codified, and migration applied. See the completion summary at:
- `/Users/williamtower/projects/PriceCompare/docs/PHASE0_COMPLETION_SUMMARY.md`
- `/Users/williamtower/projects/PriceCompare/docs/PHASE0_QUICK_REFERENCE.md`

**Key Phase 0 Achievements:**
- Fixed duplicate product constraint bug (NULL-safe partial index)
- Fixed empty name validation (Zod trim ordering)
- Added rate limiting to creation endpoints
- Improved error handling (400 for validation, not 500)
- Codified 7 reusable patterns for future development

**Test Status:** 77/80 passing (3 expected failures testing deprecated patterns)

## Phase 1 Tasks

Phase 1 includes **4 core UX improvement tasks** (estimated 16-24 hours):

### Task 1.1: Price Alert Integration from Watchlist
- Add "Set Price Alert" button to product cards
- Create dialog component for alert creation
- Pre-fill with 10% discount target
- Backend already exists (POST /api/alerts)

### Task 1.2: Cursor-Based Pagination for Watched Products
- Replace hard 100-product limit with infinite scroll
- Implement cursor-based pagination (not offset)
- Use React Query's `useInfiniteQuery`
- Backend changes: Add cursor/hasMore/nextCursor to response

### Task 1.3: Display and Edit Target Price, Notes, Priority
- Backend supports these fields but UI doesn't expose them
- Create expandable product details form
- Add PATCH route for updating watch records
- Auto-save on blur pattern

### Task 1.4: Category Filtering
- Backend has category column, no UI filtering
- Create category filter component (badge-based)
- Add GET /api/watchlists/categories endpoint
- Update query to filter by category

## Instructions

**Follow the plan exactly as written** at `/Users/williamtower/.claude/plans/snug-whistling-stream.md`

**Apply Phase 0 patterns** from `/Users/williamtower/projects/PriceCompare/docs/PHASE0_QUICK_REFERENCE.md`:
- ✅ Validation at route layer (Zod schemas)
- ✅ Configuration in constants.ts (no magic numbers)
- ✅ Rate limiting on new mutation endpoints
- ✅ CSRF protection on all mutations
- ✅ Standardized API responses (sendSuccess/sendError)
- ✅ Proper middleware ordering (auth → rate → CSRF)
- ✅ PostgreSQL error classification (400 vs 500)

**After implementing each task:**
1. Run tests to verify it works
2. Call `code-review-specialist` to review the code
3. Move to next task

**Important Files:**
- Plan: `/Users/williamtower/.claude/plans/snug-whistling-stream.md`
- Patterns: `/Users/williamtower/projects/PriceCompare/docs/PHASE0_QUICK_REFERENCE.md`
- Routes: `/Users/williamtower/projects/PriceCompare/server/routes/watchlist-routes.ts`
- Storage: `/Users/williamtower/projects/PriceCompare/server/storage/domains/watchlist-storage.ts`
- Frontend: `/Users/williamtower/projects/PriceCompare/client/src/pages/price-watch.tsx`

**Start with Task 1.1** (Price Alert Integration) and work sequentially through the tasks.

Let me know when you're ready to begin!
