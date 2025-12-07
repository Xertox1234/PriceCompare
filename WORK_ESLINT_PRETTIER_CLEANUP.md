# ESLint & Prettier Cleanup - Work File

**Session Date**: December 7, 2025 (Updated - Session 2 Batch 4 Complete)
**Status**: Phase 1-5 Complete + Phase 4 100% COMPLETE
**Next Session**: Phase 6 (CI/CD Re-enablement) - Ready to proceed

---

## Current State

### ✅ Completed Work

**Overall Progress**: 438 issues → 228 warnings (0 errors)
- ✅ Phase 1: Critical Errors (6 → 0) - **COMPLETE**
- ✅ Phase 2: Prettier Formatting (392 files) - **COMPLETE**
- ✅ Phase 3: require-await Warnings (93 fixed) - **COMPLETE**
- ✅ Phase 4: non-null-assertion (158 fixed in 2 sessions, 4 batches) - **100% COMPLETE**
  - ✅ Session 1: 55 warnings fixed (volatility-calculator.test, advanced-search, price-aggregation)
  - ✅ Session 2 Batch 1: 53 warnings fixed (seasonal-pattern-detector, retailer-routes, storage)
  - ✅ Session 2 Batch 2: 17 warnings fixed (notification-routes, retailer-reliability-calculator.test, use-websocket.test)
  - ✅ Session 2 Batch 3: 15 warnings fixed (password-reset-service.test, discourse-sso, prompt-monitoring, ProductComparison, AggregatesChart)
  - ✅ Session 2 Batch 4: 18 warnings fixed (trend-analysis-service, template components, price-history-chart, product-detail, tests, websocket, storage, affiliate-link-service)
- ✅ Phase 5: Documentation & Codification - **COMPLETE & UPDATED** (8 patterns documented)
- ⏸️ Phase 6: CI/CD Re-enablement - **READY TO PROCEED**

### Current ESLint Status

```bash
npm run lint 2>&1 | tail -5
# Output:
# ✖ 228 problems (0 errors, 228 warnings)
```

**Breakdown**:
- **require-await**: 228 warnings (192 in storage.ts - intentional, 36 in other files)
- **no-non-null-assertion**: 0 warnings (down from 158, 158 fixed across 2 sessions - 100% reduction) ✅

### Files Modified Across Sessions

**Configuration (3)** - Session 1:
- `.eslintignore` - Added `todos/archive/`
- `.prettierignore` - Added `docs/` and `todos/`
- `.eslintrc.json` - Enhanced comments

**Code - Session 1 (27 files)**:
- `server/index.ts` (2 fixes)
- `server/cache-initialization.ts`
- `server/jobs/cache-maintenance-jobs.ts`
- `server/routes/cache-routes.ts`
- `server/routes/scraping-routes.ts`
- `server/websocket/__tests__/*.ts` (3 files)
- `client/src/hooks/__tests__/useRateLimit.test.ts`
- **Phase 4 Session 1 (non-null assertions)**:
  - `server/utils/__tests__/volatility-calculator.test.ts` (45 warnings → 0)
  - `server/services/price-aggregation-service.ts` (5 warnings → 0)
  - `server/services/advanced-search.ts` (5 warnings → 0)
- Plus 8 test files, 4 agent files, 8 route files (via background agents)

**Code - Session 2 Batch 1 (3 files)**:
- **Phase 4 Session 2 Batch 1 (non-null assertions)**:
  - `server/utils/__tests__/seasonal-pattern-detector.test.ts` (34 warnings → 0)
  - `server/routes/__tests__/retailer-routes.test.ts` (12 warnings → 0)
  - `server/storage.ts` (7 warnings → 0, including critical transaction safety fix)

**Code - Session 2 Batch 2 (3 files)**:
- **Phase 4 Session 2 Batch 2 (non-null assertions)**:
  - `server/routes/notification-routes.ts` (7 warnings → 0, Pattern 8: AuthenticatedRequest typing)
  - `server/utils/__tests__/retailer-reliability-calculator.test.ts` (5 warnings → 0, Pattern 1)
  - `client/src/hooks/__tests__/use-websocket.test.tsx` (5 warnings → 0, Pattern 1 with explicit typing)

