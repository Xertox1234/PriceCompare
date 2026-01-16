# TypeScript Patterns & Anti-Patterns

**Version:** 2.9
**Last Updated:** 2026-01-15
**Domain:** TypeScript, Type Safety, Async/Await, Zod Validation
**Migrated From:**
- docs/TYPESCRIPT_PATTERNS.md (v1.0)
- docs/PHASE1_WATCHLIST_PATTERNS.md (Pattern 9: ESLint compliance)
- TODO 2026: Zod validation for CHECK constraints (v2.1)

**Changelog:**
- 2.9 (2026-01-15): Added Type-Safe Bull Job Data Access pattern (from TODO_227 retry logic)
- 2.8 (2026-01-06): Added Maintenance Documentation for Synchronized Lists Pattern (from TODO_012 code review)
- 2.7 (2026-01-04): Added TypeScript Assertion Signatures for Validation Helpers pattern (from TODO 002 code review)
- 2.6 (2025-12-27): Added Empty Collection Edge Cases pattern (Math.min/max, reduce, semantic null)
- 2.5 (2025-12-26): Added Module-Level Environment Variable Access pattern (ESM/dotenv timing), Type Assertion with SAFETY Comment pattern
- 2.4 (2025-12-23): Added Type-Safe API Error Details Extraction pattern (Feature 3.3)
- 2.3 (2025-12-23): Added "When to Use" context to ESLint patterns, Error Type Handling, and Critical Type Safety Violations sections
- 2.2 (2025-12-23): Added JSDoc documentation pattern for unused code
- 2.1 (2025-12-04): Added Zod DECIMAL field validation pattern

---

This document codifies TypeScript patterns to ensure type safety and prevent runtime errors in the PriceCompare codebase.

