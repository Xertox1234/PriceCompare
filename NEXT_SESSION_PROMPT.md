# Next Session Prompt

## Quick Start Command

Copy and paste this prompt to continue where we left off:

---

**Context:** I'm working on adding CSRF protection to the PriceCompare API as part of a critical security remediation. This is Day 2 of the work.

**Current Status:**
- Working in branch: `feat/api-standardization-final`
- Worktree: `/Users/williamtower/projects/PriceCompare/.worktrees/api-standardization`
- Progress: 12/50 endpoints protected (24%)
- Files completed: 3/11
- Tests: 31 written, 20 passing (64%)

**What's Been Done:**
1. ✅ Security audit completed (see `CSRF_PROTECTION_AUDIT.md`)
2. ✅ CSRF protection added to 3 files:
   - `server/routes/admin-aggregation-routes.ts` (4 endpoints)
   - `server/routes/admin-routes.ts` (6 endpoints)
   - `server/routes/monitoring-routes.ts` (2 endpoints)
3. ✅ Comprehensive test suite created (`server/routes/__tests__/csrf-protection.test.ts`)
4. ✅ Documentation written (3 files, 34KB total)

**What Needs to Be Done:**

**Priority 1 - Critical Files (High Risk):**
1. `server/routes/cache-routes.ts` - 7 POST endpoints (cache manipulation)
2. `server/routes/price-history-routes.ts` - 3 endpoints (data integrity)
3. `server/routes/scraping-routes.ts` - 11 POST endpoints (system operations)
4. `server/routes/affiliate-routes.ts` - 6 endpoints (financial impact)

**Priority 2 - Medium Priority Files:**
5. `server/routes/price-analytics-routes.ts` - 3 POST endpoints
6. `server/routes/advanced-search-routes.ts` - 2 POST endpoints
7. `server/routes/agent-limits-routes.ts` - 1 POST endpoint
8. `server/routes/specification-routes.ts` - 1 POST endpoint

**Next Steps:**

**Option A - Continue CSRF Protection (Recommended):**
Continue adding CSRF protection to the remaining files. Start with cache-routes.ts (highest impact). The pattern is well-established:
```typescript
// 1. Add import
import { csrfProtection } from '../middleware/security';

// 2. Add to each POST/PUT/PATCH/DELETE
app.post('/api/endpoint', csrfProtection, withAuth(async (req, res) => {
```

**Option B - Fix Failing Tests First:**
Fix the 11 failing tests by adding proper storage layer mocks. All failures are 500 errors due to missing mocks, not logic issues.

**Option C - Commit Current Work:**
Create a commit with current progress before continuing:
```bash
git add -A
git commit -m "feat: Add CSRF protection to 12 critical endpoints (24% complete)

SECURITY: Protect against Cross-Site Request Forgery attacks

Protected endpoints:
- Admin aggregation operations (4 endpoints)
- Product/Retailer CRUD operations (6 endpoints)
- Monitoring operations (2 endpoints)

Includes:
- Comprehensive security audit documentation
- Test suite with 20 passing tests
- Implementation guide for remaining work

Remaining: 38 endpoints across 8 files
See CSRF_PROTECTION_AUDIT.md for complete details"
```

**Files to Reference:**
- `CSRF_PROTECTION_AUDIT.md` - Complete technical audit
- `API_SECURITY_IMPROVEMENTS.md` - Executive summary
- `WORK_SUMMARY.md` - Day 1 progress report
- `server/routes/__tests__/csrf-protection.test.ts` - Test patterns

**Command to Resume:**
```bash
cd /Users/williamtower/projects/PriceCompare/.worktrees/api-standardization
git status
# Review current changes
# Continue with your chosen option
```

**My Recommendation:** Start with **Option C** (commit current work), then continue with **Option A** (cache-routes.ts next). This creates a checkpoint and allows for incremental progress.

What would you like to do?

---

## Alternate Shorter Prompt

If you prefer a shorter prompt:

---

Continue adding CSRF protection to PriceCompare API endpoints. We're in the worktree at `/Users/williamtower/projects/PriceCompare/.worktrees/api-standardization` on branch `feat/api-standardization-final`.

**Completed:** 12/50 endpoints (24%) across 3 files
**Next file:** `server/routes/cache-routes.ts` (7 POST endpoints)

**Pattern:**
```typescript
import { csrfProtection } from '../middleware/security';
app.post('/endpoint', csrfProtection, withAuth(async (req, res) => {
```

See `CSRF_PROTECTION_AUDIT.md` for details. Continue adding protection to remaining files.

---
