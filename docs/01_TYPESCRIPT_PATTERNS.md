# TypeScript Patterns & Anti-Patterns

**Version:** 2.1
**Last Updated:** 2025-12-04
**Domain:** TypeScript, Type Safety, Async/Await, Zod Validation
**Migrated From:**
- docs/TYPESCRIPT_PATTERNS.md (v1.0)
- docs/PHASE1_WATCHLIST_PATTERNS.md (Pattern 9: ESLint compliance)
- TODO 2026: Zod validation for CHECK constraints (v2.1)

---

This document codifies TypeScript patterns to ensure type safety and prevent runtime errors in the PriceCompare codebase.

## Table of Contents
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

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [02_DATABASE_PATTERNS.md](02_DATABASE_PATTERNS.md) - Database type patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Type checking enforcement
- [tsconfig.json](../tsconfig.json) - TypeScript configuration

---

**Maintained By:** Development Team
**Next Review:** 2025-12-29