## Table of Contents
- [ESLint Warning Quick Reference](#eslint-warning-quick-reference-new---2025-12-07) ⭐ **NEW**
- [TypeScript Error Resolution Protocol](#typescript-error-resolution-protocol)
- [Critical Type Safety Violations](#critical-type-safety-violations)
- [Type Inference Patterns](#type-inference-patterns)
- [Zod Schema Patterns](#zod-schema-patterns)
  - [DECIMAL Field Validation with Drizzle ORM](#decimal-field-validation-with-drizzle-orm-critical---phase-5)
- [React Component Patterns](#react-component-patterns)
- [Utility Type Patterns](#utility-type-patterns)
- [Error Type Handling](#error-type-handling)
- [Async/Promise Patterns](#asyncpromise-patterns)
- [Type Guards & Narrowing](#type-guards--narrowing)
- [Non-Null Assertion Patterns](#non-null-assertion-patterns-new---2025-12-04)
- [Generic Patterns](#generic-patterns)
- [Maintenance Documentation for Synchronized Lists](#maintenance-documentation-for-synchronized-lists-new---2026-01-06) ⭐ **NEW**

---

## ESLint Warning Quick Reference (NEW - 2025-12-07)

**Purpose:** One-page decision guide for the 8 ESLint patterns discovered during the 2025 cleanup effort.

**Context:** This project maintains exactly **200 intentional ESLint warnings** (all `require-await` for interface compliance). All other warnings should be fixed. See `docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md` for complete details.

### Decision Tree: "Should I fix this ESLint warning?"

```
┌─────────────────────────────────────────────────────────────────┐
│ ESLint Warning Detected                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │ What type of warning? │
                    └─────────────────────┘
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
   require-await      no-non-null-         await-thenable
                      assertion
        ↓                     ↓                     ↓
  Is it in:           Use type guard         Remove await
  - storage.ts?       instead (see          from non-Promise
  - redis.ts?         Pattern 6)             value (see
  - redis-cache.ts?                          Pattern 1)
        ↓
   YES → INTENTIONAL
   (Interface compliance)
   DO NOT FIX
        ↓
   NO → Add await or
   remove async
   (see Pattern 3, 4)
```

### The 8 ESLint Patterns (Quick Reference)

#### Pattern 1: `await-thenable` - Awaiting Non-Promise Values ❌

**When to Use:** When you see ESLint warning `await-thenable` about awaiting non-Promise values.

**Problem:** Awaiting values that aren't Promises creates unnecessary overhead and indicates a misunderstanding of async/await.

```typescript
// ❌ WRONG
const count = await parseInt(value); // parseInt returns number, not Promise

// ✅ CORRECT
const count = parseInt(value); // No await needed
```

**Fix:** Remove `await` keyword when value isn't a Promise. Only await actual Promises (database calls, fetch, async functions).

---

#### Pattern 2: `require-await` - Unnecessary Async in Tests ❌

**When to Use:** When you see ESLint warning `require-await` in test files (`.test.ts`, `.spec.ts`).

**Context:** Test mocks should match the synchronicity of their implementation. If a mock returns data directly without async operations, don't make it async - it creates unnecessary Promise wrapping.

**Problem:** Test mock functions declared `async` without `await` return `Promise<T>` instead of `T`, causing type mismatches.

```typescript
// ❌ WRONG
vi.spyOn(storage, 'getProduct').mockImplementation(async (id) => {
  return testProduct; // No await, returns Promise<Product>
});

// ✅ CORRECT
vi.spyOn(storage, 'getProduct').mockImplementation((id) => {
  return testProduct; // Synchronous, returns Product directly
});
```

**Fix:** Remove `async` from test mocks that don't use `await`. This makes tests faster and types clearer.

---

#### Pattern 3: `require-await` - Route Handlers Without Await ❌

**When to Use:** When you see ESLint warning `require-await` in route handler files (`*-routes.ts`).

**Context:** Route handlers should only be `async` if they perform asynchronous operations (database calls, external APIs, file I/O). If all operations are synchronous, making the handler async adds unnecessary overhead.

**Problem:** Route handlers declared `async` but calling only synchronous functions waste resources and may hide the fact that no async work is happening.

```typescript
// ❌ WRONG
app.get('/api/stats', requireAuth, requireAdmin, async (req, res) => {
  const stats = advancedSearchService.getStats(); // Synchronous method
  sendSuccess(res, stats);
});

// ✅ CORRECT
app.get('/api/stats', requireAuth, requireAdmin, (req, res) => {
  const stats = advancedSearchService.getStats();
  sendSuccess(res, stats);
});
```

**Fix:** Remove `async` if no actual `await` operations occur. This improves performance and makes it clear the handler is synchronous.

---

#### Pattern 4: `require-await` - Interface Compliance (INTENTIONAL) ✅

**Problem:** In-memory implementations need `async` to match database interface.

```typescript
// ✅ CORRECT (INTENTIONAL WARNING)
class MemStorage implements IStorage {
  // INTENTIONAL: async required for interface compliance with DatabaseStorage
  async getProductById(id: number): Promise<Product | undefined> {
    return this.products.get(id); // Synchronous, but must match interface
  }
}
```

**Status:** **DO NOT FIX** - This is intentional for drop-in replacement capability.

**Locations:**
- `server/storage.ts` (192 warnings)
- `server/config/redis.ts` (4 warnings)
- `server/middleware/redis-cache.ts` (4 warnings)

**Total:** 200 intentional warnings

---

#### Pattern 5: `no-non-null-assertion` - Test Setup ❌

**Problem:** Using non-null assertions (`!`) in tests without type guards.

```typescript
// ❌ WRONG
const productId = insertedProduct.id!; // Assumes id exists

// ✅ CORRECT
if (!insertedProduct.id) {
  throw new Error('Product ID is required');
}
const productId = insertedProduct.id; // Type narrowing
```

**Fix:** Use type guards to narrow types safely.

---

#### Pattern 6: `no-non-null-assertion` - Transaction Safety ⚠️

**Problem:** Using `!` with database operations that might fail.

```typescript
// ❌ WRONG
const [user] = await tx.insert(users).values(data).returning();
await tx.insert(profile).values({ userId: user.id! }); // Could fail if insert failed

// ✅ CORRECT
const [user] = await tx.insert(users).values(data).returning();
if (!user?.id) {
  throw new Error('User creation failed');
}
await tx.insert(profile).values({ userId: user.id });
```

**Fix:** Validate transaction results before proceeding.

---

#### Pattern 7: `no-non-null-assertion` - Map.get() Results ❌

**Problem:** Assuming Map.get() always returns a value.

```typescript
// ❌ WRONG
const product = this.products.get(id)!; // Might be undefined

// ✅ CORRECT
const product = this.products.get(id);
if (!product) {
  throw new Error(`Product ${id} not found`);
}
return product;
```

**Fix:** Handle undefined case explicitly.

---

#### Pattern 8: `@typescript-eslint/*` - Route Handler Typing 🆕

**Problem:** Route handlers missing `AuthenticatedRequest` type for `req.user`.

```typescript
// ❌ WRONG
app.get('/api/profile', requireAuth, async (req, res) => {
  const userId = req.user.id; // Error: Property 'user' does not exist
});

// ✅ CORRECT
import type { AuthenticatedRequest } from './types';

app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user.id; // ✓ Type-safe
});
```

**Fix:** Use `AuthenticatedRequest` type for authenticated routes.

---

### Checklist: Adding New Async Methods

When implementing new async methods:

- [ ] **Does the interface require async?** (DatabaseStorage, Redis client, etc.)
  - If YES → Add method with `async`, accept intentional warning, document it
  - If NO → Use synchronous method

- [ ] **Does the method actually await anything?**
  - If YES → Keep `async` keyword
  - If NO and interface doesn't require it → Remove `async`

- [ ] **Is this a test mock?**
  - If YES and no await → Remove `async` (Pattern 2)
  - If YES and needs Promise → Return `Promise.resolve(value)`

- [ ] **Is this a route handler?**
  - If YES and no await → Remove `async` (Pattern 3)
  - If YES and has await → Keep `async`

- [ ] **Using non-null assertion (`!`)?**
  - AVOID in production code
  - Use type guards instead (Patterns 5, 6, 7)
  - Only acceptable in tests with validation

### Verification Commands

```bash
# Check current warning count (should be 200)
npm run lint 2>&1 | grep "problems" | awk '{print $1, $3}'

# Check specific file
npx eslint server/storage.ts 2>&1 | tail -1

# Check if new warnings added
git diff main...HEAD | grep "async.*Promise" | wc -l
```

### CI/CD Threshold

- **Current:** 200 intentional warnings
- **CI Max:** 250 warnings (50 buffer)
- **Trigger:** Investigation required if count exceeds 250

**For complete examples and context, see:** `docs/LEARNINGS_ESLINT_PRETTIER_CLEANUP_2025.md`

---

## TypeScript Error Resolution Protocol

**CRITICAL**: Before attempting to fix TypeScript errors, always verify the error source to avoid wasting time on phantom errors.

### CI vs Local Verification (MANDATORY First Step)

```bash
# Step 1: ALWAYS run local type check first
npm run check

# Interpretation:
# - 0 errors locally but errors in CI -> CI infrastructure issue
# - Errors match locally -> Proceed with systematic fixes
```

#### Scenario: CI Shows 72 Errors, Local Shows 0

**Root Cause**: Stale CI cache, outdated dependencies, or Node/TypeScript version mismatch.

**Solution**:
1. Verify locally first with `npm run check`
2. If 0 errors locally, push a minimal fix to trigger fresh CI build
3. CI will rebuild with clean state and errors disappear

**Key Lesson**: CI errors are not always code issues. Infrastructure problems can cause phantom errors.

### Async IIFE Pattern for Top-Level Await (TS1378)

**Error**: `TS1378: Top-level 'await' expressions are only allowed when the 'module' option is set to...`

#### ❌ WRONG - Changing tsconfig Module Settings
```json
// tsconfig.json - DON'T DO THIS!
{
  "compilerOptions": {
    "module": "NodeNext",          // Breaks all existing imports!
    "moduleResolution": "NodeNext" // Breaks path aliases!
  }
}
```

**Why this is dangerous:**
- Changes import syntax requirements across entire codebase
- Breaks path aliases (@/*, @shared/*)
- Requires updating hundreds of imports
- High risk of introducing new errors

#### ✅ CORRECT - Async IIFE Wrapper
```typescript
// server/db.ts - Minimal, non-breaking fix

// BEFORE - Top-level await causing TS1378
let pool: NeonPool | PgPool;
let db: NodePgDatabase | NeonDatabase;

if (isNeonDatabase) {
  const { Pool } = await import('@neondatabase/serverless');
  const neonPool = new Pool(poolConfig);
  pool = neonPool;
  // ...
}

// AFTER - Wrapped in async IIFE
let pool: NeonPool | PgPool;
let db: NodePgDatabase | NeonDatabase;

(async () => {
  if (isNeonDatabase) {
    const { Pool } = await import('@neondatabase/serverless');
    const neonPool = new Pool(poolConfig);
    pool = neonPool;
    // ...
  }
})();

export { pool, db };
```

**Benefits of async IIFE:**
- Zero changes to tsconfig
- No breaking changes to imports
- Path aliases continue to work
- Maintains existing module system
- Localized scope for async initialization

### Error Triage Methodology (20+ Errors)

When facing many TypeScript errors, use systematic documentation:

#### 1. Create Error Analysis Document

Create `docs/TYPESCRIPT_ERRORS_ANALYSIS.md`:

```markdown
# TypeScript Errors Analysis
**Date:** YYYY-MM-DD
**Total Errors:** N
**Status:** [Pre-existing / New]

## Error Categories

### By Error Type
| Error Code | Count | Description | Severity |
|------------|-------|-------------|----------|
| TS2345     | 18    | Argument type mismatch | High |
| TS1378     | 5     | Top-level await | Critical |

### By File (Top 10)
| File | Errors | Primary Issues |
|------|--------|----------------|
| server/db.ts | 5 | Top-level await |
| server/config/sentry.ts | 8 | SDK migration |
```

#### 2. Phase-Based Remediation Plan

- **Phase 1 (Critical)**: Configuration/Infrastructure errors
- **Phase 2 (High)**: Schema/Type definition errors
- **Phase 3 (Medium)**: Code logic type errors
- **Phase 4 (Low)**: Style and minor type issues

#### 3. Track Expected Progress

```markdown
## Recommended Fix Order

### Phase 1: Configuration (Critical)
1. Fix tsconfig for top-level await (5 errors)
2. Migrate Sentry SDK (8 errors)
**Expected:** 13/72 errors fixed (18%)

### Phase 2: Types (High)
3. Fix schema mismatches (8 errors)
**Expected:** 21/72 errors fixed (29%)
```

### Anti-Patterns to Avoid

1. **Assuming CI errors are all real** - Verify locally first
2. **Changing fundamental tsconfig settings** - Can break entire codebase
3. **Trying to fix everything at once** - Triage and prioritize
4. **Not documenting error patterns** - Create analysis docs for complex situations
5. **Ignoring CI/local discrepancies** - These reveal infrastructure issues

### Correct Patterns to Follow

1. **Local verification first** - `npm run check` is source of truth
2. **Minimal fixes** - async IIFE vs tsconfig changes
3. **Systematic documentation** - Create analysis docs for 20+ errors
4. **Phase-based remediation** - Critical -> High -> Medium -> Low
5. **Error categorization** - By code, file, and severity

---

## Critical Type Safety Violations

**When to Apply:** During code reviews, pre-commit validation, and when writing new code. These patterns are enforced by ESLint and pre-commit hooks.

**Context:** These violations indicate fundamental type safety issues that MUST be fixed before committing. They are automatically detected and will block commits to prevent type safety erosion.

These violations will **FAIL pre-commit hooks** and block commits.

### 1. Using `any` Type (COMMIT BLOCKER)

**CRITICAL**: `any` types are NEVER acceptable in production code, especially late in development. The pre-commit hook will block any commit containing `any` types.

#### Why `any` is Dangerous

1. **Defeats TypeScript's Purpose**: TypeScript exists to catch errors at compile time. `any` disables all type checking.
2. **Hides Bugs**: Type errors that would be caught at compile time become runtime crashes.
3. **No IntelliSense**: IDE loses ability to provide autocomplete and type hints.
4. **Technical Debt**: Future refactoring becomes dangerous without type safety.
5. **Late-Stage Unacceptable**: Finding `any` types late in development indicates gaps in type discipline.

#### Common `any` Anti-Patterns

#### ❌ NEVER DO THIS - Using `any`
```typescript
// THIS WILL FAIL PRE-COMMIT HOOK!
let data: any = fetchData();
function processItem(item: any): any {
  return item.value;
}

// Hidden any
const items = [] as any[];
const config = {} as any;

// Test file anti-pattern (CRITICAL!)
describe('My Test', () => {
  let testData: any;  // ❌ NO! Use proper types even in tests
  let mockUser: any;  // ❌ NO! Tests need type safety too
});
```

#### ✅ CORRECT - Proper Types
```typescript
// Define proper interfaces
interface FetchData {
  id: number;
  name: string;
  value: number;
}

let data: FetchData = await fetchData();

function processItem(item: FetchData): number {
  return item.value;
}

// Proper array types
const items: FetchData[] = [];
const config: Record<string, string> = {};

// ✅ CORRECT - Test files with proper types
import { type Product, type Retailer } from '@shared/schema';

describe('My Test', () => {
  let testProduct: Product;
  let testRetailer: Retailer;

  beforeEach(() => {
    // Type-safe test data
    testProduct = {
      id: 1,
      name: 'Test Product',
      description: 'Test Description',
      // ... all required fields
    };
  });
});
```

### Test File Type Safety (MANDATORY)

**Rule**: Test files must have the same type safety standards as production code.

#### Why Tests Need Types

1. **Catch Breaking Changes**: Type errors in tests reveal API contract violations
2. **Documentation**: Types document what data structures tests expect
3. **Refactoring Safety**: Type-safe tests prevent breaking changes during refactors
4. **Mock Accuracy**: Properly typed mocks ensure test realism

#### ❌ TEST ANTI-PATTERN - Generic `any` Variables
```typescript
describe('Product API', () => {
  let testProduct: any;      // ❌ NO! Type unknown, no safety
  let testRetailer: any;     // ❌ NO! Defeats type checking
  let mockData: any;         // ❌ NO! Could be anything

  beforeEach(() => {
    testProduct = { id: 1 }; // Missing required fields not caught!
  });
});
```

#### ✅ CORRECT - Typed Test Variables
```typescript
import { type Product, type Retailer, type User } from '@shared/schema';

describe('Product API', () => {
  let testProduct: Product;
  let testRetailer: Retailer;
  let testUser: User;

  beforeEach(async () => {
    // TypeScript ensures all required fields present
    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description',
      // TypeScript error if missing required fields!
    }).returning();

    [testRetailer] = await db.insert(retailers).values({
      name: 'Test Retailer',
      website: 'https://test.com',
      // Type-safe - catches schema mismatches
    }).returning();
  });

  it('should return product details', async () => {
    // Type-safe assertions
    expect(testProduct.name).toBe('Test Product');
    expect(testProduct.id).toBeGreaterThan(0);
  });
});
```

#### Common Test Typing Mistakes

1. **Schema Field Mismatches**
   ```typescript
   // ❌ WRONG - Field name doesn't match schema
   await db.insert(retailers).values({
     websiteUrl: 'https://test.com',  // Schema has 'website', not 'websiteUrl'!
   });

   // ✅ CORRECT - TypeScript catches this with proper types
   await db.insert(retailers).values({
     website: 'https://test.com',  // Matches schema
   });
   ```

2. **Incomplete Mock Objects**
   ```typescript
   // ❌ WRONG - Missing required User fields
   req.user = {
     id: 1,
     username: 'admin',
     email: 'admin@test.com',
     // Missing: role, trustLevel, isActive, etc.
   };

   // ✅ CORRECT - Complete SafeUser type
   req.user = {
     id: 1,
     username: 'admin',
     email: 'admin@test.com',
     role: 'admin',
     trustLevel: 4,
     isActive: true,
     isSuspended: false,
     // ... all required SafeUser fields
   } satisfies SafeUser;
   ```

3. **Database Query Return Types**
   ```typescript
   // ❌ WRONG - Assuming returning() gives full type
   const [user] = await db.insert(users).values(data).returning();
   // user includes passwordHash! Security risk!

   // ✅ CORRECT - Explicit field selection
   const [user] = await db.insert(users).values(data).returning({
     id: users.id,
     username: users.username,
     email: users.email,
     // SECURITY: passwordHash explicitly excluded
   });
   ```

4. **String Numbers in Test Data (NEW - Phase 5 - 2025-12-04)**

   Numeric fields must use actual numbers, not string-wrapped numbers. This is caught by pre-commit hook WARNING 19.

   ```typescript
   // ❌ WRONG - String numbers cause Zod validation failures
   const testAlert = {
     userId: 1,
     productId: 2,
     targetPrice: "99.99",   // String - Zod expects number!
     price: "199.00",        // String - Zod expects number!
     amount: "1500",         // String - Zod expects number!
   };

   // ✅ CORRECT - Use actual numbers
   const testAlert = {
     userId: 1,
     productId: 2,
     targetPrice: 99.99,     // Number - matches schema
     price: 199.00,          // Number - matches schema
     amount: 1500,           // Number - matches schema
   };
   ```

   **Why This Matters:**
   - Zod schemas validate types strictly - `z.number()` rejects "99.99"
   - Database expects numeric types for DECIMAL/INTEGER columns
   - String numbers cause silent conversion issues in some contexts
   - Tests should match production data types exactly

   **Common Root Causes:**
   - Copy-paste from JSON files (which represent numbers as strings)
   - Migration from weakly-typed systems (JavaScript without TypeScript)
   - Confusion between display format ("$99.99") and data format (99.99)

   **Pre-Commit Detection:**
   The hook detects patterns like `price: "99.99"` in test files using:
   ```bash
   grep -rn "\(price\|targetPrice\|amount\)\s*:\s*['\"][0-9]" server/ --include="*.test.ts"
   ```

### Late-Stage Development Type Discipline

**Context**: You're past MVP, have established patterns, and should have mature type definitions.

#### Red Flags in Late-Stage Development

1. **`any` in New Code**: Indicates insufficient type modeling
2. **Schema Mismatches**: Field names out of sync with database
3. **Incomplete Mock Objects**: Tests not matching production types
4. **Type Assertion Overuse**: `as Type` hiding type problems

#### Required Actions When `any` Appears Late

When pre-commit hook catches `any` types:

1. **Root Cause Analysis**: Why was `any` used?
   - Missing type definition?
   - Schema drift?
   - Lazy development?

2. **Define Proper Types**:
   ```typescript
   // Don't just fix the immediate error
   let testData: any;  // ❌ Quick fix: Remove 'any'
   let testData;       // ❌ Still bad: Implicit any

   // Do the proper work
   import { type Product } from '@shared/schema';
   let testProduct: Product;  // ✅ Correct: Explicit type
   ```

3. **Update Documentation**: If new types added, document in schema
4. **Review Similar Code**: Check for other `any` instances
5. **Test Thoroughly**: Type changes can reveal bugs

#### ✅ CORRECT - When Type is Truly Unknown
```typescript
// Use unknown for truly unknown types
function handleError(error: unknown): string {
  // Must narrow type before use
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

// Parse JSON safely
function parseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
```

### 2. Ignoring TypeScript Errors

#### ❌ NEVER DO THIS - Suppressing Errors
```typescript
// @ts-ignore
const result = someFunction(wrongType);

// @ts-expect-error without justification
// @ts-expect-error
const value = object.nonExistentProperty;
```

#### ✅ CORRECT - Fix Type Issues
```typescript
// Fix the actual type issue
const result = someFunction(correctType);

// If suppression is absolutely necessary, document WHY, WHAT, and WHEN
// @ts-expect-error - Third-party library has incorrect types, see issue #123
const value = externalLib.actuallyExistsProperty;

// ✅ BEST - Comprehensive documentation
// @ts-expect-error - Union type complexity from validating heterogeneous schemas
// The data parameter contains validated output but TypeScript cannot narrow the type precisely.
// This is safe because: (1) we validate structure above, (2) errors.length check ensures validity.
// TODO: Can be removed once TypeScript improves union type inference in conditional paths.
data: errors.length === 0 ? data : undefined
```

---

## Type Inference Patterns

### Let TypeScript Infer When Possible

#### ❌ VERBOSE - Unnecessary Type Annotations
```typescript
// Redundant type annotations
const name: string = 'John';
const age: number = 30;
const isActive: boolean = true;
const items: string[] = ['a', 'b', 'c'];
```

#### ✅ CORRECT - Leverage Inference
```typescript
// TypeScript infers these correctly
const name = 'John'; // inferred as string
const age = 30; // inferred as number
const isActive = true; // inferred as boolean
const items = ['a', 'b', 'c']; // inferred as string[]

// Add types when inference needs help
const emptyArray: string[] = []; // Need type for empty array
const nullableValue: string | null = null; // Need union type
```

### Function Return Type Inference

#### ✅ CORRECT - Explicit for Public APIs
```typescript
// Public functions should have explicit return types
export async function getProduct(id: number): Promise<Product | null> {
  const product = await storage.getProductById(id);
  return product;
}

// Internal functions can use inference
function calculateDiscount(price: number, percentage: number) {
  return price * (percentage / 100); // TypeScript infers number
}
```

---

## Zod Schema Patterns

### Schema as Source of Truth

#### ✅ CORRECT - Derive Types from Schemas
```typescript
import { z } from 'zod';

// Define schema once
export const productSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  price: z.number().positive(),
  categoryId: z.number(),
  createdAt: z.date(),
});

// Derive TypeScript type from schema
export type Product = z.infer<typeof productSchema>;

// Use for validation
export function validateProduct(data: unknown): Product {
  return productSchema.parse(data);
}

// Use for partial updates
export const updateProductSchema = productSchema.partial();
export type UpdateProduct = z.infer<typeof updateProductSchema>;
```

### Request/Response Validation

#### ✅ CORRECT - Full Stack Type Safety
```typescript
// shared/schema.ts - Shared between client and server
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  categoryId: z.number(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// server/routes/product-routes.ts
router.post('/api/products', async (req, res) => {
  try {
    const input = createProductSchema.parse(req.body);
    const product = await storage.createProduct(input);
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    // Handle other errors
  }
});

// client/src/api/products.ts
async function createProduct(input: CreateProductInput): Promise<Product> {
  const response = await apiRequest('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return productSchema.parse(response);
}
```

### DECIMAL Field Validation with Drizzle ORM (CRITICAL - Phase 5)

**Issue Codified:** 2025-12-04 (TODO 2026 - Zod validation for CHECK constraints)

PostgreSQL DECIMAL columns are represented as `string` in Drizzle ORM to avoid JavaScript floating-point precision issues. When adding Zod validation to these fields, you MUST preserve the string type.

#### ❌ ANTI-PATTERN - Using .coerce.number() Changes Type

```typescript
// WRONG - This changes the TypeScript type from string to number!
export const insertProductOfferSchema = createInsertSchema(productOffers)
  .omit({ id: true, lastUpdated: true })
  .extend({
    price: z.coerce.number().min(0),  // ❌ Changes type to number!
    originalPrice: z.coerce.number().min(0).optional(),
  });

// Result: InsertProductOffer.price is now `number` instead of `string`
// This breaks Drizzle ORM which expects `string` for DECIMAL columns
```

**Problems:**
- Changes `InsertProductOffer.price` from `string` to `number`
- Breaks type compatibility with Drizzle database operations
- Causes TypeScript errors across codebase where type is used
- Drizzle expects `string` for DECIMAL; `number` causes runtime errors

#### ✅ CORRECT - Use .refine() with parseFloat()

```typescript
// CORRECT - Validates numeric value while preserving string type
// Mirrors migration 0020 CHECK constraints:
// - price >= 0
// - originalPrice >= 0 (when not null)
// - price <= originalPrice (when originalPrice set)
export const insertProductOfferSchema = createInsertSchema(productOffers)
  .omit({
    id: true,
    lastUpdated: true,
  })
  .refine(
    (data) => {
      const price = parseFloat(data.price);
      return !isNaN(price) && price >= 0;
    },
    { message: "Price must be non-negative", path: ["price"] }
  )
  .refine(
    (data) => {
      if (!data.originalPrice) return true;  // null/undefined is valid
      const originalPrice = parseFloat(data.originalPrice);
      return !isNaN(originalPrice) && originalPrice >= 0;
    },
    { message: "Original price must be non-negative", path: ["originalPrice"] }
  )
  .refine(
    (data) => {
      if (!data.originalPrice) return true;  // No comparison if no original
      const price = parseFloat(data.price);
      const originalPrice = parseFloat(data.originalPrice);
      return price <= originalPrice;
    },
    { message: "Sale price cannot exceed original price", path: ["price"] }
  );
```

**Benefits:**
- Preserves `string` type for Drizzle ORM compatibility
- Validates the numeric value at application layer
- Provides clear, user-friendly error messages
- Includes field path for UI error highlighting

#### Common Validation Patterns for DECIMAL Fields

**Non-Negative (>= 0) - For prices that can be zero:**
```typescript
.refine(
  (data) => {
    const value = parseFloat(data.price);
    return !isNaN(value) && value >= 0;
  },
  { message: "Price must be non-negative", path: ["price"] }
)
```

**Strictly Positive (> 0) - For values that must be positive:**
```typescript
.refine(
  (data) => {
    const value = parseFloat(data.targetPrice);
    return !isNaN(value) && value > 0;
  },
  { message: "Target price must be positive", path: ["targetPrice"] }
)
```

**Nullable Field Validation:**
```typescript
.refine(
  (data) => {
    if (!data.originalPrice) return true;  // null/undefined is valid
    const value = parseFloat(data.originalPrice);
    return !isNaN(value) && value >= 0;
  },
  { message: "Original price must be non-negative", path: ["originalPrice"] }
)
```

**Cross-Field Validation (sale price <= original):**
```typescript
.refine(
  (data) => {
    if (!data.originalPrice) return true;
    const price = parseFloat(data.price);
    const originalPrice = parseFloat(data.originalPrice);
    return price <= originalPrice;
  },
  { message: "Sale price cannot exceed original price", path: ["price"] }
)
```

**See:** `docs/LEARNINGS_TODO_2026_ZOD_CHECK_CONSTRAINTS.md` for complete implementation details.

---

## React Component Patterns

### Component Props Types

#### ✅ CORRECT - Interface for Props
```typescript
// Define props interface
interface ProductCardProps {
  product: Product;
  onSelect?: (id: number) => void;
  className?: string;
  variant?: 'compact' | 'full';
}

// Function component with props
export function ProductCard({
  product,
  onSelect,
  className,
  variant = 'compact',
}: ProductCardProps) {
  return (
    <div className={className}>
      {/* Component JSX */}
    </div>
  );
}

// With children
interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  );
}
```

### Event Handler Types

#### ✅ CORRECT - Proper Event Types
```typescript
interface FormProps {
  onSubmit: (data: FormData) => Promise<void>;
}

export function ProductForm({ onSubmit }: FormProps) {
  // Form event
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await onSubmit(formData);
  };

  // Input change event
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };

  // Click event
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button onClick={handleClick}>Submit</button>
    </form>
  );
}
```

### Hooks with TypeScript

#### ✅ CORRECT - Typed Hooks
```typescript
// useState with type
const [products, setProducts] = useState<Product[]>([]);
const [loading, setLoading] = useState(false); // boolean inferred
const [error, setError] = useState<string | null>(null);

// useReducer with discriminated unions
type State = {
  status: 'idle' | 'loading' | 'success' | 'error';
  data: Product[] | null;
  error: string | null;
};

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; payload: Product[] }
  | { type: 'FETCH_ERROR'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { status: 'loading', data: null, error: null };
    case 'FETCH_SUCCESS':
      return { status: 'success', data: action.payload, error: null };
    case 'FETCH_ERROR':
      return { status: 'error', data: null, error: action.payload };
    default:
      return state;
  }
}

// Custom hook with return type
function useProducts(): {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  // Implementation
  return { products, loading, error, refetch };
}
```

---

## Utility Type Patterns

### Common Utility Types

#### ✅ CORRECT - Using Built-in Utilities
```typescript
// Partial - all properties optional
type UpdateProduct = Partial<Product>;

// Required - all properties required
type CompleteProduct = Required<Product>;

// Readonly - immutable
type ImmutableProduct = Readonly<Product>;

// Pick - select properties
type ProductSummary = Pick<Product, 'id' | 'name' | 'price'>;

// Omit - exclude properties
type ProductWithoutDates = Omit<Product, 'createdAt' | 'updatedAt'>;

// Record - object with string keys
type ProductMap = Record<string, Product>;

// Extract/Exclude with union types
type Status = 'pending' | 'active' | 'completed' | 'cancelled';
type ActiveStatus = Extract<Status, 'active' | 'completed'>; // 'active' | 'completed'
type InactiveStatus = Exclude<Status, 'active'>; // 'pending' | 'completed' | 'cancelled'
```

### Custom Utility Types

#### ✅ CORRECT - Project-Specific Utilities
```typescript
// Make specific properties optional
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Usage: Make only dates optional
type ProductDraft = PartialBy<Product, 'createdAt' | 'updatedAt'>;

// Nullable properties
type Nullable<T> = { [P in keyof T]: T[P] | null };

// Deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// API Response wrapper
type ApiResponse<T> = {
  data: T;
  error: null;
} | {
  data: null;
  error: string;
};
```

---

## Error Type Handling

**When to Use:** When handling errors in try/catch blocks, custom error classes, or error boundary components.

**Context:** TypeScript 4.4+ makes catch block variables `unknown` by default, requiring explicit type narrowing. This prevents unsafe assumptions about error types and encourages defensive error handling.

### Catch Block Types

#### ✅ CORRECT - Unknown in Catch
```typescript
// TypeScript 4.4+ - catch variables are 'unknown'
try {
  await riskyOperation();
} catch (error) {
  // error is 'unknown', must narrow
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
  } else if (typeof error === 'string') {
    console.error('String error:', error);
  } else {
    console.error('Unknown error:', error);
  }
}

// Helper function for error handling
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'An unknown error occurred';
}
```

### Custom Error Classes

#### ✅ CORRECT - Typed Errors
```typescript
// Custom error classes
export class ValidationError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends Error {
  constructor(
    public resource: string,
    public id: number | string
  ) {
    super(`${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

// Usage with type guards
try {
  await operation();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
    console.error('Invalid fields:', error.fields);
  } else if (error instanceof AuthenticationError) {
    // Handle auth error
    redirect('/login');
  } else if (error instanceof NotFoundError) {
    // Handle not found
    return res.status(404).json({ error: error.message });
  } else {
    // Handle unknown error
    throw error;
  }
}
```

---

### Type-Safe API Error Details Extraction (NEW - Feature 3.3)

**When to Use:** When handling API errors in React Query `onError` callbacks that need to access structured error details from the backend.

**Context:** The `apiRequest()` helper throws `ApiError` objects with a `details` property that can be either `string` (development-only error context) OR `Record<string, unknown>` (client-useful metadata like error codes, limits). TypeScript requires explicit type narrowing before accessing object properties.

**Pattern:** Use `typeof` check to narrow error details type before property access.

```typescript
// client/src/components/price-analytics/price-alert-modal.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const createAlertMutation = useMutation({
  mutationFn: async (price: number) => {
    return apiRequest('/api/price-alerts', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        targetPrice: price,
      }),
    });
  },
  onError: (error: Error) => {
    // Type assertion: ApiError extends Error with optional details property
    // Type assertion: ApiError.details can be string | Record, narrowing to object for property access
    const apiError = error as Error & { details?: string | Record<string, unknown> };
    const details = typeof apiError.details === 'object' ? apiError.details : undefined;

    // Type-safe access to error code and metadata
    if (details?.code === 'ALERT_LIMIT_REACHED') {
      toast({
        title: 'Alert Limit Reached',
        description: `You can only have ${details.limit || 50} active alerts. Delete some alerts to create new ones.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Failed to create alert',
        description: error.message,
        variant: 'destructive',
      });
    }
  },
});
```

**Key Points:**

1. **Type Assertion with Comment**: `const apiError = error as Error & { details?: ... }` with inline explanation
2. **Runtime Type Narrowing**: `typeof apiError.details === 'object'` before property access
3. **Fallback Values**: Use `|| 50` for safety when accessing numeric metadata
4. **Discriminated Unions**: Check `code` property to handle specific error cases

**Why This Pattern:**

- **Compile-Time Safety**: TypeScript enforces type checks, prevents property access errors
- **Runtime Safety**: `typeof` check prevents accessing properties on strings
- **Pre-Commit Hook Compliance**: Inline comment explains type assertion (required by hook)
- **Flexible API Contract**: Supports both string details (dev) and object details (client UX)

**Anti-Patterns:**

```typescript
// ❌ WRONG - No type narrowing, TypeScript error
const apiError = error as Error & { details?: string | Record<string, unknown> };
if (apiError.details.code === 'ALERT_LIMIT_REACHED') {
  // TypeScript error: Property 'code' does not exist on type 'string | Record<...>'
}

