# Storage Layer Refactoring - Session Handoff

**Date:** 2025-11-24
**Branch:** `refactor/storage-god-object-phase-1`
**Worktree:** `.worktrees/storage-refactor-phase-1`
**Related Issue:** #121 - Split storage.ts God Object into Domain Modules

---

## Current Status: Phase 2 Complete ✅, Phase 3 Analyzed

### What Has Been Completed

#### ✅ Phase 1: Foundation (Complete)
- **Commit:** b60db78
- **Files Created:**
  - `server/storage/types.ts` - 64 type definitions extracted
  - `server/storage/base-storage.ts` - Abstract base class with common utilities
  - `server/storage/index.ts` - Facade pattern for backward compatibility
- **Documentation:** `docs/storage-layer/phase-1-completion.md`

#### ✅ Phase 2: User Storage Domain (Complete - Production Excellence)
- **Commits:**
  - 9c2a14c - Initial Phase 2 completion
  - c8c5edb - First code review improvements (6 fixes)
  - 58c33dc - Final code review improvements (4 fixes)
- **Files Created:**
  - `server/storage/user-storage.ts` (332 lines, 8 methods)
  - `server/storage/index.ts` - Updated to export IUserStorage
- **Quality Score:** 9.5/10 (Production Excellence)
- **Documentation:**
  - `docs/storage-layer/phase-2-completion.md`
  - `docs/storage-layer/phase-2-improvements.md` (first review)
  - `docs/storage-layer/phase-2-final-improvements.md` (second review)

**UserStorage Methods (8 total):**
1. `getAllUsers()` - Admin view with reputation
2. `getUserByIdSafe()` - Safe user retrieval (no passwordHash)
3. `getUserCount()` - Total user count
4. `updateUserProfile()` - Profile updates with validation
5. `updateUserTrustLevel()` - Trust level with bounds checking and audit logging
6. `suspendUser()` - Suspension with notification (transactional)
7. `createUserWithTransaction()` - First-user detection with SERIALIZABLE isolation
8. `getUserGrowthData()` - Daily registration analytics with pagination

**Quality Improvements Applied:**
- ✅ User existence checks on all updates
- ✅ Input validation (empty update checks)
- ✅ Bounds checking with USER_CONSTANTS
- ✅ Pagination (90-day default, 365-day max)
- ✅ Type safety (no `any` types)
- ✅ Audit logging for security-sensitive operations
- ✅ Comprehensive error handling
- ✅ Transaction support with proper isolation levels

#### 🔄 Phase 3: Product Storage Domain (Analyzed, Not Started)
- **Status:** Analysis complete, ready for implementation
- **Scope:** 35 methods (4x larger than Phase 2)
- **Estimated Effort:** 12-15 hours
- **Documentation:** `docs/storage-layer/phase-3-analysis.md`

**Product Domain Breakdown:**
1. Core CRUD (7 methods)
2. Product Offers (6 methods)
3. Specifications (7 methods)
4. Advanced Search (8 methods)
5. Embeddings (2 methods)
6. Utilities (5 methods)

---

## How to Continue from Here

### Option A: Continue Phase 3 (Full Implementation)

**Command to resume work:**
```bash
cd /Users/williamtower/projects/PriceCompare/.worktrees/storage-refactor-phase-1
git status  # Verify you're on refactor/storage-god-object-phase-1 branch
```

**Next Steps:**
1. Read `docs/storage-layer/phase-3-analysis.md` for complete scope
2. Create `server/storage/product-storage.ts`
3. Define `IProductStorage` interface with 35 methods
4. Implement methods in 5 stages (see analysis doc)
5. Apply Phase 2 quality checklist:
   - User existence checks
   - Input validation
   - Type safety (no `any`)
   - Constants for magic numbers
   - Audit logging where needed
   - Comprehensive JSDoc
6. Run tests: `npm test server/__tests__/storage-watchlist.test.ts`
7. Create `docs/storage-layer/phase-3-completion.md`

**Files to Reference:**
- `server/storage/user-storage.ts` - Quality template to follow
- `docs/storage-layer/phase-2-final-improvements.md` - Quality checklist
- `server/storage.ts` (lines 573-5931) - Source implementations to extract

### Option B: Continue Phase 3 (Break into Sub-Phases)

**Phase 3a: Core CRUD + Offers** (13 methods, ~4 hours)
```typescript
// Core CRUD
getProducts()
createProduct()
updateProduct()
deleteProduct()
getProductById()
getProductByIdRaw()
getProductByUrl()

// Offers
getProductOffers()
createProductOffer()
getProductOfferById()
updateProductOfferAffiliateLink()
getProductOffersByRetailerId()
getProductOfferWithProduct()
```

