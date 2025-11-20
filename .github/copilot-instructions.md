# PriceCompare - AI Coding Agent Instructions

## Project Overview

PriceCompare is a full-stack price comparison platform with AI-powered product discovery, web scraping, price tracking, and community features. Built with TypeScript across frontend, backend, and Chrome extension.

**Key Architecture**: Express.js + React 19 + PostgreSQL + Redis + Drizzle ORM + Playwright

**⚠️ CRITICAL**: This project uses **Playwright EXCLUSIVELY** for all browser automation and testing. **NEVER use Puppeteer.**

**See `ARCHITECTURE.md` for**:
- High-level system diagrams and component interactions
- Data flow diagrams (price updates, authentication)
- Architecture Decision Records (ADRs) explaining "why" behind tech choices
- Multi-level caching strategy (in-memory → Redis → PostgreSQL)
- Deployment architecture and scaling considerations

## Critical Development Patterns

### Security-First Development (MANDATORY)

Follow `SECURITY_GUIDELINES.md` religiously. Common violations that **will break the build**:

1. **NEVER expose password hashes** in database queries
   ```typescript
   // ❌ WRONG - exposes passwordHash
   const user = await db.select().from(users).where(eq(users.id, id));
   
   // ✅ CORRECT - explicit field selection
   const user = await db.select({
     id: users.id,
     username: users.username,
     email: users.email,
     // SECURITY: Never expose passwordHash
   }).from(users).where(eq(users.id, id));
   ```

2. **Use type-safe integer parsing** from `server/utils/validation-helpers.ts`
   ```typescript
   // ❌ WRONG - no validation
   const id = parseInt(req.params.id);
   
   // ✅ CORRECT - safe parsing with validation
   import { parseIntSafe, parseIntOptional } from './utils/validation-helpers';
   const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
   ```

3. **Sanitize errors in production** using `server/utils/error-sanitizer.ts`
   ```typescript
   // ❌ WRONG - leaks implementation details
   catch (error) {
     res.status(500).json({ error: error.message });
   }
   
   // ✅ CORRECT - sanitized error response
   import { createErrorResponse } from './utils/error-sanitizer';
   catch (error) {
     console.error('Operation failed:', error);
     const errorResponse = createErrorResponse(error, 'Operation');
     res.status(errorResponse.status).json({
       error: errorResponse.error,
       details: errorResponse.details // Only in development
     });
   }
   ```

### Database & ORM Patterns

**Drizzle ORM** is used for all database operations - never write raw SQL directly.

**Schema location**: All tables defined in `shared/schema.ts` (shared between client/server)

**Query patterns**:
```typescript
import { db } from "./db";
import { products, productOffers } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

// Joins with proper typing
const result = await db
  .select({
    product: products,
    offer: productOffers,
    retailer: retailers
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId))
  .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
  .where(and(eq(products.id, productId), gte(productOffers.price, minPrice)))
  .orderBy(desc(productOffers.price));
```

**CRITICAL: Prevent N+1 Queries** (NEVER ALLOWED):

```typescript
// ❌ WRONG - N+1 query (1 query + N queries in loop)
const products = await db.select().from(products);
for (const product of products) {
  const offers = await db.select().from(productOffers)
    .where(eq(productOffers.productId, product.id)); // N queries!
}

// ✅ CORRECT - Single query with JOIN
const productsWithOffers = await db
  .select({
    product: products,
    offers: productOffers,
  })
  .from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId));

// ✅ ALSO CORRECT - Batch query with IN clause
const productIds = products.map(p => p.id);
const allOffers = await db.select()
  .from(productOffers)
  .where(inArray(productOffers.productId, productIds));
// Group offers by productId in application code

// ✅ BEST - Use array_agg() for grouped data (see docs/PATTERNS.md)
const priceData = await db
  .select({
    productId: priceHistory.productId,
    prices: sql<Array<{price: number, date: string}>>`
      json_agg(json_build_object('price', ${priceHistory.price}, 'date', ${priceHistory.recordedAt}))
    `
  })
  .from(priceHistory)
  .groupBy(priceHistory.productId);
```

**When to use JOINs vs IN clause vs array_agg()**:
- **JOIN**: When you need related data for most/all records (1:1, 1:many)
- **IN clause**: When you need to batch-fetch optional related data or filter by IDs
- **array_agg()**: When you need grouped/nested data in a single query (see `docs/PATTERNS.md` for examples)

**Storage pattern**: All data access goes through `server/storage.ts` which implements `IStorage` interface. Never query `db` directly from routes.

### Middleware Pipeline Order (Critical!)

In `server/index.ts`, middleware MUST be applied in this exact order (security reasons):

