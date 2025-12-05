# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PriceCompare is a full-stack price comparison platform with AI-powered product discovery, web scraping, price tracking, and community features built with TypeScript.

**Tech Stack**: Express.js + React 19 + PostgreSQL + Redis + Drizzle ORM + Playwright (Chromium)

## Browser Automation - MANDATORY REQUIREMENT

**⚠️ CRITICAL: This project uses Playwright EXCLUSIVELY for all browser automation and testing.**

**NEVER use Puppeteer.** All browser automation, web scraping, and E2E testing MUST use Playwright.

### Why Playwright Only:
- Modern API with better async/await support
- Superior cross-browser testing capabilities
- Built-in auto-waiting and retry logic
- Better TypeScript support
- Active development and Microsoft backing
- Already integrated throughout the codebase

### Usage:
```typescript
import { chromium } from '@playwright/test';

// Launch browser
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Navigate and interact
await page.goto('https://example.com');
await page.locator('button').click();

// Cleanup
await context.close();
await browser.close();
```

**If you find ANY references to Puppeteer in the codebase, remove them immediately and replace with Playwright equivalents.**

## Subagent Usage
Use orchestrator for complex tasks requiring multiple domains.
Direct subagent delegation for focused work:
- "Use backend-architect to implement..."
- "Use frontend-specialist to create..."
- "Use test-engineer to add tests for..."

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
npm run test:e2e         # E2E tests with Playwright
npm run test:e2e:headed  # E2E tests with visible browser
npm run test:e2e:ui      # Playwright UI mode for debugging

# Linting (NEW - enforced in CI/CD)
npm run lint             # Run ESLint on all files (zero warnings tolerance)
npm run lint:fix         # Auto-fix ESLint issues where possible
npm run lint:security    # Security-specific ESLint rules

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
- ❌ TypeScript errors (must pass `npm run check`)
- ❌ ESLint errors (must pass `npm run lint`)
- ❌ `any` types in new code - Must use proper TypeScript types
- ❌ `console.log` in production code - Must use `log()` function or remove
- ❌ N+1 query patterns - Queries inside loops are forbidden
- ❌ passwordHash exposure - Never expose in database queries
- ❌ Floating promises - All promises must be awaited or handled
- ❌ Foreign keys without cascade rules - Must specify onDelete behavior

### Warnings (Allow commits, but flag issues):
- ⚠️ Direct `db` imports in routes (should use `storage.ts`)
- ⚠️ Hardcoded hex colors (should use design tokens)
- ⚠️ Legacy error handling patterns (should use `sendSuccess/sendError/sendErrorFromException`)
- ⚠️ Missing transaction boundaries for multi-step operations
- ⚠️ Missing CSRF protection on mutating routes

**Bypass hook** (not recommended): `git commit --no-verify`

### Working with the Pre-Commit Hook

**Key Patterns:**
- **Security markers must be inline:** `passwordHash: 'hash', // SECURITY: Test data only`
- **Remove unused variables:** Don't declare if unused, or prefix with `_`
- **Read hook output:** It provides specific fixes and examples
- **Never bypass casually:** Bypassing creates technical debt

**See `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` for complete guide** including:
- Inline security marker patterns
- Common hook failures and solutions
- Blocker vs warning classification
- Real-world examples from project commits

### Claude Code Hooks

Additionally, `.claude/hooks.json` configures the `code-review-specialist` agent to review commits made through Claude Code.

## ESLint Enforcement (NEW)

**ESLint is STRICTLY enforced** with **zero warnings tolerance** at multiple layers:

### Enforcement Layers

1. **Pre-Commit Hook** - Blocks commits with ESLint errors
2. **GitHub Actions** - Blocks PR merges with ESLint errors or warnings
3. **IDE Integration** (recommended) - Shows errors as you type

### Strict Rules Enforced

**Type Safety (ERRORS):**
- `@typescript-eslint/no-explicit-any` - No `any` types allowed
- `@typescript-eslint/no-unsafe-*` - No unsafe type operations
- `@typescript-eslint/no-floating-promises` - Must await/catch all promises
- `@typescript-eslint/no-misused-promises` - No promises in conditions
- `@typescript-eslint/await-thenable` - Only await actual promises