**Phase 3b: Specifications** (8 methods, ~3 hours)
```typescript
getProductSpecifications()
getProductSpecificationsGrouped()
createProductSpecification()
createProductSpecificationsBatch()
updateProductSpecification()
deleteProductSpecification()
deleteProductSpecifications()
getProductFull()
```

**Phase 3c: Advanced Search** (8 methods, ~4 hours)
```typescript
searchProducts()
searchProductsByTerms()
getProductSearchSuggestions()
searchProductsExact()
searchProductsFuzzy()
searchProductsBySynonyms()
searchProductsSemantic()
getProductAutocompleteSuggestions()
```

**Phase 3d: Embeddings + Utilities** (6 methods, ~2 hours)
```typescript
getProductForEmbedding()
updateProductEmbedding()
getProductOffersForSnapshot()
getProductOffersCount()
getProductWatchCountByProduct()
getProductOfferDetailsForAlert()
```

### Option C: Tackle Smaller Domains First

**Domains by Complexity (smallest to largest):**
1. **Retailer Storage** (~10 methods) - 2-3 hours
2. **Job Lock Storage** (~7 methods) - 2 hours
3. **Alert Storage** (~15 methods) - 4-5 hours
4. **Wishlist Storage** (~8 methods) - 2-3 hours
5. **Watch Storage** (~10 methods) - 3-4 hours
6. **Forum Storage** (~20 methods) - 6-8 hours
7. **Admin Storage** (~10 methods) - 3-4 hours
8. **Price Storage** (~15 methods) - 5-6 hours
9. **Community Storage** (~7 methods) - 2-3 hours
10. **Product Storage** (~35 methods) - 12-15 hours ⬅️ Save for last

---

## Code Quality Template (From Phase 2)

When implementing any domain, apply this checklist:

```typescript
// CONSTANTS at module level
const DOMAIN_CONSTANTS = {
  SOME_LIMIT: {
    MIN: 0,
    MAX: 100,
  },
  PAGINATION: {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
  },
} as const;

// Interface definition
export interface IDomainStorage {
  // Clear method signatures with JSDoc
  getEntity(id: number): Promise<Entity | null>;
}

// Implementation
export class DomainStorage extends BaseStorage implements IDomainStorage {
  /**
   * Get entity by ID
   * @param id - Entity identifier
   * @returns Entity or null if not found
   */
  async getEntity(id: number): Promise<Entity | null> {
    return this.handleError('getEntity', async () => {
      // Use typed variables, not 'any'
      type EntityFields = { id: number; name: string; /* ... */ };

      // Explicit field selection (security pattern)
      const [entity] = await this.db.select({
        id: entities.id,
        name: entities.name,
        // NEVER use select().from() without fields
      })
      .from(entities)
      .where(eq(entities.id, id))
      .limit(1);

      return entity || null;
    });
  }

  async updateEntity(id: number, data: Partial<Entity>): Promise<void> {
    return this.handleError('updateEntity', async () => {
      // Validate bounds
      if (data.someValue !== undefined) {
        if (data.someValue < DOMAIN_CONSTANTS.SOME_LIMIT.MIN ||
            data.someValue > DOMAIN_CONSTANTS.SOME_LIMIT.MAX) {
          throw new Error(`Value out of bounds`);
        }
      }

      // Check existence before update
      const [existing] = await this.db.select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, id))
        .limit(1);

      if (!existing) {
        throw new Error(`Entity ${id} not found`);
      }

      // Perform update
      await this.db.update(entities)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(entities.id, id));

      // Audit log if security-sensitive
      this.logDebug('updateEntity', {
        id,
        changes: Object.keys(data),
        timestamp: new Date().toISOString()
      });
    });
  }
}
```

---

## Testing After Implementation

**Run storage tests:**
```bash
npm test server/__tests__/storage-watchlist.test.ts
```

**Expected result:**
```
Test Files  1 passed (1)
Tests      29 passed (29)
Duration   ~2s
```

**If tests fail:**
1. Check for breaking changes in method signatures
2. Verify facade still re-exports original storage
3. Ensure no duplicate method definitions
4. Check that types match exactly

---

## Commit Pattern

