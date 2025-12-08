# Push Instructions - API Standardization Work

**Date:** November 27, 2025
**Branch:** `add_scraping`
**Status:** Ready to push (with minor conflict to resolve)

---

## Situation

You have **17 commits** of excellent API standardization work ready to push:

- ✅ Frontend React Query hooks updated
- ✅ API response helpers migrated
- ✅ 15/25 route files standardized
- ✅ Comprehensive documentation and audit
- ✅ OpenAPI specification
- ✅ Migration TODO for remaining work

**Issue:** The remote branch has 1 commit from a merged PR (#148) that overlaps with your work.

---

## Recommended Approach: Create New Branch

The safest and cleanest approach is to create a fresh branch from the current remote state:

```bash
# 1. Fetch latest remote state
git fetch origin add_scraping

# 2. Create new branch from current work
git checkout -b api-standardization-phase4g-complete

# 3. Push the new branch
git push -u origin api-standardization-phase4g-complete

# 4. Create PR from the new branch
gh pr create --base main \
  --title "feat: Complete API standardization Phase 4g + Frontend updates + Audit" \
  --body "$(cat <<'EOF'
# API Standardization - Phase 4g Complete + Frontend Updates + Comprehensive Audit

## Summary

This PR completes the API standardization effort (Phase 4g, Issue #147) with:
- ✅ Backend: 15/25 route files migrated (60% complete, 130 endpoints)
- ✅ Frontend: React Query hooks with envelope unwrapping
- ✅ Documentation: Comprehensive patterns, OpenAPI spec, audit report
- ✅ Roadmap: TODO for remaining 40% (87 endpoints)

## Changes

### Backend API Standardization
- Migrated 9 route files to standardized response format
- Created `server/utils/api-response.ts` with helper functions
- All migrated routes use `sendSuccess()`, `sendError()`, `sendErrorFromException()`

**Migrated Files (9 new):**
1. `specification-routes.ts` (8 endpoints)
2. `wishlist-routes.ts` (9 endpoints)
3. `agent-limits-routes.ts` (4 endpoints)
4. `enhanced-forum-routes.ts` (20 endpoints)
5. `advanced-search-routes.ts` (8 endpoints)
6. `discourse-routes.ts` (4 endpoints)
7. `aggregation-metrics-routes.ts` (5 endpoints)
8. `admin-aggregation-routes.ts` (4 endpoints)
9. `cache-routes.ts` (11 endpoints)
10. `price-history-routes.ts` (8 endpoints) - completed
11. Plus 5 previously migrated files

**Total:** ~130/217 endpoints (60%) now standardized

### Frontend Updates
- Enhanced `apiRequest()` with automatic envelope unwrapping
- Updated 17+ React Query hooks to use explicit `queryFn`
- Added `ApiError` class with status codes and details
- Fixed data access patterns across all hooks

**Updated Hooks:**
- `use-home-data.ts` (9 hooks)
- `use-products.ts` (1 hook)
- `use-wishlist.ts` (4 hooks)
- `use-notifications.ts` (3 hooks)

### Documentation
- **API_PATTERNS.md** - Updated with comprehensive envelope format examples (786 lines)
- **openapi.yaml** - NEW OpenAPI 3.1 specification (634 lines)
- **API_AUDIT_REPORT.md** - NEW comprehensive audit report (400 lines)
- **TODO_API_MIGRATION.md** - NEW migration roadmap for remaining work (367 lines)

### Audit Findings
- ✅ 60% complete: 130/217 endpoints standardized
- ⚠️ 40% remaining: 87/217 endpoints need migration
- 🔴 10 route files identified for Phase 2 migration
- ⚠️ Security gaps: CSRF protection needed on 17 files
- ⚠️ Validation gaps: Zod schemas needed on 12 files

## Remaining Work

See `TODO_API_MIGRATION.md` for complete migration plan:

**Phase 1 (HIGH):** 40 endpoints
- auth-routes.ts, product-routes.ts, watchlist-routes.ts, alert-routes.ts

**Phase 2 (MEDIUM):** 42 endpoints
- admin-routes.ts, scraping-routes.ts, affiliate-routes.ts

**Phase 3 (LOW):** 13 endpoints
- forum-routes.ts, monitoring-routes.ts, retailer-routes.ts

**Estimated Effort:** 18-25 hours across 3 sprints

## Testing

- ✅ All pre-commit hooks passing
- ✅ TypeScript compilation clean (no new errors)
- ✅ Envelope format validated on migrated endpoints
- ✅ Frontend hooks tested with unwrapped data
- ⚠️ Manual testing recommended for all endpoints

## Breaking Changes

**None** - All changes are backward compatible:
- `apiRequest()` handles both envelope and legacy formats
- Frontend components work with unwrapped data
- No API contract changes

## References

- Issue: #147
- Related PR: #148 (Phase 1-4d)
- Audit Report: `docs/API_AUDIT_REPORT.md`
- Migration TODO: `TODO_API_MIGRATION.md`
- OpenAPI Spec: `docs/openapi.yaml`

## Checklist

- [x] All commits follow conventional commit format
- [x] Pre-commit hooks passing
- [x] Documentation updated
- [x] No TypeScript errors introduced
- [x] Audit report generated
- [x] Migration roadmap created
- [ ] Manual testing of migrated endpoints
- [ ] Review by maintainer

---

**Next Steps:** Review TODO_API_MIGRATION.md and begin Phase 1 migration
EOF
)"
```

---

## Alternative: Force Push (If you own the branch)

If you're the only one working on `add_scraping` and want to keep the same branch name:

```bash
# Check what's different on remote
git fetch origin add_scraping
git log --oneline origin/add_scraping..HEAD

# Force push with lease (safer than --force)
git push --force-with-lease origin add_scraping

# Create PR
gh pr create --base main \
  --title "feat: Complete API standardization Phase 4g + Frontend updates + Audit" \
  --body "See PUSH_INSTRUCTIONS.md for full PR description"
```

**Warning:** This will overwrite the remote branch. Only do this if:

- You're the only one working on this branch
- The remote commit (808a1e7) is already merged to main via PR #148
- You're comfortable with force pushing

---

## What You've Accomplished

**17 Commits:**

1. Extract job lock magic numbers to constants
2. Update ARCHITECTURE.md with storage layer structure
3. Add domain-specific caching strategies guide
4. Remove phase completion summary files
5. Consolidate pattern documentation
6. Migrate 4 route files (batch 1 - 33 endpoints)
7. Standardize 6 route files (batch 2 - 52 endpoints)
8. Fix error message format in enhanced forum
9. Complete final 3 route files (batch 3 - 22 endpoints)
10. Add api-response module and cleanup
11. Complete price-history-routes standardization
12. Update React Query hooks with envelope unwrapping
13. Update use-notifications hooks
14. Update API_PATTERNS.md documentation
15. Add OpenAPI 3.1 specification
16. Add comprehensive audit report
17. Add migration TODO

**Files Changed:**

- 10 route files migrated
- 4 React Query hook files updated
- 1 new utility file (api-response.ts)
- 4 documentation files (patterns, OpenAPI, audit, TODO)

**Impact:**

- 60% of API standardized (130/217 endpoints)
- Complete frontend envelope unwrapping
- Comprehensive documentation and audit
- Clear roadmap for remaining 40%

---

## Recommended Next Steps

1. **Push your work** (use new branch approach above)
2. **Create PR** with detailed description
3. **Request review** from maintainers
4. **Begin Phase 1 migration** of remaining 40 critical endpoints
5. **Monitor PR** for feedback and merge

---

## Questions?

- Review `docs/API_AUDIT_REPORT.md` for full audit details
- Review `TODO_API_MIGRATION.md` for migration roadmap
- Check `docs/API_PATTERNS.md` for updated response patterns
- See `docs/openapi.yaml` for API specification

---

**Created:** November 27, 2025
**Context:** Session ending, low on tokens
**Status:** Ready to push ✅
