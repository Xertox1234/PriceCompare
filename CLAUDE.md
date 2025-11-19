# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PriceCompare is a full-stack price comparison platform with AI-powered product discovery, web scraping, price tracking, and community features built with TypeScript.

**Tech Stack**: Express.js + React 19 + PostgreSQL + Redis + Drizzle ORM + Playwright (Chromium)

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 5000) with Vite HMR + TSX watch

# Testing
# ⚠️ NEVER run 'npm test' without permission - it launches browser instances
# ALWAYS run specific test files only:
npm test path/to/specific.test.ts  # Run specific test file
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
npm run test:security    # Security-specific tests only
npm run test:ai          # AI service tests only

# Building
npm run build            # Production build (Vite + esbuild)
npm start                # Run production server

# Database
npm run db:push          # Push schema changes (dev only - not for production)
npm run migrate          # Run production migrations from migrations/ directory

# Type Checking
npm run check            # TypeScript type check (no emit)

# Security
npm run security:scan    # Run security scanning scripts
npm run security:audit   # NPM audit (moderate+ severity)
npm run security:fix     # Auto-fix security vulnerabilities
npm run security:full    # Run all security checks + tests
```

## Pre-Commit Hook System

**MANDATORY**: All commits go through automated code review checks.

The project has a git pre-commit hook (`.git/hooks/pre-commit`) that enforces code quality standards:

### Commit Blockers (Will FAIL commits):
- ❌ `any` types in new code - Must use proper TypeScript types
- ❌ `console.log` in production code - Must use `log()` function or remove
- ❌ N+1 query patterns - Queries inside loops are forbidden
- ❌ passwordHash exposure - Never expose in database queries

### Warnings (Allow commits, but flag issues):
- ⚠️ Direct `db` imports in routes (should use `storage.ts`)
- ⚠️ Hardcoded hex colors (should use design tokens)
- ⚠️ Missing `createErrorResponse()` for error handling

**Bypass hook** (not recommended): `git commit --no-verify`

### Claude Code Hooks

Additionally, `.claude/hooks.json` configures the `code-review-specialist` agent to review commits made through Claude Code.

## Design System (MANDATORY for UI Work)

**All UI work MUST follow the design system** to maintain consistency.

### Key Design Requirements:
- **Colors**: Use design tokens (`bg-primary`, `text-secondary`) NOT hardcoded hex values
  - Primary: Blue 500 (#3B82F6) - Use `className="bg-primary"`
  - Secondary: Amber 500 (#F59E0B) - Use `className="bg-secondary"`
  - ❌ Never use old colors (purple #5A5DFF, pink #E91E63)

- **Typography**: Inter font (configured in `client/src/index.css`)
  - Automatic via `--font-sans` token

- **Components**: ALWAYS reuse existing shared components
  - Navigation: `SharedNavigation` from `@/components/shared-navigation`
  - Hero: `NewHeroSection` from `@/components/new-hero-section`
  - Categories: `NewCategories` from `@/components/new-categories`
  - ❌ Never duplicate components - search first with `grep -r "function ComponentName"`

- **Styling Rules**:
  - Use Tailwind classes, NOT inline styles (except truly dynamic values)
  - Test in both light and dark mode
  - Maintain WCAG AA contrast ratios

**See DESIGN_SYSTEM.md** (if it exists) for complete guidelines.

## Architecture Overview

### Dual Redis Client Architecture

The application uses **two separate Redis clients** for compatibility:
- **ioredis** (`redisClient`) - Used for caching, rate limiting, distributed locks
- **redis package** (`redisSessionClient`) - Used exclusively for session storage (connect-redis v9 requirement)

Both clients are initialized in `server/config/redis.ts`. Always use `getRedisClient()` for cache/rate limiting and `getRedisSessionClient()` for sessions.

**Critical**: Redis is MANDATORY in production. The server validates this at startup (`server/index.ts:81-90`) and exits if Redis is unavailable.

### Database Layer Pattern

**All database access flows through `server/storage.ts`** which implements the `IStorage` interface. Never query `db` directly from routes.

**Schema**: Single source of truth in `shared/schema.ts` (shared by client and server)

Pattern:
```typescript
// Route handler
import { storage } from './storage';

