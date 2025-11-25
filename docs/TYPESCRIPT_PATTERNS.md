# TypeScript Patterns & Anti-Patterns

This document codifies TypeScript patterns to ensure type safety and prevent runtime errors in the PriceCompare codebase.

## Table of Contents
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

// If suppression is absolutely necessary, document why
// @ts-expect-error - Third-party library has incorrect types, see issue #123
const value = externalLib.actuallyExistsProperty;
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

### Explicit Return Types for Complex Methods (MANDATORY)

When a method returns complex data structures, ALWAYS add explicit return types:

#### ❌ WRONG - Implicit complex return type
```typescript
// Return type is hard to understand, prone to breaking changes
async getStats() {
  const hourlyCount = await this.getHourlyCount();
  const dailyCount = await this.getDailyCount();
  const topProducts = await this.getTopProducts(10);
  const topQueries = await this.getTopSearchQueries(10);

  return {
    trackedProducts: { hourly: hourlyCount, daily: dailyCount, weekly: 0 },
    trackedSearchQueries: topQueries.length,
    topProducts,
    topSearchQueries: topQueries,
  };
}
```

#### ✅ CORRECT - Explicit complex return type
```typescript
// Clear contract, self-documenting, refactoring-safe
async getStats(): Promise<{
  trackedProducts: { hourly: number; daily: number; weekly: number };
  trackedSearchQueries: number;
  topProducts: number[];
  topSearchQueries: Array<{ query: string; count: number }>;
}> {
  const hourlyCount = await this.getHourlyCount();
  const dailyCount = await this.getDailyCount();
  const topProducts = await this.getTopProducts(10);
  const topQueries = await this.getTopSearchQueries(10);

  return {
    trackedProducts: { hourly: hourlyCount, daily: dailyCount, weekly: 0 },
    trackedSearchQueries: topQueries.length,
    topProducts,
    topSearchQueries: topQueries,
  };
}
```

#### When to Add Explicit Return Types
1. **Public API methods** - All exported functions
2. **Complex return structures** - Objects with 3+ properties
3. **Nested objects** - Objects containing objects or arrays
4. **Generic or conditional returns** - Union types, generics
5. **Service class methods** - All public methods on service classes

#### Benefits
- Self-documenting code
- Catches accidental breaking changes at compile time
- Better IDE autocomplete and hover documentation
- Clearer contracts for consumers

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
```

### DRY Error Message Extraction (MANDATORY)

#### ❌ WRONG - Repeating error extraction pattern
```typescript
// THIS PATTERN REPEATED EVERYWHERE - VIOLATES DRY!
try {
  await operation1();
} catch (error) {
  logger.error('Op1 failed:', {
    error: error instanceof Error ? error.message : String(error)
  });
}

try {
  await operation2();
} catch (error) {
  logger.error('Op2 failed:', {
    error: error instanceof Error ? error.message : String(error)
  });
}
```

#### ✅ CORRECT - Use Centralized Helper
```typescript
// Use the shared helper from server/utils/error-helpers.ts
import { getErrorMessage } from '../utils/error-helpers';

try {
  await operation1();
} catch (error) {
  logger.error('Op1 failed:', { error: getErrorMessage(error) });
}