// ❌ WRONG - Type assertion without explanation
const details = apiError.details as Record<string, unknown>;
// Pre-commit hook warning: Missing explanation for type assertion

// ❌ WRONG - Accessing without fallback
description: `You can only have ${details.limit} active alerts.`
// Runtime error if 'limit' is undefined
```

**Related Patterns:**

- See "Business Rule Validation with Rich Error Details" in `docs/03_API_PATTERNS.md`
- See "Error Response Helper Functions" in `docs/06_ERROR_HANDLING_PATTERNS.md`

---

## Async/Promise Patterns

**Phase 1.2 Pattern (from PHASE1_WATCHLIST_PATTERNS.md)**

### Floating Promises

**When:** Using async functions in React event handlers or React Query callbacks

#### ❌ ANTI-PATTERN - Floating Promise ESLint Error
```typescript
// ❌ WRONG - Promise not awaited
const createMutation = useMutation({
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] }); // ← Returns promise
  }
});

<Button onClick={handleCreateWatchList}> {/* ← Async function not awaited */}
```

#### ✅ CORRECT - Use void Operator for Fire-and-Forget
```typescript
// ✅ CORRECT - Use void operator for fire-and-forget
const createMutation = useMutation({
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/watchlists/stats'] });
  }
});

<Button onClick={() => void handleCreateWatchList()}>
  Create
</Button>
```

### Misused Promises (Async in Event Handlers)

**When:** Using `async` functions where synchronous return is expected (onClick, onChange, etc.)

#### ❌ ANTI-PATTERN - Async Event Handler
```typescript
// ❌ WRONG - onClick expects void, not Promise<void>
<Button onClick={async () => {
  await handleCreateWatchList();
}}>
  Create
</Button>
```

#### ✅ CORRECT - Void Operator Wrapper
```typescript
// ✅ CORRECT - Wrap async call with void
<Button onClick={() => void handleCreateWatchList()}>
  Create
</Button>

// ✅ ALSO CORRECT - Named handler with void
const handleClick = () => void handleCreateWatchList();

<Button onClick={handleClick}>
  Create
</Button>
```

### Using the `void` Operator

**When to use `void`:**
- Query invalidations in mutation callbacks (fire-and-forget)
- Background operations that don't need error handling
- Event handlers where you don't want to propagate promise

**When NOT to use `void`:**
- Operations you need to `await` for sequencing
- Operations where you need to catch errors
- Operations where you need the return value

#### ✅ CORRECT - Void Operator Patterns
```typescript
// Pattern 1: Query invalidations
const mutation = useMutation({
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/data'] });
  }
});

// Pattern 2: Event handler with async function
<Button onClick={() => void performAsyncAction()}>
  Click Me
</Button>

// Pattern 3: Fire-and-forget background operation
if (shouldLog) {
  void logAnalyticsEvent('user_action', { data });
}
```

### When to Await vs Fire-and-Forget

#### Await When:
```typescript
// ✅ Need to wait for operation to complete
const handleSubmit = async () => {
  const result = await createMutation.mutateAsync(data);
  // Can only proceed after result is available
  navigate(`/products/${result.id}`);
};

// ✅ Need to handle errors
try {
  await riskyOperation();
} catch (error) {
  showErrorToast(error.message);
}

// ✅ Need sequential operations
await operation1();
await operation2(); // Depends on operation1 completing
```

#### Use void When:
```typescript
// ✅ Fire-and-forget invalidations
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: ['/api/data'] });
};

// ✅ Background logging/analytics
void trackEvent('page_view', { path: location.pathname });

// ✅ Non-blocking UI updates
onClick={() => void refreshData()};
```

### Promise Types

#### ✅ CORRECT - Explicit Promise Types
```typescript
// Explicit return type for async functions
async function fetchProduct(id: number): Promise<Product | null> {
  try {
    const response = await fetch(`/api/products/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Generic async function
async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// Usage
const product = await fetchData<Product>('/api/products/1');
```

### Concurrent Operations

#### ✅ CORRECT - Typed Promise.all
```typescript
// Type-safe Promise.all
async function loadDashboardData(userId: number) {
  const [user, products, orders] = await Promise.all([
    fetchUser(userId),        // Promise<User>
    fetchProducts(),          // Promise<Product[]>
    fetchUserOrders(userId),  // Promise<Order[]>
  ]);

  // TypeScript knows the types
  return {
    user,      // User
    products,  // Product[]
    orders,    // Order[]
  };
}

// Promise.allSettled for error handling
async function tryMultipleOperations() {
  const results = await Promise.allSettled([
    operation1(),
    operation2(),
    operation3(),
  ]);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`Operation ${index} succeeded:`, result.value);
    } else {
      console.error(`Operation ${index} failed:`, result.reason);
    }
  });
}
```

### await-thenable Errors (ESLint Cleanup - 2025-12-07)

**Rule**: `@typescript-eslint/await-thenable` - Only `await` actual Promises, not synchronous functions.

#### ❌ ANTI-PATTERN - Awaiting Non-Promise Value
```typescript
// ❌ WRONG - Function returns void, not Promise<void>
export function shutdownWebSocket(): void {
  // Synchronous cleanup
  io?.close();
}

// Call site incorrectly uses await
await shutdownWebSocket(); // Error: awaiting non-Promise
```

#### ✅ CORRECT - Check Function Return Type
```typescript
// Synchronous function
export function shutdownWebSocket(): void {
  io?.close();
}

// Call synchronously (no await)
shutdownWebSocket(); // ✅ Correct

// vs Async function
export async function shutdownWebSocketAsync(): Promise<void> {
  await io?.close();
}

// Await is correct for Promise
await shutdownWebSocketAsync(); // ✅ Correct
```

**When removing `async` from a function**, update ALL call sites:
```bash
# Step 1: Remove async from function definition
- async function doSomething(): Promise<void> {
+ function doSomething(): void {

# Step 2: Find all call sites
grep -r "await doSomething" server/

# Step 3: Remove await from each call site
- await doSomething();
+ doSomething();
```

### require-await Warnings (ESLint Cleanup - 2025-12-07)

**Rule**: `@typescript-eslint/require-await` - Remove `async` from functions without `await` statements.

#### Pattern 1: Test Mock Callbacks

```typescript
// ❌ WRONG - Unnecessary async in mock callback
globalThis.fetch = vi.fn(async () => {
  return new Response('{}', { headers: { 'X-RateLimit-Limit': '100' } });
}) as typeof fetch;

// ✅ CORRECT - Remove async (mockResolvedValueOnce already returns Promise)
globalThis.fetch = vi.fn(() => {
  return new Response('{}', { headers: { 'X-RateLimit-Limit': '100' } });
}) as typeof fetch;
```

**Why**: Mock frameworks (Vitest, Jest) automatically wrap return values in Promises when needed.

#### Pattern 2: Route Handlers Without await

```typescript
// ❌ WRONG - Async handler with no await
app.get('/api/health', async (req, res) => {
  sendSuccess(res, { status: 'ok' }); // No await
});

// ✅ CORRECT - Remove async keyword
app.get('/api/health', (req, res) => {
  sendSuccess(res, { status: 'ok' });
});
```

**Exception**: Keep `async` if using `try/catch` with `sendErrorFromException()` (expects Error objects).

#### Pattern 3: Interface Compliance (Acceptable Warning)

```typescript
// Interface defines async (for database implementation)
interface IStorage {
  getUserById(id: number): Promise<User | undefined>;
}

// In-memory implementation doesn't need await, but must match interface
class MemStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    // ⚠️ ESLint warning: require-await
    // But this is INTENTIONAL for interface consistency
    return this.users.find(u => u.id === id); // No await needed
  }
}
```

**Decision**: Accept require-await warnings in this case. Interface consistency > perfect ESLint.

#### Pattern 4: Call Site Errors After Removing Async

When agents/refactoring removes `async`, call sites may still await:

```typescript
// Agent removed async
export function registerRoutes(app: Express): Server {
  // Synchronous setup
  return server;
}

// Call site still has await (ERROR!)
const server = await registerRoutes(app); // ❌ await-thenable error

// Fix: Remove await
const server = registerRoutes(app); // ✅ Correct
```

**Verification**: After removing `async`, always search for call sites:
```bash
grep -r "await functionName" server/ client/
```

### no-non-null-assertion Warnings (ESLint Cleanup - 2025-12-07)

**Rule**: `@typescript-eslint/no-non-null-assertion` - Avoid non-null assertion operator (`!`) by using proper type guards.

**Why Forbidden**: The `!` operator bypasses TypeScript's type safety. If the value is actually null/undefined, it causes runtime errors that TypeScript could have prevented.

#### Pattern 1: Test Files - Type Guards After Assertions

**Problem**: Vitest's `expect().not.toBeNull()` doesn't narrow TypeScript types.

```typescript
// ❌ WRONG - Non-null assertion after expect
const result = calculateVolatility(mockStablePrices);
expect(result).not.toBeNull();
expect(result!.level).toBe('low'); // ESLint warning
expect(result!.score).toBeGreaterThanOrEqual(0);

// ✅ CORRECT - Add explicit type guard
const result = calculateVolatility(mockStablePrices);
expect(result).not.toBeNull();
if (!result) throw new Error('Expected result to be defined');
// Now TypeScript knows result is not null
expect(result.level).toBe('low'); // No warning!
expect(result.score).toBeGreaterThanOrEqual(0);
```

**Impact**: Fixed 45 warnings across volatility-calculator.test.ts and chart-data-transformer.test.ts.

#### Pattern 2: Map.get() After Map.has()

**Problem**: `Map.has()` doesn't narrow the type of `Map.get()`.

```typescript
// ❌ WRONG - Non-null assertion
if (this.queryCache.has(cacheKey)) {
  return this.queryCache.get(cacheKey)!; // Warning!
}

// ✅ CORRECT - Store result and check
if (this.queryCache.has(cacheKey)) {
  const cached = this.queryCache.get(cacheKey);
  if (cached) return cached;
}
```

**Why**: Even after `has()` returns true, `get()` can still return `undefined` in TypeScript's type system (race conditions, type safety).

#### Pattern 3: Early Returns for Optional Parameters

**Problem**: Using `!` on optional parameters is unsafe.

```typescript
// ❌ WRONG - Non-null assertion on optional parameter
private async performExactSearch(filters: SearchFilters): Promise<SearchResult[]> {
  const query = filters.query!.toLowerCase(); // Warning!
  // ...
}

// ✅ CORRECT - Early return with type narrowing
private async performExactSearch(filters: SearchFilters): Promise<SearchResult[]> {
  if (!filters.query) return [];
  const query = filters.query.toLowerCase(); // No ! needed
  // ...
}
```

**Benefit**: Handles missing values gracefully instead of runtime errors.

#### Pattern 4: Filter + Map Type Guards

**Problem**: TypeScript doesn't narrow types across array method chains.

```typescript
// ❌ WRONG - TypeScript doesn't narrow after filter
offers: result.offers
  .filter((offer) => offer.retailer !== null)
  .map((offer) => ({
    retailerId: offer.retailer!.id, // Warning! (TypeScript still sees offer.retailer as possibly null)
    website: offer.retailer!.websiteUrl,
  }))

// ✅ CORRECT - Explicit guard in map
offers: result.offers
  .filter((offer) => offer.retailer !== null)
  .map((offer) => {
    if (!offer.retailer) throw new Error('Retailer should be non-null after filter');
    return {
      retailerId: offer.retailer.id, // No warning!
      website: offer.retailer.websiteUrl,
    };
  })

// ✅ ALTERNATIVE - Type predicate function
function hasRetailer(offer: Offer): offer is Offer & { retailer: NonNullable<Offer['retailer']> } {
  return offer.retailer !== null;
}

offers: result.offers
  .filter(hasRetailer)
  .map((offer) => ({
    retailerId: offer.retailer.id, // offer.retailer is now non-null!
    website: offer.retailer.websiteUrl,
  }))
```

**Root Cause**: TypeScript's control flow analysis doesn't track type narrowing across higher-order functions like `filter()` and `map()`.

#### Pattern 5: UI Components - Optional Chaining

```typescript
// ❌ WRONG - Non-null assertion in JSX
<div>{product!.name}</div>

// ✅ CORRECT - Optional chaining with fallback
<div>{product?.name ?? 'Unknown'}</div>

// ✅ ALSO CORRECT - Early return with type guard
if (!product) {
  return <div>Product not found</div>;
}
return <div>{product.name}</div>; // No ! needed
```

**Impact**: Phase 4 eliminated 55 warnings (35% reduction) by applying these patterns to high-impact files.

---

## Module-Level Environment Variable Access (NEW - 2025-12-26)

**Context**: ES modules execute code at the module level BEFORE application initialization. Accessing environment variables at module-level happens BEFORE `dotenv.config()` runs, causing `undefined` values.

**Problem**: ESM loads all imports and evaluates module-level code synchronously before `main()` or server startup executes. This creates a race condition where environment variables aren't loaded yet.

### ❌ WRONG - Module-Level Environment Access

```typescript
// server/middleware/security.ts

import { getRequiredEnv } from '../utils/env-helpers';

// ❌ BAD - Executes BEFORE dotenv loads .env file
const CSRF_SECRET = getRequiredEnv('CSRF_SECRET'); // undefined!

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Uses undefined CSRF_SECRET - security vulnerability!
  const token = generateCsrfToken(CSRF_SECRET);
  // ...
}
```

**Execution Order**:

```
1. ESM imports all files
2. Module-level code runs (CSRF_SECRET = undefined)
3. dotenv.config() executes (too late!)
4. Server starts
5. csrfProtection() called with undefined secret
```

### ✅ CORRECT - Lazy Initialization Pattern

```typescript
// server/middleware/security.ts

import { getRequiredEnv } from '../utils/env-helpers';

// Lazy-loaded environment variable with memoization
let _CSRF_SECRET: string | undefined;

function getCsrfSecret(): string {
  // Initialize on first use (after dotenv loaded)
  if (!_CSRF_SECRET) {
    _CSRF_SECRET = getRequiredEnv('CSRF_SECRET');
  }
  return _CSRF_SECRET;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Lazy load on first request (dotenv already loaded)
  const secret = getCsrfSecret();
  const token = generateCsrfToken(secret);
  // ...
}
```

**Execution Order (Correct)**:

```
1. ESM imports all files
2. Module-level code runs (function declarations only)
3. dotenv.config() executes (.env loaded)
4. Server starts
5. First request → getCsrfSecret() → loads CSRF_SECRET ✅
```

### Alternative: Function Factory Pattern

```typescript
// server/middleware/security.ts

import { getRequiredEnv } from '../utils/env-helpers';

// Factory function creates middleware with secrets
export function createCsrfProtection() {
  const CSRF_SECRET = getRequiredEnv('CSRF_SECRET'); // Loaded when factory called

  return function csrfProtection(req: Request, res: Response, next: NextFunction) {
    const token = generateCsrfToken(CSRF_SECRET);
    // ...
  };
}

// server/index.ts
import dotenv from 'dotenv';
import { createCsrfProtection } from './middleware/security';

// Load environment first
dotenv.config();

// Create middleware AFTER dotenv
const csrfProtection = createCsrfProtection();

app.use(csrfProtection);
```

### Type Assertion with SAFETY Comment Pattern

**Context**: When Zod validation middleware runs before route handler, `req.body` is guaranteed to match the schema type, making type assertion safe.

```typescript
// server/routes/api-v1-routes.ts

import { z } from 'zod';
import { validateRequest } from '../middleware/validation';

const productSearchQuerySchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().optional(),
});

app.post(
  '/api/v1/scraping/search-product',
  basicAuth,
  validateRequest(productSearchQuerySchema), // Validates req.body
  withAdmin(async (req, res) => {
    // SAFETY: Body validated by productSearchQuerySchema middleware above
    const { productName, category } = req.body as z.infer<typeof productSearchQuerySchema>;

    const result = await searchService.searchProduct(productName, category);
    sendSuccess(res, result);
  })
);
```

**When to Use SAFETY Comments**:

1. **After Zod Validation Middleware** - Body/query validated before handler
2. **After Type Guard Check** - Conditional already narrowed type
3. **Database Query Results** - Schema guarantees shape
4. **External API Responses** - Validated by Zod schema

**Comment Format**:

```typescript
// SAFETY: [Why this assertion is safe]
const value = expr as Type;
```

**Examples**:

```typescript
// SAFETY: Body validated by createUserSchema middleware above
const { username, email } = req.body as { username: string; email: string };

// SAFETY: Type guard confirmed product is defined
const id = product!.id;

// SAFETY: Database query selects these exact fields
const { name, price } = result as { name: string; price: number };

// SAFETY: Zod schema validated external API response shape
const data = apiResponse as ApiResponseType;
```

### When NOT to Use These Patterns

❌ **Don't use lazy initialization for:**

- Constants that never change at runtime
- Values that don't depend on environment variables
- Synchronous configuration loaded from files

❌ **Don't use type assertions without SAFETY comments:**

```typescript
// ❌ BAD - No explanation why safe
const user = req.user as User;

// ✅ CORRECT - Documented safety
// SAFETY: withAuth middleware guarantees req.user is defined
const user = req.user!;
```

### Testing Pattern for Lazy Initialization

```typescript
// server/middleware/security.test.ts

import { beforeAll, describe, expect, it } from 'vitest';
import dotenv from 'dotenv';

describe('CSRF Protection', () => {
  beforeAll(() => {
    // Load environment BEFORE importing middleware
    dotenv.config({ path: '.env.test' });
  });

  it('should load CSRF secret correctly', async () => {
    // Import AFTER dotenv loaded
    const { csrfProtection } = await import('./security');

    // Test middleware uses secret correctly
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(req.csrfToken).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

### Pre-Commit Hook Pattern

If you need to bypass pre-commit hooks for intentional patterns:

```bash
git commit --no-verify -m "feat: add lazy CSRF secret initialization

Notes:
- Module-level CSRF_SECRET replaced with lazy getCsrfSecret()
- Fixes ESM timing issue where env vars accessed before dotenv loads
- Memoized for performance (only loads once)
- See server/middleware/security.ts:170-174"
```

*Source: HTTP Basic Auth ESM/dotenv timing fix (2025-12-26)*
*Added: 2025-12-26*

---

## Type Guards & Narrowing

### Type Predicates

#### ✅ CORRECT - Custom Type Guards
```typescript
// Type predicate function
function isProduct(item: unknown): item is Product {
  return (
    typeof item === 'object' &&
    item !== null &&
    'id' in item &&
    'name' in item &&
    'price' in item &&
    typeof (item as Product).id === 'number' &&
    typeof (item as Product).name === 'string' &&
    typeof (item as Product).price === 'number'
  );
}

// Usage
function processItem(item: unknown) {
  if (isProduct(item)) {
    // TypeScript knows item is Product here
    console.log(item.name, item.price);
  }
}

// Array type guard
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(item => typeof item === 'string')
  );
}

// Discriminated union guard
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function isSuccess<T>(result: Result<T>): result is { success: true; data: T } {
  return result.success === true;
}
```

### Discriminated Unions

#### ✅ CORRECT - Tagged Unions
```typescript
// API Response type
type ApiResult<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

function handleApiResult<T>(result: ApiResult<T>) {
  switch (result.status) {
    case 'loading':
      return <Spinner />;
    case 'success':
      // TypeScript knows result.data exists
      return <DataDisplay data={result.data} />;
    case 'error':
      // TypeScript knows result.error exists
      return <ErrorMessage error={result.error} />;
  }
}

// Action types
type Action =
  | { type: 'SET_USER'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_USER':
      // TypeScript knows action.payload is User
      return { ...state, user: action.payload };
    case 'LOGOUT':
      // TypeScript knows no payload
      return { ...state, user: null };
    case 'SET_ERROR':
      // TypeScript knows action.payload is string
      return { ...state, error: action.payload };
  }
}
```

### Validation Code Type Guards

When writing validation or schema-based code, runtime type guards are **MANDATORY** for accessing properties on `unknown` values.

#### ❌ WRONG - Schema Type Doesn't Narrow TypeScript Types
```typescript
// TypeScript ERROR: 'value' is of type 'unknown'
function validateProperty(value: unknown, schema: { type: string; minLength?: number }) {
  if (schema.type === 'string') {
    // Even though schema says type is 'string', TypeScript doesn't know value is a string!
    if (value.length < schema.minLength) {  // ❌ ERROR: Property 'length' does not exist
      return false;
    }
  }
}
```

#### ✅ CORRECT - Runtime Type Guard BEFORE Property Access
```typescript
function validateProperty(value: unknown, schema: { type: string; minLength?: number }) {
  // Add runtime type guard alongside schema check
  if (schema.type === 'string' && typeof value === 'string') {
    // Now TypeScript knows value is a string
    if (schema.minLength && value.length < schema.minLength) {
      return false;
    }
  }
  return true;
}
```

#### Key Principle
**Schema declarations (`schema.type === 'string'`) are runtime checks, not TypeScript type narrowing.**

You must add explicit `typeof` guards to enable TypeScript's type inference.

#### ✅ CORRECT - All Validation Type Guards
```typescript
// String validation
if (propSchema.type === 'string' && typeof value === 'string') {
  if (propSchema.minLength && value.length < propSchema.minLength) {
    errors.push({ message: 'String too short' });
  }
  if (propSchema.maxLength && value.length > propSchema.maxLength) {
    errors.push({ message: 'String too long' });
  }
}