**Code - Session 2 Batch 3 (5 files + 2 prerequisite fixes)**:
- **Phase 4 Session 2 Batch 3 (non-null assertions)**:
  - `server/services/__tests__/password-reset-service.test.ts` (3 warnings → 0, Pattern 1)
  - `server/discourse-sso.ts` (3 warnings → 0, Pattern 6: Database constraint validation)
  - `server/ai/prompt-monitoring.ts` (3 warnings → 0, Filter-first with type predicates)
  - `client/src/components/price-history/ProductComparison.tsx` (3 warnings → 0, Map.get() extraction)
  - `client/src/components/analytics/AggregatesChart.tsx` (3 warnings → 0, IIFE extraction)
- **Prerequisite fixes (for pre-commit hook)**:
  - `client/src/hooks/__tests__/useRateLimit.test.ts` (TypeScript errors: fetch mock type fixes)
  - `server/routes/notification-routes.ts` (TypeScript errors: req.user type guards + removed unused import)

**Code - Session 2 Batch 4 (15 files)** - **PHASE 4 COMPLETION (100%)**:
- **Phase 4 Session 2 Batch 4 (non-null assertions - FINAL BATCH)**:
  - `server/services/trend-analysis-service.ts` (2 warnings → 0, Type predicate filtering)
  - `client/src/components/template/modals/quickview-modal.tsx` (1 warning → 0, IIFE pattern)
  - `client/src/components/template/product-card.tsx` (1 warning → 0, IIFE pattern)
  - `client/src/components/price-history/price-history-chart.tsx` (2 warnings → 0, Map.get() extraction)
  - `client/src/pages/product-detail.tsx` (1 warning → 0, Additional guard check)
  - `client/src/hooks/__tests__/useProductComparison.test.ts` (2 warnings → 0, Pattern 1: Test type guard)
  - `server/__tests__/redis-session-storage.test.ts` (1 warning → 0, Variable extraction)
  - `server/__tests__/storage-watchlist.test.ts` (1 warning → 0, Pattern 1: Test type guard)
  - `server/agents/search-agent.ts` (1 warning → 0, Map.get() extraction)
  - `server/routes/product-routes.ts` (1 warning → 0, Map.get() extraction with type guard)
  - `server/utils/encryption.test.ts` (1 warning → 0, Pattern 1: Test type guard)
  - `server/websocket/__tests__/load.test.ts` (1 warning → 0, Nullish coalescing)
  - `server/websocket/index.ts` (1 warning → 0, Early type guard)
  - `server/storage/domains/user-storage.ts` (1 warning → 0, Type guard before return)
  - `server/services/affiliate-link-service.ts` (1 warning → 0, Nullish coalescing)

**Documentation**:
- `docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md` (UPDATED - includes all Session 2 patterns through batch 4)
- `docs/01_TYPESCRIPT_PATTERNS.md` (UPDATED - Session 1)
- `WORK_ESLINT_PRETTIER_CLEANUP.md` (THIS FILE - updated with Session 2 batch 4 progress - PHASE 4 COMPLETE)

---

## 🎯 Next Steps

### Primary Task: Re-enable Blocking CI/CD Checks (Phase 6)

**Objective**: Make ESLint and Prettier checks blocking in GitHub Actions

**Prerequisites**: ✅ All complete (0 errors)

**Steps**:

1. **Update GitHub Workflow**:
   ```bash
   # Edit .github/workflows/pr-validation.yml
   # Find these lines and remove continue-on-error

   # BEFORE:
   - name: ESLint
     run: npm run lint
     continue-on-error: true  # ← REMOVE THIS

   - name: Prettier formatting check
     run: npm run format:check
     continue-on-error: true  # ← REMOVE THIS

   # AFTER:
   - name: ESLint
     run: npm run lint

   - name: Prettier formatting check
     run: npm run format:check
   ```