1. Sentry handlers (must be first)
2. Compression
3. Request size limiting
4. Body parsing
5. CORS
6. Security headers
7. Input sanitization
8. Rate limiting
9. Session management
10. Passport initialization
11. CSRF token attachment
12. Caching
13. Performance monitoring
14. CSRF protection
15. Routes
16. Error handling (must be last)

### Path Aliases & Imports

TypeScript paths configured in `tsconfig.json`:
- `@/*` → `client/src/*` (frontend only)
- `@shared/*` → `shared/*` (frontend & backend)
- Server imports use relative paths or `./` prefix

```typescript
// Client imports
import { Button } from "@/components/ui/button";
import { ProductWithOffers } from "@shared/schema";

// Server imports
import { db } from "./db";
import { parseIntSafe } from "./utils/validation-helpers";
import { Product } from "@shared/schema";
```

### AI Prompt System

All AI prompts centralized in `server/ai/prompt-registry.ts` with versioning:

```typescript
import { getActivePrompt, executePrompt } from './ai/prompt-registry';

// Get versioned prompt
const prompt = getActivePrompt('search-query-generation');

// Execute with validation
const result = await executePrompt('search-query-generation', {
  productName: 'iPhone 15 Pro',
  category: 'Smartphones'
});
```

**Never hardcode prompts** - always use the registry for version control and A/B testing.

**Prompt Engineering Standards**: Follow `docs/PROMPT_ENGINEERING_GUIDE.md` for:
- Structured prompt anatomy (ROLE, EXPERTISE, METHODOLOGY, QUALITY CRITERIA)
- Few-shot learning examples
- Output constraints and format specifications
- Temperature and token settings

## Common Development Tasks

### Adding a New API Endpoint

1. **Define schema in `shared/schema.ts`** if new database table
2. **Add validation schema** using Drizzle's `createInsertSchema()`
3. **Add storage method** to `server/storage.ts` implementing `IStorage`
4. **Create route handler** in appropriate `server/*-routes.ts`
5. **Apply security middleware**: rate limiting, CSRF protection, auth
6. **Add tests** in `server/__tests__/`

Example route with all security patterns:
```typescript
app.post('/api/products', 
  csrfProtection, // CSRF on state-changing ops
  async (req, res) => {
    try {
      // Validate input with Zod
      const data = insertProductSchema.parse(req.body);
      
      // Storage layer handles DB
      const product = await storage.createProduct(data);
      
      res.json(product);
    } catch (error) {
      const errorResponse = createErrorResponse(error, 'CreateProduct');
      res.status(errorResponse.status).json({
        error: errorResponse.error,
        details: errorResponse.details
      });
    }
  }
);
```

### Running Tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
npm run test:security # Security-specific tests
npm run test:ai       # AI service tests
```

Tests use **Vitest** with React Testing Library. Config in `vitest.config.ts`.

### Database Migrations

```bash
npm run db:push      # Push schema changes (dev only)
npm run migrate      # Run production migrations
```

Migrations in `migrations/` directory. Schema source of truth: `shared/schema.ts`.

### Running the Application

```bash
npm run dev          # Start dev server (port 5000)
npm run build        # Production build
npm start            # Production server
```

**Dev server includes**:
- Vite HMR for frontend
- TSX watch mode for backend
- Auto-reload on file changes

### Environment Setup

Required secrets (generate with `openssl rand -base64 32`):
- `SESSION_SECRET` - Express session encryption
- `CSRF_SECRET` - CSRF token generation
- `DISCOURSE_SSO_SECRET` - Forum SSO integration
- `DATABASE_URL` - PostgreSQL connection string

Optional but recommended:
- `REDIS_URL` - Required in production for distributed systems
- `OPENAI_API_KEY` - For AI-powered features
- `SENTRY_DSN` - Error monitoring

## Project-Specific Conventions

### Constants & Configuration

All magic numbers in `server/utils/constants.ts`:
```typescript
import { CACHE_DURATION, RATE_LIMIT, PAGINATION } from './utils/constants';

// Use constants instead of hardcoding
app.use(cache({ duration: CACHE_DURATION.PRODUCTS }));
app.use(rateLimiter({ maxRequests: RATE_LIMIT.MAX_REQUESTS }));
```

### Error Handling Philosophy

- **Development**: Show full errors for debugging
- **Production**: Sanitize errors to prevent info leakage
- **Always log**: `console.error()` for server-side debugging
- **Use error sanitizer**: Never send raw errors to client

### Caching Strategy

Multi-level caching (see ARCHITECTURE.md diagram):
1. **L1 - In-memory cache** (server/middleware/cache.ts) - Fast, single-server, rate limits
2. **L2 - Redis cache** (server/middleware/redis-cache.ts) - Distributed, sessions, API responses
3. **L3 - Database** (PostgreSQL) - Persistent source of truth
4. **Client - React Query** - Client-side state with staleTime/gcTime

Cache keys follow pattern: `{resource}:{id}:{variant}` (e.g., `product:123:full`)

**TTL Guidelines**:
- Retailers: 1 hour (changes infrequently)
- Products: 5 minutes (prices update regularly)
- User sessions: 24 hours

### Service Layer for Business Logic

Keep routes thin - extract business logic to `server/services/`:
- `price-snapshot-service.ts` - Automated price tracking (see price update flow in ARCHITECTURE.md)
- `google-search.ts` - Product URL discovery
- `email-service.ts` - Notifications
- `distributed-lock.ts` - Prevent race conditions in jobs
- `password-reset-service.ts` - Password reset tokens
- `websocket-service.ts` - Real-time notifications

### Background Jobs with Bull

Job queues in `server/jobs/`:
```typescript
import { createPriceSnapshotQueue } from './jobs/price-snapshot-queue';
import { jobLockService } from './services/job-lock-service';