// Number validation
if (propSchema.type === 'number' && typeof value === 'number') {
  if (propSchema.min !== undefined && value < propSchema.min) {
    errors.push({ message: 'Number too small' });
  }
  if (propSchema.max !== undefined && value > propSchema.max) {
    errors.push({ message: 'Number too large' });
  }
}

// Boolean validation
if (propSchema.type === 'boolean' && typeof value === 'boolean') {
  // Type-safe boolean handling
}

// Array validation
if (propSchema.type === 'array' && Array.isArray(value)) {
  value.forEach((item, index) => {
    // Validate each item
  });
}

// Object validation
if (propSchema.type === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
  // Validate object properties
}
```

*Source: Validation code type guards pattern*
*Added: [Original date]*

### Type-Safe Bull Job Data Access (NEW - 2026-01-15)

**Context:** Bull queue event handlers receive `job.data` typed as `any`, causing ESLint `no-unsafe-member-access` violations when accessing properties.

**Problem:** Directly accessing properties like `job.data?.type` triggers TypeScript strict mode errors because Bull's generic defaults to `any`.

**Source:** `server/jobs/price-snapshot-queue.ts` lines 70-72, 94-96 from TODO_227 (Retry Logic Implementation).

#### ❌ WRONG - Direct Property Access on `any` Type

```typescript
import { Queue, Job } from 'bull';

// Bull's Job<T = any> means job.data is 'any' if no type provided
queue.on('active', (job) => {
  // ❌ ESLint ERROR: Unsafe member access on 'any' type
  logger.info('Job started', {
    type: job.data?.type,  // job.data is 'any', .type is unsafe
  });
});

queue.on('completed', (job, result) => {
  // ❌ ESLint ERROR: Unsafe member access
  const jobType = job.data?.type;  // TypeScript doesn't know if .type exists
  logger.info('Job completed', { type: jobType });
});
```

**Problems:**
- `job.data` is typed as `any` by Bull (generic defaults to `any`)
- ESLint `@typescript-eslint/no-unsafe-member-access` violations
- No runtime validation - crashes if shape doesn't match
- TypeScript can't help if property name changes

#### ✅ CORRECT - Type Guard Before Property Access

```typescript
import { Queue, Job } from 'bull';
import { logger } from '../utils/logger';

// Type guard pattern for job.data property access
queue.on('active', (job) => {
  // CRITICAL: Type guard required before accessing job.data properties
  const jobType = job?.data && typeof job.data === 'object' && 'type' in job.data
    ? String(job.data.type)  // Safe: coerce to string
    : undefined;

  logger.info('Job started', {
    jobId: job?.id,
    type: jobType,  // Type-safe: string | undefined
  });
});

// Reusable type guard helper
function extractJobType(job: Job | undefined): string | undefined {
  if (!job?.data || typeof job.data !== 'object' || !('type' in job.data)) {
    return undefined;
  }
  return String(job.data.type);
}

// Usage with helper
queue.on('completed', (job, result: unknown) => {
  const jobType = extractJobType(job);
  logger.info('Job completed', {
    jobId: job?.id,
    type: jobType,  // Type-safe
  });
});

// Failed event - same pattern
queue.on('failed', (job, err: unknown) => {
  const jobType = extractJobType(job);
  const error = err instanceof Error ? err : new Error(String(err));

  logger.error('Job failed', {
    jobId: job?.id,
    type: jobType,
    error: error.message,
  });
});
```

#### Why Bull Types `job.data` as `any`

**Bull's Job type definition:**

```typescript
// Simplified Bull Job interface
interface Job<T = any> {  // Generic defaults to 'any'
  id: string | number;
  data: T;  // Type is 'any' if no generic provided
  opts: JobOptions;
  attemptsMade: number;
}

// When you don't provide generic type:
queue.on('completed', (job, result) => {
  // job is Job<any>
  // job.data is any
});

// You COULD provide generic type:
interface PriceSnapshotData {
  type: 'scheduled' | 'manual';
  priority?: number;
}

queue.on('completed', (job: Job<PriceSnapshotData>, result) => {
  // job.data is PriceSnapshotData
  // BUT: Bull doesn't validate runtime data matches type!
});
```

**Problem with generic approach:**
- Type is compile-time only (no runtime validation)
- Data from Redis might not match declared type
- Still need runtime validation for safety
- Verbose to declare types for every event handler

**Recommendation:** Use type guards (runtime validation) instead of relying on compile-time generics.

#### Type Guard Pattern Breakdown

**Step-by-step validation:**

```typescript
const jobType = job?.data                    // 1. Check job and job.data exist
  && typeof job.data === 'object'            // 2. Check job.data is object
  && 'type' in job.data                      // 3. Check 'type' property exists
    ? String(job.data.type)                  // 4. Safely coerce to string
    : undefined;                             // 5. Fallback to undefined
```

**Why this is safe:**
1. Optional chaining (`job?.data`) handles null/undefined job
2. `typeof === 'object'` narrows from `any` to object type
3. `'type' in obj` checks property exists before access
4. `String(...)` safely coerces any value to string
5. Graceful fallback prevents crashes

#### Alternative: Explicit Type Narrowing

```typescript
// Longer but more explicit version
function getJobType(job: Job | undefined): string | undefined {
  // Validate job exists
  if (!job) return undefined;

  // Validate job.data is object
  if (typeof job.data !== 'object' || job.data === null) {
    return undefined;
  }

  // Validate 'type' property exists
  if (!('type' in job.data)) {
    return undefined;
  }

  // Safe to access and coerce
  return String(job.data.type);
}
```

#### When to Use

✅ **Use when:**
- Accessing `job.data` properties in Bull queue event handlers
- ESLint strict mode enabled (`no-unsafe-member-access`)
- Runtime validation required (data from Redis)
- Generic type not provided for Job

❌ **NOT needed when:**
- Using Zod schema to validate job.data (Zod narrows types)
- Job generic type provided AND runtime validation in place
- Property access is on typed object (not `any`)

#### Rationale

- **Type Safety**: Progressive narrowing prevents runtime crashes
- **ESLint Compliance**: Satisfies `no-unsafe-member-access` rule
- **Runtime Validation**: Checks property exists before access (data from Redis)
- **Graceful Degradation**: Returns undefined instead of crashing
- **No Dependencies**: Pure TypeScript (no Zod/validation library needed for simple cases)

#### Quality Checklist

- [ ] Type guard checks `typeof job.data === 'object'`
- [ ] Checks property exists (`'type' in job.data`)
- [ ] Coerces value to expected type (`String(...)`, `Number(...)`)
- [ ] Provides fallback value (undefined, null, default)
- [ ] No direct property access on `job.data` without guard
- [ ] Reusable helper function if pattern repeated (3+ times)

#### Related Patterns

- **Type-Safe Queue Event Handlers** (`docs/07_BACKGROUND_JOBS_PATTERNS.md` line 1602): Full pattern for queue events
- **Enhanced Queue Error Classification** (`docs/07_BACKGROUND_JOBS_PATTERNS.md` line 1378): Uses this pattern
- **Type Guards & Narrowing** (line 2059): General type guard principles

**Source:** TODO_227 retry logic implementation (price-snapshot-queue.ts lines 70-72, 94-96)
**Added:** 2026-01-15

---

### TypeScript Assertion Signatures for Validation Helpers (NEW - 2026-01-04)

**Context:** Storage layer validation helpers, utility functions, and parameter guards that narrow `unknown` types to specific types.

**Problem:** Validation functions that throw on invalid input should communicate to TypeScript that the value is narrowed after the call. Without assertion signatures, callers must duplicate type guards even after validation passes.

**✅ Preferred Approach - Assertion Signature (`asserts param is Type`):**

```typescript
/**
 * Validate active status is boolean type
 * @private
 */
private validateActiveStatus(active: unknown): asserts active is boolean {
  if (typeof active !== 'boolean') {
    throw new Error(`Invalid active parameter: ${active}. Must be boolean.`);
  }
  // After this function returns (doesn't throw), TypeScript knows active is boolean
}

// Usage - no type guard needed after validation
async setUserActive(userId: number, active: unknown): Promise<void> {
  this.validateActiveStatus(active);
  // TypeScript now knows active is boolean - can use without further checks
  await this.db.update(users).set({ isActive: active });
}
```

**✅ Correct - Multiple Assertion Signatures:**

```typescript
export class UserStorage extends BaseStorage {
  /**
   * Validate user ID is positive integer
   * @private
   */
  private validateUserId(userId: unknown): asserts userId is number {
    if (typeof userId !== 'number' || !Number.isInteger(userId) || userId < 1) {
      throw new Error(`Invalid userId: ${userId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate email format
   * @private
   */
  private validateEmail(email: unknown): asserts email is string {
    if (typeof email !== 'string' || !email.includes('@')) {
      throw new Error(`Invalid email: ${email}`);
    }
  }

  /**
   * Validate role is allowed value
   * @private
   */
  private validateRole(role: unknown): asserts role is 'user' | 'admin' | 'moderator' {
    const allowedRoles = ['user', 'admin', 'moderator'];
    if (typeof role !== 'string' || !allowedRoles.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${allowedRoles.join(', ')}`);
    }
  }
}
```

**❌ Anti-Pattern - No Assertion Signature:**

```typescript
// ❌ WRONG - Validation doesn't narrow type
private validateActiveStatus(active: unknown): void {
  if (typeof active !== 'boolean') {
    throw new Error(`Invalid active parameter: ${active}. Must be boolean.`);
  }
  // TypeScript doesn't know active is boolean after this returns
}

// Caller must duplicate type guard
async setUserActive(userId: number, active: unknown): Promise<void> {
  this.validateActiveStatus(active);

  // ❌ TypeScript error: active is still 'unknown'
  await this.db.update(users).set({ isActive: active });  // ERROR!

  // ❌ Must add redundant type guard
  if (typeof active === 'boolean') {
    await this.db.update(users).set({ isActive: active });  // Duplicate validation!
  }
}
```

**❌ Anti-Pattern - Type Predicate Instead of Assertion:**

```typescript
// ❌ WRONG - Type predicate returns boolean, doesn't throw
private validateActiveStatus(active: unknown): active is boolean {
  return typeof active === 'boolean';
}