**Code Quality (ERRORS):**
- `@typescript-eslint/no-unused-vars` - Clean up unused variables
- `no-var` - Use const/let, never var
- `prefer-const` - Use const for immutable values
- `eqeqeq` - Strict equality (===) required
- `no-throw-literal` - Throw Error objects only

**Security (ERRORS):**
- `no-console` - Use structured logger from utils/logger.ts
- `no-debugger` - No debugger statements
- `no-eval` - No eval() or Function() constructor

### Common ESLint Fixes

**Floating Promises:**
```typescript
// ❌ WRONG - Promise not awaited
emailService.sendWelcome(user.email);

// ✅ CORRECT - Await it
await emailService.sendWelcome(user.email);

// ✅ ALSO CORRECT - Handle errors explicitly
emailService.sendWelcome(user.email).catch(err => log.error(err));

// ✅ ALSO CORRECT - Explicit fire-and-forget
void emailService.sendWelcome(user.email);
```

**See `docs/ESLINT_ENFORCEMENT.md` for complete guide with examples and fixes.**

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
  - Hero: `HeroSection` from `@/components/hero-section`
  - Categories: `Categories` from `@/components/categories`
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

**CRITICAL - Production Requirement**:
- Redis is **MANDATORY** in production environments
- Application will **EXIT ON STARTUP** if `REDIS_URL` is not configured in production
- Validated at 4 levels: environment validation, Redis initialization, session store, rate limiter
- Development mode allows in-memory fallback (with prominent warnings)
- See `REDIS_PRODUCTION_REQUIREMENT.md` for complete testing guide and deployment examples

### Database Layer Pattern

**All database access flows through `server/storage.ts`** which implements the `IStorage` interface. Never query `db` directly from routes or services.

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

**Storage Layer Exception**: `price-aggregation-service.ts` is the ONLY service with direct `db` access (documented exception). It passes transaction contexts between private helper methods for complex atomic operations. All other services MUST use the storage layer.

**Migration Status** (as of Phase 7 completion):
- ✅ 14/15 services migrated to storage layer
- ✅ All routes use storage layer
- ⚠️ 1 documented exception: `price-aggregation-service.ts` (complex transaction context passing)
- 📊 ~86 storage methods implemented

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
   - Child should persist for historical/audit purposes (e.g., priceHistory → products)
   - Child has independent value (e.g., notifications → relatedPost)
   - You want to anonymize rather than delete (e.g., reviews → authorId)

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

All routes are consolidated in `server/routes/` and registered via `server/routes/index.ts`:

**Core routes**:
- `auth-routes.ts` - Authentication (register, login, logout, password reset)
- `product-routes.ts` - Product search, details, price history
- `retailer-routes.ts` - Retailer management
- `alert-routes.ts` - Price alerts
- `admin-routes.ts` - Admin panel
- `health-routes.ts` - Health checks
- `watchlist-routes.ts` - Watch list and product watch management
- `helpers.ts` - Shared middleware: `withAuth`, `withAdmin`, `isAuthenticated`

**Feature routes**:
- `scraping-routes.ts` - AI-powered web scraping
- `monitoring-routes.ts` - System monitoring dashboard
- `affiliate-routes.ts` - Affiliate link generation
- `price-history-routes.ts` - Historical price data
- `price-analytics-routes.ts` - Price trends and aggregations
- `notification-routes.ts` - User notifications
- `smart-alerts-routes.ts` - Advanced price alerting
- `community-routes.ts` - Community features
- `advanced-search-routes.ts` - Advanced product search
- `aggregation-metrics-routes.ts` - Price aggregation metrics
- `admin-aggregation-routes.ts` - Admin aggregation endpoints
- `cache-routes.ts` - Cache management

**Route Import Paths** (CRITICAL for nested routes):
Since routes are in `server/routes/`, imports must use `../` to reach parent directories:
```typescript
// ✅ CORRECT - from server/routes/*.ts
import { logger } from "../utils/logger";
import { createErrorResponse } from "../utils/error-sanitizer";
import { withAuth } from "./helpers";

// ❌ WRONG - these paths don't resolve from routes/ subdirectory
import { logger } from "./utils/logger";
```

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

## API Response Standardization (MANDATORY)

**Status:** 100% migrated (217/217 endpoints + all middleware as of 2025-11-28)

All API routes AND middleware MUST use standardized response helpers from `server/utils/api-response.ts`:

```typescript
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
```

### Response Format