2. **Verify Locally**:
   ```bash
   npm run lint        # Should show 0 errors, 386 warnings
   npm run format:check # Should pass
   npm run check       # TypeScript compilation
   npm test           # All tests pass
   ```

3. **Test with Sample PR**:
   ```bash
   git checkout -b test/eslint-prettier-enforcement
   echo "// Test change" >> server/utils/constants.ts
   git add server/utils/constants.ts
   git commit -m "test: verify ESLint/Prettier enforcement"
   git push origin test/eslint-prettier-enforcement
   # Open PR and verify checks are blocking
   ```

4. **Clean up test branch**:
   ```bash
   git checkout add_scraping
   git branch -D test/eslint-prettier-enforcement
   git push origin --delete test/eslint-prettier-enforcement
   ```

### Optional Task: Address Remaining require-await (36 warnings)

**Low priority** - Small number, spread across 16 files

**Files**:
- `server/services/advanced-cache.ts` (1)
- `server/services/cache-invalidation.ts` (1)
- `server/middleware/redis-cache.ts` (4)
- `server/services/google-search.ts` (1)
- Test files (29)

**Pattern**: Remove `async` if no `await`, or add `await` if missing

---

## 📚 Key Documentation References

### 1. Complete Learnings Document
**Location**: `docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md`

**Contents**:
- All fixes with before/after examples
- Impact metrics (438 → 386)
- Key patterns discovered
- Lessons learned
- Commands reference

### 2. TypeScript Patterns
**Location**: `docs/01_TYPESCRIPT_PATTERNS.md`

**New Sections Added** (Line 1209+):
- `### await-thenable Errors` - How to fix awaiting non-Promise values
- `### require-await Warnings` - Pattern 1-4 with examples
- Enhanced `### Pattern 3: Optional Chaining in Tests` with type guard pattern

### 3. ESLint Configuration
**Location**: `.eslintrc.json`

**Enhanced Comments** (Lines 39-53):
- `@typescript-eslint/no-non-null-assertion` - Reference to pattern docs
- `@typescript-eslint/await-thenable` - Critical error explanation
- `@typescript-eslint/require-await` - Acceptable warnings explained

---

## 🔧 Essential Commands

### Verification Commands

```bash
# Check ESLint errors only
npm run lint 2>&1 | grep "error " | wc -l
# Expected: 0

# Check require-await warnings
npm run lint 2>&1 | grep "require-await" | wc -l
# Expected: 228

# Check non-null-assertion warnings
npm run lint 2>&1 | grep "no-non-null-assertion" | wc -l
# Expected: 158

# Check Prettier formatting
npm run format:check
# Expected: Pass for production files, skip docs/todos

# Full verification suite
npm run lint && npm run format:check && npm run check && npm test
```

### Fix Commands

```bash
# Format specific directories
npm run format -- "client/src/**/*.{ts,tsx,js,jsx,css}"
npm run format -- "server/**/*.{ts,tsx,js,jsx}"

# Run ESLint on specific file
npx eslint server/storage.ts 2>&1 | tail -3

# Search for function call sites (when removing async)
grep -r "await functionName" server/ client/

# Count warnings per file
npx eslint <file_path> 2>&1 | grep "<warning_type>" | wc -l
```

### Git Commands

```bash
# Current branch
git branch --show-current
# Should be: add_scraping

# Check git status
git status

# View changes
git diff

# Stage and commit
git add .
git commit -m "docs: ESLint/Prettier cleanup learnings and patterns"
```

---

## 🎓 Key Patterns Reference

### Pattern 1: await-thenable Errors

**Problem**: Awaiting synchronous functions (returns `void`, not `Promise<void>`)

**Fix**:
1. Remove `async` from function definition
2. Search for all call sites: `grep -r "await functionName" server/`
3. Remove `await` from each call site

**Example**:
```typescript
// Function definition
- async function shutdownWebSocket(): Promise<void> {
+ function shutdownWebSocket(): void {

// Call site
- await shutdownWebSocket();
+ shutdownWebSocket();
```

### Pattern 2: require-await in Test Mocks

**Problem**: Unnecessary `async` in mock callbacks

