# REST API Response Format Best Practices

**Research Document - Industry Standards & Patterns (2025)**

This document synthesizes best practices for REST API response formatting based on authoritative sources, RFCs, major API providers, and popular open-source frameworks.

---

## Table of Contents

1. [Response Envelope Patterns](#response-envelope-patterns)
2. [HTTP Status Code Best Practices](#http-status-code-best-practices)
3. [Pagination Metadata Conventions](#pagination-metadata-conventions)
4. [Error Response Format Standards](#error-response-format-standards)
5. [TypeScript Typing Patterns](#typescript-typing-patterns)
6. [Framework-Specific Patterns](#framework-specific-patterns)
7. [Frontend Consumption Patterns](#frontend-consumption-patterns)
8. [Migration Strategies](#migration-strategies)
9. [Implementation Examples](#implementation-examples)

---

## Response Envelope Patterns

### The Envelope Debate (2025 Consensus)

The API community remains divided on whether to use response envelopes (wrapping data in a consistent structure) or relying on HTTP itself as the envelope.

**Arguments Against Envelopes:**
- HTTP headers and status codes already provide metadata capabilities
- CORS and RFC 5988 Link headers reduce the need for body-level metadata
- Keeping responses envelope-free future-proofs APIs
- Simpler response structure reduces parsing overhead

**Arguments For Envelopes:**
- Enables API extensibility without versioning
- Provides consistent structure for clients to parse
- Simplifies adding metadata (pagination, versioning) without breaking changes
- Critical for cross-domain JSONP requests (legacy support)
- Helpful when clients can't access HTTP headers

### When to Use Envelopes

**Use envelopes when:**
1. Supporting JSONP or clients unable to read HTTP headers
2. Providing consistent pagination metadata across all endpoints
3. Including versioning information in responses
4. Standardizing error/success response shapes
5. Building APIs consumed by multiple client types with varying capabilities

**Skip envelopes when:**
1. Building modern APIs where clients can reliably access headers
2. HTTP semantics alone sufficiently convey all necessary information
3. Minimizing response payload size is critical
4. Following strict REST principles (resource-oriented design)

### Recommended Envelope Structure

```typescript
// Modern envelope pattern (2025)
interface ApiResponse<T> {
  data: T;                    // The actual resource data
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    version?: string;
    timestamp?: string;
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

// Example response
{
  "data": {
    "id": 123,
    "name": "Product Name",
    "price": 29.99
  },
  "meta": {
    "version": "2.0",
    "timestamp": "2025-11-26T10:30:00Z"
  },
  "links": {
    "self": "/api/products/123"
  }
}
```

### Collection Response Pattern

```typescript
interface CollectionResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  links: {
    self: string;
    next?: string;
    prev?: string;
    first: string;
    last: string;
  };
}
```

---

## HTTP Status Code Best Practices

### Core Principle

**Use HTTP status codes correctly** - they are the primary mechanism for communicating operation results. Don't return `200 OK` with error details in the body.

### Success Codes (2xx)

| Code | Usage | When to Use |
|------|-------|-------------|
| **200 OK** | Standard success | GET requests, successful updates |
| **201 Created** | Resource created | POST requests creating new resources |
| **202 Accepted** | Async processing | Long-running operations queued for processing |
| **204 No Content** | Success, no body | DELETE operations, updates with `Prefer: return=minimal` |

**Best Practice:**
```typescript
// ✅ CORRECT - Specific success codes
app.post('/api/products', async (req, res) => {
  const product = await storage.createProduct(req.body);
  res.status(201).json({ data: product }); // 201 Created
});

app.delete('/api/products/:id', async (req, res) => {
  await storage.deleteProduct(id);
  res.status(204).send(); // 204 No Content
});
```

### Client Error Codes (4xx)

| Code | Usage | When to Use |
|------|-------|-------------|
| **400 Bad Request** | Validation errors | Malformed JSON, validation failures |
| **401 Unauthorized** | Authentication required | Missing or invalid auth token |
| **403 Forbidden** | Authorization failed | Valid auth but insufficient permissions |
| **404 Not Found** | Resource missing | Resource doesn't exist |
| **409 Conflict** | State conflict | Duplicate resource, constraint violation |
| **422 Unprocessable Entity** | Semantic errors | Valid JSON but business logic rejects it |
| **429 Too Many Requests** | Rate limited | Client exceeded rate limits |

**Key Distinctions:**
- **400 vs 422**: Use 400 for syntactic errors (invalid JSON), 422 for semantic errors (business rule violations)
- **401 vs 403**: Use 401 when user isn't authenticated, 403 when authenticated but lacks permission
- **4xx errors are NOT retriable** without changing the request

### Server Error Codes (5xx)

| Code | Usage | When to Use |
|------|-------|-------------|
| **500 Internal Server Error** | Unexpected errors | Uncaught exceptions, programming errors |
| **502 Bad Gateway** | Upstream failure | External service returned invalid response |
| **503 Service Unavailable** | Temporary unavailability | Maintenance, overloaded, dependency down |
| **504 Gateway Timeout** | Upstream timeout | External service didn't respond in time |

**Key Principles:**
- **5xx errors are retriable** - clients should retry with exponential backoff
- Reserve 5xx for actual server problems, not client mistakes
- Log 5xx errors for investigation

### Common Mistakes to Avoid

```typescript
// ❌ WRONG - Returns 200 with error in body
app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);
  if (!product) {
    return res.status(200).json({ error: 'Product not found' }); // WRONG!
  }
  res.json(product);
});

// ✅ CORRECT - Returns 404 status code
app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);
  if (!product) {
    return res.status(404).json({
      error: 'Product not found',
      code: 'PRODUCT_NOT_FOUND'
    });
  }
  res.json(product);
});
```

---

## Pagination Metadata Conventions

### Parameter Naming Standards

**Most common conventions** (choose one and be consistent):

**Option 1: Page-based (recommended for simple use cases)**
```
GET /api/products?page=2&limit=50
```
- `page` - Current page number (1-indexed)
- `limit` - Items per page (default: 10-50)
- `pageSize` - Alternative to `limit`

**Option 2: Offset-based (recommended for precise control)**
```
GET /api/products?offset=100&limit=50
```
- `offset` - Number of items to skip (0-indexed)
- `limit` - Number of items to return

**Option 3: Cursor-based (recommended for large datasets)**
```
GET /api/products?cursor=eyJpZCI6MTAwfQ==&limit=50
```
- `cursor` - Opaque token for next page
- `limit` - Number of items to return

### Response Metadata Structure

**Standard pagination metadata fields:**

```typescript
interface PaginationMeta {
  page: number;           // Current page (1-indexed)
  limit: number;          // Items per page
  total: number;          // Total number of items
  totalPages: number;     // Total number of pages
  hasMore?: boolean;      // Whether more pages exist
  hasPrev?: boolean;      // Whether previous page exists
}

// In response
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 50,
    "total": 1500,
    "totalPages": 30,
    "hasMore": true,
    "hasPrev": true
  },
  "links": {
    "self": "/api/products?page=2&limit=50",
    "next": "/api/products?page=3&limit=50",
    "prev": "/api/products?page=1&limit=50",
    "first": "/api/products?page=1&limit=50",
    "last": "/api/products?page=30&limit=50"
  }
}
```

### Real-World Examples

**Stripe API (cursor-based):**
```json
{
  "object": "list",
  "data": [...],
  "has_more": true,
  "url": "/v1/charges"
}
```

**Shopify API (Link header + body):**
```http
Link: <https://shop.myshopify.com/admin/api/2023-01/products.json?page_info=eyJsYXN0X2lkIjo0fQ>; rel="next"

{
  "products": [...]
}
```

**GitHub API (Link header, RFC 5988):**
```http
Link: <https://api.github.com/repos?page=3>; rel="next",
      <https://api.github.com/repos?page=50>; rel="last"
```

### Implementation Recommendations

1. **Use `limit` and `offset` as defaults** for simple pagination
2. **Include `total` and `totalPages`** so clients know dataset bounds
3. **Provide `links` object** with URLs for next/prev/first/last pages
4. **Use cursor-based pagination** for:
   - Large datasets (millions of records)
   - Real-time data (where offset changes between requests)
   - Performance-critical applications
5. **Include `hasMore` flag** for infinite scroll UIs

---

## Error Response Format Standards

### RFC 7807 / RFC 9457: Problem Details for HTTP APIs

**The de facto standard for HTTP API errors** (IETF Standards Track)

RFC 7807 (updated to RFC 9457 in 2024) defines a standard format for machine-readable error details.

**Media Type:** `application/problem+json`

**Standard Fields:**

```typescript
interface ProblemDetails {
  type: string;        // URI identifying the problem type
  title: string;       // Human-readable summary (constant for type)
  status: number;      // HTTP status code
  detail: string;      // Human-readable explanation (specific to occurrence)
  instance?: string;   // URI reference to specific occurrence
  // Extension members allowed
  [key: string]: any;
}
```

**Example:**
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Product price must be a positive number",
  "instance": "/api/products/123",
  "errors": [
    {
      "field": "price",
      "message": "Must be a positive number",
      "value": -10
    }
  ]
}
```

### JSON:API Error Format

**Alternative standard** for APIs following JSON:API specification.

**Media Type:** `application/vnd.api+json`

**Structure:**
```typescript
interface JsonApiError {
  errors: Array<{
    id?: string;          // Unique identifier for this error
    status?: string;      // HTTP status code (as string)
    code?: string;        // Application-specific error code
    title?: string;       // Short summary
    detail?: string;      // Specific explanation
    source?: {
      pointer?: string;   // JSON Pointer to error source
      parameter?: string; // Query parameter that caused error
    };
    meta?: Record<string, any>;
  }>;
}
```

**Example:**
```json
{
  "errors": [
    {
      "status": "400",
      "code": "VALIDATION_ERROR",
      "title": "Invalid Attribute",
      "detail": "Price must be a positive number",
      "source": {
        "pointer": "/data/attributes/price"
      }
    }
  ]
}
```

### RFC 7807 vs JSON:API

| Aspect | RFC 7807 | JSON:API |
|--------|----------|----------|
| **Scope** | General HTTP APIs | JSON:API-compliant APIs only |
| **Media Type** | `application/problem+json` | `application/vnd.api+json` |
| **Multiple Errors** | Single error object (extend with array) | Native array support |
| **Error Location** | Extension field | Built-in `source.pointer` |
| **Adoption** | Broader (IETF standard) | Specific to JSON:API ecosystem |
| **Flexibility** | Highly extensible | More structured/opinionated |

### Recommended Error Response Pattern

**For general REST APIs (RFC 7807-inspired):**

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable message
    details?: string;       // Additional context
    fields?: Array<{        // Validation errors
      field: string;
      message: string;
      value?: any;
    }>;
    type?: string;          // Error type URI (RFC 7807)
    statusCode?: number;    // Convenience (redundant with HTTP status)
    requestId?: string;     // For support/debugging
    timestamp?: string;     // When error occurred
  };
}
```

**Example usage:**
```typescript
// Validation error (400)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "not-an-email"
      },
      {
        "field": "price",
        "message": "Must be positive",
        "value": -10
      }
    ],
    "statusCode": 400,
    "requestId": "req_abc123"
  }
}

// Not found error (404)
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Product not found",
    "details": "No product exists with ID 12345",
    "statusCode": 404,
    "requestId": "req_def456"
  }
}

// Server error (500)
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": "Please contact support if the problem persists",
    "statusCode": 500,
    "requestId": "req_ghi789"
  }
}
```

### Industry Examples

**Microsoft Azure Error Format:**
```json
{
  "error": {
    "code": "InvalidParameterValue",
    "message": "The value provided for one of the parameters is invalid",
    "target": "query",
    "details": [
      {
        "code": "NullValue",
        "target": "$search",
        "message": "$search query cannot be null"
      }
    ]
  }
}
```

**Google Cloud Error Format:**
```json
{
  "error": {
    "code": 400,
    "message": "Invalid value at 'user.email' (user.email), \"invalid_email\"",
    "status": "INVALID_ARGUMENT",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.BadRequest",
        "fieldViolations": [
          {
            "field": "user.email",
            "description": "Invalid email format"
          }
        ]
      }
    ]
  }
}
```

---

## TypeScript Typing Patterns

### Generic API Response Types

**Pattern 1: Basic Generic Response**

```typescript
// Shared response wrapper
interface ApiResponse<T> {
  data: T;
  meta?: {
    timestamp: string;
    version: string;
  };
}

// Success response
interface SuccessResponse<T> extends ApiResponse<T> {
  success: true;
}

// Error response
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    fields?: ValidationError[];
  };
}

// Discriminated union for type safety
type ApiResult<T> = SuccessResponse<T> | ErrorResponse;

// Type guard
function isErrorResponse(response: ApiResult<any>): response is ErrorResponse {
  return response.success === false;
}

// Usage
async function fetchProduct(id: number): Promise<ApiResult<Product>> {
  const response = await fetch(`/api/products/${id}`);
  return response.json();
}

const result = await fetchProduct(123);
if (isErrorResponse(result)) {
  console.error(result.error.message);
} else {
  console.log(result.data); // TypeScript knows this is Product
}
```

**Pattern 2: Generic Fetch Function**

```typescript
// Generic fetch with automatic type inference
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'UNKNOWN_ERROR',
          message: 'An error occurred'
        }
      };
    }

    return {
      success: true,
      data: data.data || data,
      meta: data.meta
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error'
      }
    };
  }
}

// Type-safe usage (no casting needed)
const product = await apiFetch<Product>('/api/products/123');
const products = await apiFetch<Product[]>('/api/products');
```

**Pattern 3: Paginated Response Type**

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  links: {
    self: string;
    next?: string;
    prev?: string;
    first: string;
    last: string;
  };
}

// Usage
async function fetchProducts(
  page: number = 1,
  limit: number = 50
): Promise<PaginatedResponse<Product>> {
  return apiFetch<PaginatedResponse<Product>>(
    `/api/products?page=${page}&limit=${limit}`
  );
}
```

**Pattern 4: Route-Based Type Mapping**

```typescript
// Advanced pattern: infer types from routes
interface ApiEndpoints {
  '/api/products': Product[];
  '/api/products/:id': Product;
  '/api/users': User[];
  '/api/users/:id': User;
}

// Extract return type based on route
async function apiGet<T extends keyof ApiEndpoints>(
  route: T,
  params?: Record<string, string | number>
): Promise<ApiResult<ApiEndpoints[T]>> {
  let url = route as string;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return apiFetch<ApiEndpoints[T]>(url);
}

// Type-safe usage with autocomplete
const product = await apiGet('/api/products/:id', { id: 123 });
// TypeScript knows result is Product

const products = await apiGet('/api/products');
// TypeScript knows result is Product[]
```

**Pattern 5: Validation Error Types**

```typescript
interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    fields: ValidationError[];
  };
}

// Type guard
function isValidationError(
  response: ErrorResponse
): response is ValidationErrorResponse {
  return response.error.code === 'VALIDATION_ERROR';
}

// Usage with type narrowing
const result = await createProduct(data);
if (isErrorResponse(result)) {
  if (isValidationError(result)) {
    // TypeScript knows result.error.fields exists
    result.error.fields.forEach(err => {
      console.error(`${err.field}: ${err.message}`);
    });
  } else {
    console.error(result.error.message);
  }
}
```

### Helper Function Patterns

**Type-safe response creators:**

```typescript
// Success response creator
function createSuccessResponse<T>(
  data: T,
  meta?: Record<string, any>
): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

// Error response creator
function createErrorResponse(
  code: string,
  message: string,
  details?: string,
  fields?: ValidationError[]
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      fields
    }
  };
}

// Validation error creator
function createValidationError(
  fields: ValidationError[]
): ValidationErrorResponse {
  return {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      fields
    }
  };
}

// Express.js integration
app.get('/api/products/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const product = await storage.getProductById(id);

  if (!product) {
    return res.status(404).json(
      createErrorResponse('PRODUCT_NOT_FOUND', 'Product not found')
    );
  }

  res.json(createSuccessResponse(product));
});
```

---

## Framework-Specific Patterns

### Express.js

**Standard response pattern:**

```typescript
import { Request, Response, NextFunction } from 'express';

// Response helper middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.success = <T>(data: T, statusCode: number = 200) => {
    res.status(statusCode).json(createSuccessResponse(data));
  };

  res.error = (code: string, message: string, statusCode: number = 500) => {
    res.status(statusCode).json(createErrorResponse(code, message));
  };

  next();
});