**Template for domain completion commits:**
```bash
git add server/storage/domain-storage.ts docs/storage-layer/phase-X-completion.md

git commit -m "$(cat <<'EOF'
Phase X: [Domain] Storage extraction complete

Extracted [N] [domain]-related methods from monolithic storage.ts:

[List of methods organized by category]

Quality improvements applied:
- ✅ Extends BaseStorage for error handling
- ✅ Explicit field selection for security
- ✅ Input validation and bounds checking
- ✅ Entity existence checks on updates
- ✅ Type safety (no 'any' types)
- ✅ Constants for magic numbers
- ✅ Comprehensive JSDoc documentation
- ✅ Audit logging for sensitive operations

Testing:
- All 29 storage tests passing
- No regressions introduced
- Zero breaking changes

Code quality score: [X]/10

Related: #121

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

git push origin refactor/storage-god-object-phase-1
```

---

## Files to Review Before Starting

**Essential reading:**
1. `docs/storage-layer/phase-3-analysis.md` - Scope and strategy
2. `server/storage/user-storage.ts` - Quality template
3. `docs/storage-layer/phase-2-final-improvements.md` - Quality checklist
4. `server/storage/base-storage.ts` - Available utilities

**Reference files:**
5. `server/storage/types.ts` - All type definitions
6. `server/storage.ts` - Source implementations (lines vary by domain)

---

## Current Git Status

```bash
# Branch
refactor/storage-god-object-phase-1

# Latest commits
58c33dc - Phase 2: Final code review improvements - production excellence
c8c5edb - Phase 2: Code review improvements - all blockers resolved
9c2a14c - Phase 2: User Storage domain extraction complete
b60db78 - Phase 1: Foundation - types, base class, facade

# Clean working directory (all Phase 2 work committed)
```

---

## Quick Start Command for Next Session

```bash
# Resume work
cd /Users/williamtower/projects/PriceCompare/.worktrees/storage-refactor-phase-1

# Verify branch
git branch --show-current  # Should show: refactor/storage-god-object-phase-1

# Read analysis
cat docs/storage-layer/phase-3-analysis.md

# Review quality template
cat server/storage/user-storage.ts

# Create new domain file
touch server/storage/product-storage.ts  # Or your chosen domain

# Start implementing!
```

---

## Context for AI Agent

**Task:** Continue storage layer refactoring (GitHub issue #121)

**Goal:** Extract domain-specific storage repositories from 5,715-line monolithic `server/storage.ts`

**Pattern:** Facade pattern - maintain backward compatibility while creating modular domain repositories

**Current Progress:**
- ✅ Phase 1: Foundation complete
- ✅ Phase 2: User Storage complete (9.5/10 quality)
- 🔄 Phase 3: Product Storage analyzed, ready to implement

**Quality Bar:** UserStorage achieved 9.5/10 through 2 rounds of code review. All subsequent domains must meet or exceed this standard.

**Key Files:**
- Foundation: `server/storage/{types.ts, base-storage.ts, index.ts}`
- Template: `server/storage/user-storage.ts` (follow this pattern)
- Source: `server/storage.ts` (extract methods from here)
- Tests: `server/__tests__/storage-watchlist.test.ts` (verify no regressions)

**Success Criteria:**
- Zero breaking changes (facade maintains compatibility)
- All 29 tests passing
- Code quality ≥ 9/10
- Comprehensive documentation

---

## Questions to Ask User at Start of Next Session

1. "I see Phase 2 (User Storage) is complete at 9.5/10 quality. Phase 3 (Product Storage) is analyzed with 35 methods. Would you like to:
   - **A)** Implement full Phase 3 (~12-15 hours)
   - **B)** Break Phase 3 into sub-phases (3a, 3b, 3c, 3d)
   - **C)** Start with a smaller domain first (Retailer, Job Lock, etc.)"

2. "Should I use the UserStorage quality template (existence checks, type safety, audit logging, etc.) for all implementations?"

3. "Do you want me to invoke the code-review-specialist agent after each domain is complete?"

---

## Additional Context

**Pre-commit Hook:** The codebase has automated security checks that will flag:
- ❌ Blockers: `any` types, passwordHash exposure, N+1 queries, console.log
- ⚠️ Warnings: Missing transactions, direct db imports, unoptimized queries

**Use `// SECURITY: NEVER expose` comments** to document passwordHash handling for the hook.

**Redis Note:** This project uses dual Redis clients (ioredis + redis package). Not relevant for storage layer but good to know.

**Testing:** Always run tests after each domain implementation. 29 tests must continue passing.

---

## End of Handoff

**Last Updated:** 2025-11-24
**Next Session Should Start With:** Reading this document + `docs/storage-layer/phase-3-analysis.md`

Good luck! The UserStorage implementation is a stellar template. Follow that pattern and you'll achieve the same high quality. 🚀