// Caller must handle false case
async setUserActive(userId: number, active: unknown): Promise<void> {
  if (!this.validateActiveStatus(active)) {
    throw new Error('Invalid active status');  // ❌ Error handling duplicated
  }
  // Now active is boolean, but we had to handle the error case
}
```

**Rationale:**

1. **Type Narrowing**: TypeScript knows the type after validation without duplicate checks
2. **Error Throwing**: Assertion signatures match the pattern of validators that throw (not return false)
3. **Single Responsibility**: Validator handles both runtime check and type narrowing
4. **Consistency**: All validators follow the same pattern (throw on invalid, narrow on valid)
5. **Developer Experience**: IDE autocomplete shows narrowed type after validator call
6. **Reduced Duplication**: No need for redundant `typeof` checks after validation

**When to Use Assertion Signatures:**

- ✅ Validation functions that THROW on invalid input
- ✅ Narrowing `unknown` → specific type (boolean, string, number, union type)
- ✅ Storage layer validators (validateUserId, validateEmail, validateRole)
- ✅ Utility validators in shared/validation modules
- ❌ Functions that RETURN boolean (use type predicates: `value is Type`)
- ❌ Functions that don't validate (just log, transform, etc.)

**Comparison: Assertion Signature vs Type Predicate:**

| Feature | Assertion Signature | Type Predicate |
|---------|---------------------|----------------|
| Signature | `asserts x is T` | `x is T` |
| Returns | `void` (throws on invalid) | `boolean` (true/false) |
| Error Handling | Throws exception | Returns false |
| Use Case | Validators that throw | Conditional type checks |
| Example | `validateUserId(id: unknown): asserts id is number` | `isProduct(x: unknown): x is Product` |

**Example: Full Storage Layer Pattern:**

```typescript
export class UserStorage extends BaseStorage {
  // ✅ Assertion signatures for validators
  private validateUserId(userId: unknown): asserts userId is number {
    if (typeof userId !== 'number' || userId < 1) {
      throw new Error(`Invalid userId: ${userId}`);
    }
  }

  private validateActiveStatus(active: unknown): asserts active is boolean {
    if (typeof active !== 'boolean') {
      throw new Error(`Invalid active parameter: ${active}`);
    }
  }

  // ✅ Type predicate for conditional checks
  private isAdminUser(user: SafeUser): user is SafeUser & { role: 'admin' } {
    return user.role === 'admin';
  }

  // Usage in public method
  async setUserActive(userId: unknown, active: unknown): Promise<void> {
    try {
      // Validate and narrow types
      this.validateUserId(userId);       // userId is now number
      this.validateActiveStatus(active); // active is now boolean

      // TypeScript knows types, no further checks needed
      await this.db
        .update(users)
        .set({ isActive: active })
        .where(eq(users.id, userId));

      await storageCache.invalidateUserCache(userId);
    } catch (error) {
      this.handleError(error, 'setUserActive');
    }
  }
}
```

**Related:**
- See "Validation Helper Extraction" pattern in `DATABASE_PATTERNS.md` (Section 1)
- See "Type Predicates" section above for conditional type checks
- See `server/storage/domains/user-storage.ts` for real-world examples

**Source:** TODO 002 code review (setUserActive implementation), 2026-01-04
*Added: 2026-01-04*

### Type Assertions for Schema Properties

When accessing schema properties, TypeScript may not know their shape. Define interfaces and use type assertions.

#### ❌ WRONG - Schema Property is Unknown
```typescript
interface ArraySchema {
  type: 'array';
  items: string;
  itemConstraints?: unknown;  // TypeScript doesn't know the shape
}

if (schema.items === 'string' && schema.itemConstraints) {
  const constraints = schema.itemConstraints;  // Type: unknown
  if (constraints.minLength) {  // ❌ ERROR: Property 'minLength' does not exist
    // ...
  }
}
```

#### ✅ CORRECT - Define Interface and Assert Type
```typescript
// Define the constraints interface
interface ItemConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

interface ArraySchema {
  type: 'array';
  items: string | ObjectItemSchema;
  minItems?: number;
  maxItems?: number;
  itemConstraints?: ItemConstraints;  // Now properly typed
}

// Use type assertion after validating context
if (schema.items === 'string' && (schema as ArraySchema).itemConstraints) {
  const constraints = (schema as ArraySchema).itemConstraints as ItemConstraints;

  // Now TypeScript knows the shape
  if (constraints.minLength && item.length < constraints.minLength) {
    errors.push({ message: 'Too short' });
  }

  if (constraints.pattern && !constraints.pattern.test(item)) {
    errors.push({ message: 'Pattern mismatch' });
  }
}
```

### Centralized Validation Messages

Extract all validation error messages into a constant object for consistency and maintainability.

#### ❌ WRONG - Scattered String Literals
```typescript
// In one file
errors.push({ message: 'String must be at least ' + min + ' characters' });

// In another file
errors.push({ message: 'String must be at least ' + minLength + ' chars' });  // Inconsistent!

// Later
errors.push({ message: 'String length must be >= ' + minChars });  // Different wording!
```

#### ✅ CORRECT - Centralized Message Constants
```typescript
// Define all messages in one place
const VALIDATION_MESSAGES = {
  // Simple messages
  EXPECTED_ARRAY: 'Expected array',
  EXPECTED_OBJECT: 'Expected object',
  TYPE_MISMATCH: 'Type mismatch',
  PATTERN_MISMATCH: 'String does not match required pattern',
  VALUE_NOT_IN_LIST: 'Value not in allowed list',

  // Parameterized messages (factory functions)
  ARRAY_MIN_ITEMS: (min: number) => `Array must have at least ${min} items`,
  ARRAY_MAX_ITEMS: (max: number) => `Array must have at most ${max} items`,
  STRING_MIN_LENGTH: (min: number) => `String must be at least ${min} characters`,
  STRING_MAX_LENGTH: (max: number) => `String must be at most ${max} characters`,
  NUMBER_TOO_SMALL: (min: number) => `Number too small (min ${min})`,
  NUMBER_TOO_LARGE: (max: number) => `Number too large (max ${max})`,
  REQUIRED_FIELD_MISSING: (field: string) => `Required field missing: ${field}`,
  UNKNOWN_SCHEMA: (name: string) => `Unknown schema: ${name}`,
} as const;

// Usage - consistent everywhere
errors.push({
  field: '[0]',
  message: VALIDATION_MESSAGES.STRING_MIN_LENGTH(constraints.minLength),
});

errors.push({
  field: 'root',
  message: VALIDATION_MESSAGES.EXPECTED_ARRAY,
});
```

**Benefits:**
- Consistent error messages across entire codebase
- Easy to update all messages in one place
- Type-safe with `as const`
- Enables future i18n/localization
- Self-documenting - all error messages in one place

### Input Validation at Function Entry

Always validate inputs early, even when TypeScript types provide some safety.

#### ❌ WRONG - No Runtime Validation
```typescript
export function validateOutput(
  schemaName: keyof typeof outputSchemas,
  data: unknown
): ValidationResult {
  const schema = outputSchemas[schemaName];  // Could still be undefined in edge cases
  // Proceeds without checking...
}
```

#### ✅ CORRECT - Defense in Depth
```typescript
export function validateOutput(
  schemaName: keyof typeof outputSchemas,
  data: unknown
): ValidationResult {
  // Validate schema name exists (runtime check for defense in depth)
  if (!(schemaName in outputSchemas)) {
    return {
      valid: false,
      errors: [{
        field: 'schema',
        message: VALIDATION_MESSAGES.UNKNOWN_SCHEMA(schemaName)
      }]
    };
  }

  const schema = outputSchemas[schemaName];
  // Now safe to proceed with validation...
}
```

---

## Non-Null Assertion Patterns (NEW - 2025-12-04)

Non-null assertions (`!`) bypass TypeScript's null safety. This section documents when to use them and preferred alternatives.

### When Non-Null Assertions Are Dangerous

The `!` operator tells TypeScript "trust me, this is not null". But if you're wrong, you get a runtime crash instead of a compile-time error.

**Most Common Violation**: Using `!` after `Map.get()` when building grouped data.

### Pattern 1: Map.get() with Null Coalescing (PREFERRED)

```typescript
// ❌ WRONG - Non-null assertion hides potential crash
const groupedData = new Map<string, DataPoint[]>();

for (const item of items) {
  const key = item.category;
  if (!groupedData.has(key)) {
    groupedData.set(key, []);
  }
  groupedData.get(key)!.push(item);  // ❌ Non-null assertion!
}

// ✅ BEST - Null coalescing is clean and safe
const groupedData = new Map<string, DataPoint[]>();

for (const item of items) {
  const key = item.category;
  const group = groupedData.get(key) ?? [];
  group.push(item);
  groupedData.set(key, group);
}
```

**Benefits of null coalescing**:
- Zero chance of null pointer exception
- More readable - single line handles both cases
- No log noise from initialization
- TypeScript understands the type narrowing

### Pattern 2: Explicit Error for Uninitialized Refs

When null indicates a bug (not a valid state), throw a descriptive error.

```typescript
// ❌ WRONG - Non-null assertion on ref
const fetchFn = originalFetchRef.current!;

// ✅ GOOD - Explicit error with context
if (!originalFetchRef.current) {
  throw new Error(
    'Rate limit hook: Fetch ref not initialized. ' +
    'This indicates a timing issue in hook lifecycle.'
  );
}
const fetchFn = originalFetchRef.current;  // TypeScript knows it's defined
```

**When to use explicit errors:**
- React refs that should be set after mount
- Singleton services that should be initialized
- Resources that MUST exist (null indicates a setup bug)

### Pattern 3: Optional Chaining in Tests

In tests, prefer optional chaining over non-null assertions for clearer failure messages.

```typescript
// ❌ WRONG - Non-null assertion crashes with unhelpful stack trace
expect(result!.currentPrice).toBe(100);
expect(products[0]!.name).toBe('Test');

// ✅ BETTER - Optional chaining gives clearer test failure
expect(result?.currentPrice).toBe(100);
expect(products[0]?.name).toBe('Test');
// Failure: "expected undefined to be 100" - tells you what was null

// ✅ ALSO GOOD - Explicit existence check first
expect(result).toBeDefined();
expect(result!.currentPrice).toBe(100);  // Safe after check

// ✅ BEST - Type guard after null check (ESLint Cleanup - 2025-12-07)
const result = calculateVolatility(mockStablePrices);
expect(result).not.toBeNull();
if (!result) throw new Error('Expected result to be defined');
// Now TypeScript knows result is not null - no ! needed
expect(result.level).toBe('low');
expect(result.score).toBeGreaterThanOrEqual(0);
expect(result.standardDeviation).toBeGreaterThan(0);
```

**TypeScript Limitation**: `expect().not.toBeNull()` doesn't narrow types for TypeScript. The compiler still sees `result` as `Type | null` even after the assertion.

**Pattern from volatility-calculator.test.ts** (34 instances):
```typescript
// ❌ CURRENT - Non-null assertions after expect
const result = calculateVolatility(mockStablePrices);
expect(result).not.toBeNull();
expect(result!.level).toBe('low');             // ❌ ESLint warning
expect(result!.score).toBeGreaterThanOrEqual(0); // ❌ ESLint warning
expect(result!.standardDeviation).toBeGreaterThan(0); // ❌ ESLint warning

// ✅ FIX - Add type guard after assertion
const result = calculateVolatility(mockStablePrices);
expect(result).not.toBeNull();
if (!result) throw new Error('Expected result to be defined');
// TypeScript now knows result is not null
expect(result.level).toBe('low');              // ✅ No ! needed
expect(result.score).toBeGreaterThanOrEqual(0);  // ✅ No ! needed
expect(result.standardDeviation).toBeGreaterThan(0); // ✅ No ! needed
```

**Why the type guard works:**
- `if (!result)` narrows the type from `T | null` to `T` in TypeScript
- The `throw` ensures execution doesn't continue if result is null
- More explicit than `!` - shows intent clearly

### Pattern 4: Double Non-Null Assertions (CRITICAL)

When you see TWO `!` on the same line, BOTH need null handling.

```typescript
// ❌ CRITICAL - Double non-null assertion
const listProducts = productsByListId.get(product.watchListId!)!;
//                                                       ^     ^
//                         First assertion: watchListId is defined
//                         Second assertion: Map.get() returns value

// ✅ CORRECT - Handle BOTH null cases
if (!product.watchListId) {
  logger.warn(`Product ${product.productId} has null watchListId, skipping`);
  continue;
}

const listProducts = productsByListId.get(product.watchListId) ?? [];
listProducts.push(product);
productsByListId.set(product.watchListId, listProducts);
```

### Anti-Pattern: Logger.warn for Expected Behavior

DO NOT use `logger.warn()` for normal code paths like first-time Map initialization.

```typescript
// ❌ WRONG - Creates false-positive warnings in logs
const group = groupedData.get(key);
if (group) {
  group.push(item);
} else {
  logger.warn(`Missing group for key: ${key}, initializing`);  // ❌ Log noise!
  groupedData.set(key, [item]);
}

// ✅ CORRECT - Silent initialization with null coalescing
const group = groupedData.get(key) ?? [];
group.push(item);
groupedData.set(key, group);
```

**Problems with warning on expected nulls:**
- First-time initialization is EXPECTED, not a warning condition
- Creates noise in production logs
- Makes real warnings harder to find
- Verbose compared to null coalescing

### Quick Reference Table

| Pattern | Replace With |
|---------|-------------|
| `map.get(key)!` | `map.get(key) ?? defaultValue` |
| `array[0]!` | `array[0]` with optional chaining or bounds check |
| `ref.current!` | Explicit null check with descriptive error |
| `value!.property!` | Two separate null checks |
| `logger.warn` for init | Null coalescing (no logging) |

### Detection Commands

```bash
# Find non-null assertions in TypeScript files
grep -rn "!\." server/ client/src/ --include="*.ts" --include="*.tsx" | grep -v ".test."

# Find Map.get() with non-null assertion
grep -rn "\.get(.*)\!" server/ client/src/ --include="*.ts"

# Find double non-null assertions
grep -rn "!\)!" server/ client/src/ --include="*.ts"
```

---

## Empty Collection Edge Cases (NEW - 2025-12-27)

**Context:** Operations on collections (arrays, Maps, Sets) often have unexpected behavior when the collection is empty. This causes bugs that manifest as invalid data (`Infinity`, `NaN`, `undefined`) instead of meaningful values like `null`.

**Problem:** Spread operators and aggregate functions like `Math.min()`, `Math.max()`, `Array.reduce()` behave unexpectedly on empty collections.

### Empty Array with Math.min/Math.max (CRITICAL)

**Issue:** `Math.min(...[])` returns `Infinity` (not `null`, `undefined`, or error). `Math.max(...[])` returns `-Infinity`.

#### ❌ WRONG - No Empty Check Before Spread

```typescript
// Phase 3 Code Review finding - api-v1-routes.ts line 388
const offers = await storage.getProductOffers(product.id);
const prices = offers.map((o) => parseFloat(o.price));
const bestPrice = Math.min(...prices);  // Returns Infinity if offers is empty!

// API response: { bestPrice: Infinity }  // ❌ Invalid JSON, breaks clients
```

**Why this is wrong:**
- `Math.min()` with zero arguments returns `Infinity` (by spec)
- Clients expect `null` when no price exists, not `Infinity`
- `Infinity` is technically valid JSON but semantically wrong
- Edge case easily missed in testing (requires product with zero offers)

#### ✅ CORRECT - Check Length Before Spread

```typescript
// Fixed in Phase 3 - api-v1-routes.ts line 387-388
const offers = await storage.getProductOffers(product.id);
const prices = offers.length > 0 ? offers.map((o) => parseFloat(o.price)) : [];
const bestPrice = prices.length > 0 ? Math.min(...prices) : null;

// API response: { bestPrice: null }  // ✅ Semantically correct
```

**Pattern:**
```typescript
// ALWAYS check collection.length before spread operator
const values = collection.length > 0 ? collection.map(transform) : [];
const min = values.length > 0 ? Math.min(...values) : null;
const max = values.length > 0 ? Math.max(...values) : null;
```

#### Alternative: Array.reduce() for Safety

```typescript
// No spread operator - safer for large arrays
const bestPrice = prices.reduce(
  (min, price) => (price < min ? price : min),
  Infinity  // Explicit initial value
);

// Still need empty check for semantic correctness
const bestPrice = prices.length > 0
  ? prices.reduce((min, price) => (price < min ? price : min), Infinity)
  : null;
```

**Benefits of reduce:**
- No spread operator (avoids stack overflow on huge arrays)
- Explicit initial value (intent is clear)
- Still need length check for semantic `null` vs `Infinity`

### Empty Array with Array.reduce (MODERATE)

**Issue:** `Array.reduce()` without initial value throws on empty arrays.

#### ❌ WRONG - reduce() Without Initial Value

```typescript
const total = prices.reduce((sum, price) => sum + price);
// Throws: "Reduce of empty array with no initial value"
```

#### ✅ CORRECT - Always Provide Initial Value

```typescript
const total = prices.reduce((sum, price) => sum + price, 0);
// Returns: 0 (for empty array)

// Or check length first for semantic null
const total = prices.length > 0
  ? prices.reduce((sum, price) => sum + price, 0)
  : null;
```

### Empty Map/Set Edge Cases

**Issue:** Iterating over empty Maps/Sets with aggregation operations.

#### ❌ WRONG - No Empty Check

```typescript
const prices = new Map<number, number>();
// ... populate map ...

const allPrices = Array.from(prices.values());
const avgPrice = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;
// Returns: 0 / 0 = NaN if map is empty
```

#### ✅ CORRECT - Check Size First

```typescript
const prices = new Map<number, number>();
// ... populate map ...

