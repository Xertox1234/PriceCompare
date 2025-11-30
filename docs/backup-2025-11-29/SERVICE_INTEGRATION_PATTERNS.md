---
Pattern: Service Integration Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [API_PATTERNS.md, SECURITY_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, DATABASE_PATTERNS.md, TYPESCRIPT_PATTERNS.md]
---

# Service Integration Patterns

This document codifies service integration patterns identified through production code reviews. These patterns ensure consistency, reliability, and maintainability across all service integrations.

## Table of Contents
- [Storage Layer Pattern](#storage-layer-pattern)
- [Guard Completeness Pattern](#guard-completeness-pattern)
- [Cache-Before-Limit Pattern](#cache-before-limit-pattern)
- [Type Extraction Pattern](#type-extraction-pattern)
- [Error Message Quality Pattern](#error-message-quality-pattern)
- [Route Helper Compliance](#route-helper-compliance)

## Storage Layer Pattern

**Rule**: All database access flows through `server/storage.ts` which implements the `IStorage` interface. Never query `db` directly from routes or services.

### Anti-Pattern: Direct Database Access

```typescript
// ❌ WRONG - Direct db import in route
import { db } from './db';
import { products } from '@shared/schema';
import { eq } from 'drizzle-orm';

app.get('/api/products/:id', async (req, res) => {
  const product = await db.select()
    .from(products)
    .where(eq(products.id, parseInt(req.params.id)));
  res.json(product[0]);
});
```

### Correct Pattern: Storage Layer Abstraction

```typescript
// ✅ CORRECT - Use storage layer
import { storage } from './storage';
import { parseIntSafe } from './utils/validation-helpers';

app.get('/api/products/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
  const product = await storage.getProductById(id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.json(product);
});
```

### Benefits of Storage Layer

1. **Single Source of Truth**: All queries in one place
2. **Testability**: Easy to mock `storage` for testing
3. **Consistency**: Uniform error handling and validation
4. **Migration Safety**: Schema changes require updates in one location
5. **Type Safety**: Storage methods return properly typed results

### Documented Exception

**`price-aggregation-service.ts`** is the ONLY service with direct `db` access. This exception is documented because:
- Passes transaction contexts between private helper methods
- Complex atomic operations require fine-grained transaction control
- All other services MUST use the storage layer

### Migration Status

- ✅ 14/15 services migrated to storage layer
- ✅ All routes use storage layer
- ✅ 1 documented exception (price-aggregation-service.ts)

## Guard Completeness Pattern

**Problem**: Inconsistent application of rate limiters or guards across service methods leads to partial protection and unexpected quota consumption.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Inconsistent guard application
class SearchService {
  async searchRetailer(query: string) {
    // Has rate limit check ✓
    const canProceed = await rateLimiter.checkLimit(userId);
    if (!canProceed) throw new Error('Rate limit exceeded');
    return await this.performRetailerSearch(query);
  }

  async searchGeneral(query: string) {
    // Missing rate limit check ✗
    return await this.performGeneralSearch(query);
  }

  async searchByCategory(category: string) {
    // Also missing rate limit check ✗
    return await this.performCategorySearch(category);
  }
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - All external API methods protected consistently
class SearchService {
  private async checkRateLimit(operation: string, userId: string) {
    const { allowed, remaining, resetTime } = await rateLimiter.check(userId);
    if (!allowed) {
      throw new Error(
        `Rate limit exceeded for ${operation}. ` +
        `Remaining: ${remaining}, resets at: ${resetTime.toISOString()}`
      );
    }
    return { remaining, resetTime };
  }

  async searchRetailer(query: string, userId: string) {
    await this.checkRateLimit('searchRetailer', userId);
    return await this.performRetailerSearch(query);
  }

  async searchGeneral(query: string, userId: string) {
    await this.checkRateLimit('searchGeneral', userId);
    return await this.performGeneralSearch(query);
  }

  async searchByCategory(category: string, userId: string) {
    await this.checkRateLimit('searchByCategory', userId);
    return await this.performCategorySearch(category);
  }
}
```

**Key Principles**:
1. ALL methods making external API calls must have guard checks
2. Use a DRY helper method for guard implementation
3. No partial protection - either all methods are protected or none
4. Include operation context in error messages

## Cache-Before-Limit Pattern

**Problem**: Checking rate limits before cache lookups wastes user quota on cached responses and provides poor user experience.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Rate limit checked before cache
async function searchWithRateLimit(query: string, userId: string) {
  // Counts against quota even for cached results!
  const canProceed = await rateLimiter.check(userId);
  if (!canProceed) {
    throw new Error('Rate limit exceeded');
  }

  // Cache check comes after limit check
  const cached = await cache.get(`search:${query}`);
  if (cached) {
    return cached;
  }

  const result = await performExpensiveSearch(query);
  await cache.set(`search:${query}`, result);
  return result;
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Cache check bypasses rate limit
async function searchWithRateLimit(query: string, userId: string) {
  // Step 1: Check cache first - doesn't count against quota
  const cacheKey = `search:${query}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    log(`Cache hit for query: ${query}, user: ${userId}`);
    return cached;
  }

  // Step 2: Only check rate limit for actual API calls
  const { allowed, remaining, resetTime } = await rateLimiter.check(userId);
  if (!allowed) {
    throw new Error(
      `API rate limit exceeded. Remaining quota: ${remaining}. ` +
      `Resets at: ${resetTime.toLocaleTimeString()}. ` +
      `Try using recent searches or wait for reset.`
    );
  }

  // Step 3: Perform expensive operation
  log(`Cache miss for query: ${query}, consuming API quota`);
  const result = await performExpensiveSearch(query);

  // Step 4: Cache result for future use
  await cache.set(cacheKey, result, { ttl: 300 }); // 5 minute cache

  return result;
}
```

**Implementation Rules**:
1. Always check cache BEFORE rate limit
2. Log cache hits and misses for monitoring
3. Only consume rate limit quota for actual external calls
4. Include cache usage suggestions in rate limit errors
5. Set appropriate TTL based on data volatility

## Type Extraction Pattern

**Problem**: Complex inline types in React Query hooks reduce code readability and make maintenance difficult.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Complex inline types are hard to read and maintain
function ProductDetails({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: ProductWithOffers & {
      specifications?: Array<{
        name: string;
        value: string;
        category?: string;
        unit?: string;
      }>;
      reviews?: {
        average: number;
        count: number;
        distribution: Record<number, number>;
        recent: Array<{
          id: number;
          rating: number;
          comment: string;
          author: string;
          date: Date;
        }>;
      };
      priceHistory?: Array<{
        price: number;
        date: Date;
        retailer: string;
      }>;
    };
    metadata?: {
      lastUpdated: Date;
      confidence: number;
    };
  }>({
    queryKey: ['product', id],
    queryFn: () => fetchProductDetails(id)
  });

  // Rest of component...
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Named interfaces improve readability and reusability
// Types defined at the top of the file or in a separate types file
interface ProductSpecification {
  name: string;
  value: string;
  category?: string;
  unit?: string;
}

interface ProductReview {
  id: number;
  rating: number;
  comment: string;
  author: string;
  date: Date;
}

interface ProductReviews {
  average: number;
  count: number;
  distribution: Record<number, number>;
  recent: ProductReview[];
}

interface PricePoint {
  price: number;
  date: Date;
  retailer: string;
}

interface ProductMetadata {
  lastUpdated: Date;
  confidence: number;
}

interface ProductDetailsResponse {
  success: boolean;
  data: ProductWithOffers & {
    specifications?: ProductSpecification[];
    reviews?: ProductReviews;
    priceHistory?: PricePoint[];
  };
  metadata?: ProductMetadata;
}

// Clean, readable component
function ProductDetails({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery<ProductDetailsResponse>({
    queryKey: ['product', id],
    queryFn: () => fetchProductDetails(id)
  });

  // Rest of component...
}
```

**Guidelines**:
1. Extract types when return type exceeds 3 lines
2. Create named interfaces for nested objects
3. Group related type definitions together
4. Use descriptive names that indicate purpose
5. Consider creating a `types.ts` file for shared types

## Error Message Quality Pattern

**Problem**: Vague error messages provide no actionable information to users, leading to frustration and support requests.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Non-actionable, vague errors
if (!allowed) {
  throw new Error('Limit exceeded');
}

if (remaining === 0) {
  throw new Error('No more requests allowed');
}

if (queue.length > MAX_QUEUE) {
  throw new Error('Queue full');
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Actionable, informative errors with context
if (!allowed) {
  throw new Error(
    `Daily API limit exceeded for product search (${used}/${limit}). ` +
    `Your limit resets at ${resetTime.toLocaleTimeString()} (${timeUntilReset} remaining). ` +
    `You have ${remaining} requests remaining today. ` +
    `Consider using cached searches or upgrading your plan for higher limits.`
  );
}

if (remaining === 0) {
  throw new Error(
    `Rate limit exhausted for ${operation}. ` +
    `Current limit: ${limit} requests per ${window}. ` +
    `Next available slot: ${nextSlot.toISOString()}. ` +
    `Alternative: Use the batch ${operation} endpoint for multiple queries.`
  );
}

if (queue.length > MAX_QUEUE) {
  throw new Error(
    `Processing queue full (${queue.length}/${MAX_QUEUE} items). ` +
    `Estimated wait time: ${estimatedWait} minutes. ` +
    `Queue typically clears faster during off-peak hours (${offPeakHours}). ` +
    `For immediate processing, consider using the priority queue (requires premium).`
  );
}
```

**Error Message Requirements**:
1. **What**: Specify exactly what limit/constraint was exceeded
2. **Current State**: Show current usage vs limit
3. **When**: Indicate when the limit resets or becomes available
4. **Remaining**: Display remaining quota if applicable
5. **Alternatives**: Suggest alternative approaches or workarounds
6. **Context**: Include relevant operation or resource name

## Route Helper Compliance

**Problem**: Inline authentication and error handling in routes leads to inconsistency, security vulnerabilities, and code duplication.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Inline authentication and error handling
app.get('/api/user/profile', async (req, res) => {
  // Manual auth check - inconsistent
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const profile = await getUserProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    // Manual error handling - may leak sensitive info
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  // Another manual auth check - different pattern
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    await deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    // Different error handling pattern
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Consistent use of route helpers
import { withAuth, withAdmin } from './helpers';
import { createErrorResponse } from '../utils/error-sanitizer';

app.get('/api/user/profile', withAuth(async (req, res) => {
  try {
    // req.user guaranteed to exist by withAuth
    const profile = await getUserProfile(req.user!.id);
    res.json(profile);
  } catch (error) {
    // Consistent error handling
    const errorResponse = createErrorResponse(error, 'GetUserProfile');
    res.status(errorResponse.status).json(errorResponse);
  }
}));

app.delete('/api/admin/users/:id', withAdmin(async (req, res) => {
  try {
    // Admin access guaranteed by withAdmin
    const userId = parseIntSafe(req.params.id, 'userId', { min: 1 });
    await deleteUser(userId);
    res.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'DeleteUser');
    res.status(errorResponse.status).json(errorResponse);
  }
}));
```

**Implementation Standards**:
1. **Authentication**: Always use `withAuth` or `withAdmin` helpers
2. **Error Handling**: Always use `createErrorResponse` in catch blocks
3. **Integer Parsing**: Always use `parseIntSafe` or `parseIntOptional`
4. **CSRF Protection**: Add `csrfProtection` middleware for state-changing operations
5. **Type Safety**: Leverage TypeScript's non-null assertion when auth is guaranteed

## Additional Patterns

### Service Method Consistency

All methods within a service class should follow consistent patterns:

```typescript
class PriceService {
  // Each method should have:
  // 1. Parameter validation
  // 2. Consistent logging
  // 3. Same error handling pattern
  // 4. Consistent return structure

  async getCurrentPrice(productId: string): Promise<ServiceResponse<Price>> {
    // 1. Validation
    const id = parseIntSafe(productId, 'productId', { min: 1 });

    // 2. Logging
    log(`Fetching current price for product ${id}`);

    try {
      // 3. Core logic with consistent structure
      const price = await this.fetchPrice(id);

      // 4. Consistent success response
      return {
        success: true,
        data: price,
        timestamp: new Date()
      };
    } catch (error) {
      // 5. Consistent error handling
      log(`Price fetch failed for product ${id}:`, error);
      throw new ServiceError('Failed to fetch price', {
        productId: id,
        operation: 'getCurrentPrice'
      });
    }
  }

  // All other methods follow the same pattern...
}
```

### Dependency Injection Pattern

Services should accept dependencies through constructor injection:

```typescript
// ✅ CORRECT - Testable, flexible
class SearchService {
  constructor(
    private readonly cache: CacheService,
    private readonly rateLimiter: RateLimiter,
    private readonly apiClient: ApiClient
  ) {}

  async search(query: string): Promise<SearchResults> {
    // Use injected dependencies
    const cached = await this.cache.get(query);
    // ...
  }
}

// Easy to test with mocks
const testService = new SearchService(mockCache, mockLimiter, mockClient);
```

## Testing Considerations

When implementing these patterns, ensure:

1. **Guard Testing**: Test both allowed and blocked scenarios
2. **Cache Testing**: Verify cache hits don't consume rate limits
3. **Error Testing**: Validate error messages contain required information
4. **Type Testing**: Ensure extracted types match API responses
5. **Helper Testing**: Verify route helpers properly handle auth states

## Migration Guide

When updating existing code to follow these patterns:

1. **Audit Current State**: Identify all service methods making external calls
2. **Extract Common Logic**: Create shared helper methods for guards
3. **Update Error Messages**: Enhance with actionable information
4. **Extract Complex Types**: Move inline types to named interfaces
5. **Standardize Routes**: Replace inline auth/error handling with helpers
6. **Add Tests**: Ensure new patterns are properly tested
7. **Update Documentation**: Document any service-specific patterns

## References

- [Code Review Specialist Agent Configuration](/.claude/agents/code-review-specialist.md)
- [TypeScript Reviewer Agent Configuration](/.claude/agents/typescript-reviewer.md)
- [API Patterns Documentation](API_PATTERNS.md)
- [Error Handling Patterns](ERROR_HANDLING_PATTERNS.md)
- [TypeScript Patterns](TYPESCRIPT_PATTERNS.md)