// Add job to queue
await priceSnapshotQueue.add('snapshot', { productId: 123 });

// CRITICAL: Use distributed locks in scheduled jobs (multi-server safety)
// See docs/PATTERNS.md section "Distributed Job Locking"
cron.schedule('0 2 * * *', async () => {
  const result = await jobLockService.withLock(
    'price-snapshot:daily',
    async () => performDailySnapshot(),
    3600 // TTL in seconds
  );
  if (result === null) {
    logger.info('Job skipped - already running on another server');
  }
});
```

## Chrome Extension Integration

Extension code in `extensions/chrome/` with own manifest.json. Key files:
- `background.js` - Service worker for price monitoring
- `content-scripts/price-detector.js` - Injected into retailer pages
- `popup/` - Extension UI (React components)

Extension shares types from `shared/` but runs independently from main app.

## Avoiding Common Pitfalls

1. **N+1 QUERIES**: NEVER query in a loop - always use JOINs or `inArray()` batch queries
2. **Redis required in production**: App validates this in `server/index.ts` and exits if missing
3. **CSRF tokens**: Attached by middleware, client must include in requests
4. **Type safety**: Enable strict mode, avoid `any` types
5. **Pagination**: Always paginate large datasets using `PAGINATION.DEFAULT_LIMIT`
6. **Input validation**: Every route input goes through Zod schema first
7. **Account lockout**: Failed logins trigger temporary lockouts (see `server/middleware/account-lockout.ts`)

## Performance Patterns

**See `docs/PERFORMANCE_GUIDE.md` for complete optimization strategies**

- **NO N+1 QUERIES EVER**: Always use JOINs or batch queries with `inArray()` - see Database & ORM section
- **Use SQL aggregations**: COUNT(*), GROUP BY, array_agg() at database level (see `docs/PATTERNS.md`)
- **Component memoization**: React.memo() with custom comparison functions for expensive renders
- **Query debouncing**: 300ms debounce on search inputs to reduce API calls
- **Lazy loading**: Code-split pages and lazy-load images with Intersection Observer
- **Manual code splitting** in `vite.config.ts` - vendor chunks for React, UI libs
- **Image optimization**: Use Unsplash CDN with query params (`?w=400&h=300`)
- **Database indexes**: All foreign keys indexed (see `shared/schema.ts`)
- **Caching headers**: Set appropriate Cache-Control headers (retailers: 1h, products: 5m)
- **Compression**: gzip enabled for all responses
- **React Query**: Configure staleTime (5m), gcTime (10m), smart retry logic

## Documentation to Reference

### Core Documentation (Read These First)
- `ARCHITECTURE.md` - **Essential system overview**: diagrams, data flows, ADRs, caching strategy, deployment
- `SECURITY_GUIDELINES.md` - **Mandatory security patterns** (never expose passwords, sanitize errors, etc.)
- `CONTRIBUTING.md` - Setup guide, development workflow, environment variables

### Pattern Libraries (docs/)
- `docs/PATTERNS.md` - **Essential** database query patterns, distributed locking, aggregation best practices
- `docs/PERFORMANCE_GUIDE.md` - Frontend/backend optimization strategies, caching, lazy loading
- `docs/COMPONENT_GUIDE.md` - React component architecture, props, usage patterns
- `docs/PROMPT_ENGINEERING_GUIDE.md` - AI prompt structure and best practices
- `docs/API_DOCUMENTATION.md` - Complete API endpoint reference
- `server/ai/README.md` - AI prompt system documentation

**Start here for big picture**: `ARCHITECTURE.md` explains the "why" behind architectural decisions (Drizzle vs Prisma, Vite vs webpack, multi-layer security, etc.)

## TypeScript Strict Mode

This project uses strict TypeScript:
- No implicit `any`
- Strict null checks enabled
- No unused locals/parameters (warnings, not errors)
- All catch variables are `unknown` - must type guard

When you see type errors, fix them properly - don't use `any` or `@ts-ignore` without comment justification.