app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);
  res.json(product);
});
```

### Foreign Key Cascade Strategy

**ALL foreign keys MUST have explicit cascade rules** to prevent orphaned records and maintain referential integrity.

**Cascade Types:**
- **CASCADE** (`onDelete: 'cascade'`) - Child data is meaningless without parent, delete automatically
- **SET NULL** (`onDelete: 'set null'`) - Child data persists but reference becomes null
- **RESTRICT** (rare) - Prevent deletion if children exist

**Strategy Guidelines:**

1. **Use CASCADE when:**
   - Child records are meaningless without parent (e.g., productOffers → products)
   - Data is transactional/temporary (e.g., priceAlerts → users)
   - Relationship is ownership-based (e.g., watchLists → users)

2. **Use SET NULL when:**
   - Child should persist for historical/audit purposes (e.g., forumPosts → users)
   - Child has independent value (e.g., notifications → relatedPost)
   - You want to anonymize rather than delete (e.g., forumTopics → authorId)

3. **Examples from schema.ts:**
   ```typescript
   // CASCADE - Offers die with products
   productId: integer("product_id")
     .references(() => products.id, { onDelete: 'cascade' })
     .notNull(),

   // SET NULL - Posts persist, author anonymized
   authorId: integer("author_id")
     .references(() => users.id, { onDelete: 'set null' })
     .notNull(),
   ```

4. **Migration Pattern:**
   ```sql
   -- Drop existing constraint and recreate with CASCADE
   ALTER TABLE product_offers
     DROP CONSTRAINT IF EXISTS product_offers_product_id_fkey,
     ADD CONSTRAINT product_offers_product_id_fkey
       FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
   ```

**NEVER create foreign keys without cascade rules** - this causes silent data corruption over time.

### Route Organization

Routes are modular and registered in `server/routes/index.ts`:

**Core routes** (`server/routes/`):
- `auth-routes.ts` - Authentication (register, login, logout, password reset)
- `product-routes.ts` - Product search, details, price history
- `retailer-routes.ts` - Retailer management
- `alert-routes.ts` - Price alerts
- `admin-routes.ts` - Admin panel
- `forum-routes.ts` - Forum functionality
- `health-routes.ts` - Health checks

**Feature routes** (root `server/` directory):
- `scraping-routes.ts` - AI-powered web scraping
- `monitoring-routes.ts` - System monitoring dashboard
- `affiliate-routes.ts` - Affiliate link generation
- `price-history-routes.ts` - Historical price data
- `price-analytics-routes.ts` - Price trends and aggregations
- `notification-routes.ts` - User notifications
- `smart-alerts-routes.ts` - Advanced price alerting
- `community-routes.ts` - Community features
- `enhanced-forum-routes.ts` - Enhanced forum capabilities
- `advanced-search-routes.ts` - Advanced product search
- `discourse-routes.ts` - Discourse SSO integration
- `hybrid-data-routes.ts` - Hybrid data collection

### Middleware Pipeline Order (CRITICAL)

In `server/index.ts`, middleware **MUST** be in this exact order:

1. Sentry request/tracing handlers (first!)
2. Compression
3. Request size limiting
4. Body parsing
5. CORS
6. Security headers
7. Input sanitization
8. Rate limiting (Redis-based if available)
9. Session management
10. Passport initialization
11. CSRF token attachment
12. API caching
13. Performance monitoring
14. CSRF protection
15. Request logging
16. Routes
17. Sentry error handler
18. Error handler (last!)

**Why this order matters**: Security layers must process requests before business logic. CSRF tokens must be attached before protection is enforced. Error handlers must be last to catch all errors.

### Service Layer Architecture

Business logic lives in `server/services/` to keep routes thin:

**Core services**:
- `price-snapshot-service.ts` - Automated price tracking
- `distributed-lock.ts` - Prevent race conditions in distributed systems
- `job-lock-service.ts` - Distributed job locking for scheduled tasks
- `google-search.ts` - AI-powered product URL discovery
- `email-service.ts` - Transactional emails
- `password-reset-service.ts` - Secure password reset flow
- `websocket-service.ts` - Real-time notifications
- `alert-service.ts` - Price alert management
- `notification-service.ts` - User notification system
- `smart-alerts-service.ts` - Advanced alerting logic
- `price-history-service.ts` - Price history data management
- `trend-analysis-service.ts` - Price trend analysis
- `price-aggregation-service.ts` - Price data aggregation

**Caching services**:
- `redis-cache.ts` - Redis-based distributed cache
- `advanced-cache.ts` - Multi-layer caching with TTL management
- `analytics-cache.ts` - Analytics-specific caching
- `cache-warming.ts` - Proactive cache population
- `cache-invalidation.ts` - Smart cache invalidation

**Other services**:
- `affiliate-link-service.ts` - Affiliate URL generation
- `advanced-search.ts` - Advanced product search
- `hybrid-data-collector.ts` - Multi-source data collection
- `monitoring-service.ts` - System monitoring
- `community-service.ts` - Community features
- `popularity-tracker.ts` - Product popularity tracking
- `price-drop-detection.ts` - Price drop alerts
- `product-discovery-fallback.ts` - Fallback product discovery

### Background Jobs

Job queues in `server/jobs/` use Bull with Redis:

- `price-snapshot-queue.ts` - Scheduled price snapshots
- `price-history-jobs.ts` - Price history aggregation
- `price-analytics-jobs.ts` - Price analytics processing
- `cache-maintenance-jobs.ts` - Cache cleanup and warming

**Distributed job locking** (multi-server safety):
```typescript
import { jobLockService } from './services/job-lock-service';