**Fix**: Remove `async` (mock frameworks handle Promises)

```typescript
// ❌ WRONG
globalThis.fetch = vi.fn(async () => new Response('{}'));

// ✅ CORRECT
globalThis.fetch = vi.fn(() => new Response('{}'));
```

### Pattern 3: Interface Compliance (Acceptable Warnings)

**Situation**: MemStorage implements async interface for DatabaseStorage compatibility

**Decision**: Accept require-await warnings (192 in storage.ts)

```typescript
// Interface defines async
interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
}

// In-memory implementation doesn't need await
class MemStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    // ⚠️ require-await warning is INTENTIONAL
    return this.users.find(u => u.id === id);
  }
}
```

### Pattern 4: Test File Type Guards

**Problem**: `expect().not.toBeNull()` doesn't narrow types for TypeScript

**Fix**: Add type guard after assertion

```typescript
// ❌ CURRENT
expect(result).not.toBeNull();
expect(result!.level).toBe('low');

// ✅ FIX
expect(result).not.toBeNull();
if (!result) throw new Error('Expected result to be defined');
expect(result.level).toBe('low'); // No ! needed
```

---

## 🚨 Important Notes

### storage.ts Warnings (192) - DO NOT FIX

**Location**: `server/storage.ts`

**Why**: MemStorage class implements `IStorage` interface. Interface requires async methods for DatabaseStorage compatibility. In-memory operations don't need `await`, but methods must match interface.

**Verification**:
```bash
npx eslint server/storage.ts 2>&1 | grep "require-await" | wc -l
# Expected: 192
```

**Decision**: Accept these warnings - interface consistency > perfect ESLint scores.

### Prettier Exclusions

**Excluded directories**: `docs/`, `todos/`

**Reason**: Documentation has specific formatting needs (markdown tables, code blocks)

**Config**: `.prettierignore`
```
# Documentation (preserve specific structure)
docs/
todos/
```

### Pre-Commit Hook

**Location**: `.git/hooks/pre-commit`

**Current Status**: Does NOT check await-thenable

**Future Enhancement** (Optional):
```bash
# Add to pre-commit hook
AWAIT_THENABLE=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs npx eslint --rule "@typescript-eslint/await-thenable: error" 2>&1 | grep "await-thenable" || true)
if [ -n "$AWAIT_THENABLE" ]; then
  echo "❌ BLOCKER: Awaiting non-Promise values"
  echo "$AWAIT_THENABLE"
  exit 1
fi
```

---

## 📊 Impact Metrics Summary

| Metric | Before | After Session 1 | After Batch 1 | After Batch 2 | After Batch 3 | After Batch 4 | Total Change |
|--------|--------|----------------|---------------|---------------|---------------|---------------|--------------|
| **Total Issues** | 438 | 331 (-107) | 278 (-53) | 261 (-17) | 246 (-15) | 228 (-18) | -210 (48%) ✅ |
| **Errors** | 6 | 0 (-6) | 0 | 0 | 0 | 0 | -6 (100%) ✅ |
| **Warnings** | 432 | 331 (-101) | 278 (-53) | 261 (-17) | 246 (-15) | 228 (-18) | -204 (47%) ✅ |
| **Non-Null Assertions** | 158 | 103 (-55) | 50 (-53) | 33 (-17) | 18 (-15) | 0 (-18) | -158 (100%) ✅ |
| **Prettier Files** | 812 | 420 | 420 | 420 | 420 | 420 | -392 formatted ✅ |
| **require-await** | 274 | 228 | 228 | 228 | 228 | 228 | -46 (17%) |
| **CI/CD Status** | Advisory | **Ready** | **Ready** | **Ready** | **Ready** | **Ready** | ✅ Blocking ready |

---

## 🔗 Related Files

### Plan File
**Location**: `~/.claude/plans/scalable-mapping-porcupine.md`

**Status**: Original 6-phase plan - Phases 1-3 complete, Phase 4 deferred, Phase 5 complete

### GitHub Workflow
**Location**: `.github/workflows/pr-validation.yml`