// Type augmentation
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, statusCode?: number): void;
      error(code: string, message: string, statusCode?: number): void;
    }
  }
}

// Usage
app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);
  if (!product) {
    return res.error('PRODUCT_NOT_FOUND', 'Product not found', 404);
  }
  res.success(product);
});
```

### NestJS

**Standard interceptor pattern:**

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>> {

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString()
        }
      }))
    );
  }
}

// Register globally
app.useGlobalInterceptors(new ResponseTransformInterceptor());
```

### tRPC

**Built-in type safety** - no manual response wrapping needed:

```typescript
import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

const appRouter = t.router({
  getProduct: t.procedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const product = await storage.getProductById(input.id);
      if (!product) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Product not found'
        });
      }
      return product; // Type-safe, no wrapper needed
    }),

  listProducts: t.procedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(50)
    }))
    .query(async ({ input }) => {
      const products = await storage.getProducts(input);
      return {
        data: products,
        pagination: {
          page: input.page,
          limit: input.limit,
          total: await storage.getProductCount()
        }
      };
    })
});

// Client usage - fully type-safe
const product = await trpc.getProduct.query({ id: 123 });
// TypeScript knows exact shape of product
```

---

## Frontend Consumption Patterns

### React Query (TanStack Query)

**Pattern 1: Basic query with generic types:**