try {
  await operation2();
} catch (error) {
  logger.error('Op2 failed:', { error: getErrorMessage(error) });
}
```

#### Helper Implementation (server/utils/error-helpers.ts)
```typescript
/**
 * Extract error message from unknown error type
 *
 * Handles Error objects, strings, and other values safely.
 * Use in catch blocks to safely extract error messages for logging.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
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

## Redis Client Null Safety Pattern

### The Problem
Services that use Redis must handle the case where the client may not be available (development mode, initialization failure, or disconnection).

### ❌ WRONG - Direct Client Import
```typescript
// Direct import causes "possibly null" TypeScript errors
import { redisClient } from '../config/redis';

async function cacheData(key: string, value: string): Promise<void> {
  // TypeScript error: Object is possibly 'null'
  await redisClient.set(key, value);
}
```

### ✅ CORRECT - Use Getter with Null Check
```typescript
import { getRedisClient } from '../config/redis';

async function cacheData(key: string, value: string): Promise<void> {
  const redisClient = getRedisClient();
  if (!redisClient) {
    logger.warn('Redis not available, skipping cache operation');
    return;
  }

  await redisClient.set(key, value);
}
```

### Pattern for Services with Multiple Redis Operations
```typescript
import { getRedisClient } from '../config/redis';
import { createLogger } from '../utils/logger';
import { getErrorMessage } from '../utils/error-helpers';

const logger = createLogger('CacheService');

export class CacheService {
  async get(key: string): Promise<string | null> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        logger.warn('Redis not available, returning null');
        return null;
      }
      return await redisClient.get(key);
    } catch (error) {
      logger.error('Cache get failed:', {
        key,
        error: getErrorMessage(error)
      });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      const redisClient = getRedisClient();
      if (!redisClient) {
        logger.warn('Redis not available, skipping cache set');
        return;
      }

      if (ttl) {
        await redisClient.setex(key, ttl, value);
      } else {
        await redisClient.set(key, value);
      }
    } catch (error) {
      logger.error('Cache set failed:', {
        key,
        error: getErrorMessage(error)
      });
      // Don't throw - cache failures shouldn't break main operations
    }
  }
}
```

### Key Guidelines
1. **Always use `getRedisClient()`** - never import `redisClient` directly
2. **Check for null before every operation** - Redis may become unavailable
3. **Log warnings when Redis unavailable** - helps with debugging
4. **Provide sensible fallbacks** - return null/empty array, don't throw
5. **Include operation context in logs** - what key/operation failed
6. **Use contextual loggers** - `createLogger('ServiceName')` for traceability

---

## Contextual Logging Pattern

### The Problem
Generic logging makes it hard to trace issues back to specific services or modules.

### ❌ WRONG - Generic Logger
```typescript
import { logger } from '../utils/logger';

// In CacheService
logger.error('Failed to get data'); // Which service? Which operation?

// In SearchService
logger.error('Failed to get data'); // Same generic message!
```

### ✅ CORRECT - Contextual Logger
```typescript
import { createLogger } from '../utils/logger';

// In CacheService
const logger = createLogger('CacheService');
logger.error('Failed to get data', { key: 'product:123' });
// Output: [CacheService] Failed to get data { key: 'product:123' }

// In SearchService
const logger = createLogger('SearchService');
logger.error('Failed to get data', { query: 'iphone' });
// Output: [SearchService] Failed to get data { query: 'iphone' }
```

### Best Practices
```typescript
import { createLogger } from '../utils/logger';
import { getErrorMessage } from '../utils/error-helpers';

// Create logger at module level with service name
const logger = createLogger('PopularityTracker');

export class PopularityTracker {
  async trackProductView(productId: number): Promise<void> {
    try {
      // ... operation
    } catch (error) {
      // Include relevant context in error logs
      logger.error('Error tracking product view:', {
        productId,
        error: getErrorMessage(error)
      });
    }
  }

  async getStats(): Promise<Stats> {
    // Use appropriate log level
    logger.info('Fetching popularity stats');
    logger.debug('Stats request details', { timestamp: Date.now() });
    // ...
  }
}
```

### Logger Naming Conventions
- **Services**: `createLogger('ServiceName')` - e.g., 'PopularityTracker', 'PriceHistory'
- **Middleware**: `createLogger('Middleware:Name')` - e.g., 'Middleware:RateLimit'
- **Jobs**: `createLogger('Job:Name')` - e.g., 'Job:PriceSnapshot'
- **Routes**: Use route path as context - e.g., 'Routes:Products'

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
- [ ] **Explicit return types** for public APIs and complex methods
- [ ] **Zod schemas** for runtime validation
- [ ] **Type guards** for unknown data
- [ ] **Discriminated unions** for state machines
- [ ] **Generic constraints** for reusable code
- [ ] **Strict mode** enabled in tsconfig
- [ ] **Error handling** with unknown type
- [ ] **Complete interfaces** with all properties
- [ ] **DRY error extraction** - Use `getErrorMessage()` helper, not inline type guards
- [ ] **Redis null checks** - Use `getRedisClient()` with null guard in every method
- [ ] **Contextual logging** - Use `createLogger('ServiceName')` for traceable logs
- [ ] **Pipeline result validation** - Check if Redis pipeline.exec() returns null

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Database type patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Type checking enforcement
- [tsconfig.json](../tsconfig.json) - TypeScript configuration