**Success responses:**
```json
{
  "success": true,
  "data": <your_data_here>
}
```

**Error responses:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": "Additional context (development only)"
}
```

### Helper Functions

1. **sendSuccess(res, data, status?)** - Send successful response
   - Default status: 200
   - Use 201 for resource creation
   - Automatically wraps data in envelope

2. **sendError(res, message, status, details?)** - Send explicit error
   - Use for known error conditions (404, 400, etc.)
   - Sanitizes error messages in production
   - **Flexible details parameter:**
     - `string` details: Development-only (filtered in production for security)
     - `Record<string, unknown>` details: Always included (for client UX like `retryAfter`, `locked`)

3. **sendErrorFromException(res, error, context)** - Send error from caught exception
   - Handles Zod validation errors (400)
   - Sanitizes stack traces in production
   - Logs errors automatically
   - Use in catch blocks

### Migration Status

**COMPLETE** - All routes and middleware migrated. When working with routes OR middleware:
- ✅ Use new helpers: `sendSuccess/sendError/sendErrorFromException`
- ❌ Avoid legacy: `createErrorResponse()` + manual `res.json()`
- ❌ Never manually create envelope: `res.json({ success: true, data: ... })`

### Middleware Error Responses (MANDATORY - 100% Coverage)

**ALL middleware error responses MUST use `sendError()` helper:**

**EXCEPTION - Error Handler Middleware:**

The centralized error handler (`server/middleware/error-handler.ts`) is EXEMPT from using `sendError()` helpers because:

1. **Architectural Layer**: Error handler IS the implementation layer for error responses (not a consumer)
2. **Safety Net**: Last-resort handler should not depend on higher-level abstractions
3. **Format Consistency**: Achieved through standardized envelope format, not code sharing

**Format Consistency**: Achieved through manual responses that match the standardized envelope format:
```typescript
{
  success: false,
  error: string,
  code?: string,
  details?: unknown
}
```

**Exception-to-Exception**: The `notFoundHandler()` function within error-handler.ts DOES use `sendError()` because it's route-like (handles specific 404 case), not a catch-all error handler.

**Example (error-handler.ts)**:
```typescript
// Manual response (intentional) - matches sendError() envelope format
if (err instanceof AppError) {
  return res.status(err.statusCode).json(err.toJSON());
  // Returns: { success: false, error, code, statusCode }
}