```typescript
import { useQuery } from '@tanstack/react-query';

function useProduct(id: number) {
  return useQuery<Product, ErrorResponse>({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) {
        throw await response.json();
      }
      const data = await response.json();
      return data.data || data; // Handle envelope
    }
  });
}

// Component usage
function ProductDetail({ id }: { id: number }) {
  const { data, error, isLoading } = useProduct(id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.error.message}</div>;

  return <div>{data.name}</div>;
}
```

**Pattern 2: Paginated queries:**

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';

function useProducts() {
  return useInfiniteQuery<PaginatedResponse<Product>>({
    queryKey: ['products'],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await fetch(
        `/api/products?page=${pageParam}&limit=50`
      );
      return response.json();
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1
  });
}

// Infinite scroll component
function ProductList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useProducts();

  return (
    <>
      {data?.pages.map((page) =>
        page.data.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))
      )}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          Load More
        </button>
      )}
    </>
  );
}
```

### SWR

**Pattern 1: Basic fetcher:**

```typescript
import useSWR from 'swr';

// Generic fetcher
const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }
  const data = await response.json();
  return data.data || data;
};

// Hook
function useProduct(id: number) {
  return useSWR<Product>(`/api/products/${id}`, fetcher);
}

// Component
function ProductDetail({ id }: { id: number }) {
  const { data, error, isLoading } = useProduct(id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data.name}</div>;
}
```

**Pattern 2: Pagination with SWR:**

```typescript
import useSWRInfinite from 'swr/infinite';