**Current State**: ESLint and Prettier checks are advisory (`continue-on-error: true`)

**Lines to Modify** (for Phase 6):
- Remove `continue-on-error: true` from ESLint step
- Remove `continue-on-error: true` from Prettier step

### Git Branch
**Current Branch**: `add_scraping`

**Clean Status**: Yes (all changes committed)

**Last Commit**: Added ESLint/Prettier cleanup documentation

---

## 🎯 Success Criteria

### For Phase 6 (CI/CD Re-enablement)

✅ **Prerequisites Met**:
- [x] 0 ESLint errors
- [x] All production files formatted
- [x] Documentation complete
- [x] Patterns codified

📋 **Phase 6 Checklist**:
- [ ] Update `.github/workflows/pr-validation.yml`
- [ ] Run full verification locally
- [ ] Test with sample PR
- [ ] Verify checks are blocking
- [ ] Clean up test branch
- [ ] Document in ARCHITECTURE.md

### For Phase 4 (Non-Null Assertions) - ✅ COMPLETE

📊 **Final State**: 0 warnings (down from 158 - 100% reduction)

🎯 **Target**: 0 warnings - ✅ ACHIEVED

**✅ Completed** (158 warnings eliminated across 24 files in 4 batches):
- **Session 1**: 55 warnings fixed
  - volatility-calculator.test.ts (45), price-aggregation-service.ts (5), advanced-search.ts (5)
- **Session 2 Batch 1**: 53 warnings fixed
  - seasonal-pattern-detector.test.ts (34), retailer-routes.test.ts (12), storage.ts (7)
- **Session 2 Batch 2**: 17 warnings fixed
  - notification-routes.ts (7), retailer-reliability-calculator.test.ts (5), use-websocket.test.tsx (5)
- **Session 2 Batch 3**: 15 warnings fixed
  - password-reset-service.test.ts (3), discourse-sso.ts (3), prompt-monitoring.ts (3), ProductComparison.tsx (3), AggregatesChart.tsx (3)
- **Session 2 Batch 4**: 18 warnings fixed (FINAL BATCH)
  - trend-analysis-service.ts (2), template components (2), price-history-chart.tsx (2), tests (6), backend services (6)

**Success Metrics**:
- ✅ All high-impact files (10+ warnings) eliminated - 100%
- ✅ All medium-impact files (5-9 warnings) eliminated - 100%
- ✅ All low-impact files (1-4 warnings) eliminated - 100%
- ✅ Phase 4 complete - 158/158 warnings fixed

---

## 💡 Tips for Next Session

1. **Start with verification**: Run `npm run lint` to confirm current state (should show 0 errors, 228 warnings)

2. **Primary objective**: Phase 6 - Re-enable blocking CI/CD checks (30 min)
   - Phase 4 (non-null assertions) is now 100% complete
   - All prerequisites met for CI/CD enforcement

3. **Use the patterns**: All patterns are documented in `docs/01_TYPESCRIPT_PATTERNS.md`

4. **Commit frequently**: Stage by directory for easier review

5. **Verify after each fix**: Run `npm run lint` to see progress

6. **Reference learnings**: `docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md` has complete examples including all Phase 4 patterns

---

## 📞 Quick Reference

**Check current state**:
```bash
npm run lint 2>&1 | tail -5
```

**Read learnings document**:
```bash
cat docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md | less
```

**View TypeScript patterns**:
```bash
grep -A20 "await-thenable Errors" docs/01_TYPESCRIPT_PATTERNS.md
```

**Check git status**:
```bash
git status
git log --oneline -10
```

---

**Session End**: December 7, 2025 (Session 2 Batch 4 Complete - Phase 4 100% COMPLETE)
**Next Session**: Ready to proceed with Phase 6 (CI/CD Re-enablement)
**Status**: ✅ Clean state, 0 errors, 100% non-null assertion elimination (158 → 0), ready for CI/CD blocking checks
**Major Achievement**: Phase 4 COMPLETE - All non-null assertion warnings eliminated across 24 files in 4 batches