cron.schedule('0 2 * * *', async () => {
  const result = await jobLockService.withLock(
    'price-snapshot:daily',
    async () => performDailySnapshot(),
    3600 // TTL in seconds
  );
  if (result === null) {
    log('Job skipped - already running on another server');
  }
});
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

## Security Patterns (MANDATORY)

### 1. Never Expose Password Hashes

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

### 2. Use Type-Safe Integer Parsing

```typescript
import { parseIntSafe, parseIntOptional } from './utils/validation-helpers';

// ❌ WRONG - no validation
const id = parseInt(req.params.id);

// ✅ CORRECT - safe parsing with validation
const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
```

### 3. Sanitize Errors in Production

```typescript
import { createErrorResponse } from './utils/error-sanitizer';

// ❌ WRONG - leaks implementation details
catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ CORRECT - sanitized error response
catch (error) {
  console.error('Operation failed:', error);
  const errorResponse = createErrorResponse(error, 'Operation');
  res.status(errorResponse.status).json({
    error: errorResponse.error,
    details: errorResponse.details // Only in development
  });
}
```

### 4. Input Validation with Zod

Every route input must be validated:

```typescript
import { insertProductSchema } from '@shared/schema';

app.post('/api/products', csrfProtection, async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    res.json(product);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'CreateProduct');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      details: errorResponse.details
    });
  }
});
```

## Database Query Patterns

### NEVER Write N+1 Queries

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

// ✅ BEST - Use array_agg() for grouped data
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

### When to use JOINs vs IN clause vs array_agg()

- **JOIN**: When you need related data for most/all records (1:1, 1:many)
- **IN clause**: When you need to batch-fetch optional related data or filter by IDs
- **array_agg()**: When you need grouped/nested data in a single query

## Transaction Boundaries (MANDATORY)

**ALL multi-step database operations MUST use transactions** to maintain data integrity and prevent partial updates.

### When to Use Transactions

Use transactions whenever you perform 2+ related database operations that must succeed or fail together:

1. **Create + Related Records**: Topic + first post, product + offers, user + profile
2. **Update + Related Updates**: Post creation + topic stats update, suspension + notification
3. **Delete + Cascading Deletes**: Alert deletion + notification cleanup
4. **Check-Then-Act**: User count check + admin creation (race condition prevention)
5. **Import Operations**: Batch imports that should be all-or-nothing

### Basic Transaction Pattern