function useProducts() {
  return useSWRInfinite<PaginatedResponse<Product>>(
    (pageIndex) => `/api/products?page=${pageIndex + 1}&limit=50`,
    fetcher,
    {
      revalidateFirstPage: false
    }
  );
}

function ProductList() {
  const { data, size, setSize, isLoading } = useProducts();

  const products = data ? data.flatMap(page => page.data) : [];
  const hasMore = data?.[data.length - 1]?.pagination.hasMore;

  return (
    <>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
      {hasMore && (
        <button onClick={() => setSize(size + 1)}>Load More</button>
      )}
    </>
  );
}
```

### Axios Interceptors

**Pattern 1: Global response/error handling:**

```typescript
import axios, { AxiosError } from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor - unwrap envelope
api.interceptors.response.use(
  (response) => {
    // Automatically unwrap data from envelope
    if (response.data.data !== undefined) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error: AxiosError<ErrorResponse>) => {
    // Transform error to consistent format
    if (error.response?.data?.error) {
      const apiError = new Error(error.response.data.error.message);
      (apiError as any).code = error.response.data.error.code;
      (apiError as any).fields = error.response.data.error.fields;
      return Promise.reject(apiError);
    }
    return Promise.reject(error);
  }
);

// Usage - data already unwrapped
const product = await api.get<Product>('/products/123');
console.log(product.data); // Product, not { data: Product }
```

**Pattern 2: Integration with React Query:**

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const response = await api.get(queryKey[0] as string);
        return response.data; // Already unwrapped by interceptor
      },
      retry: (failureCount, error: any) => {
        // Don't retry 4xx errors
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      }
    }
  }
});

// Usage
function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: [`/products/${id}`]
    // queryFn provided by default options
  });
}
```