const avgPrice = prices.size > 0
  ? Array.from(prices.values()).reduce((sum, p) => sum + p, 0) / prices.size
  : null;
// Returns: null if map is empty (semantically correct)
```

### String Join on Empty Arrays

**Issue:** `array.join()` returns empty string for empty arrays, which might not be semantically correct.

#### ❌ WRONG - Implicit Empty String

```typescript
const tags = product.tags.join(', ');
// Returns: "" if tags is empty
// API response: { tags: "" }  // Might confuse clients (empty vs no tags?)
```

#### ✅ CORRECT - Explicit Null for Missing Data

```typescript
const tags = product.tags.length > 0 ? product.tags.join(', ') : null;
// Returns: null if tags is empty
// API response: { tags: null }  // Clear: no tags exist
```

### Detection Pattern

**Common symptoms:**
- API responses containing `Infinity` or `-Infinity`
- NaN in calculations
- Empty strings where `null` expected
- Unexpected 0 values

**Detection commands:**
```bash
# Find Math.min/max without length checks
grep -rn "Math\.min(\.\.\." server/ --include="*.ts" | \
  grep -v "length > 0"

# Find reduce without initial value
grep -rn "\.reduce(" server/ --include="*.ts" | \
  grep -v ", " | grep -v "0)"

# Find array operations on potentially empty collections
grep -rn "\.map(.*Math\." server/ --include="*.ts"
```

### Checklist: Operations on Collections

Before using these operations, ALWAYS check collection size:

- [ ] **Math.min(...array)** - Check `array.length > 0` first
- [ ] **Math.max(...array)** - Check `array.length > 0` first
- [ ] **array.reduce(fn)** - Provide initial value OR check length
- [ ] **array[0]** - Use optional chaining `array[0] ?? null`
- [ ] **Set/Map to Array** - Check `collection.size > 0` first
- [ ] **array.join()** - Decide if `""` or `null` for empty array

### Semantic Null Pattern (RECOMMENDED)

**When in doubt, use `null` to indicate "data does not exist":**

```typescript
// ✅ GOOD - Semantic null for missing data
const result = {
  bestPrice: offers.length > 0 ? Math.min(...prices) : null,
  avgRating: reviews.length > 0 ? calculateAvg(reviews) : null,
  topReviewer: reviews.length > 0 ? reviews[0].author : null,
  tags: product.tags.length > 0 ? product.tags.join(', ') : null,
};

// Clients can distinguish:
// - null: Data does not exist (no offers, no reviews)
// - 0: Data exists and value is zero (free product, 0-star review)
// - undefined: Field not requested/included
```

**Rationale:**
- **Data Integrity**: `Infinity`, `NaN`, `""` are technically valid but semantically wrong
- **Client Experience**: Clients expect `null` for missing data, not edge case values
- **Type Safety**: TypeScript understands `number | null`, not `number | Infinity`
- **API Consistency**: All "no data" cases return `null` uniformly
- **Debugging**: `Infinity` in logs immediately signals missing length check

**Related Patterns:**
- See `docs/02_DATABASE_PATTERNS.md` - Handling empty result sets
- See `docs/03_API_PATTERNS.md` - Consistent response patterns
- See `docs/06_ERROR_HANDLING_PATTERNS.md` - Meaningful error responses

*Source: Phase 3 Code Review (api-v1-routes.ts line 388), empty offers array edge case*
*Fixed: 2025-12-27*
*Added: 2025-12-27*

---

### String Normalization: `.replaceAll()` vs `.replace()` (ANTI-PATTERN) (NEW - 2026-01-16)

**Context:** When normalizing strings for IDs, slugs, URLs, or identifiers that require removing ALL occurrences of a character or pattern.

**Problem:** `.replace()` only replaces the FIRST occurrence of a pattern when used with a string argument, silently leaving subsequent occurrences in place. This causes subtle bugs in string normalization where multi-word inputs are only partially cleaned.

**Priority:** P1 - Common source of subtle normalization bugs

#### ❌ ANTI-PATTERN - `.replace()` Only Handles First Occurrence

```typescript
// ❌ WRONG - Only removes FIRST space
const retailerName = "Best Buy Store";
const slug = retailerName.toLowerCase().replace(' ', '');

console.log(slug);
// Expected: "bestbuystore"
// Actual:   "bestbuy Store"  ❌ Only first space removed!

// Real-world failure scenario:
const retailers = [
  { name: "Best Buy", slug: "bestbuy" },        // ✅ Works (only 1 space)
  { name: "Home Depot", slug: "homedepot" },    // ✅ Works (only 1 space)
  { name: "Bed Bath Beyond", slug: "bed bath beyond" }  // ❌ FAILS (2+ spaces)
];

// E2E test fails for "Bed Bath Beyond" only:
await page.goto(`/retailers/${slug}`);  // /retailers/bed bath beyond (invalid URL!)
```

**Why This Is Dangerous:**

1. **Silent Failure**: No error thrown - looks correct for single-occurrence cases
2. **Partial Test Coverage**: Tests with 2-word names pass, 3+ word names fail
3. **Inconsistent Behavior**: Works for some inputs, fails for others
4. **URL/ID Corruption**: Partially normalized strings break routing, lookups, comparisons

#### ✅ CORRECT - `.replaceAll()` for Normalization (Handles ALL Occurrences)

```typescript
// ✅ CORRECT - Removes ALL spaces
const retailerName = "Best Buy Store";
const slug = retailerName.toLowerCase().replaceAll(' ', '');

console.log(slug);
// Output: "bestbuystore" ✅ All spaces removed

// ✅ Works for all inputs regardless of word count
const retailers = [
  { name: "Best Buy", slug: normalize("Best Buy") },                    // "bestbuy"
  { name: "Home Depot", slug: normalize("Home Depot") },                // "homedepot"
  { name: "Bed Bath Beyond", slug: normalize("Bed Bath Beyond") },      // "bedbathbeyond"
  { name: "Williams Sonoma Inc", slug: normalize("Williams Sonoma Inc") } // "williamsonomainc"
];

function normalize(name: string): string {
  return name.toLowerCase().replaceAll(' ', '');
}

// Regex version for more complex patterns
const normalized = retailerName
  .toLowerCase()
  .replaceAll(/\s+/g, '');  // Replace all whitespace (spaces, tabs, newlines)

const urlSafe = productName
  .toLowerCase()
  .replaceAll(/[^a-z0-9]+/g, '-')  // Replace all non-alphanumeric with hyphens
  .replaceAll(/-+/g, '-')          // Collapse multiple hyphens
  .replace(/^-|-$/g, '');          // Trim leading/trailing hyphens
```

#### When to Use `.replace()` vs `.replaceAll()`

| Method | Use Case | Behavior | Example |
|--------|----------|----------|---------|
| **`.replace(str, newStr)`** | Replace **first occurrence only** (rare in normalization) | Stops after first match | `"a-b-c".replace('-', '_')` → `"a_b-c"` |
| **`.replaceAll(str, newStr)`** | Replace **ALL occurrences** (normalization, sanitization) | Replaces every match | `"a-b-c".replaceAll('-', '_')` → `"a_b_c"` |
| **`.replace(/regex/g, newStr)`** | Replace all via regex (complex patterns) | Global flag replaces all | `"a-b-c".replace(/-/g, '_')` → `"a_b_c"` |

**Rule of Thumb:**

- **Normalizing strings** (IDs, slugs, URLs) → **ALWAYS use `.replaceAll()`**
- **One-time replacement** (first occurrence only) → `.replace()` is OK
- **Complex patterns** (whitespace, special chars) → `.replaceAll(/regex/g, '')` or `.replace(/regex/g, '')`

#### Real-World Normalization Examples

```typescript
// ✅ CORRECT - E2E test data-testid normalization
const retailerName = "Best Buy Store";
const testId = retailerName.toLowerCase().replaceAll(/\s+/g, '');
// Result: "bestbuystore"

await page.locator(`[data-testid="retailer-${testId}"]`).click();

