# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PriceCompare is a full-stack price comparison platform with AI-powered product discovery, web scraping, price tracking, and community features built with TypeScript.

**Tech Stack**: Express.js + React 19 + PostgreSQL + Redis + Drizzle ORM + Playwright (Chromium)

## Browser Automation - MANDATORY REQUIREMENT

**⚠️ CRITICAL: This project uses Playwright EXCLUSIVELY for all browser automation and testing.**

**NEVER use Puppeteer, axios+cheerio, or any other scraping library.** All browser automation, web scraping, and E2E testing MUST use Playwright.

### ❌ FORBIDDEN (Will be rejected in code review)

```typescript
// ❌ WRONG - axios + cheerio CANNOT handle JavaScript-rendered content
import axios from 'axios';
import * as cheerio from 'cheerio';

const response = await axios.get(url);  // Gets static HTML only
const $ = cheerio.load(response.data);  // Cannot execute JavaScript
const price = $('.price').text();       // Empty if JS-rendered ❌

// ❌ WRONG - Puppeteer is NOT supported
import puppeteer from 'puppeteer';      // Use Playwright instead
```

### ✅ REQUIRED (Playwright pattern)

```typescript
// ✅ CORRECT - Playwright executes JavaScript and waits for dynamic content
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  viewport: { width: 1920, height: 1080 },
});
const page = await context.newPage();

try {
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  // Wait for JavaScript to render content
  await page.waitForSelector('.price', { timeout: 10000 });

  // Extract data AFTER JavaScript execution
  const price = await page.locator('.price').textContent();

} finally {
  // ALWAYS cleanup to prevent memory leaks
  await context.close();
  await browser.close();
}
```

### Why Playwright is Mandatory

**Modern websites use JavaScript frameworks** (React, Vue, Angular):
- **axios+cheerio**: Gets raw HTML before JS executes → empty selectors ❌
- **Playwright**: Launches real browser, executes JavaScript → full content ✅

**Evidence**: See `docs/SCRAPING_AXIOS_CHEERIO_FAILURES.md` for proof that axios+cheerio fails on 100% of modern e-commerce sites (Amazon, Walmart, Target).

### Pre-Commit Enforcement

The pre-commit hook blocks commits with forbidden imports:

```bash
# Blocked patterns
grep -r "from 'axios'" server/agents/     # ❌ Will fail commit
grep -r "import.*cheerio" server/agents/  # ❌ Will fail commit
grep -r "puppeteer" server/               # ❌ Will fail commit
```

**If you need to scrape a website, ALWAYS use Playwright.** See `server/agents/extraction-agent.ts` for the reference implementation.

## Development Commands

```bash
# Development
npm run dev              # Start dev server (port 5000)
npm test                 # Vitest tests (unit/integration)
npm run test:e2e         # Playwright E2E tests

# Quality
npm run lint             # ESLint (zero warnings tolerance)
npm run format           # Format with Prettier
npm run check            # TypeScript type check

# Database
npm run db:push          # Push schema changes (dev only)
npm run migrate          # Run production migrations

# Security
npm run security:full    # All security checks + tests
```

## Test Database Setup

**Quick Setup:**

```bash
createdb pricecompare_test
npm test
```

**Smart defaults** from `server/test/setup.ts`:
- User: Your system username
- Password: Empty (trust/peer auth)
- Host: localhost
- Database: pricecompare_test

**Custom configuration** in `.env.test`:

```bash
DATABASE_USER=your_username
DATABASE_PASSWORD=your_password
DATABASE_URL=postgresql://user:pass@localhost:5432/pricecompare_test
```