---

## Migration Strategies

### Gradual Migration Approach

When standardizing responses in an existing API, use these strategies to avoid breaking changes:

#### Strategy 1: Dual Format Support (Transition Period)

```typescript
// Support both old and new formats during transition
app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);

  if (!product) {
    return res.status(404).json(
      createErrorResponse('PRODUCT_NOT_FOUND', 'Product not found')
    );
  }

  // Check for new format opt-in via header or query param
  const useNewFormat =
    req.headers['x-api-version'] === '2.0' ||
    req.query.format === 'v2';

  if (useNewFormat) {
    // New envelope format
    return res.json(createSuccessResponse(product));
  } else {
    // Old format (backward compatible)
    return res.json(product);
  }
});
```

#### Strategy 2: Version-Based Routing

```typescript
// Mount different routers for different versions
app.use('/api/v1', v1Router); // Old format
app.use('/api/v2', v2Router); // New format

// Default to latest
app.use('/api', v2Router);
```

#### Strategy 3: Response Transform Middleware

```typescript
// Middleware to transform old responses to new format
function envelopeTransform(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function(data: any) {
    // If already in envelope format, pass through
    if (data.success !== undefined || data.error !== undefined) {
      return originalJson(data);
    }

    // Transform to envelope format
    if (res.statusCode >= 400) {
      return originalJson(createErrorResponse(
        'ERROR',
        data.message || 'An error occurred'
      ));
    }

    return originalJson(createSuccessResponse(data));
  };

  next();
}

// Apply selectively or globally
app.use('/api/v2', envelopeTransform);
```

