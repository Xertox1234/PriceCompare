# TODO Management

This folder contains TODO items for the PriceCompare project. Completed TODOs are archived to `archive/` with timestamps.

## Active TODOs

Currently, there are **2 numbered active TODOs** (require backend work).

### 🟡 P2 - Important (Requires Backend)

| TODO | Title | Impact | Blocker |
|------|-------|--------|---------|
| **290** | Comparison List Persistence | Data loss on refresh | Needs backend API |

### 🔵 P3 - Nice-to-Have (Requires Backend)

| TODO | Title | Impact | Blocker |
|------|-------|--------|---------|
| **293** | Agent-Native Accessibility Gaps | 3 features missing API | Needs newsletter API, theme API |

### 📝 Documentation Tasks
- **TODO_MISSING_GUIDES** - P4 (Low), Documentation
  - **Problem**: Pattern validation found referenced guides that don't exist
  - **Missing**: Database performance review guide, others
  - **Impact**: Documentation gaps

---

## Recently Completed (2026-01-25)

### Frontend Code Review Parallel Resolution
**10 TODOs resolved** via parallel agent execution:

| TODO | Priority | Resolution | Category |
|------|----------|------------|----------|
| **283** | P1 | WebSocket Singleton - Refactored to shared client | Architecture |
| **284** | P1 | ShopProvider Hierarchy - Added to App.tsx providers | Architecture |
| **285** | P1 | CSRF Token Fix - Replaced 15 fetch() with apiRequest() | Security |
| **286** | P2 | Orphaned Pages - Deleted 742 lines dead code | Cleanup |
| **287** | P2 | Memoization Fixes - useCallback/useMemo in home-new.tsx | Performance |
| **288** | P2 | Duplicate Hooks - Deleted use-mobile.tsx duplicate | Cleanup |
| **289** | P2 | Wishlist Set Optimization - O(n) → O(1) lookups | Performance |
| **291** | P2 | Race Condition Mutex - pendingToggles ref pattern | Data Integrity |
| **292** | P3 | Naming Convention - Renamed 7 hooks to kebab-case | Consistency |
| **294** | P3 | Zod Validation - Created shared/auth-schema.ts | Type Safety |

**Commits**:
- `bc6cb8c` - fix: resolve 10 frontend TODOs via parallel agent execution

---

### Backend Parallel Agent Resolution Session (Earlier)
**9 TODOs resolved** via parallel agent execution:

| TODO | Priority | Resolution | Time |
|------|----------|------------|------|
| **272** | P2 | Agent-Native APIs - Added 9 endpoints for Compare List & Recently Viewed | ~4 hrs |
| **273** | P2 | Price History Index - **Already existed** in migration 0004 | 0 min |
| **274** | P2 | Auth Modal Design Tokens - Replaced with Tailwind tokens | ~30 min |
| **275** | P2 | E2E Cleanup Tables - Added 23 missing tables (41 total) | ~30 min |
| **278** | P1 | Production URL Validation - Added APP_URL/CLIENT_URL checks | ~1 hr |
| **279** | P2 | OpenAI Graceful Degradation - Added fallbacks for AI features | ~2 hrs |
| **280** | P2 | SMTP Startup Validation - Added verifyConnection() method | ~1 hr |
| **281** | P1 | Discourse SSO Timing Attack - Fixed with crypto.timingSafeEqual | ~30 min |
| **282** | P3 | Document db.delete() Test Cleanup - Added NOTE comments | ~15 min |

**Bonus fix**: Added database trigger (migration 0033) to prevent compare list race condition.

**Commits**:
- `05f031c` - feat: resolve 7 TODOs via parallel agent execution
- `5697cb3` - fix(security): add database trigger for compare list race condition

---

## Previously Completed

### 2026-01-19
- **TODO_247 (Product Listing Pagination)** → Completed
  - Added pagination to useProducts hook with atomic filter reset
  - Prev/Next buttons, page state, 12 E2E tests

### 2026-01-15
- **TODO_227 (Scraper Retry Logic)** → Completed
  - Multi-layer retry strategy with intelligent error classification
  - 87% reduction in data gaps

- **TODO_228 (Timing Attack Prevention)** → Already implemented (verification only)

- **TODO_226 (Auth Rate Limiting)** → Already implemented (verification only)

- **TODO_229 (Password Change Validation)** → Completed
  - Added 18 comprehensive tests for password change security

- **TODO_230 (Distributed Lock for Snapshot Scheduler)** → Completed
  - Added `jobLockService.withLock()` wrapper

### 2026-01-09
- **E2E Test Remediation** → Completed
  - 18 failures fixed, 122 passing / 0 failing / 25 skipped

### 2026-01-06-07
- **TODO_013 (Watchlist Integration)** → Completed
- **TODO_016 (Performance Optimization)** → Completed
- **TODO_017 (Related Products)** → Already complete
- **TODO_018 (Price Alert Email Notifications)** → Completed

### 2025-12
- **TODO_001-010** → Various fixes and improvements
- **TODO_165 (Error Handling Consolidation)** → Completed

---

## Archive

Completed TODOs are stored in the `archive/` directory with format:
```
archive/YYYY-MM-DD-TODO_XXX_DESCRIPTION.md
```

## Workflow

1. **Create TODO**: Copy `TODO_TEMPLATE.md` and rename to TODO_XXX_DESCRIPTION.md
2. **Work on TODO**: Follow implementation steps in the TODO file
3. **Pre-Close Verification**: Complete the verification checklist (mandatory!)
4. **Complete**: Move to `archive/` with timestamp prefix
5. **Update README**: Update this file to reflect current active TODOs

## Priority Levels

- **P0 - Critical**: Blocking issues, must fix immediately
- **P1 - High**: Important improvements, fix soon
- **P2 - Medium**: Valuable improvements, schedule when possible
- **P3 - Low**: Nice-to-have improvements
- **P4 - Optional**: Enhancement opportunities