```typescript
// ✅ CORRECT - Atomic multi-step operation
await db.transaction(async (tx) => {
  // Step 1: Create main record
  const [topic] = await tx.insert(forumTopics).values(topicData).returning();

  // Step 2: Create related record - must succeed or rollback topic
  await tx.insert(forumPosts).values({
    topicId: topic.id,
    ...postData
  });

  // Step 3: Update stats - must succeed or rollback all
  await tx.update(forumTopics)
    .set({ postCount: sql`${forumTopics.postCount} + 1` })
    .where(eq(forumTopics.id, topic.id));
});
```

### Transaction Isolation Levels

Use SERIALIZABLE isolation for operations with race condition risks:

```typescript
// ✅ CORRECT - Prevent race conditions with SERIALIZABLE
await db.transaction(async (tx) => {
  // Check if first user (count could change concurrently)
  const userCount = await tx.select({ count: sql`count(*)` }).from(users);
  const isFirstUser = parseInt(userCount[0].count as string) === 0;

  // Create user - role determined by count check
  await tx.insert(users).values({
    ...userData,
    role: isFirstUser ? 'admin' : 'user'
  }).returning();
}, {
  isolationLevel: 'serializable' // Prevent concurrent first-user race
});
```

**When to use SERIALIZABLE**:
- Counter/sequence calculations (postNumber, order numbers)
- Check-then-insert patterns (first user, duplicate prevention)
- Daily limit enforcement (notification limits)
- Any operation where concurrent execution could cause logical errors

**Default (READ COMMITTED)** is fine for:
- Simple multi-step creates with no conditionals
- Operations on records locked by primary key
- Sequential operations with no race condition risk

### Common Patterns

**Pattern 1: Create + Notification**
```typescript
// UX: User must be notified of important events
await db.transaction(async (tx) => {
  await tx.update(users).set({ isSuspended: true }).where(eq(users.id, userId));
  await tx.insert(notifications).values({
    userId,
    type: 'moderation',
    title: 'Account suspended',
    content: reason
  });
});
```

**Pattern 2: Record + Reputation Award**
```typescript
// DATA INTEGRITY: Reputation must match recorded achievements
await db.transaction(async (tx) => {
  const [deal] = await tx.insert(dealSpottings).values(dealData).returning();
  await tx.insert(userReputation).values({
    userId,
    reputationChange: points,
    relatedEntityId: deal.id
  });
});
```

**Pattern 3: Batch Import**
```typescript
// DATA INTEGRITY: All-or-nothing imports
return await db.transaction(async (tx) => {
  for (const item of importData) {
    const [list] = await tx.insert(watchLists).values(listData).returning();
    for (const product of item.products) {
      await tx.insert(productWatches).values({ listId: list.id, ...product });
    }
  }
  return { imported: importData.length };
});
```

### What NOT to Include in Transactions

- **External API calls**: Move these outside transactions (HTTP requests, email sending)
- **Long-running operations**: Keep transactions short to avoid lock contention
- **Read-only operations**: Use transactions only when writes need atomicity
- **Independent operations**: Don't wrap unrelated operations together

```typescript
// ❌ WRONG - External API call in transaction
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
  await sendWelcomeEmail(email); // DON'T DO THIS
});

// ✅ CORRECT - External calls after transaction
await db.transaction(async (tx) => {
  await tx.insert(users).values(userData);
});
// Email after successful commit
if (emailService.isReady()) {
  await sendWelcomeEmail(email);
}
```

### Security Notes

- Mark passwordHash usage with `// SECURITY: NEVER expose` to pass pre-commit hooks
- Transactions protect against partial updates but not SQL injection (still validate inputs)
- Use explicit field selection, never expose sensitive fields like passwordHash

### Performance Considerations

- Transaction overhead: <5ms typically
- Cost of data corruption: Potentially catastrophic
- **Always prefer correctness over premature optimization**
- Keep transactions short - acquire locks, do work, release quickly

### Related Issues

See GitHub issue #67 for the comprehensive audit that identified 13 missing transaction boundaries in the codebase.

## Path Aliases

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

## Multi-Level Caching Strategy

