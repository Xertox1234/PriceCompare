# TypeScript Strict Mode Rules for Claude Code

**CRITICAL**: These rules are MANDATORY and enforced by ESLint + pre-commit hooks. Violations will block commits.

## Rule 1: NEVER Use `any` Type

**Status**: Hard block via ESLint `@typescript-eslint/no-explicit-any: error`

### ❌ FORBIDDEN
```typescript
let data: any;
function process(item: any): any { }
const items: any[] = [];
const config = {} as any;
```

### ✅ REQUIRED
Always use one of these type-safe alternatives:

#### 1. Specific Types or Interfaces
```typescript
interface Product {
  id: number;
  name: string;
  price: number;
}

let product: Product;
function processProduct(item: Product): number {
  return item.price;
}
```

#### 2. `unknown` for Truly Unknown Types
```typescript
// Forces type checking before use
function handleError(error: unknown): string {
  // MUST narrow type before accessing properties
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
```

#### 3. Generic Types for Reusable Functions
```typescript
function identity<T>(value: T): T {
  return value;
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  return response.json();
}
```

#### 4. Record Types for Dynamic Objects
```typescript
// Object with string keys and unknown values
const config: Record<string, unknown> = {};

// Type-safe key-value store
const settings: Record<string, string | number> = {
  apiUrl: 'https://api.example.com',
  timeout: 3000,
};
```

#### 5. Import Types from Schema
```typescript
// ALWAYS import from shared schema
import { type Product, type Retailer, type User, type SafeUser } from '@shared/schema';

// Test files
describe('Product Tests', () => {
  let testProduct: Product;  // Not 'any'!
  let testRetailer: Retailer;
});
```

## Rule 2: Test Files Need Types Too

**Test files are held to the SAME standards as production code.**

### Why Tests Need Types
- Catch breaking API changes at compile time
- Document expected data structures
- Enable refactoring with confidence
- Ensure mock accuracy

### ❌ FORBIDDEN in Tests
```typescript
describe('My Test', () => {
  let testData: any;      // NO!
  let mockUser: any;      // NO!
  let response: any;      // NO!
});
```

### ✅ REQUIRED in Tests
```typescript
import { type Product, type SafeUser } from '@shared/schema';

describe('Product API', () => {
  let testProduct: Product;
  let testUser: SafeUser;

  beforeEach(async () => {
    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Description',
      // TypeScript enforces all required fields
    }).returning();
  });
});
```

## Rule 3: External Libraries Without Types

For external libraries that lack TypeScript definitions:

### 1. Check for @types Packages First
```bash
npm install --save-dev @types/library-name
```

### 2. Create Local Type Definitions
```typescript
// types/external-library.d.ts
declare module 'external-library' {
  export interface LibraryOptions {
    apiKey: string;
    timeout?: number;
  }

  export function initialize(options: LibraryOptions): void;
}
```

### 3. Use Module Augmentation
```typescript
// types/augmentations.d.ts
import 'express';

declare module 'express' {
  interface Request {
    user?: SafeUser;
  }
}
```

## Rule 4: Type Guards for Runtime Validation

When dealing with external data (API responses, user input), use type guards:

```typescript
// Type predicate function
function isProduct(data: unknown): data is Product {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    typeof (data as Product).id === 'number' &&
    typeof (data as Product).name === 'string'
  );
}

// Usage
function processData(data: unknown) {
  if (isProduct(data)) {
    // TypeScript knows data is Product here
    console.log(data.name);
  }
}
```

## Rule 5: Zod Schemas for Validation

Use Zod for runtime validation and type derivation:

```typescript
import { z } from 'zod';

const productSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(200),
  price: z.number().positive(),
});

// Derive TypeScript type from schema
type Product = z.infer<typeof productSchema>;

// Validate at runtime
const product = productSchema.parse(unknownData);
```

## Enforcement Layers

This project enforces type safety at multiple levels:

### 1. ESLint (Real-time)
- Runs in IDE with instant feedback
- Blocks `any` types immediately
- Prevents unsafe type operations

### 2. Pre-commit Hook (Commit-time)
- Runs `npm run check` (TypeScript compiler)
- Runs custom type safety checks
- Blocks commits with type errors

### 3. TypeScript Compiler (Build-time)
- Strict mode enabled in `tsconfig.json`
- All strict checks enabled
- Build fails on type errors

### 4. CI/CD Pipeline (Deploy-time)
- Type checking in continuous integration
- Prevents deployment of type-unsafe code

## Common Scenarios

### Scenario 1: API Response
```typescript
// ❌ WRONG
async function fetchUser(id: number): Promise<any> {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}

// ✅ CORRECT
async function fetchUser(id: number): Promise<SafeUser> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();
  return userSchema.parse(data); // Validates and types
}
```

### Scenario 2: Event Handlers
```typescript
// ❌ WRONG
function handleClick(event: any) {
  console.log(event.target.value);
}

// ✅ CORRECT
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  console.log(event.currentTarget.value);
}
```

### Scenario 3: Generic Collections
```typescript
// ❌ WRONG
const cache: any[] = [];

// ✅ CORRECT
const cache: Product[] = [];
// Or for mixed types:
const cache: Array<Product | User> = [];
// Or for truly dynamic:
const cache: unknown[] = [];
```

## Remember

1. **`any` disables TypeScript** - You lose all type safety
2. **Tests need types** - Same standards as production code
3. **`unknown` forces validation** - Safer than `any`
4. **Import from schema** - Don't duplicate type definitions
5. **ESLint will stop you** - If you try to use `any`, the linter will error immediately

## Quick Reference

| Situation | Use This | Not This |
|-----------|----------|----------|
| API response | `Promise<User>` + validation | `Promise<any>` |
| Unknown data | `unknown` + type guard | `any` |
| Test variables | `Product`, `SafeUser` | `any` |
| Generic function | `<T>` | `any` |
| Dynamic object | `Record<string, unknown>` | `any` |
| Error handling | `error: unknown` | `error: any` |

---

**Last Updated**: 2025-11-28
**Enforcement**: ESLint error + Pre-commit hook + TypeScript strict mode
**Exceptions**: NONE - No `any` types allowed anywhere in codebase