### Migration Checklist

**Phase 1: Preparation (1-2 weeks)**
- [ ] Audit existing API endpoints and response formats
- [ ] Document current inconsistencies
- [ ] Define target response schema
- [ ] Create TypeScript types for new formats
- [ ] Write helper functions (createSuccessResponse, createErrorResponse)
- [ ] Update API documentation

**Phase 2: Backend Implementation (2-4 weeks)**
- [ ] Implement dual format support or versioning
- [ ] Add response transform middleware
- [ ] Update error handling to use new format
- [ ] Add integration tests for both formats
- [ ] Update OpenAPI/Swagger documentation

**Phase 3: Client Migration (2-3 weeks)**
- [ ] Update frontend API client to handle new format
- [ ] Add axios interceptors or fetch wrappers
- [ ] Update React Query/SWR hooks
- [ ] Test error handling flows
- [ ] Monitor for edge cases

**Phase 4: Deprecation (4-12 weeks)**
- [ ] Announce deprecation timeline to API consumers
- [ ] Add deprecation warnings to old format responses
- [ ] Monitor usage analytics
- [ ] Provide migration guide and support
- [ ] Remove old format support after grace period

### Backward Compatibility Patterns

**Pattern 1: Optional envelope unwrapping:**

```typescript
// Client-side helper that works with both formats
async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();

  // Handle new envelope format
  if (data.data !== undefined) {
    if (data.success === false) {
      throw new Error(data.error.message);
    }
    return data.data;
  }

  // Handle old direct format
  return data;
}
```

**Pattern 2: Discriminated response types:**

```typescript
// Type that handles both old and new formats
type LegacyProduct = Product;
type EnvelopedProduct = { data: Product; meta: any };
type ProductResponse = LegacyProduct | EnvelopedProduct;

// Type guard
function isEnveloped<T>(response: any): response is { data: T } {
  return response.data !== undefined && response.success !== undefined;
}

// Usage
const response = await fetchProduct(123);
const product = isEnveloped<Product>(response)
  ? response.data
  : response;
```

---

## Implementation Examples

### Complete Express.js Implementation

```typescript
// types/api.ts
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    fields?: ValidationError[];
    requestId: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  links: {
    self: string;
    next?: string;
    prev?: string;
    first: string;
    last: string;
  };
}

// utils/response-helpers.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

export function createSuccessResponse<T>(
  data: T,
  meta?: Record<string, any>
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '2.0',
      requestId: uuidv4(),
      ...meta
    }
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  details?: string,
  fields?: ValidationError[]
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      fields,
      requestId: uuidv4()
    }
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
  baseUrl: string
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  const buildUrl = (p: number) =>
    `${baseUrl}?page=${p}&limit=${limit}`;

  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: '2.0',
      requestId: uuidv4()
    },
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore
    },
    links: {
      self: buildUrl(page),
      next: hasMore ? buildUrl(page + 1) : undefined,
      prev: page > 1 ? buildUrl(page - 1) : undefined,
      first: buildUrl(1),
      last: buildUrl(totalPages)
    }
  };
}

// middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    const fields = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      value: err.input
    }));

    return res.status(400).json(
      createErrorResponse(
        'VALIDATION_ERROR',
        'Request validation failed',
        undefined,
        fields
      )
    );
  }

  // Known application errors
  if (error.name === 'NotFoundError') {
    return res.status(404).json(
      createErrorResponse(
        'RESOURCE_NOT_FOUND',
        error.message
      )
    );
  }

  // Default server error
  console.error('Unhandled error:', error);
  return res.status(500).json(
    createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred',
      process.env.NODE_ENV === 'development'
        ? error.message
        : undefined
    )
  );
}

// routes/products.ts
import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// List products with pagination
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const [products, total] = await Promise.all([
      storage.getProducts(pageNum, limitNum),
      storage.getProductCount()
    ]);

    res.json(
      createPaginatedResponse(
        products,
        pageNum,
        limitNum,
        total,
        `${req.protocol}://${req.get('host')}${req.baseUrl}`
      )
    );
  } catch (error) {
    next(error);
  }
});

// Get single product
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const product = await storage.getProductById(id);

    if (!product) {
      return res.status(404).json(
        createErrorResponse(
          'PRODUCT_NOT_FOUND',
          'Product not found',
          `No product exists with ID ${id}`
        )
      );
    }

    res.json(createSuccessResponse(product));
  } catch (error) {
    next(error);
  }
});