1. **L1 - In-memory cache** (`server/middleware/cache.ts`) - Fast, single-server
2. **L2 - Redis cache** (`server/middleware/redis-cache.ts`) - Distributed
3. **L3 - Database** (PostgreSQL) - Persistent source of truth
4. **Client - React Query** - Client-side state with staleTime/gcTime

Cache keys: `{resource}:{id}:{variant}` (e.g., `product:123:full`)

**TTL Guidelines**:
- Retailers: 1 hour (changes infrequently)
- Products: 5 minutes (prices update regularly)
- User sessions: 24 hours

## Constants & Configuration

All magic numbers in `server/utils/constants.ts`:

```typescript
import { CACHE_DURATION, RATE_LIMIT, PAGINATION } from './utils/constants';

app.use(cache({ duration: CACHE_DURATION.PRODUCTS }));
app.use(rateLimiter({ maxRequests: RATE_LIMIT.MAX_REQUESTS }));
```

## Environment Variables

**Required secrets** (generate with `openssl rand -base64 32`):
- `SESSION_SECRET` - Express session encryption
- `CSRF_SECRET` - CSRF token generation
- `DISCOURSE_SSO_SECRET` - Forum SSO integration
- `DATABASE_URL` - PostgreSQL connection string

**Optional but recommended**:
- `REDIS_URL` - Required in production for distributed systems
- `OPENAI_API_KEY` - For AI-powered features
- `SENTRY_DSN` - Error monitoring

## TypeScript Strict Mode

This project uses strict TypeScript:
- No implicit `any`
- Strict null checks enabled
- No unused locals/parameters (warnings, not errors)
- All catch variables are `unknown` - must type guard

Fix type errors properly - don't use `any` or `@ts-ignore` without comment justification.

## Chrome Extension Integration

Extension code in `extensions/chrome/` with own manifest.json:
- `background.js` - Service worker for price monitoring
- `content-scripts/price-detector.js` - Injected into retailer pages
- `popup/` - Extension UI (React components)

Extension shares types from `shared/` but runs independently from main app.

## Graceful Shutdown

The server implements graceful shutdown for SIGTERM/SIGINT signals in `server/index.ts`:

```typescript
async function gracefulShutdown(signal: string) {
  log(`${signal} received, starting graceful shutdown...`);

  try {
    // Close Redis connections (both ioredis and redis clients)
    log('Closing Redis connections...');
    await closeRedis();
    log('Redis connections closed');

    // Exit process
    log('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## Common Pitfalls to Avoid

1. **N+1 QUERIES**: NEVER query in a loop - always use JOINs or `inArray()` batch queries
2. **Redis required in production**: App validates this in `server/index.ts` and exits if missing
3. **CSRF tokens**: Attached by middleware, client must include in requests
4. **Type safety**: Enable strict mode, avoid `any` types
5. **Pagination**: Always paginate large datasets using `PAGINATION.DEFAULT_LIMIT`
6. **Input validation**: Every route input goes through Zod schema first
7. **Account lockout**: Failed logins trigger temporary lockouts (`server/middleware/account-lockout.ts`)
8. **Dual Redis clients**: Use correct client - `ioredis` for cache, `redis` package for sessions

## Documentation Reference

### Essential Reading
- `ARCHITECTURE.md` - System overview, diagrams, data flows, ADRs, caching strategy, deployment
- `SECURITY_GUIDELINES.md` - Security patterns (never expose passwords, sanitize errors, etc.)
- `.github/copilot-instructions.md` - Comprehensive development patterns

### Pattern Libraries (docs/)
- `docs/PATTERNS.md` - Database query patterns, distributed locking, aggregation best practices
- `docs/PERFORMANCE_GUIDE.md` - Frontend/backend optimization, caching, lazy loading
- `docs/COMPONENT_GUIDE.md` - React component architecture, props, usage patterns
- `docs/PROMPT_ENGINEERING_GUIDE.md` - AI prompt structure and best practices
- `docs/API_DOCUMENTATION.md` - Complete API endpoint reference
- `server/ai/README.md` - AI prompt system documentation

**Start here for big picture**: `ARCHITECTURE.md` explains the "why" behind architectural decisions.
- Always call the code-review-specialist sub agent to perform a code review on the files that were changed in that session.