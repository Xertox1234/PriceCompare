# PriceCompare - AI Coding Agent Instructions

## Project Overview

Full-stack price comparison platform: Express.js + React 19 + PostgreSQL + Redis + Drizzle ORM. **Uses Playwright EXCLUSIVELY** for browser automation (never Puppeteer).

## Architecture Quick Reference

- **Schema**: `shared/schema.ts` (single source of truth, shared client/server)
- **Storage Layer**: `server/storage.ts` implements `IStorage` - all DB access through this layer
- **Routes**: `server/routes/*.ts` - thin handlers, business logic in `server/services/`
- **Path Aliases**: `@/*` → client, `@shared/*` → shared (both sides)

See `ARCHITECTURE.md` for diagrams and ADRs explaining architectural decisions.

## Critical Patterns (Build Breakers)

### 1. Security - Password Hashes
```typescript
// ❌ WRONG - exposes passwordHash
const user = await db.select().from(users).where(eq(users.id, id));

// ✅ CORRECT - explicit field selection
const user = await db.select({ id: users.id, username: users.username, email: users.email })
  .from(users).where(eq(users.id, id));
```

### 2. CSRF Protection (All Mutations)
```typescript
// ✅ CORRECT - CSRF before auth, per-route (never global app.use)
app.post('/api/products', csrfProtection, withAuth(async (req, res) => { }));
```

### 3. N+1 Query Prevention (NEVER query in loops)
```typescript
// ❌ WRONG - N queries in loop
for (const p of products) { await db.select().from(offers).where(eq(offers.productId, p.id)); }

// ✅ CORRECT - Single query with JOIN or batch IN clause
const result = await db.select().from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId));
```

### 4. API Response Helpers
```typescript
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';
// ✅ Always use these - never manual res.json({ success: true, data: ... })
sendSuccess(res, data);  // Returns: { success: true, data }
sendError(res, 'Not found', 404);  // Returns: { success: false, error }
```

### 5. Type Safety
- Zero `any` tolerance - use `unknown` + type guards, generics, or `Record<string, unknown>`
- Safe integer parsing: `parseIntSafe(req.params.id, 'productId', { min: 1 })`
- Zod validation for all route inputs

## Key Commands

```bash
npm run dev          # Start dev server (port 5000) - Vite HMR + TSX watch
npm test path/to/test.ts  # Run specific test (avoid npm test alone - launches browsers)
npm run lint         # ESLint (zero warnings tolerance, enforced in CI)
npm run check        # TypeScript type check
npm run db:push      # Push schema changes (dev only)
```

## Project Structure

```
server/
├── routes/         # API endpoints (use helpers.ts for withAuth, withAdmin)
├── services/       # Business logic (price-snapshot, email, google-search)
├── storage/        # Domain repositories (user, product, price, watchlist)
├── middleware/     # Security, rate limiting, caching
├── utils/          # api-response.ts, validation-helpers.ts, constants.ts
└── ai/             # Prompt registry (never hardcode prompts)
client/src/
├── components/     # React components (use shared-navigation, hero-section)
├── pages/          # Page components
└── hooks/          # Custom React hooks
shared/
└── schema.ts       # Drizzle schema + Zod validation schemas
```

## Environment Variables

**Required**: `SESSION_SECRET`, `CSRF_SECRET`, `DATABASE_URL`
**Production Required**: `REDIS_URL` (app exits without it)
**Optional**: `OPENAI_API_KEY`, `SENTRY_DSN`

## Middleware Pipeline Order (Critical)

In `server/index.ts`, middleware MUST be in this exact order:
1. Sentry handlers (first) → 2. Compression → 3. Body parsing → 4. CORS → 5. Security headers
6. Input sanitization → 7. Rate limiting → 8. Session management → 9. Passport → 10. CSRF token attachment
11. Caching → 12. Performance monitoring → 13. Routes → 14. Error handling (last)

## Transaction Boundaries

Use `db.transaction()` for multi-step operations that must succeed/fail together:
```typescript
await db.transaction(async (tx) => {
  const [product] = await tx.insert(products).values(data).returning();
  await tx.insert(productOffers).values({ productId: product.id, ...offerData });
});
```
Keep transactions short. Never include external API calls inside transactions.

## Background Jobs (Bull + Redis)

Job queues in `server/jobs/`. Use distributed locks for scheduled tasks (multi-server safety):
```typescript
import { jobLockService } from './services/job-lock-service';
const result = await jobLockService.withLock('job-name', async () => doWork(), 3600);
if (result === null) console.log('Job skipped - running on another server');
```

## Chrome Extension

Extension code in `extensions/chrome/` with separate manifest.json. Shares types from `shared/` but runs independently. Key files: `background.js` (service worker), `content-scripts/price-detector.js` (retailer page injection).

## Pattern Documentation

Consult before implementing:
- `docs/01_TYPESCRIPT_PATTERNS.md` - Type safety, async/await
- `docs/02_DATABASE_PATTERNS.md` - N+1 prevention, transactions, storage layer
- `docs/03_API_PATTERNS.md` - Routes, middleware, testing
- `docs/04_SECURITY_PATTERNS.md` - Auth, CSRF, validation (single source of truth)

## Pre-Commit Hook

Blocks commits on: TypeScript errors, ESLint errors, `any` types, N+1 patterns, passwordHash exposure, floating promises. See `docs/LEARNINGS_PRE_COMMIT_HOOK_PATTERNS.md` for common fixes.