// Create product
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  description: z.string().optional()
});

router.post('/', async (req, res, next) => {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await storage.createProduct(data);

    res.status(201).json(createSuccessResponse(product));
  } catch (error) {
    next(error);
  }
});

export default router;

// server/index.ts
import express from 'express';
import productRoutes from './routes/products';
import { errorHandler } from './middleware/error-handler';

const app = express();

app.use(express.json());

// Routes
app.use('/api/products', productRoutes);

// Error handler (must be last)
app.use(errorHandler);

app.listen(5000, () => {
  console.log('Server running on port 5000');
});
```

### Complete React Query Client

```typescript
// api/client.ts
import axios from 'axios';
import type { ApiResponse, ErrorResponse, PaginatedResponse } from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Unwrap envelope
    if (response.data.success && response.data.data !== undefined) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    if (error.response?.data?.error) {
      const apiError = new Error(error.response.data.error.message);
      (apiError as any).code = error.response.data.error.code;
      (apiError as any).fields = error.response.data.error.fields;
      throw apiError;
    }
    throw error;
  }
);

export default api;

// hooks/useProducts.ts
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import type { Product, PaginatedResponse } from '../types';

export function useProducts(page: number = 1, limit: number = 50) {
  return useQuery<Product[]>({
    queryKey: ['products', page, limit],
    queryFn: async () => {
      const { data } = await api.get<Product[]>(
        `/products?page=${page}&limit=${limit}`
      );
      return data;
    }
  });
}

export function useInfiniteProducts(limit: number = 50) {
  return useInfiniteQuery<PaginatedResponse<Product>>({
    queryKey: ['products', 'infinite', limit],
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.get<PaginatedResponse<Product>>(
        `/products?page=${pageParam}&limit=${limit}`
      );
      return data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1
  });
}

export function useProduct(id: number) {
  return useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data } = await api.get<Product>(`/products/${id}`);
      return data;
    },
    enabled: !!id
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id'>) => {
      const { data } = await api.post<Product>('/products', product);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
}

// components/ProductList.tsx
import { useInfiniteProducts } from '../hooks/useProducts';

