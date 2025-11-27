---
Pattern: TypeScript Patterns & Anti-Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [DATABASE_PATTERNS.md, SECURITY_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md]
---

# TypeScript Patterns & Anti-Patterns

This document codifies TypeScript patterns to ensure type safety and prevent runtime errors in the PriceCompare codebase.

## Table of Contents
- [TypeScript Error Resolution Protocol](#typescript-error-resolution-protocol)
- [Critical Type Safety Violations](#critical-type-safety-violations)
- [Type Inference Patterns](#type-inference-patterns)
- [Zod Schema Patterns](#zod-schema-patterns)
- [React Component Patterns](#react-component-patterns)
- [Utility Type Patterns](#utility-type-patterns)
- [Error Type Handling](#error-type-handling)
- [Async/Await Patterns](#asyncawait-patterns)
- [Type Guards & Narrowing](#type-guards--narrowing)
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
```

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

## Async/Await Patterns

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

- [ ] **No `any` types** - Use `unknown` or specific types
- [ ] **No `@ts-ignore`** - Fix the actual issue
- [ ] **Explicit return types** for public APIs
- [ ] **Zod schemas** for runtime validation
- [ ] **Type guards** for unknown data
- [ ] **Discriminated unions** for state machines
- [ ] **Generic constraints** for reusable code
- [ ] **Strict mode** enabled in tsconfig
- [ ] **Error handling** with unknown type
- [ ] **Complete interfaces** with all properties

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Database type patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Type checking enforcement
- [tsconfig.json](../tsconfig.json) - TypeScript configuration