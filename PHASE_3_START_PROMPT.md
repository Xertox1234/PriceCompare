# Phase 3: Product Domain Extraction - Storage Layer Refactoring

I want to start Phase 3 of the storage layer refactoring outlined in GitHub issue #121.

## Context

**Phase 1 (COMPLETED & MERGED in PR #137)**:
- Created server/storage/ directory with types.ts, base-storage.ts, index.ts
- Extracted 69 type definitions from monolithic storage.ts
- Established facade pattern for backward compatibility
- Codified patterns in .claude/knowledge/storage-refactoring-patterns.md

**Phase 2 (COMPLETED & MERGED in PR #138)**:
- Extracted UserStorage domain (15 methods, 476 lines)
- Discovered critical type consistency pattern (Section 11)
- Updated code-review-specialist agent with domain extraction checks
- Created comprehensive lessons learned document
- Reduced storage.ts from 7,035 to ~6,535 lines (500 lines extracted)

**Progress**: 15/86 methods extracted (~17%)

## Phase 3 Goal

Extract the **Product domain** into `server/storage/domains/product-storage.ts` following established patterns and Phase 2 lessons learned.

## Key Requirements

### 1. Follow Established Patterns

**REQUIRED READING** (10 minutes):
- `.claude/knowledge/storage-refactoring-patterns.md` - All patterns, especially Section 11 (Type Consistency)
- `.claude/knowledge/phase-2-lessons-learned.md` - Critical lessons from Phase 2
- `server/storage/domains/user-storage.ts` - Reference implementation

**Critical Patterns from Phase 2**:
- ✅ Use specialized types in IStorage interface (NO inline types like `Array<{ ... }>`)
- ✅ Review all optional parameters (should they be required?)
- ✅ Add security markers proactively (not reactively)
- ✅ Run code-review-specialist agent before finalizing
- ✅ Keep delegation trivial (no logic in DatabaseStorage)
- ✅ Organize methods into 4-5 logical sections

### 2. ProductStorage Implementation

**Extends**: BaseStorage abstract class

**Estimated Methods** (~20 methods - verify by analyzing storage.ts):

**Product CRUD**:
- getProducts()
- getProductById()
- getProductByIdRaw()
- createProduct()
- updateProduct()
- deleteProduct()
- searchProducts()

**Product Offers**:
- getProductOffers()
- createProductOffer()
- getProductOfferById()
- updateProductOfferAffiliateLink()
- incrementProductOfferClickCount()
- getProductOffersByRetailerId()

**Product Search & Discovery**:
- getProductByUrl() - For browser extension
- searchProductsAdvanced() - If exists
- getProductSpecifications() - If exists

**Other Product Operations**:
- Identify any remaining product-related methods in storage.ts

### 3. Type Consistency (CRITICAL - Phase 2 Lesson)

**BEFORE extracting, verify IStorage interface**:
```bash
# Check for inline types that should be specialized
grep -E "Promise<Array<{|Promise<\{" server/storage.ts | grep -v "Promise<ProductWithOffers"
```

**Pattern**:
```typescript
// ❌ WRONG - Inline type
getProducts(): Promise<Array<{ id: number; name: string; ... }>>;

// ✅ CORRECT - Specialized type from types.ts
getProducts(): Promise<Product[]>;
```

**Checklist**:
- [ ] All return types use specialized types from storage/types.ts
- [ ] No inline `Array<{ ... }>` definitions in IStorage
- [ ] ProductStorage return types match IStorage exactly
- [ ] DatabaseStorage delegation preserves types
- [ ] MemStorage stubs updated with matching types
- [ ] Optional parameters reviewed (should they be required?)

### 4. Implementation Guidance (7-Point from base-storage.ts)

1. **Input Validation**: Validate productId, offerId (positive integers)
2. **N+1 Prevention**: Use JOINs for product+offers, explicit field selection
3. **Security**: If any sensitive fields exist, never expose (use safe types)
4. **Error Handling**: Use `handleError()` from BaseStorage
5. **Transactions**: Wrap multi-step operations (e.g., create product + offers)
6. **Retry Logic**: Use `retryWithBackoff` for transient errors if needed
7. **Logging**: Use `logSuccess()` for completed operations

### 5. Method Organization Pattern

Organize into logical sections (follow UserStorage pattern):

```typescript
// ============================================================================
// Product CRUD Operations
// ============================================================================

// ============================================================================
// Product Offers
// ============================================================================

// ============================================================================
// Product Search & Discovery
// ============================================================================

// ============================================================================
// Product Specifications (if applicable)
// ============================================================================
```

### 6. Facade Integration (server/storage.ts)

Update DatabaseStorage class:
```typescript
export class DatabaseStorage implements IStorage {
  private userStorage: UserStorage;
  private productStorage: ProductStorage;  // NEW

  constructor() {
    this.userStorage = new UserStorage(db);
    this.productStorage = new ProductStorage(db);  // NEW
  }

  // Delegate product methods (trivial forwarding only)
  async getProductById(id: number): Promise<ProductWithOffers | null> {
    return this.productStorage.getProductById(id);
  }
  // ... delegate all ~20 product methods
}
```

### 7. Zero Breaking Changes Verification

**After implementation**:
```bash
# Verify TypeScript compilation
npx tsc --noEmit

# Check for new errors (should be zero)
npx tsc --noEmit 2>&1 | wc -l
```

**Test import paths** (all should work):
```typescript
import { storage } from './storage';           // ✅ Still works
import { storage } from './storage/index';     // ✅ Still works
import { ProductStorage } from './storage/domains/product-storage';  // ✅ New
```

## Step-by-Step Workflow (Phase 2 Proven Process)

### Pre-Implementation (10 minutes)

1. **Create worktree** for isolated development:
   ```bash
   git worktree add .worktrees/phase-3-product-storage-refactor -b phase-3-product-storage-refactor
   cd .worktrees/phase-3-product-storage-refactor
   ```

2. **Read required documentation**:
   - [ ] storage-refactoring-patterns.md (focus on Section 11)
   - [ ] phase-2-lessons-learned.md
   - [ ] server/storage/domains/user-storage.ts

3. **Analyze storage.ts** to identify product methods:
   ```bash
   # Find all product-related methods
   grep -n "async.*Product\|async.*Offer" server/storage.ts
   ```

4. **Check IStorage for inline types**:
   ```bash
   grep -E "Promise<Array<{" server/storage.ts
   ```

### Implementation (varies)

5. **Create ProductStorage** (`server/storage/domains/product-storage.ts`):
   - Extend BaseStorage
   - Import types from `../types`
   - Add validation methods (validateProductId, validateOfferId)
   - Implement ~20 product methods
   - Organize into 4-5 logical sections
   - Add JSDoc comments with usage context

6. **Update IStorage interface** (if needed):
   - Replace any inline types with specialized types
   - Verify optional parameters (should they be required?)
   - Add any missing type imports

7. **Update DatabaseStorage** (delegation):
   - Add `private productStorage: ProductStorage`
   - Initialize in constructor
   - Delegate all ~20 product methods (trivial forwarding)

8. **Update MemStorage** (test stubs):
   - Update stub methods to match new types
   - Ensure consistency with IStorage interface

### Post-Implementation (20 minutes)

9. **Verify TypeScript compilation**:
   ```bash
   npx tsc --noEmit
   ```

10. **Run code-review-specialist agent** (MANDATORY - Phase 2 lesson):
    ```
    Use code-review-specialist to review server/storage/domains/product-storage.ts and server/storage.ts
    ```

11. **Address all critical issues** found in review

12. **Create commit** following Phase 2 style:
    ```bash
    git add server/storage/domains/product-storage.ts server/storage.ts
    git commit -m "feat: Storage Layer Refactoring Phase 3 - Product Domain Extraction (#121)

    Extract product-related operations from monolithic storage.ts into ProductStorage domain repository.

    Files Created:
    - server/storage/domains/product-storage.ts (~XXX lines)

    Methods Extracted (~20 total):
    - Product CRUD: getProducts(), getProductById(), createProduct(), updateProduct(), deleteProduct()
    - Product Offers: getProductOffers(), createProductOffer(), updateProductOfferAffiliateLink()
    - Search: searchProducts(), getProductByUrl()
    - [List remaining methods]

    Type Consistency: All IStorage methods use specialized types (no inline types)

    Statistics:
    - Before: storage.ts ~6,535 lines
    - After: storage.ts ~X,XXX lines, product-storage.ts ~XXX lines
    - Methods extracted: XX/86 (~XX%)

    Related: #121

    🤖 Generated with [Claude Code](https://claude.com/claude-code)

    Co-Authored-By: Claude <noreply@anthropic.com>"
    ```

13. **Create Pull Request**:
    ```bash
    git push -u origin phase-3-product-storage-refactor
    gh pr create --base add_scraping --title "feat: Storage Layer Refactoring Phase 3 - Product Domain Extraction (#121)" --body "[Use Phase 2 PR #138 as template]"
    ```

## Phase 2 Lessons to Apply

### 1. Type Consistency (CRITICAL)

**Before starting, check**:
```bash
# Find inline types in IStorage
grep -E "Promise<Array<{" server/storage.ts
```

**Fix immediately**: Replace inline types with specialized types from types.ts

### 2. Optional Parameters

**Review pattern**:
```typescript
// ❌ WRONG - No sensible default
getProducts(limit?: number): Promise<Product[]>

// ✅ CORRECT - Required (prevents unbounded queries)
getProducts(limit: number): Promise<Product[]>

// ✅ ALSO CORRECT - With documented default
getProducts(limit = 20): Promise<Product[]>
```

### 3. Code Review is Mandatory

**DON'T skip this step** - Phase 2 found critical type issues that compilation missed.

**Time investment**: 15 minutes
**Value**: Prevents production bugs, maintains quality

### 4. Delegation is Trivial

**Pattern**:
```typescript
// ✅ CORRECT - Just forward
async getProductById(id: number): Promise<ProductWithOffers | null> {
  return this.productStorage.getProductById(id);
}

// ❌ WRONG - Don't add logic here
async getProductById(id: number): Promise<ProductWithOffers | null> {
  if (!id) throw new Error('Invalid ID');  // Validation belongs in domain
  return this.productStorage.getProductById(id);
}
```

## Success Criteria

- [ ] ProductStorage extends BaseStorage ✅
- [ ] All ~20 product methods implemented ✅
- [ ] IStorage uses specialized types (no inline types) ✅
- [ ] DatabaseStorage delegates to ProductStorage ✅
- [ ] MemStorage stubs updated ✅
- [ ] TypeScript compilation passes (zero NEW errors) ✅
- [ ] Code-review-specialist review completed ✅
- [ ] All critical issues addressed ✅
- [ ] Zero breaking changes verified ✅
- [ ] Commit created with Phase 2 style ✅
- [ ] PR created with comprehensive description ✅

## Quick Reference

**Key Files**:
- Implementation: `server/storage/domains/product-storage.ts` (NEW)
- Integration: `server/storage.ts` (MODIFIED - delegation)
- Types: `server/storage/types.ts` (reference)
- Patterns: `.claude/knowledge/storage-refactoring-patterns.md`
- Lessons: `.claude/knowledge/phase-2-lessons-learned.md`
- Reference: `server/storage/domains/user-storage.ts`

**Key Commands**:
```bash
# Setup
git worktree add .worktrees/phase-3-product-storage-refactor -b phase-3-product-storage-refactor

# Find product methods
grep -n "async.*Product\|async.*Offer" server/storage.ts

# Check inline types
grep -E "Promise<Array<{" server/storage.ts

# Verify compilation
npx tsc --noEmit

# Create PR
gh pr create --base add_scraping --title "Phase 3: Product Domain" --body "..."
```

**Expected Results**:
- Files changed: 2 (product-storage.ts NEW, storage.ts MODIFIED)
- Lines extracted: ~500-800 (product methods are complex)
- Methods extracted: ~35/86 (~40% total progress)
- Time: 2-4 hours (includes reading, implementation, review)

## Related Issues & PRs

- GitHub Issue: #121 (Storage Layer God Object Refactoring)
- Phase 1 PR: #137 (Foundation - MERGED)
- Phase 2 PR: #138 (User Domain - MERGED)
- Phase 3 PR: TBD (This phase)

## Notes

- Product domain is larger than User domain (~20 methods vs 15)
- May include complex JOINs for product+offers+retailers
- SearchFilters type may need extraction/documentation
- ProductWithOffers type already exists in types.ts ✅
- Watch for N+1 queries in search operations
- Consider pagination requirements for search methods

---

**Ready to start?** Copy this entire prompt to Claude Code in the phase-3 worktree and begin implementation. Phase 2's lessons learned will ensure a smoother extraction with fewer issues caught in review.