**See test setup file for troubleshooting** common errors (role doesn't exist, connection refused, etc.)

## Pre-Commit Hook System

**MANDATORY**: All commits go through automated code review checks.

### Commit Blockers (Will FAIL commits):

- ❌ TypeScript errors
- ❌ ESLint errors
- ❌ `any` types in new code
- ❌ `console.log` in production code
- ❌ N+1 query patterns
- ❌ passwordHash exposure
- ❌ Floating promises
- ❌ Foreign keys without cascade rules

### Warnings (Allow commits, flag issues):

- ⚠️ Direct `db` imports in routes (use `storage.ts`)
- ⚠️ Hardcoded hex colors (use design tokens)
- ⚠️ Legacy error handling (use `sendSuccess/sendError/sendErrorFromException`)
- ⚠️ Missing transaction boundaries
- ⚠️ Missing CSRF protection
- ⚠️ Local timezone date methods (use UTC)

**See `docs/learnings/pre-commit/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` for complete guide.**

## ESLint & Prettier Enforcement

**ESLint** enforced with **zero warnings tolerance**:
- Pre-commit hook blocks commits
- GitHub Actions blocks PR merges
- IDE shows errors in real-time

**Prettier** auto-formats on commit via `lint-staged`.

**Key ESLint rules:**
- No `any` types
- No floating promises (must await/catch/void)
- No console.log (use `log()` from utils/logger)
- Strict equality (===)

**See `docs/ESLINT_ENFORCEMENT.md` for fixes.**

## Design System

**All UI work MUST follow the design system:**

- **Colors**: Use tokens (`bg-primary`, `text-secondary`) NOT hex values
- **Typography**: Inter font via `--font-sans` token
- **Components**: ALWAYS reuse from `@/components/*` - never duplicate
- **Styling**: Tailwind classes, test light/dark mode, WCAG AA contrast

## Architecture Overview

### Dual Redis Client Architecture

- **ioredis** - Caching, rate limiting, distributed locks
- **redis package** - Session storage only (connect-redis v9)

**CRITICAL**: Redis **MANDATORY** in production. App will **EXIT ON STARTUP** without `REDIS_URL`.

### Database Layer Pattern

**All database access flows through `server/storage.ts`**. Never query `db` directly from routes/services.

**Exception**: `price-aggregation-service.ts` only (documented justification for transaction context passing).

```typescript
import { storage } from './storage';

app.get('/api/products/:id', async (req, res) => {
  const product = await storage.getProductById(id);
  sendSuccess(res, product);
});
```

### Foreign Key Cascade Strategy

**ALL foreign keys MUST have explicit cascade rules:**

- **CASCADE** - Child meaningless without parent (offers → products)
- **SET NULL** - Child persists, reference nulled (posts → author)
- **RESTRICT** - Prevent deletion if children exist (rare)

### Route Organization

Routes in `server/routes/`, registered via `server/routes/index.ts`.

**Import paths from routes/**: Must use `../` to reach parent directories:

```typescript
// ✅ CORRECT
import { logger } from '../utils/logger';
import { withAuth } from './helpers';

// ❌ WRONG
import { logger } from './utils/logger';
```

### Middleware Pipeline Order (CRITICAL)

Order in `server/index.ts`:

1. Sentry request/tracing (first!)
2. Compression, size limits, body parsing
3. CORS, security headers, sanitization
4. Rate limiting, sessions, passport
5. CSRF token attachment
6. API caching, performance monitoring
7. CSRF protection
8. Request logging, routes
9. Sentry error handler
10. Error handler (last!)

**Why**: Security before business logic. CSRF attachment before protection. Error handlers last.

### Multi-Level Caching Strategy

**All storage access flows through `storageCache`** for automatic caching:

```typescript
import { storageCache } from './services/storage-cache';

const product = await storageCache.getProductById(id); // Cached
```

**Cache tiers:**
- STATIC (1hr): Retailers
- WARM (10min): Products, Users
- COLD (3min): Search results
- HOT (30min): Frequent data
- COMPUTED (30min): Expensive calculations

**Features**: Auto-invalidation, cache warming, versioned keys, admin bypass (`?skipCache=1`)

## API Response Standardization (MANDATORY)

**Status:** 100% migrated (217/217 endpoints + middleware)

**All routes/middleware use helpers from `server/utils/api-response.ts`:**

```typescript
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

// Success
sendSuccess(res, product);
// → { success: true, data: product }

// Known error
sendError(res, 'Product not found', 404);
// → { success: false, error: "Product not found" }

// Exception handling
try {
  const data = schema.parse(req.body);
  const result = await storage.create(data);
  sendSuccess(res, result, 201);
} catch (error) {
  sendErrorFromException(res, error, 'CreateProduct');
}
```

**sendError details parameter:**
- `string`: Development-only (filtered in production)
- `Record<string, unknown>`: Always included (for UX metadata like `retryAfter`, `locked`)

**Exception**: `error-handler.ts` exempt (is the implementation layer, not consumer). See `docs/ADR_ERROR_HANDLER_EXEMPTION.md`.

## Security Patterns (MANDATORY)

### 1. Never Expose Password Hashes

```typescript
// ✅ CORRECT - explicit field selection
const user = await db.select({
  id: users.id,
  username: users.username,
  email: users.email,
  // SECURITY: Never expose passwordHash
}).from(users).where(eq(users.id, id));
```

### 2. Type-Safe Parsing

```typescript
import { parseIntSafe } from './utils/validation-helpers';

const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
```

### 3. Input Validation with Zod

```typescript
import { insertProductSchema } from '@shared/schema';

const data = insertProductSchema.parse(req.body);
```

### 4. CSRF Protection (MANDATORY)

**ALL mutating operations (POST/PUT/PATCH/DELETE) MUST use `csrfProtection`:**

```typescript
import { csrfProtection } from '../middleware/security';
import { withAuth } from './helpers';

// ✅ CORRECT - CSRF before auth
app.post('/api/products', csrfProtection, withAuth(async (req, res) => {
  // ...
}));

// ✅ Auth endpoints need CSRF
app.post('/api/auth/register', csrfProtection, async (req, res) => {
  // ...
});
```

**Rules:**
- Apply per-route, NOT globally (never `app.use(csrfProtection)`)
- CSRF before auth middleware
- Auth endpoints (/register, /login, /forgot-password, /reset-password) need CSRF

**See `docs/04_SECURITY_PATTERNS.md` for complete guide.**

### 5. Route Helpers for Auth

```typescript
import { withAuth, withAdmin } from './helpers';

app.get('/api/protected', withAuth(async (req, res) => {
  const user = req.user!; // Auth guaranteed
}));

app.delete('/api/admin/users/:id', withAdmin(async (req, res) => {
  // Admin access guaranteed
}));
```

## Database Query Patterns

### NEVER Write N+1 Queries

```typescript
// ❌ WRONG - N+1 query
const products = await db.select().from(products);
for (const product of products) {
  const offers = await db.select().from(productOffers)
    .where(eq(productOffers.productId, product.id)); // N queries!
}

// ✅ CORRECT - JOIN
const productsWithOffers = await db.select({
  product: products,
  offers: productOffers,
}).from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId));

// ✅ CORRECT - Batch with IN
const productIds = products.map(p => p.id);
const allOffers = await db.select().from(productOffers)
  .where(inArray(productOffers.productId, productIds));
```

**When to use:**
- **JOIN**: Related data for most/all records
- **IN clause**: Batch-fetch optional related data
- **array_agg()**: Grouped/nested data in single query

## Transaction Boundaries (MANDATORY)

**ALL multi-step operations MUST use transactions:**

```typescript
// ✅ CORRECT - Atomic operation
await db.transaction(async (tx) => {
  const [product] = await tx.insert(products).values(data).returning();
  await tx.insert(productOffers).values({ productId: product.id, ...offer });
  await tx.update(retailers)
    .set({ productCount: sql`${retailers.productCount} + 1` })
    .where(eq(retailers.id, offer.retailerId));
});
```

**Use SERIALIZABLE for race conditions:**

```typescript
await db.transaction(async (tx) => {
  const count = await tx.select({ count: sql`count(*)` }).from(users);
  const isFirstUser = parseInt(count[0].count) === 0;
  await tx.insert(users).values({ ...data, role: isFirstUser ? 'admin' : 'user' });
}, { isolationLevel: 'serializable' });
```

**What NOT to include:**
- External API calls (HTTP, email)
- Long-running operations
- Read-only operations
- Independent operations

**See `docs/02_DATABASE_PATTERNS.md` for patterns.**

## Test Schema Synchronization (MANDATORY)

**ALL new database tables MUST be added to E2E test cleanup immediately.**

When you add tables via migrations, you **MUST** update the E2E cleanup logic in the same commit:

```typescript
// In e2e/helpers.ts (around line 61):
await db.execute(sql`
  TRUNCATE TABLE
    users,
    products,
    product_offers,
    price_history,
    // ... existing tables
    my_new_table,  // ← ADD NEW TABLES HERE
  RESTART IDENTITY CASCADE
`);
```

**Checklist for new migrations:**

1. ✅ Create migration file (e.g., `0027_create_my_table.sql`)
2. ✅ Update `e2e/helpers.ts` TRUNCATE statement (lines 61-77)
3. ✅ Run E2E tests to verify: `npm run test:e2e`
4. ✅ Validate schema sync: `npm run validate:schema-sync` (if script exists)
5. ✅ Tag commit: `[TEST_SCHEMA] Update e2e cleanup for migration 0027`

**Why this is critical:**

Schema drift caused all E2E tests to fail when migrations 0026-0027 added `scraping_jobs` and `price_snapshots` tables without updating test cleanup. The TRUNCATE statement failed with "relation does not exist" errors, blocking all test execution.

**Prevention pattern:**

```bash
# After creating migration:
git add migrations/0027_create_my_table.sql
git add e2e/helpers.ts  # Include test cleanup update
git commit -m "feat: add my_table schema

[TEST_SCHEMA] Update e2e cleanup for migration 0027"
```

**See `docs/learnings/database/LEARNINGS_TODO_007_TEST_SCHEMA_DRIFT.md` for the full investigation.**

## TypeScript Strict Mode & Enforcement

**ZERO TOLERANCE for `any` types**. Enforced at 4 layers:

1. **ESLint** (real-time IDE) - Blocks `any` immediately
2. **Pre-commit hook** - Blocks commits
3. **TypeScript compiler** - Build-time checks
4. **Claude Code context** - Development guidance

### Use Instead of `any`:

```typescript
// Specific types
import { type Product, type SafeUser } from '@shared/schema';

// Unknown + type guard
function handleError(error: unknown) {
  if (error instanceof Error) return error.message;
}

// Generics
async function fetchData<T>(url: string): Promise<T> { }

// Record types
const config: Record<string, unknown> = {};
```

**Test files have same standards** - no exceptions!

**See `docs/01_TYPESCRIPT_PATTERNS.md` for complete guide.**

## Environment Variables

**Required ALL environments:**
- `SESSION_SECRET` - Express session encryption
- `CSRF_SECRET` - CSRF token generation
- `DATABASE_URL` - PostgreSQL connection

**Required PRODUCTION** (app exits if missing):
- `REDIS_URL` - **MANDATORY** for rate limiting, sessions, caching
  - Format: `redis://hostname:6379` or `rediss://user:pass@host:port`
  - Providers: Upstash, Redis Cloud, AWS ElastiCache

**Optional:**
- `OPENAI_API_KEY` - AI features
- `SENTRY_DSN` - Error monitoring

## Common Pitfalls

1. **❌ NEVER USE axios+cheerio FOR SCRAPING**: **CRITICAL** - Playwright ONLY. axios+cheerio cannot execute JavaScript and fails on 100% of modern sites. See TODO_205 migration for evidence. Pre-commit hook blocks axios/cheerio in `server/agents/`.
2. **N+1 QUERIES**: Use JOINs or `inArray()` batch queries
3. **Direct DB access**: Use `storage` layer (exception: `price-aggregation-service.ts`)
4. **Redis in production**: **MANDATORY** - app exits without `REDIS_URL`
5. **CSRF Protection**: Per-route, NOT global. CSRF before auth.
6. **Type safety**: Zero `any` tolerance
7. **Pagination**: Use `PAGINATION.DEFAULT_LIMIT`
8. **Input validation**: Zod schemas first
9. **Dual Redis clients**: `ioredis` for cache, `redis` for sessions
10. **NPM Overrides**: Track in `docs/tooling/NPM_OVERRIDES_TRACKING.md`
11. **Schema-Migration Mismatch**: ALWAYS validate `npm run validate:schema` before commit (See `docs/learnings/database/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md`)

## Pattern Documentation (CRITICAL)

**ALWAYS consult pattern files before implementing** - they prevent repeated mistakes.

### Core Pattern Files (docs/)

**8 consolidated domain-specific files:**

1. **`01_TYPESCRIPT_PATTERNS.md`** - Type safety, async/await, floating promises, Zod (CRITICAL)
2. **`02_DATABASE_PATTERNS.md`** - N+1 prevention, transactions, storage layer (CRITICAL)
3. **`03_API_PATTERNS.md`** - Routes, middleware, testing, services (CRITICAL)
4. **`04_SECURITY_PATTERNS.md`** - Auth, CSRF (SINGLE SOURCE OF TRUTH), validation (CRITICAL)
5. **`05_FRONTEND_PATTERNS.md`** - React, React Query, forms, state
6. **`06_ERROR_HANDLING_PATTERNS.md`** - Error responses, sanitization
7. **`07_BACKGROUND_JOBS_PATTERNS.md`** - Bull queues, distributed locking
8. **`08_TESTING_PATTERNS.md`** - Vitest, integration tests, database testing

### Additional Documentation

- `ARCHITECTURE.md` - System overview, diagrams, ADRs, caching
- `.github/WORKFLOWS.md` - CI/CD pipeline
- `docs/COMPONENT_GUIDE.md` - React component architecture
- `docs/API_DOCUMENTATION.md` - API endpoint reference
- `docs/PATTERN_CODIFICATION_GUIDE.md` - Pattern extraction workflow
- `docs/tooling/LINT_ERROR_PATTERNS.md` - Common ESLint errors and fixes (1624 errors codified)

### Learnings (Real-World Examples)

- `learnings/pre-commit/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` - Hook patterns, security markers
- `learnings/todos/LEARNINGS_TODO_179_UTC_TIMEZONE_SERVICE_FIX.md` - UTC-first date handling
- `learnings/e2e-testing/LEARNINGS_PHASE_1_2_WATCHLIST_E2E_CSRF_FIX.md` - E2E CSRF patterns
- `learnings/database/LEARNINGS_SCHEMA_MIGRATION_MISMATCH_PREVENTION.md` - Migration validation (P0 CRITICAL)
- `SCHEMA_MIGRATION_QUICK_REFERENCE.md` - Fast migration reference card

**See `docs/learnings/` and `docs/phases/` for complete lists.**

## Code Review Workflow

**After implementing features:**

1. **Code Review** - Invoke `code-review-specialist` to check against patterns
2. **Pattern Codification** - Invoke `pattern-codifier` to extract learnings
3. **Commit** - Include updated pattern files

```bash
git add .
git commit -m "..."  # Pre-commit hook runs review

# If patterns identified
claude task pattern-codifier "Codify patterns from review"
git add docs/*_PATTERNS.md
git commit --amend --no-edit
```

**Codify when:**
- ✅ Security vulnerabilities fixed
- ✅ Performance optimizations
- ✅ Pre-commit blocks resolved
- ✅ Recurring feedback (2+ times)
- ✅ New architectural patterns

**See `docs/PATTERN_CODIFICATION_GUIDE.md` for workflow.**