export function ProductList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteProducts(50);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const products = data.pages.flatMap(page => page.data);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {products.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 btn btn-primary"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

---

## Summary & Recommendations

### Key Takeaways

1. **HTTP Status Codes are Primary**
   - Use correct status codes (2xx, 4xx, 5xx)
   - Never return 200 with errors in body
   - 4xx = client error (not retriable), 5xx = server error (retriable)

2. **Response Envelopes are Contextual**
   - Use envelopes for consistency when supporting multiple client types
   - Skip envelopes for pure REST when HTTP headers suffice
   - Be consistent across your entire API

3. **Pagination Metadata is Essential**
   - Always include: page, limit, total, totalPages
   - Provide navigation links (next, prev, first, last)
   - Use cursor-based pagination for large datasets

4. **Error Standards Matter**
   - RFC 7807/9457 is the IETF standard for HTTP APIs
   - JSON:API for APIs already using JSON:API spec
   - Include machine-readable error codes
   - Provide field-level validation errors

5. **TypeScript Enhances Type Safety**
   - Use discriminated unions for success/error responses
   - Create generic helper functions for type inference
   - Leverage type guards for runtime checking
   - Define route-based type mappings for advanced type safety

6. **Frontend Integration Should Be Seamless**
   - Use axios interceptors to unwrap envelopes automatically
   - React Query/SWR provide excellent patterns for pagination
   - Handle errors consistently with proper retry logic

7. **Migration Requires Planning**
   - Support dual formats during transition
   - Version your API when making breaking changes
   - Communicate deprecation timelines clearly
   - Provide comprehensive migration guides

### Recommended Stack for PriceCompare

Based on your current Express + React + TypeScript stack:

**Backend (Express):**
- Implement response envelope pattern for consistency
- Use RFC 7807-inspired error format
- Add helper functions (createSuccessResponse, createErrorResponse, createPaginatedResponse)
- Standardize pagination with page/limit parameters
- Use Zod for validation with automatic error transformation

**Frontend (React):**
- Axios with interceptors for automatic envelope unwrapping
- React Query for data fetching with proper typing
- Generic hooks for consistent API consumption
- Type-safe error handling with discriminated unions

**Types (Shared):**
- Define shared TypeScript types in `shared/api-types.ts`
- Export ApiResponse, ErrorResponse, PaginatedResponse
- Create helper types for common patterns
- Use Zod schemas for runtime validation

This approach provides:
- Type safety from backend to frontend
- Consistent API patterns across all endpoints
- Easy debugging with request IDs
- Scalable pagination for large datasets
- Standards-compliant error handling

---

## Sources

### Official Standards & RFCs
- [RFC 7807: Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [RFC 9457: Problem Details for HTTP APIs (Updated)](https://www.rfc-editor.org/rfc/rfc9457.html)
- [JSON:API Specification](https://jsonapi.org/format/)
- [HTTP Response Status Codes - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)

### Industry Guidelines
- [Microsoft REST API Guidelines](https://github.com/Microsoft/api-guidelines/blob/master/Guidelines.md)
- [Microsoft Azure REST API Guidelines](https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md)
- [Google API Design Guide](https://cloud.google.com/apis/design/)
- [Google JSON Style Guide](https://google.github.io/styleguide/jsoncstyleguide.xml)

### Best Practice Articles
- [REST API Best Practices - Stack Overflow Blog](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [Best Practices for a Pragmatic RESTful API - Vinay Sahni](https://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api)
- [REST API Design Best Practices - Sergei Codes](https://sergeicodes.com/posts/2022-05-05-rest-api-design-best-practices.html)
- [HTTP Status Codes - REST API Tutorial](https://restfulapi.net/http-status-codes/)

### Pagination Resources
- [Stripe API Pagination](https://docs.stripe.com/api/pagination)
- [Shopify REST Admin API Pagination](https://shopify.dev/docs/api/admin-rest/usage/pagination)
- [RESTful API Pagination Best Practices - Medium](https://medium.com/@khdevnet/restful-api-pagination-best-practices-a-developers-guide-5b177a9552ef)
- [API Pagination Guide - Treblle](https://treblle.com/blog/api-pagination-guide-techniques-benefits-implementation)

### Error Handling
- [RFC 7807 Introduction - Axway](https://blog.axway.com/learning-center/apis/api-design/introduction-to-rfc-7807)
- [REST API Error Handling - RestCase Blog](https://blog.restcase.com/rest-api-error-handling-problem-details-response/)
- [Problem Details RFC 9457 - Nicolas Fränkel](https://blog.frankel.ch/problem-details-http-apis/)
- [Microsoft Graph Error Responses](https://learn.microsoft.com/en-us/graph/errors)

### TypeScript Patterns
- [TypeScript API Response Types - Medium](https://medium.com/@finnkumar6/how-to-write-api-response-types-with-typescript-ebd3fca20844)
- [TypeScript Generics - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/typescript-generics/)
- [Standardizing API Responses in TypeScript - Medium](https://medium.com/@tusharupadhyay691/standardizing-api-responses-in-typescript-enhancing-clarity-and-flexibility-3c1294f0ff05)
- [TypeScript Official Documentation - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)

### Framework Resources
- [tRPC Documentation](https://trpc.io)
- [NestJS-tRPC Integration](https://www.nestjs-trpc.io/)
- [tsoa - TypeScript OpenAPI](https://github.com/lukeautry/tsoa)
- [From REST to tRPC - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/trpc-explained/)

### Frontend Integration
- [React Query with Axios - Medium](https://medium.com/@cristafovici.den/master-data-fetching-with-axios-and-react-query-in-2024-part-1-7b10c5909eb1)
- [Axios Interceptors Documentation](https://axios-http.com/docs/interceptors)
- [TanStack Query - Interceptors Discussion](https://github.com/TanStack/query/discussions/3653)
- [SWR with Axios Interceptors](https://github.com/vercel/swr/discussions/2544)

### Migration & Strategy
- [API Response Standardization - DEV Community](https://dev.to/ra1nbow1/how-to-write-the-right-api-client-in-typescript-38g3)
- [Building Type-Safe APIs with tRPC Migration Guide](https://dev.to/eva_clari_289d85ecc68da48/building-type-safe-apis-with-trpc-a-practical-migration-guide-from-rest-3l4j)
- [Azure SDK TypeScript Guidelines](https://azure.github.io/azure-sdk/typescript_design.html)

### Open Source Examples
- [tsoa - TypeScript REST API](https://github.com/lukeautry/tsoa)
- [Express TypeScript Example - bezkoder](https://github.com/bezkoder/express-typescript-example)
- [REST API Node TypeScript - mariocoski](https://github.com/mariocoski/rest-api-node-typescript)
- [Awesome REST Resources](https://github.com/marmelab/awesome-rest)