// Exception uses helper (route-like, not catch-all)
export function notFoundHandler(req: Request, res: Response, _next: NextFunction) {
  sendError(res, 'Route not found', 404, {
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}
```

**See**: `docs/ADR_ERROR_HANDLER_EXEMPTION.md` for complete architectural decision, error flow analysis, and implementation details.

```typescript
// ❌ WRONG - Manual JSON error response in middleware
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

// ✅ CORRECT - Use sendError() helper
import { sendError } from './utils/api-response';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}
```

**Applies to all middleware types:**
- Authentication (`server/auth.ts` - requireAuth, requireAdmin)
- Validation (`server/validation.ts` - validateRequest, validateMultiple)
- Rate limiting, CSRF, account lockout, request limits, error handlers

**Rich Metadata Pattern (for rate limiting, lockouts):**

```typescript
// Use object details to include client-useful metadata
sendError(res, 'Account temporarily locked', 429, {
  locked: true,
  remainingTime: lockStatus.remainingTime,
  message: `Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
  attempts: lockStatus.attempts,
});
// Response: { success: false, error: '...', locked: true, remainingTime: 847, ... }

// Also set HTTP standard headers where applicable
res.setHeader('Retry-After', retryAfterSeconds.toString());
```

**See `docs/MIDDLEWARE_API_PATTERNS.md` for complete patterns and examples.**

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

### 3. Use Standardized API Response Helpers (MANDATORY)

**ALL routes must use standardized response helpers** from `server/utils/api-response.ts`:

```typescript
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

// ✅ CORRECT - Standardized success response
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProductById(id);

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
    // Response: { success: true, data: product }
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
    // Response: { success: false, error: "message", details?: "..." }
  }
});

// ✅ CORRECT - 201 status for creation
app.post('/api/products', async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    sendSuccess(res, product, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'CreateProduct');
  }
});
```

**Anti-Pattern: Nested Response Wrappers (CRITICAL)**

NEVER manually wrap data with `success` or `data` fields - the helpers provide the envelope:

```typescript
// ❌ WRONG - Creates double-nested envelope
sendSuccess(res, {
  success: true,
  data: metrics
});
// Results in: { success: true, data: { success: true, data: metrics } }

// ✅ CORRECT - Pass data directly
sendSuccess(res, metrics);
// Results in: { success: true, data: metrics }
```

**Legacy Pattern (DEPRECATED):**

The old `createErrorResponse()` pattern is being phased out (87% migrated as of 2025-11-27):

```typescript
// ⚠️ DEPRECATED - Don't use in new code
import { createErrorResponse } from '../utils/error-sanitizer';
const errorResponse = createErrorResponse(error, 'Context');
res.status(errorResponse.status).json({ error: errorResponse.error });
```

### 4. Input Validation with Zod

Every route input must be validated:

```typescript
import { insertProductSchema } from '@shared/schema';
import { sendSuccess, sendErrorFromException } from '../utils/api-response';

app.post('/api/products', csrfProtection, async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    sendSuccess(res, product, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'CreateProduct');
  }
});
```

### 5. CSRF Protection (MANDATORY)

**ALL mutating operations (POST, PUT, PATCH, DELETE) MUST use `csrfProtection` middleware.**

```typescript
import { csrfProtection } from '../middleware/security';
import { withAuth, withAdmin } from './helpers';

// ✅ CORRECT - CSRF before auth (fast token check, fails early)
app.post('/api/products',
  csrfProtection,     // 1. Verify CSRF token
  withAuth(async (req, res) => {  // 2. Verify authentication
    // 3. Execute business logic
  })
);

// ✅ CORRECT - Auth endpoints MUST have CSRF
app.post('/api/auth/register', csrfProtection, async (req, res) => {
  // Prevents unauthorized account creation
});

// ✅ CORRECT - Token endpoint for unauthenticated clients
app.get('/api/csrf-token', (req, res) => {
  const token = generateCsrfToken(req);
  sendSuccess(res, { csrfToken: token });
});

// ❌ CRITICAL MISTAKE - NEVER use global CSRF
// In server/index.ts:
app.use(csrfProtection);  // ❌ Causes double-protection, blocks GET requests
```

**Key CSRF Rules:**
- Apply per-route, NOT globally
- CSRF middleware BEFORE auth middleware (csrfProtection → withAuth)
- Auth endpoints (/register, /login, /forgot-password, /reset-password) need CSRF
- Exemptions rare and must be justified (see `docs/SECURITY_PATTERNS.md`)

**See `docs/SECURITY_PATTERNS.md` for complete CSRF implementation guide.**

### 6. Use Route Helpers for Auth

Always use shared helpers from `server/routes/helpers.ts`:

```typescript
import { withAuth, withAdmin } from "./helpers";

// ✅ CORRECT - Use shared helper
app.get("/api/protected", withAuth(async (req, res) => {
  const user = req.user!; // Auth guaranteed by withAuth
  // ...
}));

// ✅ Admin-only route
app.delete("/api/admin/users/:id", withAdmin(async (req, res) => {
  // Admin access guaranteed
}));

// ❌ WRONG - Don't define inline auth middleware
app.get("/api/data", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  // ...
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

1. **Create + Related Records**: Product + offers, user + profile, watchlist + items
2. **Update + Related Updates**: Price update + history record, suspension + notification
3. **Delete + Cascading Deletes**: Alert deletion + notification cleanup
4. **Check-Then-Act**: User count check + admin creation (race condition prevention)
5. **Import Operations**: Batch imports that should be all-or-nothing

### Basic Transaction Pattern

```typescript
// ✅ CORRECT - Atomic multi-step operation
await db.transaction(async (tx) => {
  // Step 1: Create main record
  const [product] = await tx.insert(products).values(productData).returning();

  // Step 2: Create related record - must succeed or rollback product
  await tx.insert(productOffers).values({
    productId: product.id,
    ...offerData
  });

  // Step 3: Update stats - must succeed or rollback all
  await tx.update(retailers)
    .set({ productCount: sql`${retailers.productCount} + 1` })
    .where(eq(retailers.id, offerData.retailerId));
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

The application uses a sophisticated multi-tier caching system with automatic invalidation:

### Cache Layers

1. **L1 - In-memory cache** (`AdvancedCacheService`) - Fastest, single-server, 1000 items, 60s TTL
2. **L2 - Redis cache** (`AdvancedCacheService`) - Distributed across servers
3. **L3 - Database** (PostgreSQL) - Persistent source of truth
4. **Client - React Query** - Client-side state with staleTime/gcTime

### Storage Cache Service (NEW - Issue #125)

**All storage layer access now flows through `storageCache`** for automatic caching:

```typescript
// ✅ CORRECT - Use storageCache wrapper
import { storageCache } from './services/storage-cache';

app.get('/api/products/:id', async (req, res) => {
  const product = await storageCache.getProductById(id);  // Cached
  sendSuccess(res, product);
});

// ❌ WRONG - Direct storage access bypasses cache
const product = await storage.getProductById(id);  // No caching
```

**Key Features**:
- **Automatic invalidation**: Updates/deletes automatically clear caches
- **Cache warming**: Critical caches (retailers) pre-loaded on startup
- **Versioned keys**: `CacheKeys.PRODUCT.FULL(id)` from `server/utils/cache-keys.ts`
- **Cache bypass**: Admin users can use `?skipCache=1` query parameter
- **Metrics logging**: Performance metrics logged every minute

**Cache Tiers (by access pattern)**:
- **STATIC** (1 hour): Retailers (admin-only changes)
- **WARM** (10 min): Products, Users (frequently accessed)
- **COLD** (3 min): Search results (occasionally accessed)
- **HOT** (30 min): Frequently accessed data
- **COMPUTED** (30 min): Expensive calculations

**Cache Key Versioning**:
```typescript
// Increment CACHE_VERSION in server/utils/cache-keys.ts when schema changes
const CACHE_VERSION = 1;

// Old keys become stale automatically - zero-downtime migrations
CacheKeys.PRODUCT.FULL(123)  // Returns: "product:full:v1:123"
```

**Cache Invalidation Pattern**:
```typescript
// In storage layer after update/delete
await storageCache.invalidateProductCache(productId);
// Invalidates: product:full:v1:123 + pattern: product:search:v1:*
```

**TTL Guidelines**:
- Retailers: 1 hour (STATIC tier - changes infrequently)
- Products: 10 minutes (WARM tier - prices update regularly)
- Search: 3 minutes (COLD tier - varies by query)
- User sessions: 24 hours

## Constants & Configuration

All magic numbers in `server/utils/constants.ts`:

```typescript
import { CACHE_DURATION, RATE_LIMIT, PAGINATION } from './utils/constants';

app.use(cache({ duration: CACHE_DURATION.PRODUCTS }));
app.use(rateLimiter({ maxRequests: RATE_LIMIT.MAX_REQUESTS }));
```

## Environment Variables

**Required in ALL environments** (generate with `openssl rand -base64 32`):
- `SESSION_SECRET` - Express session encryption
- `CSRF_SECRET` - CSRF token generation
- `DATABASE_URL` - PostgreSQL connection string

**Required in PRODUCTION** (app will exit if missing):
- `REDIS_URL` - **MANDATORY** for distributed rate limiting, sessions, and caching
  - Format: `redis://hostname:6379` or `rediss://user:pass@host:port` (SSL)
  - Recommended providers: Upstash, Redis Cloud, AWS ElastiCache
  - In development: Optional (falls back to in-memory with warnings)
  - In production: **Application will fail to start without this**

**Optional but recommended**:
- `OPENAI_API_KEY` - For AI-powered features
- `SENTRY_DSN` - Error monitoring and performance tracking

## TypeScript Strict Mode & Enforcement

**CRITICAL**: This project has **ZERO TOLERANCE** for `any` types. Type safety is enforced at multiple layers.

### Enforcement Layers (Defense in Depth)

#### 1. ESLint (Real-Time - IDE)
**Location**: `.eslintrc.json`

Blocks `any` types immediately in your editor:
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}
```

**IMPORTANT**: Test files get NO exception - they must use proper types too!

#### 2. Pre-Commit Hook (Commit-Time)
**Location**: `.git/hooks/pre-commit`

Runs on every commit:
- `npm run check` - TypeScript compiler check
- `npx eslint` - Lint all staged files for `any` types
- Custom grep checks - Catches `any` in diffs

**Commits are BLOCKED if any layer fails.**

#### 3. TypeScript Compiler (Build-Time)
**Location**: `tsconfig.json`

Strict mode configuration:
- `strict: true` - All strict checks enabled
- `noImplicitAny: true` - No implicit any
- `strictNullChecks: true` - Null safety
- `strictFunctionTypes: true` - Function type safety

#### 4. Claude Code Context (Development-Time)
**Location**: `.claude/rules.md`

Provides Claude Code with comprehensive type safety rules:
- Why `any` is forbidden
- What to use instead (unknown, generics, Record, etc.)
- Test file requirements
- Type guard patterns
- Common scenarios with solutions

### Type Safety Rules

#### ✅ ALWAYS Use These Instead of `any`:

1. **Specific Types from Schema**
   ```typescript
   import { type Product, type SafeUser } from '@shared/schema';
   let product: Product;
   let user: SafeUser;
   ```

2. **`unknown` for Truly Unknown Data**
   ```typescript
   function handleError(error: unknown) {
     if (error instanceof Error) {
       return error.message;
     }
     return 'Unknown error';
   }
   ```

3. **Generic Types**
   ```typescript
   async function fetchData<T>(url: string): Promise<T> {
     const response = await fetch(url);
     return response.json();
   }
   ```

4. **Record Types**
   ```typescript
   const config: Record<string, unknown> = {};
   const settings: Record<string, string | number> = {};
   ```

#### ❌ NEVER Do This:
```typescript
let data: any;                    // BLOCKED by ESLint
function process(item: any) {}    // BLOCKED by ESLint
const items: any[] = [];          // BLOCKED by ESLint

// Test files - NO EXCEPTION!
describe('Test', () => {
  let testData: any;  // BLOCKED - use proper types!
});
```

### Test File Requirements

**Test files must have same type safety standards as production code.**

```typescript
// ✅ CORRECT
import { type Product, type Retailer } from '@shared/schema';

describe('Product API', () => {
  let testProduct: Product;
  let testRetailer: Retailer;

  beforeEach(async () => {
    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description',
    }).returning();
  });
});
```

### Quick Reference

| Situation | Use This | Not This |
|-----------|----------|----------|
| API response | `Promise<User>` + validation | `Promise<any>` |
| Unknown data | `unknown` + type guard | `any` |
| Test variables | `Product`, `SafeUser` | `any` |
| Generic function | `<T>` | `any` |
| Dynamic object | `Record<string, unknown>` | `any` |
| Error handling | `error: unknown` | `error: any` |

### Why This Matters

1. **`any` defeats TypeScript** - Disables all type checking
2. **Hides bugs** - Type errors become runtime crashes
3. **No IntelliSense** - Loses autocomplete and type hints
4. **Technical debt** - Makes refactoring dangerous
5. **Late-stage unacceptable** - Finding `any` indicates type discipline gaps

### Additional Strict Mode Settings

- No implicit `any`
- Strict null checks enabled
- No unused locals/parameters (warnings, not errors)
- All catch variables are `unknown` - must type guard

**See `.claude/rules.md` for comprehensive type safety guide.**
**See `docs/TYPESCRIPT_PATTERNS.md` for detailed patterns and examples.**

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
2. **Direct DB access**: NEVER import `db` directly in routes or services (except `price-aggregation-service.ts`)
   - Always use `storage` abstraction layer for database operations
   - See storage layer migration (TODO 031) for complete migration guide
   - Exception: `price-aggregation-service.ts` has documented justification
3. **Redis MANDATORY in production**: Application will **FAIL TO START** if `REDIS_URL` not set in production
   - Validated at startup in `server/config/env-validation.ts` and `server/index.ts`
   - Development allows fallback with warnings, production exits with error
   - See `REDIS_PRODUCTION_REQUIREMENT.md` for testing guide
4. **CSRF Protection**: ALL mutations (POST/PUT/PATCH/DELETE) MUST have `csrfProtection` middleware
   - Apply per-route, NOT globally (never `app.use(csrfProtection)`)
   - CSRF before auth middleware (`csrfProtection, withAuth`)
   - Auth endpoints (/register, /login, /forgot-password, /reset-password) need CSRF
   - See `docs/SECURITY_PATTERNS.md` for complete guide
5. **Type safety**: Enable strict mode, avoid `any` types
6. **Pagination**: Always paginate large datasets using `PAGINATION.DEFAULT_LIMIT`
7. **Input validation**: Every route input goes through Zod schema first
8. **Account lockout**: Failed logins trigger temporary lockouts (`server/middleware/account-lockout.ts`)
9. **Dual Redis clients**: Use correct client - `ioredis` for cache, `redis` package for sessions
10. **NPM Overrides**: Track temporary security overrides in `docs/NPM_OVERRIDES_TRACKING.md`
    - Use overrides ONLY for security patches (patch versions: x.y.Z)
    - Document CVE/GHSA reference, removal trigger, and monitoring plan
    - Review monthly and remove when parent package updates
    - See `docs/04_SECURITY_PATTERNS.md` (Dependency Security section)

## Pattern Documentation (CRITICAL)

**ALWAYS consult these pattern files before implementing features** - they codify lessons learned and prevent repeated mistakes:

### Core Pattern Files (docs/) - CONSOLIDATED 2025-11-29

**⚠️ IMPORTANT: Pattern files were consolidated from 21 files into 7 domain-specific files. Use ONLY these:**

1. **`docs/01_TYPESCRIPT_PATTERNS.md`** - Type safety, async/await, floating promises, `void` operator, Zod integration (CRITICAL)
2. **`docs/02_DATABASE_PATTERNS.md`** - N+1 prevention, transactions, storage layer, schema design, query optimization (CRITICAL)
3. **`docs/03_API_PATTERNS.md`** - Routes, middleware pipeline, testing, service integration, error handling (CRITICAL)
4. **`docs/04_SECURITY_PATTERNS.md`** - Auth, CSRF protection (SINGLE SOURCE OF TRUTH), validation, password security (CRITICAL)
5. **`docs/05_FRONTEND_PATTERNS.md`** - React, React Query, forms, pagination, state management
6. **`docs/06_ERROR_HANDLING_PATTERNS.md`** - Error responses, PostgreSQL error codes, sanitization, recovery
7. **`docs/07_BACKGROUND_JOBS_PATTERNS.md`** - Bull queues, cron jobs, distributed locking

**Each pattern has ONE canonical location. Old files (PHASE0, PHASE1, etc.) have been merged and archived.**

### Additional Documentation
- `ARCHITECTURE.md` - System overview, diagrams, data flows, ADRs, caching strategy
- `.github/WORKFLOWS.md` - GitHub Actions workflows, CI/CD pipeline documentation (NEW)
- `.github/copilot-instructions.md` - Comprehensive development patterns (mirrors core patterns)
- `docs/COMPONENT_GUIDE.md` - React component architecture, props, usage patterns
- `docs/API_DOCUMENTATION.md` - Complete API endpoint reference
- `docs/AFFILIATE_REQUIREMENTS.md` - Retailer affiliate program requirements and setup
- `docs/NPM_OVERRIDES_TRACKING.md` - Active npm overrides monitoring and removal tracking (NEW)
- `server/ai/README.md` - AI prompt system documentation

### Learnings Documentation (Real-World Examples)
- `docs/LEARNINGS_TODO_002_BODY_PARSER_FIX.md` - Transitive dependency security fix pattern (2025-12-02)
- `docs/LEARNINGS_TODO_006_DISCUSSION_COUNT.md` - Identifying and resolving duplicate TODOs (2025-12-03)
- `docs/LEARNINGS_TODO_010_BATCH_INSERT.md` - Batch insert optimization implementation (2025-12-03)
- `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` - Working with pre-commit hooks, security markers, and common fixes (2025-12-03)
- `docs/LEARNINGS_TODO_2026_ZOD_CHECK_CONSTRAINTS.md` - Zod validation for DECIMAL fields with Drizzle ORM type preservation (2025-12-04)
- `docs/LEARNINGS_TODO_162_MIDDLEWARE_STANDARDIZATION.md` - Parallel vs sequential execution, flexible API signatures, architectural exceptions (2025-12-04)

### Subagent Documentation (.claude/knowledge/)
- `claude-code-subagent-setup-guide.md` - Complete subagent system guide
- `subagent-quick-reference.md` - Quick reference for delegation patterns

**Pattern files save time**: They document what NOT to do (anti-patterns) and what TO do (correct patterns) with real code examples from this codebase.

## Code Review Workflow

**After implementing features or making changes:**
- Always invoke the `code-review-specialist` subagent to review files changed in the session
- The agent will check against all pattern files and pre-commit hook requirements
- Address any critical issues before committing