// ✅ CORRECT - URL slug generation
const productTitle = "Apple iPhone 15 Pro Max";
const slug = productTitle
  .toLowerCase()
  .replaceAll(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphen
  .replace(/^-+|-+$/g, '');         // Trim hyphens from start/end
// Result: "apple-iphone-15-pro-max"

// ✅ CORRECT - Database identifier sanitization
const username = "John   Doe";  // Multiple spaces (user input)
const sanitized = username
  .trim()
  .replaceAll(/\s+/g, '-')  // Replace all whitespace sequences with single hyphen
  .toLowerCase();
// Result: "john-doe"

// ✅ CORRECT - File path sanitization
const filename = "Q4 Sales Report (Final).pdf";
const safeName = filename
  .replaceAll(/[\/\\:*?"<>|]/g, '')  // Remove illegal file chars
  .replaceAll(/\s+/g, '_');           // Replace spaces with underscores
// Result: "Q4_Sales_Report_Final.pdf"
```

#### Detection Pattern - Find Potential Bugs

```bash
# Find .replace() calls that might need .replaceAll()
# (potential normalization bugs)
grep -rn "\.replace\(" server/ client/ --include="*.ts" --include="*.tsx" \
  | grep -v "replaceAll" \
  | grep -E "(toLowerCase|toUpperCase|slug|normalize|sanitize)"

# Example hits that might be bugs:
# server/routes.ts:42: const slug = name.toLowerCase().replace(' ', '');  # ❌ BUG!
# client/utils.ts:15: const id = text.toLowerCase().replace(/\s/g, ''); # ✅ OK (regex with /g)
```

#### Migration Pattern

```typescript
// BEFORE (buggy)
const normalize = (str: string) => str.toLowerCase().replace(' ', '');

// AFTER (correct)
const normalize = (str: string) => str.toLowerCase().replaceAll(' ', '');

// Or with regex for more complex patterns
const normalize = (str: string) => str.toLowerCase().replaceAll(/\s+/g, '');
```

**Rationale:**

- **Correctness**: Normalization MUST handle ALL occurrences, not just first
- **Predictability**: Function behaves consistently regardless of input word count
- **Debugging**: Partial normalization bugs are hard to spot (only fail on multi-occurrence inputs)
- **Test Coverage**: Single-word test cases can hide `.replace()` bugs
- **Intent**: `.replaceAll()` name clearly signals "replace ALL", not "replace first"

**Related Patterns:**
- See `docs/08_TESTING_PATTERNS.md` - E2E data-testid normalization patterns
- See `docs/03_API_PATTERNS.md` - URL slug generation in API routes

> **Source**: TODO_234 resolution (2026-01-16) - E2E Price Analytics Widget Visibility (data-testid selector mismatch)
> **Added**: 2026-01-16

---

## Generic Patterns

### Generic Functions

#### ✅ CORRECT - Reusable Generics
```typescript
// Generic fetch wrapper
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Usage with type
const product = await apiRequest<Product>('/products/1');
const users = await apiRequest<User[]>('/users');

// Generic cache wrapper
class Cache<T> {
  private cache = new Map<string, T>();

  set(key: string, value: T): void {
    this.cache.set(key, value);
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Usage
const productCache = new Cache<Product>();
productCache.set('product-1', product);
```

### Generic Constraints

#### ✅ CORRECT - Bounded Generics
```typescript
// Constraint to ensure type has an ID
interface HasId {
  id: number | string;
}

function findById<T extends HasId>(items: T[], id: T['id']): T | undefined {
  return items.find(item => item.id === id);
}

// Works with any type that has an id
const product = findById(products, 123); // Product | undefined
const user = findById(users, 'user-456'); // User | undefined

// Multiple constraints
interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

function sortByDate<T extends Timestamped>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}
```

---

## Bracket Notation for Private Method Access (2025-12-02)

**When to use bracket notation to access private methods within the same module.**

In TypeScript, private methods (`private methodName()`) are only accessible within the same class. However, when writing tests or internal utilities within the same module, you may need to call private methods. Bracket notation provides a way to do this that is acceptable within the same module context.

### Pattern: Bracket Notation for Internal Testing

```typescript
class CacheService {
  // Private method not accessible via dot notation from outside
  private generateKey(entity: string, id: number): string {
    return `${entity}:v1:${id}`;
  }

  // Private method for cache warming
  private async warmCacheForEntity(entity: string): Promise<void> {
    // Implementation
  }
}

// Within the same module (e.g., testing internal behavior)
const service = new CacheService();

// ❌ WRONG - TypeScript error: Property 'generateKey' is private
service.generateKey('product', 123);

// ✅ ACCEPTABLE - Bracket notation bypasses TypeScript private check
// Only use within the same module for testing/internal purposes
service['generateKey']('product', 123);  // Works at runtime
```

### When This Is Acceptable

**USE bracket notation when:**
- Unit testing private methods within the same module
- Internal module utilities need to access private behavior
- Calling from a method in the same class file that TypeScript doesn't recognize

**DON'T USE bracket notation when:**
- Accessing from a different module (indicates design problem)
- The method should actually be public
- Testing should go through public API instead

### Alternative: Extract to Testable Unit

If you frequently need to test a private method, consider extracting it:

```typescript
// ✅ BETTER - Extract reusable logic to standalone function
export function generateCacheKey(entity: string, id: number): string {
  return `${entity}:v1:${id}`;
}

class CacheService {
  private generateKey(entity: string, id: number): string {
    return generateCacheKey(entity, id);
  }
}

// Now testable without bracket notation
describe('generateCacheKey', () => {
  it('should generate versioned key', () => {
    expect(generateCacheKey('product', 123)).toBe('product:v1:123');
  });
});
```

### Review Checklist

- [ ] Bracket notation only used within same module
- [ ] Consider if method should be public or extracted
- [ ] Document why bracket notation is needed (comment)
- [ ] Tests primarily use public API, bracket notation is exception

---

## TypeScript Configuration

### Strict tsconfig.json

#### ✅ CORRECT - Enable Strict Mode
```json
{
  "compilerOptions": {
    "strict": true, // Enables all strict checks
    "noImplicitAny": true, // Error on implicit any
    "strictNullChecks": true, // Null/undefined checking
    "strictFunctionTypes": true, // Strict function types
    "strictBindCallApply": true, // Strict bind/call/apply
    "strictPropertyInitialization": true, // Class property init
    "noImplicitThis": true, // Error on implicit this
    "alwaysStrict": true, // Use strict mode

    // Additional strictness
    "noUnusedLocals": true, // Error on unused locals
    "noUnusedParameters": true, // Error on unused params
    "noImplicitReturns": true, // All paths must return
    "noFallthroughCasesInSwitch": true, // Switch exhaustiveness
    "noUncheckedIndexedAccess": true, // Index access returns T | undefined

    // Type checking
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
  }
}
```

---

## Common TypeScript Mistakes

### Mistake 1: Type Assertion Abuse

#### ❌ WRONG - Unsafe Assertions
```typescript
// Dangerous - bypasses type checking
const user = {} as User; // user.name is undefined!
const data = response as Product; // What if response is wrong shape?
```

#### ✅ CORRECT - Validate Instead
```typescript
// Validate the data
const user = validateUser(userData); // Throws if invalid
const product = productSchema.parse(response); // Validated
```

### Mistake 2: Incomplete Types

#### ❌ WRONG - Partial Types
```typescript
interface User {
  id: number;
  name: string;
  // Missing other properties used in code
}
```

#### ✅ CORRECT - Complete Types
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}
```

---

## TypeScript Checklist

### Pre-Commit Requirements (BLOCKERS)
- [ ] **No `any` types** - Especially in test files! Use proper types from schema
- [ ] **No `@ts-ignore`** - Fix the actual issue or document thoroughly
- [ ] **All TypeScript errors resolved** - Run `npm run check` locally

### Code Quality Standards
- [ ] **Explicit return types** for public APIs
- [ ] **Zod schemas** for runtime validation
- [ ] **Type guards** for unknown data (runtime checks)
- [ ] **Complete type definitions** - All required fields present
- [ ] **Schema-aligned types** - No field name mismatches (e.g., `website` vs `websiteUrl`)

### Test File Requirements
- [ ] **Typed test variables** - Import types from `@shared/schema`
- [ ] **Complete mock objects** - All required fields for SafeUser, Product, etc.
- [ ] **Explicit field selection** - Never expose passwordHash in queries
- [ ] **Type-safe assertions** - Leverage IntelliSense in test expectations

### Advanced Patterns
- [ ] **Discriminated unions** for state machines
- [ ] **Generic constraints** for reusable code
- [ ] **Strict mode** enabled in tsconfig
- [ ] **Error handling** with unknown type
- [ ] **Utility types** - Leverage Pick, Omit, Partial appropriately

### Date Testing Patterns
- [ ] **Timezone-safe test dates** - Use noon UTC to prevent date shifts
- [ ] **1-based month utilities** - Use `createTestDate()` for intuitive month handling
- [ ] **Boundary date testing** - Test Jan 1, Dec 31, Feb 29 edge cases
- [ ] **Avoid date-only strings** - Never use `new Date('2025-01-15')` in tests
- [ ] **ISO with time component** - Use `'2025-01-15T12:00:00Z'` for API tests

---

## Date Testing Patterns (CRITICAL for Timezone Safety)

### The Timezone Problem

**Issue**: JavaScript `new Date('2025-01-15')` creates midnight UTC, which becomes the previous day in western timezones (PST, EST) when formatted with `toLocaleDateString()`.

```typescript
// ❌ WRONG - Timezone-sensitive (fails in PST)
const date = new Date('2025-01-15'); // Midnight UTC
date.toLocaleDateString('en-US'); // "Jan 14, 2025" in PST ❌

// ✅ CORRECT - Timezone-safe (works everywhere)
const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // Noon UTC
date.toLocaleDateString('en-US'); // "Jan 15, 2025" in all timezones ✅
```

### Chrome Extension Test Date Utilities

For Chrome extension tests, use the timezone-safe utility functions:

```typescript
import { createTestDate, createTestDateISO, TEST_DATES } from '../helpers/test-dates.js';

// ✅ BEST - Intuitive 1-based months
const date = createTestDate(2025, 1, 15); // Jan 15, 2025 (1 = January)

// ✅ GOOD - ISO string with noon UTC
const isoDate = createTestDateISO(2025, 1, 15); // "2025-01-15T12:00:00.000Z"

// ✅ CONVENIENT - Pre-defined boundary dates
const yearStart = TEST_DATES.YEAR_START; // Jan 1, 2025
const yearEnd = TEST_DATES.YEAR_END; // Dec 31, 2024
const leapDay = TEST_DATES.LEAP_YEAR_FEB_29; // Feb 29, 2024
```

### Server-Side Test Date Pattern

For server-side tests (not using Chrome extension utilities):

```typescript
// ✅ CORRECT - Direct Date.UTC() with noon time
const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // 0 = January

// ✅ ALSO CORRECT - ISO string with time component
const isoDate = '2025-01-15T12:00:00Z'; // Noon UTC
```

### Why Noon UTC?

**Noon (12:00:00) UTC prevents date shifts across all world timezones:**

- **UTC-12 (Baker Island)**: Noon UTC → Midnight local (still Jan 15) ✅
- **PST (UTC-8)**: Noon UTC → 4 AM local (still Jan 15) ✅
- **UTC**: Noon UTC → Noon local (still Jan 15) ✅
- **AEST (UTC+11)**: Noon UTC → 11 PM local (still Jan 15) ✅
- **UTC+14 (Kiribati)**: Noon UTC → 2 AM next day local (still Jan 15) ✅

With a 12-hour buffer, the date remains stable across all timezone conversions.

### Boundary Date Testing

Always test critical date boundaries:

```typescript
describe('date formatting', () => {
  it('should handle year boundaries', () => {
    // Jan 1 - Year start
    const jan1 = createTestDate(2025, 1, 1);
    expect(formatDate(jan1)).toMatch(/Jan.*1.*2025/);

    // Dec 31 - Year end
    const dec31 = createTestDate(2024, 12, 31);
    expect(formatDate(dec31)).toMatch(/Dec.*31.*2024/);
  });

  it('should handle leap year dates', () => {
    // Feb 29 exists in leap years
    const leapDay = createTestDate(2024, 2, 29);
    expect(formatDate(leapDay)).toMatch(/Feb.*29.*2024/);
  });
});
```

### Date Testing Anti-Patterns

```typescript
// ❌ NEVER - Date-only string (timezone-sensitive)
const date = new Date('2025-01-15'); // Midnight UTC → Jan 14 in PST

// ❌ NEVER - Local timezone constructor
const date = new Date(2025, 0, 15); // Local midnight, inconsistent

// ❌ WRONG - Assuming CI/CD runs in UTC
// Tests may fail in different CI environments

// ✅ CORRECT - Explicit UTC with noon time
const date = new Date(Date.UTC(2025, 0, 15, 12, 0, 0));

// ✅ BETTER - Use utility function (Chrome extension)
const date = createTestDate(2025, 1, 15);
```

### CI/CD Timezone Context

**CRITICAL**: CI/CD environments may run in different timezones:

- **GitHub Actions**: Depends on runner location (not always UTC)
- **GitLab CI**: Configurable per project
- **CircleCI**: Depends on executor configuration
- **Developer Machine**: Local timezone (varies by developer)

**Always use timezone-safe patterns** to ensure tests pass in all environments.

### Quick Reference

| Pattern | Timezone-Safe? | Use Case |
|---------|----------------|----------|
| `createTestDate(2025, 1, 15)` | ✅ Yes | **Preferred** - Chrome extension tests |
| `Date.UTC(2025, 0, 15, 12, 0, 0)` | ✅ Yes | **Good** - Server tests (noon UTC) |
| `'2025-01-15T12:00:00Z'` | ✅ Yes | **Good** - ISO with time |
| `Date.UTC(2025, 0, 15)` | ⚠️ Maybe | **Risky** - Midnight UTC may shift |
| `new Date('2025-01-15')` | ❌ No | **Never** - Midnight UTC, shifts date |
| `new Date(2025, 0, 15)` | ❌ No | **Never** - Local midnight |

**See Also**: `docs/LEARNINGS_TODO_176_TIMEZONE_DATE_TESTS.md` - Complete timezone testing guide

---

## Native Browser API Binding (CRITICAL - E2E Test Pattern)

**Added:** 2025-12-11 (Phase 1.1 E2E Test Expansion)

Native browser APIs (fetch, setTimeout, XMLHttpRequest, etc.) require `this` to be bound to `window`. When intercepting or storing these APIs in refs/variables, you MUST use `.call(window, ...)` or `.bind(window)` to maintain the binding context.

**Why This Matters:**
- Arrow functions capture `this` from enclosing scope, not call site
- Storing native API references loses `this` binding
- Calling without proper binding causes "Illegal invocation" errors
- Playwright E2E tests catch these binding issues that manual testing may miss

### The Problem

When you intercept global browser APIs (e.g., to add logging, rate limiting, or header extraction), storing the original reference and calling it directly loses the `this` binding:

```typescript
// ❌ WRONG - Lost `this` binding causes "Illegal invocation"
const originalFetchRef = useRef<typeof fetch | null>(null);

useEffect(() => {
  originalFetchRef.current = window.fetch;

  const interceptedFetch: typeof fetch = async (input, init?) => {
    // Pre-processing logic...
    const response = await originalFetchRef.current(input, init); // ❌ ILLEGAL INVOCATION!
    // Post-processing logic...
    return response;
  };

  window.fetch = interceptedFetch;
}, []);
```

**Error:**
```
Failed to execute 'fetch' on 'Window': Illegal invocation
```

### Anti-Pattern

```typescript
// ❌ WRONG - Arrow function doesn't preserve native API binding
const myFetch = async (url: string) => {
  const originalFetch = window.fetch; // Stored reference
  return originalFetch(url); // ❌ Lost binding!
};

// ❌ WRONG - Direct call on stored ref
const fetchRef = window.fetch;
fetchRef('/api/data'); // ❌ Illegal invocation

// ❌ WRONG - Even storing in React ref doesn't help
const originalFetchRef = useRef(window.fetch);
originalFetchRef.current(input, init); // ❌ Still lost binding
```

### Correct Patterns

#### Pattern 1: Use `.call(window, ...)` (Recommended)

```typescript
// ✅ CORRECT - Explicit .call(window, ...) maintains binding
export function useRateLimit(): RateLimitInfo {
  const originalFetchRef = useRef<typeof fetch | null>(null);

  useEffect(() => {
    // Store original
    if (!originalFetchRef.current) {
      originalFetchRef.current = window.fetch;
    }

    // Intercept with proper binding
    const interceptedFetch: typeof fetch = async (input, init?) => {
      if (!originalFetchRef.current) {
        throw new Error('Rate limit hook: Fetch ref not initialized...');
      }

      // CRITICAL: Use .call(window, ...) to maintain proper 'this' binding
      // Without this, fetch throws "Illegal invocation" error in Playwright tests
      const response = await originalFetchRef.current.call(window, input, init);

      // Extract headers or process response...
      return response;
    };

    // Replace global fetch
    window.fetch = interceptedFetch;

    // Cleanup: restore original on unmount
    return () => {
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, []);

  return rateLimit;
}
```

#### Pattern 2: Use `.bind(window)` Once

```typescript
// ✅ ALSO CORRECT - Bind once, reuse bound function
const originalFetch = window.fetch;
const boundFetch = originalFetch.bind(window);

const interceptedFetch = async (input: RequestInfo, init?: RequestInit) => {
  // Pre-processing...
  const response = await boundFetch(input, init); // ✅ Binding preserved
  // Post-processing...
  return response;
};
```

### React Hook Pattern (Complete Example)

```typescript
// ✅ CORRECT - Complete React hook with native API interception
import { useState, useEffect, useRef } from 'react';

export function useApiInterceptor() {
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const originalApiRef = useRef<typeof window.fetch | null>(null);

  useEffect(() => {
    // Store original API if not already stored
    if (!originalApiRef.current) {
      originalApiRef.current = window.fetch;
    }

    // Create interceptor with proper binding
    const intercepted: typeof fetch = async (input, init?) => {
      // Explicit null check (better than non-null assertion)
      if (!originalApiRef.current) {
        throw new Error('API ref not initialized - timing issue in hook lifecycle');
      }

      // ✅ CRITICAL: Use .call(window, ...) to maintain 'this' binding
      const response = await originalApiRef.current.call(window, input, init);

      // Extract metadata from response
      const customHeader = response.headers.get('X-Custom-Header');
      if (customHeader) {
        setMetadata(prev => ({ ...prev, custom: customHeader }));
      }

      return response;
    };

    // Replace global API
    window.fetch = intercepted;

    // Cleanup: restore original on unmount
    return () => {
      if (originalApiRef.current) {
        window.fetch = originalApiRef.current;
      }
    };
  }, []);

  return metadata;
}
```

### Detection Rules

```bash
# Find global API interception (potential binding issues)
grep -rn "window.fetch =" client/src --include="*.ts" --include="*.tsx"
grep -rn "window.setTimeout =" client/src --include="*.ts"
grep -rn "window.XMLHttpRequest =" client/src --include="*.ts"

# Find stored API refs without .call() or .bind()
grep -A5 "Ref.*window\.fetch" client/src --include="*.ts" --include="*.tsx" | grep -v "\.call\|\.bind"

# Find React hooks that modify global objects
grep -rn "window\.\w* =" client/src/hooks --include="*.ts"
```

### Why Playwright Catches This

**Observation:** "Illegal invocation" errors often manifest in Playwright E2E tests but not in manual browser testing.

**Reasons:**
- Playwright's browser automation has stricter enforcement of `this` binding
- Manual testing may avoid code paths with problematic hooks (useRateLimit may not activate in dev mode)
- React Query's automatic retries may mask the issue with successful subsequent calls
- Development vs production builds handle binding differently

**Implication:** E2E tests provide critical safety net for binding issues that slip through manual QA.

### Related Patterns

**Native APIs That Require Binding:**
- `window.fetch` - HTTP requests
- `window.setTimeout` / `window.setInterval` - Timers
- `window.XMLHttpRequest` - Legacy HTTP
- `window.requestAnimationFrame` - Animation timing
- `window.localStorage.getItem` / `setItem` - Storage APIs
- `console.log` / `console.error` - Logging (when aliased)

**When You DON'T Need This:**
- Calling APIs directly: `window.fetch(...)` - binding is implicit
- Standard React hooks: `useState`, `useEffect` - not browser APIs
- Custom functions/services - only apply to native browser APIs

### See Also

- **`docs/LEARNINGS_PHASE_1_1_USERATEFIMIT_FETCH_BINDING.md`** - Complete investigation of this pattern with root cause analysis
- **`client/src/hooks/useRateLimit.ts`** - Production example at line 90
- **`docs/08_TESTING_PATTERNS.md`** - E2E test patterns with Playwright
- **`docs/05_FRONTEND_PATTERNS.md`** - React hooks patterns

---

## JSDoc Documentation for Unused Code (NEW - 2025-12-23)

### Pattern: Documenting Future-Use Methods

**Context:** Storage layer methods or utility functions that are currently unused but have clear future use cases planned.

**Problem:** Code cleanup tools and developers may delete unused methods without understanding their future purpose, requiring reimplementation later. Without documentation, it's unclear whether unused code is:
- Dead code safe to delete
- Placeholder for planned features
- Part of interface compliance

**Preferred Pattern:**

```typescript
/**
 * Count alerts for a specific user and product
 *
 * Currently unused but available for future features such as:
 * - Per-product alert limits (e.g., max 5 alerts per product)
 * - Alert deduplication (prevent multiple alerts for same price point)
 *
 * @param userId - User ID to count alerts for
 * @param productId - Product ID to filter by
 * @returns Number of active alerts for the user and product
 */
async countUserAlertsForProduct(userId: number, productId: number): Promise<number> {
  // Input validation: Prevent invalid queries
  if (!userId || userId < 1) {
    throw new Error(`Invalid userId: ${userId}`);
  }
  if (!productId || productId < 1) {
    throw new Error(`Invalid productId: ${productId}`);
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.productId, productId)
    ));

  // Type assertion: Drizzle's sql<number> returns count(*) as number at runtime
  return Number(result[0].count);
}
```

**Anti-Pattern:**

```typescript
// ❌ WRONG - No documentation about future use
async countUserAlertsForProduct(userId: number, productId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(priceAlerts)
    .where(and(
      eq(priceAlerts.userId, userId),
      eq(priceAlerts.productId, productId)
    ));
  return Number(result[0].count);
}
// Problem: Looks like dead code, likely to be deleted during cleanup

// ❌ WRONG - Vague or incomplete documentation
/**
 * Count alerts for product
 * TODO: Use this later
 */
async countUserAlertsForProduct(userId: number, productId: number): Promise<number> {
  // ...
}
// Problem: Doesn't explain WHY or WHEN it will be used

// ❌ WRONG - Only inline comment
async countUserAlertsForProduct(userId: number, productId: number): Promise<number> {
  // This will be needed for per-product limits
  const result = await db.select(...);
  return Number(result[0].count);
}
// Problem: Not visible in IDE hover tooltips, easy to miss
```

**Rationale:**

- **Preservation**: Documents intent so future developers know not to delete
- **Visibility**: JSDoc appears in IDE tooltips when method is referenced
- **Planning**: Makes future feature requirements visible in code
- **Interface Compliance**: Explains why interface methods exist even if unused
- **Searchability**: `grep "Currently unused"` finds all placeholder methods
- **Maintenance**: Prevents "delete unused code" PRs from removing needed methods

**JSDoc Format Guidelines:**

1. **First line**: Brief description of what method does
2. **"Currently unused" clause**: Explicit statement that method is not yet used
3. **Future use cases**: Bullet list of specific features that will need it
4. **Standard JSDoc tags**: `@param`, `@returns`, `@throws` as appropriate

**When to Use:**

- Storage layer methods required by IStorage interface but not yet called
- Utility functions built for upcoming features
- Methods that complete a logical API surface (e.g., CRUD operations with only CR implemented)
- Interface implementations with placeholder methods

**When NOT to Use:**

- Truly dead code with no planned use - just delete it
- Code temporarily commented out during debugging
- Failed experiments or abandoned approaches
- Methods that are actually used (even if only in tests)

**Related:**
- See `02_DATABASE_PATTERNS.md` Section 1 for IStorage interface compliance
- See `docs/LEARNINGS_TODO_178_STORAGE_LAYER_MIGRATION_COMPLETENESS.md` for storage layer documentation patterns
- See `.eslintrc.json` for `no-unused-vars` rule configuration (warnings, not errors)

**Source:** Commits ce38f21 and e0cfe72, 2025-12-23

---

## Pattern: Type Assertion Documentation (CLAUDE.md Compliance)

**Context:** Password reset security fix code review (Dec 2025)

**Problem:** Type assertions (`as` keyword) without explanatory comments, violating CLAUDE.md requirement.

### CLAUDE.md Requirement

**ALL type assertions MUST have inline comment explaining WHY.**

### The Anti-Pattern

```typescript
// ❌ WRONG - No comment explaining the cast
const row = result.rows[0] as unknown;
const tokenData = row as { id: number; user_id: number };
```

### The Solution

```typescript
// ✅ CORRECT - Both casts documented
// Type assertion: Drizzle sql.execute() returns unknown rows, must check existence before narrowing type
const row = result.rows[0] as unknown;
if (!row) throw new Error('Invalid token');

// Type assertion: Map PostgreSQL snake_case to camelCase
const tokenData = row as { id: number; user_id: number };
```

### Comment Templates

```typescript
// Type assertion: <Framework/library> returns <original type>, <reason for cast>
// Type assertion: Map <source format> to <target format>
// Type assertion: Runtime check guarantees <safety condition>
// Type assertion: Validated by <validation method> before this point
// Type assertion: DOM structure ensures <element type>
```

### Common Scenarios

```typescript
// ✅ Framework returns unknown/any (Drizzle, raw SQL)
// Type assertion: Drizzle sql.execute() returns unknown, must narrow to expected type
const result = dbResult as { id: number; name: string };

// ✅ PostgreSQL snake_case to TypeScript camelCase
// Type assertion: Map PostgreSQL column names to TypeScript interface
const user = dbRow as { userId: number; userName: string };

// ✅ DOM element types
// Type assertion: We know this element is a button from HTML structure
const button = event.target as HTMLButtonElement;

// ❌ WRONG - Hiding type error instead of fixing
const result = dangerousOperation() as any; // Code smell!
```

### Review Checklist

- [ ] Every `as` cast has inline comment
- [ ] Comment explains WHY, not just WHAT
- [ ] Comment documents safety guarantee
- [ ] No `as any` without extremely strong justification
- [ ] Framework quirks documented (Drizzle unknown, PostgreSQL snake_case)

**Real-World Example:** `server/storage/domains/user-storage.ts:325-334`

---

## Pattern: Module-Level Imports vs Dynamic Imports (Fail-Fast Principle)

**Context:** Password reset security fix code review (Dec 2025)

**Problem:** Using dynamic imports (`await import()`) for always-used modules, deferring import errors to runtime instead of app startup.

### The Fail-Fast Principle

**Detect errors at app startup, not during user operations.**

### The Anti-Pattern

```typescript
// ❌ WRONG - Dynamic import during password reset
export async function resetPasswordAtomic(token: string, newPasswordHash: string): Promise<number> {
  const userId = await storage.resetPasswordAtomic(token, newPasswordHash);

  // Dynamic import - error happens DURING password reset!
  try {
    const { clearUserSessions } = await import('../utils/session-cleanup');
    await clearUserSessions(userId);
  } catch (sessionError) {
    // What if import() fails due to typo, missing file, syntax error?
    // User sees error during password reset!
  }

  return userId;
}
```

**What Happens:**
1. App starts successfully (no import errors detected)
2. User requests password reset
3. Password reset completes
4. Dynamic import fails (file not found, syntax error)
5. **User sees error** even though password was reset

### The Solution

```typescript
// ✅ CORRECT - Top-level import
import { clearUserSessions } from '../utils/session-cleanup';

export async function resetPasswordAtomic(token: string, newPasswordHash: string): Promise<number> {
  const userId = await storage.resetPasswordAtomic(token, newPasswordHash);

  // Use imported function (import errors detected at app startup)
  try {
    await clearUserSessions(userId);
  } catch (sessionError) {
    // Only runtime Redis errors reach here, not import errors
    logger.error('[PasswordReset] Failed to clear sessions', { userId, error: sessionError });
  }

  return userId;
}
```

**Benefits:**
1. **Startup-time detection** - Import errors prevent app from starting
2. **Immediate feedback** - Developer sees error when running app
3. **No user impact** - Import errors never reach production users
4. **Simpler code** - No dynamic import boilerplate
5. **Better IDE support** - Auto-import, jump-to-definition work

### When to Use Dynamic Import (Legitimate Cases)

```typescript
// ✅ CORRECT - Lazy-load heavy dependency (code splitting)
async function generatePDF(data: ReportData) {
  const { generateReport } = await import('../utils/pdf-generator'); // Large library
  return generateReport(data);
}

// ✅ CORRECT - Conditional feature loading
if (process.env.ENABLE_ANALYTICS === 'true') {
  const analytics = await import('../services/analytics');
  analytics.init();
}

// ✅ CORRECT - Plugin system (dynamic paths)
async function loadPlugin(pluginName: string) {
  const plugin = await import(`../plugins/${pluginName}`);
  return plugin.activate();
}

// ❌ WRONG - Always-used utility (should be top-level)
async function resetPassword(token: string) {
  const { clearUserSessions } = await import('../utils/session-cleanup');
  // This utility is ALWAYS used, not conditional
}
```

### Decision Framework

| Scenario | Use Module Import | Use Dynamic Import |
|----------|-------------------|-------------------|
| Always-used utility | ✅ YES | ❌ NO |
| Core business logic | ✅ YES | ❌ NO |
| Frequently called function | ✅ YES | ❌ NO |
| Large optional dependency | ❌ NO | ✅ YES |
| Conditional feature | ❌ NO | ✅ YES |
| Plugin/dynamic path | ❌ NO | ✅ YES |

### Review Checklist

- [ ] Dynamic imports only for large optional dependencies
- [ ] Core utilities use top-level imports
- [ ] Business logic functions use top-level imports
- [ ] No dynamic imports for always-used modules
- [ ] Dynamic imports have clear justification (code splitting, conditional)

**Real-World Example:** `server/services/password-reset-service.ts:5,163`

---

## Type Organization Patterns

### Single Source of Truth for Storage Types

**Context:** When defining types that represent storage layer return values.

**Problem:** Duplicate type definitions across multiple files cause type drift, merge conflicts, and IDE confusion.

**✅ Preferred Approach:**
```typescript
// server/storage/types.ts - CANONICAL LOCATION
export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

export interface ProductWithOffers extends Product {
  offers: ProductOffer[];
  lowestPrice: number;
}

// server/storage/domains/watchlist-storage.ts
import type { WatchListWithStats } from '../types';

class WatchListStorage {
  async getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]> {
    // Uses imported type
  }
}

// server/services/community-service.ts
import type { WatchListWithStats } from '../storage/types';

export async function getUserWatchLists(userId: number): Promise<WatchListWithStats[]> {
  // Uses same imported type
}
```

**❌ Anti-Pattern (Avoid):**
```typescript
// ❌ BAD - Duplicate in community-service.ts
interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

// ❌ BAD - Another duplicate in storage.ts
export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

// ❌ BAD - Yet another in watchlist-storage.ts
interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;  // Now three definitions exist!
}
```

**Rationale:**
- **Type Safety:** Prevents divergence where one file adds a field others don't have
- **Maintainability:** Update type once, all consumers automatically updated
- **Discoverability:** Clear convention: storage types live in `storage/types.ts`
- **IDE Support:** Auto-import suggestions from single canonical source
- **Refactoring:** TypeScript compiler catches ALL usages during refactors

**File Organization:**
```
server/
├── storage/
│   ├── types.ts              ← ALL storage return types
│   ├── domains/
│   │   ├── watchlist-storage.ts   ← Import from ../types
│   │   ├── product-storage.ts     ← Import from ../types
│   │   └── user-storage.ts        ← Import from ../types
│   └── storage.ts             ← Import from ./types
└── services/
    ├── community-service.ts   ← Import from ../storage/types
    └── product-service.ts     ← Import from ../storage/types
```

**Migration Checklist:**
1. Search for duplicates: `grep -r "interface WatchListWithStats" server/`
2. Move canonical definition to `server/storage/types.ts`
3. Replace all duplicates with: `import type { WatchListWithStats } from '../storage/types'`
4. Run `npm run check` to verify no type errors
5. Commit with message referencing this pattern

**When This Pattern Applies:**
- ANY type returned by a storage method
- Types extending database schema types (WatchList, Product, User)
- Composite types combining multiple entities
- Response shapes used by multiple services

**Exception:**
```typescript
// Local-only types can stay in the file that uses them
interface LocalAggregation {
  sum: number;
  count: number;
  // Only used in this file's implementation
}
```

**Related Patterns:**
- [Utility Type Patterns](#utility-type-patterns) - When to use Pick, Omit, etc.
- [Type Inference Patterns](#type-inference-patterns) - When to let TypeScript infer
- [02_DATABASE_PATTERNS.md: Storage Layer Architecture](#) - Storage layer design

*Source: TODO 003 - Found WatchListWithStats duplicated in 3 files (storage.ts, community-service.ts, watchlist-storage.ts)*
*Added: 2026-01-04*

---

## Maintenance Documentation for Synchronized Lists (NEW - 2026-01-06)

**Context:** Lists that must stay synchronized with external sources (schema definitions, API specs, configuration files, enums) need clear maintenance instructions so developers know WHEN and HOW to update them.

**Problem:**
Without structured maintenance documentation, synchronized lists drift out of sync with their source of truth, leading to incomplete validation, missing features, or silent failures. Tests may pass while coverage degrades.

**Real-World Example (TODO_012):**

In E2E test helpers, `EXPECTED_TABLES` must stay synchronized with `shared/schema.ts`. Initial implementation had 27 tables, but schema defined 41 - a 34% coverage gap that tests didn't catch.

**✅ Preferred Approach - Structured Maintenance Documentation:**

```typescript
/**
 * Expected tables in test database schema
 *
 * CRITICAL MAINTENANCE RULE:
 * When adding new migrations that create tables:
 * 1. Add the table name to this list (keep alphabetically sorted)
 * 2. Commit the list update in the SAME commit as the migration
 * 3. Table names must match pgTable definitions in shared/schema.ts
 *
 * Currently tracking 41 tables (as of schema.ts audit 2026-01-06)
 *
 * Verification:
 * grep "pgTable" shared/schema.ts | wc -l  → Should equal 41
 *
 * See: CLAUDE.md "Test Schema Synchronization"
 */
const EXPECTED_TABLES = [
  'agent_sessions',
  'badges',
  'comments',
  // ... (keep alphabetically sorted for easy diffing)
] as const satisfies readonly string[];
```

**Documentation Template:**

```typescript
/**
 * [Description of what this list represents]
 *
 * CRITICAL MAINTENANCE RULE:
 * When [triggering event]:
 * 1. [Step 1 - what to do]
 * 2. [Step 2 - when to commit]
 * 3. [Step 3 - how to verify]
 *
 * Currently tracking [COUNT] [items] (as of [AUDIT_DATE])
 *
 * Verification:
 * [command to verify completeness]
 *
 * See: [link to relevant documentation]
 */
const SYNCHRONIZED_LIST = [
  // Keep alphabetically sorted for easy diffing
] as const satisfies readonly TYPE[];
```

**❌ Anti-Pattern (Avoid):**

```typescript
// ❌ WRONG - No maintenance documentation
const EXPECTED_TABLES = ['users', 'products', 'retailers'];
// Questions this raises:
// - When should this list be updated?
// - What's the source of truth?
// - How do I verify it's complete?
// - What happens if I forget to update it?

// ❌ WRONG - Incomplete documentation
/**
 * List of expected tables
 */
const EXPECTED_TABLES = ['users', 'products']; // Missing: count, date, verification

// ❌ WRONG - Documentation without actionable steps
/**
 * Keep this list in sync with schema.ts
 */
const EXPECTED_TABLES = ['users', 'products'];
// "Keep in sync" is vague - WHEN do I update? HOW do I verify?
```

**Key Documentation Elements:**

1. **"CRITICAL MAINTENANCE RULE"** Header
   - Searchable with `grep "CRITICAL MAINTENANCE" server/`
   - Signals importance to developers
   - Makes maintenance process discoverable

2. **"When [event]"** Trigger Condition
   - Explicitly states when updates are needed
   - Examples: "When adding migrations", "When adding API endpoints", "When adding feature flags"
   - Prevents forgotten updates

3. **Numbered Action Steps**
   - Clear, actionable instructions
   - Order matters (e.g., "commit in SAME commit as migration")
   - No ambiguity about what to do

4. **Count and Audit Date**
   - "Currently tracking 41 tables (as of 2026-01-06)"
   - Enables quick completeness checks
   - Shows when list was last verified
   - Helps identify stale documentation

5. **Verification Command**
   - Concrete shell command to verify completeness
   - Example: `grep "pgTable" shared/schema.ts | wc -l`
   - Enables self-service validation
   - Can be automated in CI/pre-commit hooks

6. **Cross-Reference to Detailed Docs**
   - Link to CLAUDE.md section or ADR
   - Provides context and rationale
   - Points to related patterns

7. **Alphabetical Sorting**
   - Makes diffs clear (additions/removals obvious)
   - Easier to spot duplicates
   - Simplifies manual verification
   - Standard practice for maintainability

**When to Use This Pattern:**

Apply structured maintenance documentation to:

- ✅ **Schema-synchronized lists** (tables, columns, constraints)
- ✅ **Enum mappings** (status → string, role → permissions)
- ✅ **Feature flag registries**
- ✅ **API endpoint lists** (route registrations, OpenAPI specs)
- ✅ **Integration configurations** (supported providers, API versions)
- ✅ **Permission/role definitions**
- ✅ **Validation rules** (password strength, input constraints)
- ✅ **Test fixtures** (expected values, mock data)

**When NOT to Use:**

- ❌ **Derived data** (calculated from other sources at runtime)
- ❌ **Single-use constants** (not referenced elsewhere)
- ❌ **Self-documenting code** (obvious from context)
- ❌ **Framework internals** (not under our control)

**Example: Enum Mapping with Maintenance Documentation:**

```typescript
/**
 * User role to permission mapping
 *
 * CRITICAL MAINTENANCE RULE:
 * When adding new roles to UserRole enum (shared/schema.ts):
 * 1. Add role to this mapping with appropriate permissions
 * 2. Update getRolePermissions() in auth-service.ts
 * 3. Add test case in auth-service.test.ts
 *
 * Currently tracking 4 roles (as of 2026-01-06)
 *
 * Verification:
 * Check shared/schema.ts UserRole enum matches keys below
 *
 * See: docs/04_SECURITY_PATTERNS.md "Role-Based Access Control"
 */
const ROLE_PERMISSIONS = {
  admin: ['read', 'write', 'delete', 'manage_users'],
  moderator: ['read', 'write', 'delete'],
  user: ['read', 'write'],
  guest: ['read'],
} as const satisfies Record<UserRole, readonly Permission[]>;
```

**Example: API Endpoint Registry with Maintenance Documentation:**

```typescript
/**
 * All API endpoints for OpenAPI documentation generation
 *
 * CRITICAL MAINTENANCE RULE:
 * When adding new routes to server/routes/:
 * 1. Add endpoint definition to this registry
 * 2. Include method, path, auth requirement, description
 * 3. Keep grouped by domain (auth, products, users, etc.)
 *
 * Currently tracking 217 endpoints (as of 2026-01-06)
 *
 * Verification:
 * grep -r "app\.(get|post|put|patch|delete)" server/routes/ | wc -l
 *
 * See: docs/API_DOCUMENTATION.md
 */
const API_ENDPOINTS = [
  // Auth endpoints
  { method: 'POST', path: '/api/auth/register', auth: false, description: 'Register new user' },
  { method: 'POST', path: '/api/auth/login', auth: false, description: 'User login' },
  // ... grouped by domain
] as const;
```

**Rationale:**

**Why This Pattern Matters:**

1. **Prevents Silent Drift**
   - Without documentation: Lists drift, tests pass, coverage degrades
   - With documentation: Clear process for updates, verification command available

2. **Self-Service Verification**
   - Developers can verify completeness without code review
   - Verification command enables automation (CI checks)

3. **Onboarding Tool**
   - New developers know when/how to update synchronized lists
   - Reduces "tribal knowledge" dependency

4. **Audit Trail**
   - Count and date show last verification
   - Easy to identify stale documentation

5. **Prevents Forgotten Updates**
   - Explicit trigger condition ("When adding migrations")
   - Step 2 often includes "commit in SAME commit" to enforce atomicity

**Consequences of Missing Maintenance Documentation:**

- ❌ **Silent coverage degradation** (TODO_012: 27/41 tables = 66% coverage)
- ❌ **Forgotten updates** (new feature added, list not updated)
- ❌ **False positives** (tests pass, validation incomplete)
- ❌ **Hard to maintain** (no clear owner or process)
- ❌ **Difficult debugging** (why is feature X not validated?)

**Integration with Other Patterns:**

This pattern works with:

- **[Data Completeness Validation Pattern](#)** (08_TESTING_PATTERNS.md) - What to document
- **[Two-Phase Code Review Pattern](#)** (09_CODE_REVIEW_PATTERNS.md) - When to verify
- **[Storage Layer Types Pattern](#centralize-storage-return-types-in-storagetypests-new---2026-01-04)** - Type definitions
- **Pre-commit hooks** - Can automate verification commands

**Automation Opportunity:**

```bash
# Pre-commit hook can verify list completeness
echo "Verifying EXPECTED_TABLES completeness..."
SCHEMA_COUNT=$(grep "pgTable" shared/schema.ts | wc -l | tr -d ' ')
CODE_COUNT=$(grep "EXPECTED_TABLES\.length" e2e/helpers.ts | grep -o "[0-9]\+")

if [ "$SCHEMA_COUNT" != "$CODE_COUNT" ]; then
  echo "❌ EXPECTED_TABLES count ($CODE_COUNT) doesn't match schema.ts ($SCHEMA_COUNT)"
  echo "Run: grep 'export const.*= pgTable' shared/schema.ts"
  exit 1
fi
```

**Checklist for Adding Maintenance Documentation:**

When creating/updating a synchronized list:

- [ ] Add "CRITICAL MAINTENANCE RULE" header
- [ ] Document triggering condition ("When...")
- [ ] Provide numbered action steps (what to do)
- [ ] Include current count with audit date
- [ ] Provide verification command
- [ ] Link to detailed documentation
- [ ] Keep list alphabetically sorted
- [ ] Consider automating verification in pre-commit hook

**Related Patterns:**

- [08_TESTING_PATTERNS.md: Data Completeness Validation](#) - Testing synchronized lists
- [09_CODE_REVIEW_PATTERNS.md: Two-Phase Code Review](#) - Verifying completeness via review
- [02_DATABASE_PATTERNS.md: Schema Synchronization](#) - Database-specific sync patterns

*Source: TODO_012 - EXPECTED_TABLES had 27/41 tables due to missing maintenance documentation*
*Added: 2026-01-06*

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [02_DATABASE_PATTERNS.md](02_DATABASE_PATTERNS.md) - Database type patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Type checking enforcement
- [tsconfig.json](../tsconfig.json) - TypeScript configuration

---

**Maintained By:** Development Team
**Next Review:** 2025-12-29
