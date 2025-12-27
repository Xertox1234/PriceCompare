# API & Route Patterns

**Version:** 2.3
**Last Updated:** 2025-12-27
**Migrated From:** 6 source documents (see References)
**Status:** Active - Mandatory for all API/route code
**Changelog:**
- 2.3 (2025-12-27): Added Unified Authentication Middleware Pattern (flexibleAuth + withAuth mandatory wrapper)
- 2.2 (2025-12-26): Added Agent-Native Authentication Design pattern (HTTP Basic Auth)
- 2.1 (2025-12-23): Added business rule validation pattern (Feature 3.3 - alert limits)

---

## Table of Contents

1. [Overview](#overview)
2. [Route Organization](#route-organization)
3. [Middleware Pipeline](#middleware-pipeline)
4. [Request/Response Patterns](#requestresponse-patterns)
5. [Testing Patterns](#testing-patterns)
6. [Service Integration](#service-integration)
7. [Error Handling in Routes](#error-handling-in-routes)
8. [Performance Patterns](#performance-patterns)
9. [Security & Authentication](#security--authentication)
10. [API Checklist](#api-checklist)

---

## Overview

This document consolidates all API and route patterns for the PriceCompare platform. It combines route organization, middleware configuration, request/response handling, testing, service integration, error handling, and performance optimization patterns into a single authoritative reference.

**Key Principles:**
- **Consistency**: All routes follow standardized patterns
- **Security**: CSRF, auth, input validation at every layer
- **Performance**: Caching, rate limiting, query optimization
- **Type Safety**: Zero tolerance for `any` types
- **DRY**: Shared helpers eliminate boilerplate
- **Testing**: 100% validation helper coverage

---

## Route Organization

### Route Registration Order (CRITICAL)

Express matches routes in the order they are registered. **Specific routes MUST be registered BEFORE parameterized routes** to prevent conflicts.

#### ❌ WRONG - Parameterized Route Registered First

```typescript
// THIS CAUSES 404 ERRORS!
app.get("/api/watchlists/:id", getWatchlistById);        // Matches first - "stats" treated as :id
app.get("/api/watchlists/stats", getWatchlistStats);     // NEVER REACHED - always returns 404
app.get("/api/watchlists/products", getWatchlistProducts); // NEVER REACHED
```

**Why this fails:**
1. User requests `/api/watchlists/stats`
2. Express checks routes in order
3. `/api/watchlists/:id` matches first with `id = "stats"`
4. Handler tries `parseIntSafe("stats", ...)` → validation error
5. Stats endpoint never reached, even though it exists

#### ✅ CORRECT - Specific Routes First

```typescript
// Specific routes BEFORE parameterized routes
app.get("/api/watchlists/products", getWatchlistProducts);   // Specific - matches exactly
app.get("/api/watchlists/stats", getWatchlistStats);         // Specific - matches exactly
app.get("/api/watchlists/:id", getWatchlistById);            // Parameterized - matches last
```

**Rule of Thumb:**
1. Static paths first: `/api/watchlists/stats`
2. Specific patterns: `/api/watchlists/user/:userId`
3. Generic params last: `/api/watchlists/:id`

Always add a comment when order matters:
```typescript
// IMPORTANT: Specific routes must be registered before parameterized :id route
app.get("/api/watchlists/stats", getStats);
app.get("/api/watchlists/:id", getById);
```

---

### File Structure Pattern

#### ✅ CORRECT - Modular Route Files

```typescript
// server/routes/index.ts - Central registration
import { Express } from 'express';
import { registerAuthRoutes } from './auth-routes';
import { registerProductRoutes } from './product-routes';
import { registerAdminRoutes } from './admin-routes';

export function registerRoutes(app: Express) {
  // Health check first (no auth)
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Register route modules
  registerAuthRoutes(app);
  registerProductRoutes(app);
  registerAdminRoutes(app);

  // 404 handler last
  app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
}

// server/routes/product-routes.ts - Domain-specific routes
import { Router } from 'express';
import { withAuth } from './helpers';
import { csrfProtection } from '../middleware/security';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

export function registerProductRoutes(app: Express) {
  const router = Router();

  // Public routes
  router.get('/products', getProducts);
  router.get('/products/:id', getProduct);

  // Protected routes
  router.post('/products',
    csrfProtection,     // 1. CSRF first
    withAuth(async (req, res) => {  // 2. Auth second
      // 3. Business logic
    })
  );

  app.use('/api', router);
}
```

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

---

### Storage Layer Pattern

#### ❌ WRONG - Direct DB Access in Routes

```typescript
// THIS WILL TRIGGER PRE-COMMIT WARNING!
import { db } from '../db';

router.get('/api/products/:id', async (req, res) => {
  // Direct database access in route - BAD!
  const product = await db.select()
    .from(products)
    .where(eq(products.id, id));
  res.json(product);
});
```

#### ✅ CORRECT - Use Storage Abstraction

```typescript
// server/storage.ts - Database abstraction layer
export interface IStorage {
  getProductById(id: number): Promise<Product | null>;
  createProduct(data: CreateProductInput): Promise<Product>;
  updateProduct(id: number, data: UpdateProductInput): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
}

export class Storage implements IStorage {
  async getProductById(id: number): Promise<Product | null> {
    const [product] = await db.select({
      id: products.id,
      name: products.name,
      price: products.price,
      // Explicit field selection
    }).from(products)
      .where(eq(products.id, id))
      .limit(1);

    return product || null;
  }
  // ... other methods
}

export const storage = new Storage();

// server/routes/product-routes.ts - Route using storage
import { storage } from '../storage';
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

router.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProductById(id);

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
  }
});
```

**Storage Layer Exception**: `price-aggregation-service.ts` is the ONLY service with direct `db` access (documented exception). It passes transaction contexts between private helper methods for complex atomic operations. All other services MUST use the storage layer.

**Migration Status** (as of Phase 7 completion):
- ✅ 14/15 services migrated to storage layer
- ✅ All routes use storage layer
- ⚠️ 1 documented exception: `price-aggregation-service.ts`
- 📊 ~86 storage methods implemented

---

## Middleware Pipeline

### Correct Middleware Order (CRITICAL)

In `server/index.ts`, middleware **MUST** be in this exact order:

```typescript
// server/index.ts
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import passport from 'passport';

const app = express();

// 1. Request tracking / monitoring (FIRST!)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// 2. Compression
app.use(compression());

// 3. Body parsing & limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. CORS (before routes)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// 5. Security headers
app.use(helmet());

// 6. Request sanitization
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // XSS protection

// 7. Rate limiting (after sanitization)
app.use('/api/', apiRateLimiter);
app.use('/api/auth/', authRateLimiter);

// 8. Session management
app.use(session({
  secret: process.env.SESSION_SECRET!,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// 9. Passport initialization (after session)
app.use(passport.initialize());
app.use(passport.session());

// 10. CSRF token attachment
app.use(attachCsrfToken);

// 11. Request logging
app.use(requestLogger);

// 12. Routes
registerRoutes(app);

// 13. Error handlers (LAST!)
app.use(Sentry.Handlers.errorHandler());
app.use(globalErrorHandler);
```

**Why this order matters**: Security layers must process requests before business logic. CSRF tokens must be attached before protection is enforced. Error handlers must be last to catch all errors.

---

### Per-Route Middleware Order (CRITICAL for CSRF)

**CORRECT order for individual routes: `csrfProtection` → `withAuth/withAdmin` → handler**

#### ❌ WRONG - Global CSRF Protection

```typescript
// server/index.ts
// THIS IS A CRITICAL ARCHITECTURAL FLAW!
app.use(csrfProtection);  // ❌ NEVER apply globally

// Problems with global CSRF:
// 1. Double protection - routes that also include csrfProtection run it twice
// 2. GET requests blocked - safe methods incorrectly rejected
// 3. Token consumption issues - token may be consumed before reaching handler
// 4. CORS preflight failures - OPTIONS requests fail
```

#### ✅ CORRECT - Per-Route CSRF Protection

```typescript
// server/index.ts
// NOTE: CSRF protection is applied per-route in individual route files,
// not globally. This ensures GET requests aren't protected while mutations are.
// Each POST/PUT/PATCH/DELETE endpoint includes csrfProtection middleware.
// See server/routes/*.ts files for csrfProtection usage.

// In route files - apply selectively:
import { csrfProtection } from '../middleware/security';
import { withAuth, withAdmin } from './helpers';

// ✅ CORRECT - CSRF before auth (fast token check fails early)
app.post('/api/products',
  csrfProtection,     // 1. Verify CSRF token (fast, fails early)
  withAuth(async (req, res) => {  // 2. Verify authentication
    // 3. Execute business logic
  })
);

// ✅ CORRECT - Admin endpoint with CSRF
app.delete('/api/admin/users/:id',
  csrfProtection,     // 1. CSRF check first
  withAdmin(async (req, res) => {  // 2. Admin role check
    // 3. Delete user
  })
);

// ✅ CORRECT - Authentication endpoints also need CSRF
app.post('/api/auth/register', csrfProtection, async (req, res) => {
  // Register user
});

// ✅ CORRECT - GET requests don't need CSRF
app.get('/api/products', async (req, res) => {
  // Safe method - no CSRF needed
});
```

#### ❌ WRONG - Auth Before CSRF

```typescript
// INEFFICIENT and INCONSISTENT with project standards
app.post('/api/endpoint',
  requireAuth,        // ❌ Wastes auth resources on CSRF attacks
  csrfProtection,     // Should be first
  async (req, res) => {}
);
```

**Why CSRF First:**
- CSRF validation is fast (token comparison with `crypto.timingSafeEqual`)
- Fails early for invalid requests (rejects before expensive auth operations)
- Prevents wasting database queries and auth resources on CSRF attacks
- Consistent with project-wide pattern (48+ endpoints)
- Matches the documented middleware pipeline order

#### CSRF Exemptions

```typescript
// Only exempt public endpoints that:
// 1. Require no authentication
// 2. Perform NO user-specific state changes
// 3. Have alternative protection (signature verification, rate limiting)

app.post("/api/affiliate/track-click/:offerId", async (req, res) => {
  // NOTE: This endpoint is intentionally public and exempted from CSRF protection
  // because it's called cross-origin from retailer sites for analytics tracking.
  // No user data modified, only logs analytics events.
  // See server/middleware/security.ts CSRF_EXEMPT_PATHS for exemption.
  await trackAffiliateClick(offerId);
  res.json({ success: true });
});
```

**Exemption Checklist:**
- [ ] Endpoint is truly public (no authentication required)?
- [ ] Endpoint performs NO user-specific state changes?
- [ ] Alternative protection exists (signature verification, rate limiting)?
- [ ] Exemption documented in code with clear justification?
- [ ] Security team has approved exemption?
- [ ] Exemption added to `CSRF_EXEMPT_PATHS` in security.ts?

**When in doubt: ALWAYS apply CSRF protection.**

**See `docs/SECURITY_PATTERNS.md` for complete CSRF implementation guide with attack scenarios.**

---

### Middleware Error Responses (MANDATORY - 100% Coverage)

**ALL middleware error responses MUST use `sendError()` helper:**

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
- SSO (`server/discourse-sso.ts` - all error responses)
- Rate limiting, CSRF, account lockout, request limits

#### EXCEPTION: Error Handler Middleware

**The centralized error handler middleware (`server/middleware/error-handler.ts`) is EXEMPT from using `sendError()` helpers.**

**Rationale:**
1. **Architectural Layer**: Error handler IS the implementation layer for error responses (not a consumer)
2. **Safety Net Principle**: Last-resort handler should not depend on higher-level abstractions it backs up
3. **Format Consistency**: Achieved through standardized envelope format in code, not shared helpers
4. **Conceptual Clarity**: Using sendError() in error-handler would be conceptually circular

**Format Requirements:**
- Error handler MUST use same envelope format as `sendError()`: `{ success: false, error: string, ... }`
- AppError.toJSON() MUST include `success: false` discriminator
- All error paths must produce identical envelope structure

**Exception to the Exception:**
- `notFoundHandler()` uses `sendError()` because it's route-like (handles specific 404 case), not a catch-all

**See `docs/ADR_ERROR_HANDLER_EXEMPTION.md` for complete architectural decision and rationale.**

---

## Request/Response Patterns

### Standardized API Response Envelope (Phase 4g - Issue #147)

**All 210 API endpoints** now use a consistent envelope format for type-safe responses.

#### Response Type Definitions

```typescript
// server/utils/api-response.ts
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

export interface ApiResponseMeta {
  timestamp: string;
  version: string;
  requestId?: string;
}

// Success responses - discriminated union with success: true
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiResponseMeta;
}

// Error responses - discriminated union with success: false
interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string; // Only in development mode
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

#### Response Helper Functions

```typescript
// server/utils/api-response.ts
import { Response } from 'express';

/**
 * Send successful response with data
 * @param res - Express response object
 * @param data - Response data (any type)
 * @param statusCode - HTTP status code (default: 200)
 * @param meta - Optional metadata (pagination, etc.)
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: Partial<ApiResponseMeta>
): void {
  const response: { success: true; data: T; meta?: ApiResponseMeta } = {
    success: true,
    data,
  };

  if (meta || res.locals.requestId) {
    response.meta = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      requestId: res.locals.requestId,
      ...meta,
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Send error response
 * @param res - Express response object
 * @param error - Error message string
 * @param statusCode - HTTP status code (default: 500)
 * @param details - Optional error details (development only)
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 500,
  details?: string
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const response: { success: false; error: string; details?: string } = {
    success: false,
    error,
  };

  if (isDevelopment && details) {
    response.details = details;
  }

  res.status(statusCode).json(response);
}

/**
 * Send error from caught exception
 * Automatically detects status codes from error messages
 * @param res - Express response object
 * @param error - Caught error (unknown type)
 * @param context - Operation context for logging
 */
export function sendErrorFromException(
  res: Response,
  error: unknown,
  context: string = 'Operation'
): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let message = `${context} failed`;
  let status = 500;
  let details: string | undefined;

  if (error instanceof Error) {
    message = error.message;

    // Automatic status code detection from error messages
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('not found')) status = 404;
    else if (errorMsg.includes('unauthorized')) status = 401;
    else if (errorMsg.includes('forbidden')) status = 403;
    else if (errorMsg.includes('already exists') || errorMsg.includes('unique')) status = 409;
    else if (errorMsg.includes('invalid') || errorMsg.includes('must be')) status = 400;

    if (isDevelopment && error.stack) {
      details = error.stack;
    }
  }

  logger.error(`${context} error:`, {
    error: error instanceof Error ? error.message : String(error),
    status,
  });

  sendError(res, message, status, details);
}

/**
 * Send paginated response
 * @param res - Express response object
 * @param data - Array of items for current page
 * @param meta - Pagination metadata
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    meta,
  });
}

/**
 * Convenience helpers for common status codes
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}
```

---

### Anti-Pattern: Nested Response Wrappers (CRITICAL)

**Severity: HIGH** - This breaks the API contract and creates inconsistent responses.

When migrating to standardized API response helpers, developers sometimes accidentally wrap data with redundant `success` and `data` fields before passing to `sendSuccess()`. This creates double-nested envelopes that break frontend parsing.

```typescript
// ❌ WRONG - Nested wrappers (creates double envelope)
sendSuccess(res, {
  success: true,
  data: metrics
});
// Results in: { success: true, data: { success: true, data: metrics } }

// ❌ WRONG - Manual data wrapper
sendSuccess(res, {
  data: { watchLists, count: watchLists.length }
});
// Results in: { success: true, data: { data: { watchLists, count } } }

// ❌ WRONG - Manual success wrapper
sendSuccess(res, {
  success: true,
  alerts,
  count: alerts.length
});
// Results in: { success: true, data: { success: true, alerts, count } }

// ✅ CORRECT - Pass data directly (helper adds the envelope)
sendSuccess(res, metrics);
// Results in: { success: true, data: metrics }

// ✅ CORRECT - Object with properties (no manual envelope)
sendSuccess(res, { watchLists, count: watchLists.length });
// Results in: { success: true, data: { watchLists, count } }

// ✅ CORRECT - Array data
sendSuccess(res, alerts);
// Results in: { success: true, data: [...alerts] }
```

**Detection Pattern:**
```bash
# Find potential nested wrapper issues
grep -rn "sendSuccess(res, {" server/routes/*.ts | grep -E "(success|data):"
```

**Root Cause:** Developers familiar with manual response patterns may not internalize that `sendSuccess()`, `sendError()`, and `sendErrorFromException()` automatically provide the envelope format.

**Key Rule:** The helpers ARE the envelope - never manually add `success: true` or wrap in `{ data: ... }`.

---

### Schema-Route-Storage Alignment Pattern (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002_ALERT_ROUTES fix)

When adding or modifying fields in routes, you must update **THREE layers** in strict alignment to prevent validation errors or incomplete updates:

1. **Database Schema** (`shared/schema.ts`)
2. **Route Validation Schema** (route file)
3. **Storage Layer Interface** (`server/storage.ts`)

**Missing any layer causes 400 validation errors or silent update failures.**

#### ❌ ANTI-PATTERN - Missing Validation Schema Field

```typescript
// Database schema ALREADY has the field
// shared/schema.ts
export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  targetPrice: numeric('target_price').notNull(),
  notifyForum: boolean('notify_forum').default(false), // Field exists in DB
});

// ❌ WRONG - Route validation MISSING the field
// server/routes/alert-routes.ts
const insertPriceAlertSchema = z.object({
  productId: z.number().int().positive(),
  targetPrice: z.number().positive(),
  // notifyForum missing! - Causes 400 validation error when client sends it
});

// ❌ WRONG - Storage layer can't update it
// server/storage.ts
async updatePriceAlert(
  alertId: number,
  userId: number,
  targetPrice?: number
  // notifyForum parameter missing! - Can't update the field
): Promise<PriceAlert | null>
```

**Symptoms:**
- Client sends `{ productId: 123, targetPrice: 99.99, notifyForum: false }`
- Route validation rejects with 400: "Unknown field: notifyForum"
- OR: Route accepts but storage layer can't update the field

#### ✅ CORRECT - All Three Layers Aligned

```typescript
// 1. Database Schema (shared/schema.ts)
export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull(),
  targetPrice: numeric('target_price').notNull(),
  notifyForum: boolean('notify_forum').default(false),
});

// 2. Route Validation Schema (server/routes/alert-routes.ts)
const insertPriceAlertSchema = z.object({
  productId: z.number().int().positive(),
  targetPrice: z.number().positive(),
  notifyForum: z.boolean().optional().default(false), // ✅ Added
});

const updatePriceAlertSchema = z.object({
  targetPrice: z.number().positive().optional(),
  notifyForum: z.boolean().optional(), // ✅ Added
});

// 3. Storage Layer Interface (server/storage.ts)
async updatePriceAlert(
  alertId: number,
  userId: number,
  targetPrice?: number,
  notifyForum?: boolean // ✅ Added parameter
): Promise<PriceAlert | null> {
  const updates: Record<string, number | boolean> = {};
  if (targetPrice !== undefined) updates.targetPrice = targetPrice;
  if (notifyForum !== undefined) updates.notifyForum = notifyForum; // ✅ Include in updates

  const [updated] = await db
    .update(priceAlerts)
    .set(updates)
    .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
    .returning();

  return updated || null;
}
```

#### Three-Layer Checklist

When adding/modifying route fields:

- [ ] **Layer 1: Database Schema** - Field defined in `shared/schema.ts` table
- [ ] **Layer 2: Route Validation** - Field in Zod schema (create + update schemas)
- [ ] **Layer 3: Storage Interface** - Parameter in storage method + included in updates

**Detection Pattern:**
```bash
# Find schema fields
grep -A 10 "pgTable('price_alerts'" shared/schema.ts

# Check route validation
grep -A 15 "PriceAlertSchema" server/routes/alert-routes.ts

# Check storage interface
grep -A 10 "updatePriceAlert" server/storage.ts
```

**Pre-Commit Hook Enhancement:**

Consider adding automated check:
```bash
# Check if all schema fields have corresponding Zod validation
# Check if all route parameters have storage layer support
```

**Related Learnings:**
- `docs/LEARNINGS_TODO_002_ALERT_ROUTES_FIX.md` - Complete fix documentation
- Pre-commit hooks catch missing fields in routes
- TypeScript catches missing fields in storage calls

---

### DELETE Response Pattern: Meaningful Acknowledgment (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 optional improvements)

DELETE endpoints should return meaningful confirmation data, not empty objects. This improves API clarity and provides explicit confirmation to clients.

#### ❌ ANTI-PATTERN - Empty Response

```typescript
// ❌ WRONG - No feedback that operation succeeded
app.delete("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
  const deleted = await storage.deletePriceAlert(alertId, user.id);
  if (!deleted) {
    sendError(res, 'Alert not found or unauthorized', 404);
    return;
  }

  sendSuccess(res, {}); // Empty object provides no value
}));
```

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

**Problem**: Client only knows operation succeeded from HTTP 200 status. No explicit confirmation in response body.

#### ✅ CORRECT - Meaningful Acknowledgment

```typescript
// ✅ CORRECT - Explicit confirmation of deletion
app.delete("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
  const deleted = await storage.deletePriceAlert(alertId, user.id);
  if (!deleted) {
    sendError(res, 'Alert not found or unauthorized', 404);
    return;
  }

  sendSuccess(res, { deleted: true });
}));
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

**Benefits:**
- Explicit confirmation in response body
- Type-safe response structure
- Better API clarity for clients
- Aligns with REST best practices

#### Alternative Patterns

```typescript
// Pattern 1: Return deleted entity ID
sendSuccess(res, { deleted: true, deletedId: alertId });

// Pattern 2: Return count of deleted entities (batch operations)
sendSuccess(res, { deleted: true, count: deletedCount });

// Pattern 3: Return deleted entity (if needed by client)
sendSuccess(res, { deleted: true, entity: deletedAlert });
```

**Test Pattern:**

```typescript
it('should delete entity and return confirmation', async () => {
  const response = await request(app)
    .delete(`/api/entities/${entityId}`)
    .set('Cookie', authCookie)
    .set('X-CSRF-Token', csrfToken);

  const result = expectSuccessResponse<{ deleted: boolean }>(response, 200);
  expect(result.deleted).toBe(true);

  // Verify database deletion
  const entity = await storage.getEntityById(entityId);
  expect(entity).toBeNull();
});
```

**When to Use:**
- All DELETE operations (except 204 No Content responses)
- Batch delete operations (return count)
- Soft delete operations (return updated entity)

---

### Audit Logging Pattern for Sensitive Operations (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 optional improvements)

**Rule:** All irreversible or sensitive operations MUST have structured audit logging for compliance, debugging, and security monitoring.

#### When Audit Logging is MANDATORY

Add audit logging when operation:
1. **Irreversible** - DELETE, permanent updates, account closures
2. **Price/money-sensitive** - Price changes, payment operations, refunds
3. **User data integrity** - Account changes, permission updates, data exports
4. **Compliance required** - GDPR data access, financial operations

#### ✅ CORRECT Pattern

```typescript
import { logger } from "../utils/logger";

app.delete("/api/price-alerts/:id", csrfProtection, withAuth(async (req, res) => {
  const user = req.user;
  const alertId = parseIntSafe(req.params.id, 'alertId', { min: 1 });

  const deleted = await storage.deletePriceAlert(alertId, user.id);
  if (!deleted) {
    sendError(res, 'Alert not found or unauthorized', 404);
    return;
  }

  // ✅ AUDIT LOG - Structured logging for sensitive operations
  logger.info('Price alert deleted', {
    alertId,
    userId: user.id,
    action: 'price-alert-deleted',
    timestamp: new Date().toISOString(),
  });

  sendSuccess(res, { deleted: true });
}));
```

#### Log Structure Requirements

**Mandatory fields:**
- `action` - Standardized action type (use kebab-case)
- `userId` - Who performed the operation
- `entityId` - What was affected (alertId, productId, etc.)
- `timestamp` - When it occurred (ISO 8601 format)

**Optional fields:**
- `ipAddress` - For security monitoring
- `userAgent` - For device tracking
- `reason` - For operations requiring justification
- `previousValue` - For audit trail of changes

#### Example Audit Log Output

```json
{
  "level": "info",
  "message": "Price alert deleted",
  "alertId": 42,
  "userId": 123,
  "action": "price-alert-deleted",
  "timestamp": "2025-12-02T18:30:00.000Z"
}
```

#### Audit Logging Checklist

For each route, ask:
- [ ] Is operation irreversible? (DELETE, permanent updates)
- [ ] Does it affect money/pricing?
- [ ] Does it modify user data integrity?
- [ ] Could it be needed for compliance audit?
- [ ] Would security team want to monitor this?

**If YES to any** → Add structured audit logging

#### Common Operations Requiring Audit Logs

**Always Log:**
- DELETE operations (all types)
- Price/discount changes
- User account changes (role, permissions, suspension)
- Payment operations (charges, refunds)
- Data exports/downloads
- Authentication failures (rate limiting, suspicious activity)

**Consider Logging:**
- CREATE operations for critical entities
- Bulk operations (batch imports, mass updates)
- Admin-only operations
- Operations with compliance requirements

**Don't Log:**
- Read-only GET operations (unless compliance required)
- Health checks, metrics endpoints
- Internal system operations

#### Pattern for Multiple Audit Points

```typescript
app.patch("/api/users/:id/role", csrfProtection, withAdmin(async (req, res) => {
  const targetUserId = parseIntSafe(req.params.id, 'userId', { min: 1 });
  const { role } = req.body;
  const adminUser = req.user;

  const previousRole = await storage.getUserRole(targetUserId);

  const updated = await storage.updateUserRole(targetUserId, role);
  if (!updated) {
    sendError(res, 'User not found', 404);
    return;
  }

  // ✅ AUDIT - Role changes are security-sensitive
  logger.warn('User role changed', {
    targetUserId,
    adminUserId: adminUser.id,
    adminUsername: adminUser.username,
    previousRole,
    newRole: role,
    action: 'user-role-changed',
    timestamp: new Date().toISOString(),
  });

  sendSuccess(res, updated);
}));
```

**Benefits:**
1. **Compliance** - Audit trail for regulatory requirements
2. **Security** - Detect suspicious deletion patterns
3. **Debugging** - Understand user behavior and system issues
4. **Analytics** - Track why users delete entities
5. **Recovery** - Aid in data recovery investigations

---

### LEFT JOIN Pattern for Related Data (CRITICAL)

**Issue Codified**: 2025-12-02 (TODO_002 optional improvements)

**Rule:** When clients always need related data, use JOIN in the storage layer to prevent N+1 queries and reduce API calls.

#### ❌ ANTI-PATTERN - Separate Queries (N+1)

```typescript
// ❌ WRONG - N+1 query pattern
async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
  const alerts = await this.db
    .select()
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, userId));

  // N queries - one for each alert!
  for (const alert of alerts) {
    alert.product = await this.db
      .select()
      .from(products)
      .where(eq(products.id, alert.productId));
  }

  return alerts;
}
```

**Problems:**
- N database roundtrips (1 + N queries)
- Slow performance with many records
- Violates pre-commit hook N+1 check

#### ✅ CORRECT - Single JOIN Query

```typescript
// ✅ CORRECT - Single query with LEFT JOIN
async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
  try {
    if (!userId || userId < 1) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // Use LEFT JOIN to include product details with each alert
    const alertsWithProducts = await this.db
      .select({
        alert: priceAlerts,
        product: products,
      })
      .from(priceAlerts)
      .leftJoin(products, eq(priceAlerts.productId, products.id))
      .where(eq(priceAlerts.userId, userId));

    // Map results to include product details in alert objects
    return alertsWithProducts.map(({ alert, product }) => ({
      ...alert,
      product: product || undefined, // Graceful null handling
    })) as PriceAlert[];
  } catch (error) {
    this.handleError(error, 'getUserPriceAlerts');
  }
}
```

**Benefits:**
1. **Single query** - No N+1 problem
2. **Reduced API calls** - Client gets everything in one response
3. **Better UX** - Display product name immediately
4. **Graceful degradation** - Product undefined if deleted

#### Response Example

**Before (without JOIN):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 123,
      "productId": 456,
      "targetPrice": "89.99",
      "isActive": true
    }
  ]
}
```

**After (with JOIN):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 123,
      "productId": 456,
      "targetPrice": "89.99",
      "isActive": true,
      "product": {
        "id": 456,
        "name": "iPhone 15 Pro",
        "description": "Latest iPhone model",
        "category": "Electronics"
      }
    }
  ]
}
```

#### Drizzle LEFT JOIN Mapping Pattern

**Key Insight:** Drizzle's automatic nested object handling can be quirky. Use explicit mapping for control.

```typescript
// ✅ CORRECT - Explicit select and manual mapping
const results = await db
  .select({
    parent: parentTable,
    child: childTable,
  })
  .from(parentTable)
  .leftJoin(childTable, eq(parentTable.id, childTable.parentId));

// Map manually to desired structure
return results.map(({ parent, child }) => ({
  ...parent,
  child: child || undefined, // Handle null from LEFT JOIN
}));
```

**Avoid:**
```typescript
// ❌ ANTI-PATTERN - Expecting automatic nesting
const results = await db
  .select()
  .from(parentTable)
  .leftJoin(childTable, eq(parentTable.id, childTable.parentId));
// Drizzle's auto-nesting can be unpredictable with nullable fields
```

#### When to Use LEFT JOIN

**Use JOIN when:**
- Clients always need the related data (90%+ of requests)
- Related data is small (not large nested arrays)
- Performance matters (avoid N+1)
- Client-side data assembly is complex

**Don't use JOIN when:**
- Related data is rarely needed (<10% of requests)
- Related data is very large (pagination needed)
- Client can efficiently fetch separately
- Optional feature flag determines if data is needed

#### Test Pattern

```typescript
it('should include related details in response', async () => {
  const response = await request(app)
    .get('/api/entities')
    .set('Cookie', authCookie);

  const entities = expectSuccessResponse<Array<{ relatedData?: RelatedType }>>(response, 200);

  // Verify related data included
  expect(entities[0]).toHaveProperty('relatedData');
  expect(entities[0].relatedData).toBeDefined();
  expect(entities[0].relatedData).toMatchObject({
    id: expect.any(Number),
    name: expect.any(String),
  });
});
```

**Related Patterns:**
- See `docs/02_DATABASE_PATTERNS.md` - N+1 Prevention (Section 2.1)
- See `docs/02_DATABASE_PATTERNS.md` - Query Optimization (Section 3)

---

### Route Usage Examples

```typescript
// server/routes/product-routes.ts
import { sendSuccess, sendError, sendErrorFromException, sendPaginated } from '../utils/api-response';
import { withAuth } from './helpers';

// Example 1: Simple success response
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProductById(productId);

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
    // Response: { success: true, data: Product }
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
    // Response: { success: false, error: "Error message", details?: "..." }
  }
});

// Example 2: Created resource (201)
app.post('/api/wishlists', withAuth(async (req, res) => {
  try {
    const userId = req.user!.id;
    const data = createWishlistSchema.parse(req.body);
    const wishlist = await storage.createWishlist(userId, data);

    sendSuccess(res, wishlist, 201);
    // Response: { success: true, data: Wishlist } with 201 status
  } catch (error) {
    sendErrorFromException(res, error, 'CreateWishlist');
  }
}));

// Example 3: Paginated response
app.get('/api/products/search', async (req, res) => {
  try {
    const page = parseIntSafe(req.query.page as string, 'page', { min: 1 }) || 1;
    const limit = parseIntSafe(req.query.limit as string, 'limit', { min: 1, max: 100 }) || 20;

    const { products, total } = await storage.searchProducts({ page, limit, query });

    sendPaginated(res, products, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page < Math.ceil(total / limit),
      nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    });
    // Response: { success: true, data: Product[], meta: PaginationMeta }
  } catch (error) {
    sendErrorFromException(res, error, 'SearchProducts');
  }
});

// Example 4: Manual error with specific status
app.delete('/api/wishlists/:id', withAuth(async (req, res) => {
  try {
    const userId = req.user!.id;
    const wishlistId = parseIntSafe(req.params.id, 'wishlistId', { min: 1 });

    const deleted = await storage.deleteWishlist(wishlistId, userId);
    if (!deleted) {
      sendError(res, 'Wishlist not found', 404);
      return;
    }

    sendSuccess(res, {});
    // Response: { success: true, data: {} }
  } catch (error) {
    sendErrorFromException(res, error, 'DeleteWishlist');
  }
}));

// Example 5: Response with metadata
app.get('/api/wishlists', withAuth(async (req, res) => {
  try {
    const userId = req.user!.id;
    const wishlists = await storage.getUserWishlists(userId);

    sendSuccess(res, { wishlists, count: wishlists.length });
    // Response: { success: true, data: { wishlists: Wishlist[], count: number } }
  } catch (error) {
    sendErrorFromException(res, error, 'GetUserWishlists');
  }
}));
```

#### Migration Status (Phase 4g Complete)

**✅ 210/210 endpoints migrated (100%)**
- All routes use standardized `sendSuccess()`, `sendError()`, `sendErrorFromException()`
- All React Query hooks use explicit `queryFn: () => apiRequest<T>(url)`
- Frontend automatically unwraps envelope responses
- Type-safe discriminated union pattern throughout

**Key Benefits:**
1. **Type Safety**: Discriminated union prevents accessing data/error incorrectly
2. **Consistency**: All endpoints follow same format
3. **Developer Experience**: Auto-unwrapping simplifies component code
4. **Error Handling**: Consistent ApiError class with status codes
5. **Maintainability**: Single source of truth for response format

---

### Request Validation

#### Zod Validation Middleware

```typescript
// middleware/validation.ts
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/api-response';

export function validateRequest<T extends z.ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and transform data
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.reduce((acc, err) => {
          const path = err.path.join('.');
          acc[path] = err.message;
          return acc;
        }, {} as Record<string, string>);

        sendError(res, 'Validation failed', 400, JSON.stringify(errors));
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        sendError(res, 'Invalid query parameters', 400, JSON.stringify(error.errors));
        return;
      }
      next(error);
    }
  };
}

// Usage in routes
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  categoryId: z.number().int().positive(),
});

router.post('/api/products',
  csrfProtection,
  withAuth(async (req, res) => {
    // req.body is now typed and validated
    const product = await storage.createProduct(req.body);
    sendSuccess(res, product, 201);
  })
);
```

#### Parameter Validation

```typescript
// utils/validation-helpers.ts
export function parseIntSafe(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  const parsed = parseInt(String(value), 10);

  if (isNaN(parsed)) {
    throw new ValidationError(`${fieldName} must be a valid integer`, {
      [fieldName]: 'Invalid integer',
    });
  }

  if (options.min !== undefined && parsed < options.min) {
    throw new ValidationError(`${fieldName} must be at least ${options.min}`, {
      [fieldName]: `Minimum value is ${options.min}`,
    });
  }

  if (options.max !== undefined && parsed > options.max) {
    throw new ValidationError(`${fieldName} must not exceed ${options.max}`, {
      [fieldName]: `Maximum value is ${options.max}`,
    });
  }

  return parsed;
}

// Route usage
router.get('/api/products/:id', async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProductById(id);

    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    sendSuccess(res, product);
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
  }
});
```

---

#### Business Rule Validation with Rich Error Details (NEW - Feature 3.3)

**When to Use:** When enforcing business rules (rate limits, quotas, feature limits) that need to return structured error metadata to clients.

**Context:** Business rule validation differs from schema validation - it checks application-level constraints (user limits, system quotas) that require database queries or service state checks. The error response should include both a user-friendly message AND structured metadata for client-side handling.

**Pattern:** Validate business rules after schema validation, return rich error details using object format.

```typescript
// server/routes/alert-routes.ts
import { PRICE_ALERT } from '../utils/constants';

app.post(
  '/api/price-alerts',
  csrfProtection,
  withAuth(async (req, res) => {
    try {
      // Step 1: Schema validation (input structure)
      const validatedData = createPriceAlertSchema.parse(req.body);
      const user = req.user;

      // Step 2: Foreign key validation (data integrity)
      const product = await storage.getProductById(validatedData.productId);
      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      // Step 3: Business rule validation (application constraints)
      const userAlertCount = await storage.countUserAlerts(user.id);
      if (userAlertCount >= PRICE_ALERT.MAX_ALERTS_PER_USER) {
        sendError(
          res,
          `Alert limit reached. You can only have ${PRICE_ALERT.MAX_ALERTS_PER_USER} active alerts.`,
          400,
          {
            code: 'ALERT_LIMIT_REACHED',
            limit: PRICE_ALERT.MAX_ALERTS_PER_USER,
            current: userAlertCount,
          }
        );
        return;
      }

      // Step 4: Create resource
      const alert = await storage.createPriceAlert({
        userId: user.id,
        productId: validatedData.productId,
        targetPrice: validatedData.targetPrice.toFixed(2),
        notifyForum: validatedData.notifyForum,
      });

      sendSuccess(res, alert, 201);
    } catch (error: unknown) {
      sendErrorFromException(res, error, 'CreatePriceAlert');
    }
  })
);
```

**Key Points:**

1. **Validation Order**: Schema → Foreign keys → Business rules → Create
2. **Rich Error Metadata**: Use object `details` parameter for structured data
3. **Error Codes**: Include `code` field for client-side conditional handling
4. **User-Friendly Messages**: Error message explains limit + current state
5. **Constants**: Business rules sourced from `server/utils/constants.ts`

**Error Response Format:**

```typescript
// Client receives:
{
  success: false,
  error: "Alert limit reached. You can only have 50 active alerts.",
  code: "ALERT_LIMIT_REACHED",
  limit: 50,
  current: 50
}
```

**Why Object Details Over String:**

- `sendError(res, msg, status, "string")` → Development-only (filtered in production)
- `sendError(res, msg, status, { ... })` → Always included (client UX metadata)
- See `docs/06_ERROR_HANDLING_PATTERNS.md` for complete `details` parameter guide

**Related Patterns:**

- See "Frontend Type-Safe Error Details Extraction" in `docs/01_TYPESCRIPT_PATTERNS.md`
- See "Middleware Rich Metadata Pattern" in `docs/MIDDLEWARE_API_PATTERNS.md`

---

### Pagination Patterns

#### Cursor vs Offset Pagination

```typescript
// Offset pagination (simple, allows jumping to pages)
router.get('/api/products', async (req, res) => {
  try {
    const page = parseIntOptional(req.query.page) || 1;
    const limit = Math.min(
      parseIntOptional(req.query.limit) || 50,
      100 // Max limit
    );
    const offset = (page - 1) * limit;

    const [products, total] = await Promise.all([
      db.select()
        .from(products)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(products.createdAt)),
      db.select({ count: sql<number>`count(*)::int` })
        .from(products)
        .then(r => r[0].count),
    ]);

    sendPaginated(res, products, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    });
  } catch (error) {
    sendErrorFromException(res, error, 'GetProducts');
  }
});

// Cursor pagination (efficient for large datasets)
router.get('/api/feed', async (req, res) => {
  try {
    const limit = parseIntOptional(req.query.limit) || 50;
    const cursor = req.query.cursor; // Base64 encoded cursor

    let query = db.select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(limit + 1); // Fetch one extra to check hasNext

    if (cursor) {
      const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
      query = query.where(
        or(
          lt(posts.createdAt, decodedCursor.createdAt),
          and(
            eq(posts.createdAt, decodedCursor.createdAt),
            gt(posts.id, decodedCursor.id)
          )
        )
      );
    }

    const items = await query;
    const hasNext = items.length > limit;
    const results = hasNext ? items.slice(0, -1) : items;

    const nextCursor = hasNext
      ? Buffer.from(JSON.stringify({
          createdAt: results[results.length - 1].createdAt,
          id: results[results.length - 1].id,
        })).toString('base64')
      : null;

    sendSuccess(res, {
      data: results,
      meta: {
        nextCursor,
        hasNext,
      },
    });
  } catch (error) {
    sendErrorFromException(res, error, 'GetFeed');
  }
});
```

---

## Testing Patterns

### Response Validation Helpers

**ALL route tests MUST use the standardized validation helpers** from `server/__tests__/helpers/response-validators.ts`:

```typescript
import {
  expectSuccessResponse,
  expectErrorResponse,
} from '../../__tests__/helpers/response-validators';

describe('Product Routes', () => {
  it('should return product details', async () => {
    const response = await request(app).get('/api/products/123');

    // ✅ CORRECT - Use validation helper
    const product = expectSuccessResponse<Product>(response, 200);

    expect(product.id).toBe(123);
    expect(product.name).toBeDefined();
  });

  it('should return 404 for non-existent product', async () => {
    const response = await request(app).get('/api/products/999');

    // ✅ CORRECT - Validate error response
    expectErrorResponse(response, 404, 'Product not found');
  });
});
```

### ❌ WRONG - Manual Response Assertions

```typescript
// ❌ WRONG - Don't manually check response structure
it('should return product details', async () => {
  const response = await request(app).get('/api/products/123');

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);  // Manual envelope check
  expect(response.body.data).toBeDefined();  // Manual data check

  const product = response.body.data;  // Manual extraction
  expect(product.id).toBe(123);
});

// ❌ WRONG - Don't access response.body directly
it('should return products', async () => {
  const response = await request(app).get('/api/products');

  const products = response.body;  // Assumes no envelope
  expect(Array.isArray(products)).toBe(true);
});
```

**Why Validation Helpers Matter:**

1. **Consistency**: All tests validate the same envelope structure
2. **Type Safety**: Helpers provide proper TypeScript typing
3. **Error Detection**: Catches envelope format bugs immediately
4. **Maintainability**: Single source of truth for validation logic
5. **Future-Proof**: If envelope format changes, update one place

---

### Timezone-Safe Date Testing (CRITICAL)

**Problem**: JavaScript `new Date('2025-01-15')` creates midnight UTC, which becomes the previous day in western timezones (PST, EST) when formatted with `toLocaleDateString()`.

#### ❌ WRONG - Timezone-Sensitive Test Dates

```typescript
it('should format date correctly', () => {
  // ❌ WRONG - Midnight UTC shifts to Jan 14 in PST
  const date = new Date('2025-01-15');
  const formatted = formatDate(date);
  expect(formatted).toMatch(/Jan.*15.*2025/); // FAILS in PST!
});

it('should return created timestamp', async () => {
  // ❌ WRONG - Local timezone constructor
  const testDate = new Date(2025, 0, 15); // Midnight local time
  const response = await request(app).post('/api/products').send({
    createdAt: testDate.toISOString()
  });
  // Inconsistent behavior across environments
});
```

#### ✅ CORRECT - Timezone-Safe Patterns

**Chrome Extension Tests** - Use utility functions:

```typescript
import { createTestDate, createTestDateISO, TEST_DATES } from '../helpers/test-dates.js';

it('should format date correctly', () => {
  // ✅ CORRECT - Noon UTC, works in all timezones
  const date = createTestDate(2025, 1, 15); // 1-based months (1 = January)
  const formatted = formatDate(date);
  expect(formatted).toMatch(/Jan.*15.*2025/); // Passes everywhere ✅
});

it('should handle year boundaries', () => {
  // ✅ CORRECT - Pre-defined boundary dates
  const jan1 = TEST_DATES.YEAR_START;
  const dec31 = TEST_DATES.YEAR_END;
  expect(formatDate(jan1)).toMatch(/Jan.*1.*2025/);
  expect(formatDate(dec31)).toMatch(/Dec.*31.*2024/);
});

it('should handle leap year dates', () => {
  // ✅ CORRECT - Leap day testing
  const leapDay = TEST_DATES.LEAP_YEAR_FEB_29;
  expect(formatDate(leapDay)).toMatch(/Feb.*29.*2024/);
});
```

**Server Tests** - Direct Date.UTC() with noon time:

```typescript
it('should return created timestamp', async () => {
  // ✅ CORRECT - Explicit UTC with noon time
  const testDate = new Date(Date.UTC(2025, 0, 15, 12, 0, 0)); // 0 = January
  const response = await request(app).post('/api/products').send({
    createdAt: testDate.toISOString()
  });

  const product = expectSuccessResponse<Product>(response, 201);
  expect(product.createdAt).toBeDefined();
});

it('should filter by date range', async () => {
  // ✅ CORRECT - ISO strings with time component
  const response = await request(app)
    .get('/api/products')
    .query({
      startDate: '2025-01-01T12:00:00Z', // Noon UTC
      endDate: '2025-01-31T12:00:00Z'
    });

  const products = expectSuccessResponse<Product[]>(response, 200);
  expect(products).toHaveLength(10);
});
```

**Why Noon UTC?**

Noon (12:00:00) UTC provides a 12-hour buffer that prevents date shifts across all world timezones:
- **PST (UTC-8)**: 4 AM local, still same date ✅
- **UTC+14**: 2 AM next day local, still same date ✅

**Quick Reference:**

| Pattern | Timezone-Safe? | Use Case |
|---------|----------------|----------|
| `createTestDate(2025, 1, 15)` | ✅ Yes | **Preferred** - Chrome extension tests |
| `Date.UTC(2025, 0, 15, 12, 0, 0)` | ✅ Yes | **Good** - Server tests |
| `'2025-01-15T12:00:00Z'` | ✅ Yes | **Good** - API query params |
| `new Date('2025-01-15')` | ❌ No | **Never** - Shifts date in PST |
| `new Date(2025, 0, 15)` | ❌ No | **Never** - Local timezone |

**CI/CD Context:**

Don't assume CI/CD runs in UTC! GitHub Actions, GitLab CI, and CircleCI may use different timezones depending on runner configuration.

**See Also**: `docs/01_TYPESCRIPT_PATTERNS.md` - Date Testing Patterns section

---

### Variable Naming Conflicts

#### ❌ CRITICAL MISTAKE - Variable Shadowing

**NEVER use a variable name that shadows a table import**:

```typescript
import { retailers } from '@shared/schema';  // Table import

describe('Retailer Routes', () => {
  it('should return retailers', async () => {
    const response = await request(app).get('/api/retailers');

    // ❌ WRONG - 'retailers' shadows the table import
    const retailers = expectSuccessResponse<Array<Retailer>>(response, 200);

    // This will FAIL - 'retailers' now refers to the response variable!
    await db.insert(retailers).values({  // ERROR: Cannot access before initialization
      name: 'Test Retailer'
    });
  });
});
```

#### ✅ CORRECT - Use Distinct Variable Names

```typescript
import { retailers } from '@shared/schema';  // Table import

describe('Retailer Routes', () => {
  it('should return retailers', async () => {
    const response = await request(app).get('/api/retailers');

    // ✅ CORRECT - Use 'result' or 'retailerList' to avoid shadowing
    const result = expectSuccessResponse<Array<Retailer>>(response, 200);

    expect(result.length).toBeGreaterThan(0);

    // ✅ Now db operations work correctly
    await db.insert(retailers).values({
      name: 'Test Retailer'
    });
  });
});
```

**Common Variable Naming Patterns:**

| Table Import | ❌ Avoid | ✅ Use Instead |
|--------------|----------|----------------|
| `retailers` | `retailers` | `result`, `retailerList`, `data` |
| `products` | `products` | `result`, `productList`, `data` |
| `users` | `users` | `result`, `userList`, `data` |
| `priceAlerts` | `priceAlerts` | `result`, `alerts`, `data` |

**Error Symptoms:**

If you see these errors, you likely have a variable shadowing issue:

```
ReferenceError: Cannot access 'retailers' before initialization
TypeError: Cannot access 'products' before initialization
ReferenceError: Cannot access 'users2' before initialization
```

---

### PostgreSQL Type Handling

#### DECIMAL/NUMERIC Values Return as Strings (CRITICAL)

**Problem Found**: PostgreSQL DECIMAL and NUMERIC values return as strings to preserve precision. TypeScript type assertions (`sql<number>`) only affect compile-time, NOT runtime.

```typescript
// WRONG - Type assertion doesn't convert at runtime!
const products = await db.select({
  id: products.id,
  bestPrice: sql<number>`MIN(${productOffers.price})`  // TypeScript thinks number...
}).from(products);

// bestPrice is actually a STRING "99.99" at runtime!
// This causes test failures:
expect(product.bestPrice).toBeGreaterThanOrEqual(50);  // String comparison!
```

#### Correct Pattern - Convert in Storage/Route Layer

```typescript
// In storage or route handler
const products = await db.select({
  id: products.id,
  bestPrice: sql<string>`MIN(${productOffers.price})`  // Acknowledge it's string
}).from(products);

// Convert when building response
return products.map(row => ({
  ...row,
  // Type assertion: PostgreSQL DECIMAL returns string, convert to number for API
  bestPrice: typeof row.bestPrice === 'string' ? parseFloat(row.bestPrice) : row.bestPrice,
}));
```

#### Test Pattern for Price Fields

```typescript
it('should filter by price range', async () => {
  const response = await request(app)
    .get('/api/products/search')
    .query({ minPrice: '50', maxPrice: '150' });

  const { data } = expectPaginatedResponse<{ bestPrice: number }>(response, 200);

  // Verify type conversion happened
  data.forEach((product: { bestPrice: number }) => {
    expect(typeof product.bestPrice).toBe('number');  // Verify it's a number, not string
    expect(product.bestPrice).toBeGreaterThanOrEqual(50);
    expect(product.bestPrice).toBeLessThanOrEqual(150);
  });
});
```

---

### Test Data Setup

```typescript
describe('Product Routes', () => {
  let testProduct: Product;
  let testRetailer: Retailer;

  beforeEach(async () => {
    // Clean database
    await db.delete(products);
    await db.delete(retailers);

    // Create test data
    [testRetailer] = await db.insert(retailers).values({
      name: 'Test Retailer',
      website: 'https://example.com'
    }).returning();

    [testProduct] = await db.insert(products).values({
      name: 'Test Product',
      description: 'Test Description'
    }).returning();
  });

  afterEach(async () => {
    // Clean up after each test
    await db.delete(products);
    await db.delete(retailers);
  });

  it('should return product with offers', async () => {
    // Create test offer
    await db.insert(productOffers).values({
      productId: testProduct.id,
      retailerId: testRetailer.id,
      price: '99.99'
    });

    const response = await request(app).get(`/api/products/${testProduct.id}`);

    const result = expectSuccessResponse<ProductWithOffers>(response, 200);
    expect(result.offers.length).toBe(1);
  });
});
```

---

## Service Integration

### Guard Completeness Pattern

**Problem**: Inconsistent application of rate limiters or guards across service methods leads to partial protection and unexpected quota consumption.

#### Anti-Pattern

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

#### Correct Pattern

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

**Key Principles:**
1. ALL methods making external API calls must have guard checks
2. Use a DRY helper method for guard implementation
3. No partial protection - either all methods are protected or none
4. Include operation context in error messages

---

### Cache-Before-Limit Pattern

**Problem**: Checking rate limits before cache lookups wastes user quota on cached responses and provides poor user experience.

#### Anti-Pattern

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

#### Correct Pattern

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

**Implementation Rules:**
1. Always check cache BEFORE rate limit
2. Log cache hits and misses for monitoring
3. Only consume rate limit quota for actual external calls
4. Include cache usage suggestions in rate limit errors
5. Set appropriate TTL based on data volatility

---

### Single Cache Abstraction Pattern

**Problem**: Multiple cache implementations create confusion, duplicate Redis connections, and maintenance burden.

**Status**: Enforced as of 2025-12-01 (Cache Consolidation Complete)

#### Anti-Pattern

```typescript
// ❌ WRONG - Multiple separate cache services
import { redisCache } from '../services/redis-cache';
import { analyticsCacheService } from '../services/analytics-cache';
import { queryCache } from '../services/redis-cache';

// Creates confusion: which cache to use?
// Creates duplicate Redis connections
// Inconsistent cache key patterns
```

#### Correct Pattern

```typescript
// ✅ CORRECT - Single unified cache abstraction
import { advancedCache, CacheTier, queryCache, generalCache } from '../services/advanced-cache';

// Primary cache service with L1+L2 and tiered TTL
const data = await advancedCache.getOrSet(
  key,
  async () => fetchFromDB(),
  CacheTier.WARM  // Uses tier-based TTL
);

// Invalidate with pattern matching
await advancedCache.invalidatePattern('product:123:*');

// Specialized wrappers for specific domains
// queryCache - AI-generated search queries (7 day TTL)
await queryCache.set('some-query-key', queries);

// generalCache - General-purpose caching (1 hour TTL)
await generalCache.set('some-key', data);
```

**Cache Tier Selection:**

| Tier | TTL | Use Case |
|------|-----|----------|
| `CacheTier.HOT` | 30 min | Frequently accessed (top 100 products) |
| `CacheTier.WARM` | 10 min | Moderately accessed (normal products) |
| `CacheTier.COLD` | 3 min | Rarely accessed |
| `CacheTier.STATIC` | 1 hour | Rarely changes (retailers, categories) |
| `CacheTier.COMPUTED` | 30 min | Expensive calculations (analytics) |

**Implementation Rules:**
1. **Always use `advancedCache`** - Never create new cache service instances
2. **Use specialized wrappers** - `queryCache` and `generalCache` for backward compatibility
3. **Select appropriate tier** - Match TTL to data update frequency
4. **Use L1 sparingly** - Only for ultra-hot data (set `useL1 = true`)
5. **Pattern invalidation** - Use `invalidatePattern()` instead of clearing entire cache

**Related Documentation:**
- `docs/advanced-caching.md` - Full caching system documentation
- `docs/DOMAIN_CACHING_STRATEGIES.md` - Per-domain caching guidance

---

### Type Extraction Pattern

**Problem**: Complex inline types in React Query hooks reduce code readability and make maintenance difficult.

#### Anti-Pattern

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

#### Correct Pattern

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

**Guidelines:**
1. Extract types when return type exceeds 3 lines
2. Create named interfaces for nested objects
3. Group related type definitions together
4. Use descriptive names that indicate purpose
5. Consider creating a `types.ts` file for shared types

---

### Error Message Quality Pattern

**Problem**: Vague error messages provide no actionable information to users, leading to frustration and support requests.

#### Anti-Pattern

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

#### Correct Pattern

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

**Error Message Requirements:**
1. **What**: Specify exactly what limit/constraint was exceeded
2. **Current State**: Show current usage vs limit
3. **When**: Indicate when the limit resets or becomes available
4. **Remaining**: Display remaining quota if applicable
5. **Alternatives**: Suggest alternative approaches or workarounds
6. **Context**: Include relevant operation or resource name

---

## Error Handling in Routes

### Mandatory Helpers

#### 1. handleRouteError()

**Purpose**: Standardized error response for all route error handlers.

**Usage**:
```typescript
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName');
}
```

**What it does**:
- Calls `createErrorResponse()` internally
- Automatically logs errors via logger
- Sends sanitized error response
- Determines correct status code (400 for validation, 500 for others)
- Includes validation details in development mode

**Import**:
```typescript
import { handleRouteError } from "./helpers";
```

**Optional status override**:
```typescript
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName', 500);  // Force 500
}
```

---

#### 2. notFound()

**Purpose**: Standardized 404 not-found responses.

**Usage**:
```typescript
if (!resource) {
  notFound(res, 'Resource');
  return;
}
```

**What it does**:
- Returns 404 status code
- Sends consistent JSON response: `{ error: "Resource not found" }`
- Ensures all 404s use same format

**Import**:
```typescript
import { notFound } from "./helpers";
```

---

### Anti-Patterns to Flag

#### Anti-Pattern 1: Manual createErrorResponse

```typescript
// ❌ WRONG - Verbose, 4-5 lines
catch (error: unknown) {
  logger.error('Operation failed:', { error: error instanceof Error ? error.message : String(error) });
  const errorResponse = createErrorResponse(error, 'OperationName');
  res.status(errorResponse.status).json({ error: errorResponse.error });
}

// ✅ CORRECT - 1 line
catch (error: unknown) {
  handleRouteError(res, error, 'OperationName');
}
```

**Why it's wrong**: Violates DRY, easy to forget logging, inconsistent format

---

#### Anti-Pattern 2: Manual 404 Responses

```typescript
// ❌ WRONG - Inconsistent format (uses "message" instead of "error")
if (!product) {
  res.status(404).json({ message: "Product not found" });
  return;
}

// ❌ WRONG - Custom error messages
if (!watchlist) {
  res.status(404).json({ error: "Watch list not found or cannot be deleted" });
  return;
}

// ✅ CORRECT - Consistent helper
if (!product) {
  notFound(res, 'Product');
  return;
}
```

**Why it's wrong**: API clients expect consistent format, frontend error handling breaks

---

#### Anti-Pattern 3: Using console.error

```typescript
// ❌ WRONG - Redundant logging
catch (error: unknown) {
  console.error('Failed to get alerts:', error);
  handleRouteError(res, error, 'GetAlerts');
}

// ✅ CORRECT - Helper logs automatically
catch (error: unknown) {
  handleRouteError(res, error, 'GetAlerts');
}
```

**Why it's wrong**: handleRouteError logs internally, console.error lacks structure

---

#### Anti-Pattern 4: Silent Failures

```typescript
// ❌ WRONG - Returns empty array, hides error
catch (error: unknown) {
  logger.error('Error fetching categories', { error });
  res.json([]);
}

// ✅ CORRECT - Return proper error
catch (error: unknown) {
  handleRouteError(res, error, 'GetCategories');
}

// ✅ ACCEPTABLE - Document intentional graceful degradation
catch (error: unknown) {
  // GRACEFUL DEGRADATION: Non-critical feature, don't block UX
  logger.warn('Categories fetch failed, returning empty', { error });
  res.json([]);
}
```

**Why it's wrong**: Masks backend issues, prevents client retry/notification

---

### Complete Route Example

**Before refactoring**:
```typescript
app.get("/api/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const product = await storage.getProduct(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error: unknown) {
    console.error('Failed to get product:', error);
    const errorResponse = createErrorResponse(error, 'GetProduct');
    res.status(errorResponse.status).json({
      error: errorResponse.error,
      ...(errorResponse.details && { details: errorResponse.details })
    });
  }
});
```

**After refactoring**:
```typescript
app.get("/api/products/:id", async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    const product = await storage.getProduct(id);

    if (!product) {
      notFound(res, 'Product');
      return;
    }

    res.json(product);
  } catch (error: unknown) {
    handleRouteError(res, error, 'GetProduct');
  }
});
```

**Improvements**:
- 18 lines → 12 lines (33% reduction)
- Safe integer parsing with validation
- Consistent error response format
- Automatic logging
- Clear, maintainable code

---

## Performance Patterns

### Caching Patterns

#### Cache Middleware

```typescript
// middleware/cache.ts
interface CacheOptions {
  duration?: number; // seconds
  key?: (req: Request) => string;
  condition?: (req: Request) => boolean;
}

export function cache(options: CacheOptions = {}) {
  const {
    duration = 300, // 5 minutes default
    key = (req) => `cache:${req.originalUrl}`,
    condition = (req) => req.method === 'GET',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition not met
    if (!condition(req)) {
      return next();
    }

    const cacheKey = key(req);

    try {
      // Check cache
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      log.error('Cache read error:', error);
      // Continue without cache
    }

    // Store original send
    const originalSend = res.json.bind(res);

    // Override json method
    res.json = function(data: any) {
      res.setHeader('X-Cache', 'MISS');

      // Cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(cacheKey, duration, JSON.stringify(data))
          .catch(error => log.error('Cache write error:', error));
      }

      return originalSend(data);
    };

    next();
  };
}

// Usage with different cache durations
router.get('/api/products',
  cache({ duration: 300 }), // 5 minutes
  getProducts
);

router.get('/api/products/:id',
  cache({
    duration: 60, // 1 minute
    key: (req) => `product:${req.params.id}`,
  }),
  getProduct
);

// Cache invalidation
export async function invalidateCache(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Invalidate on update
router.put('/api/products/:id', async (req, res) => {
  const product = await storage.updateProduct(req.params.id, req.body);

  // Invalidate related caches
  await Promise.all([
    invalidateCache(`product:${req.params.id}`),
    invalidateCache('cache:/api/products*'),
  ]);

  res.json(product);
});
```

---

### Rate Limiting

#### Tiered Rate Limiting

```typescript
// middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

// General API limit
export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict auth limit
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 50,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Rate limit by IP + email for auth
    return `${req.ip}:${req.body?.email || ''}`;
  },
});

// Search rate limit (expensive operation)
export const searchLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:search:',
  }),
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 searches per minute
});

// User-specific rate limiting
export function userRateLimit(max: number, windowMs: number) {
  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: 'rl:user:',
    }),
    windowMs,
    max,
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated
      return req.session?.userId?.toString() || req.ip;
    },
    skip: (req) => {
      // Skip for admin users
      return req.session?.role === 'admin';
    },
  });
}

// Apply different limits
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/scrape',
  requireAuth,
  userRateLimit(5, 60000) // 5 per minute per user
);
```

---

## Security & Authentication

### Agent-Native Authentication Design (NEW - 2025-12-26)

**Context**: Choosing authentication mechanisms for AI agents and automation requires balancing simplicity, security, and implementation cost.

**Decision**: HTTP Basic Authentication over API keys for agent-native endpoints.

#### Design Rationale

**Why HTTP Basic Auth?**

1. **Simplicity** - 2 hours implementation vs 8+ hours for API keys
2. **Zero Database Changes** - No `api_keys` table, no migrations
3. **Standard Compliance** - RFC 7617, works with all HTTP clients
4. **Equally Secure** - Over HTTPS, same security as API keys
5. **Stateless** - No session cookies, perfect for automation
6. **Universal Support** - curl, SDKs, automation tools all support it

**Trade-offs Accepted:**

| Feature | HTTP Basic Auth | API Keys |
|---------|----------------|----------|
| Implementation Time | 2 hours | 8+ hours |
| Database Changes | None | New table + migrations |
| Per-User Keys | No | Yes |
| Key Rotation | Manual | Programmatic |
| Usage Analytics | IP-based only | Per-key metrics |
| Rate Limiting | Per-user | Per-key |

#### When to Upgrade to API Keys

**Upgrade triggers** (any ONE triggers upgrade):

1. **Scale**: 100+ users requesting individual keys
2. **Compliance**: Audit requirements mandate key rotation logs
3. **Analytics**: Per-key usage metrics needed for billing
4. **Rate Limiting**: Different limits per key (not per user)

**Current Status** (as of 2025-12-26):

- Users: 1-10 (admins only)
- Use Case: Internal automation, AI agents
- Decision: HTTP Basic Auth sufficient

#### Implementation Pattern

```typescript
// server/middleware/basic-auth.ts

import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';

export async function basicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Fall through to session auth if no Authorization header
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return next();
  }

  try {
    // Decode Base64 credentials
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // Validate input (DoS prevention)
    if (!username || !password || username.length > 100 || password.length > 200) {
      logger.warn('Basic auth failed: Invalid credentials format');
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Retrieve user with passwordHash
    const user = await storage.getUserByUsername(username);

    if (!user) {
      logger.warn('Basic auth failed: User not found', { username });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Check account status
    if (user.isSuspended) {
      logger.warn('Basic auth failed: Account suspended', { username });
      sendError(res, 'Account suspended', 403);
      return;
    }

    if (!user.isActive) {
      logger.warn('Basic auth failed: Account inactive', { username });
      sendError(res, 'Account inactive', 403);
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      logger.warn('Basic auth failed: Invalid password', { username });
      res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Attach user to request (same as session auth)
    req.user = user;

    logger.info('Basic auth successful', {
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    next();
  } catch (error) {
    logger.error('Basic auth error:', error);
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'Authentication failed', 500);
  }
}
```

#### Route Registration Pattern

```typescript
// server/routes/api-v1-routes.ts

import { basicAuth } from '../middleware/basic-auth';
import { withAuth, withAdmin } from './helpers';

export function registerApiV1Routes(app: Express) {
  /**
   * Agent-Native Endpoints
   * Authentication: HTTP Basic Auth (stateless)
   * CSRF: Exempt (no session cookies)
   */

  app.post(
    '/api/v1/scraping/discover-trends',
    // CSRF exempt: Uses HTTP Basic Auth (stateless), not session cookies
    basicAuth,        // 1. Authenticate via Authorization header
    withAdmin(async (req, res) => {  // 2. Verify admin role
      // 3. Execute business logic
      const result = await coordinationAgent.processTask({
        action: 'discover_trends',
        sources: req.body.sources,
      });
      sendSuccess(res, { message: 'Completed', result });
    })
  );

  // Additional agent endpoints...
}
```

#### Client Usage Examples

**curl**:

```bash
# Simple authentication
curl -u "admin:password" https://api.pricecompare.com/api/v1/scraping/discover-trends

# With request body
curl -u "admin:password" \
  -H "Content-Type: application/json" \
  -d '{"sources": ["amazon", "ebay"]}' \
  https://api.pricecompare.com/api/v1/scraping/discover-trends
```

**Python**:

```python
import requests

# Using auth parameter (recommended)
response = requests.post(
    'https://api.pricecompare.com/api/v1/scraping/discover-trends',
    auth=('admin', 'password'),
    json={'sources': ['amazon', 'ebay']}
)

# Or manual header
import base64
credentials = base64.b64encode(b'admin:password').decode('utf-8')
headers = {'Authorization': f'Basic {credentials}'}
response = requests.post(url, headers=headers, json=data)
```

**Node.js**:

```javascript
// Using axios
const axios = require('axios');

const response = await axios.post(
  'https://api.pricecompare.com/api/v1/scraping/discover-trends',
  { sources: ['amazon', 'ebay'] },
  {
    auth: {
      username: 'admin',
      password: 'password'
    }
  }
);

// Using fetch with manual header
const credentials = Buffer.from('admin:password').toString('base64');
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

#### Security Checklist

- [ ] **HTTPS Enforced** - Credentials sent in base64 (not encrypted)
- [ ] **Rate Limiting** - Prevent brute force (5 req/min per IP)
- [ ] **Account Lockout** - Lock after N failed attempts
- [ ] **Account Status** - Validate `isActive` and `isSuspended`
- [ ] **Input Validation** - Max username/password length (DoS)
- [ ] **WWW-Authenticate Header** - Return on 401 for client retry
- [ ] **Audit Logging** - Log all auth attempts (success + failure)
- [ ] **Fallback to Session** - Support both auth methods

#### Migration Path to API Keys

**When to migrate**:

```
IF (users > 100 OR compliance_required OR per_key_metrics_needed)
  THEN implement API keys system
  ELSE keep HTTP Basic Auth
```

**Implementation checklist for future API keys**:

1. Create `api_keys` table with schema:
   ```sql
   CREATE TABLE api_keys (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
     key_hash TEXT NOT NULL,
     name TEXT NOT NULL,
     last_used_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT NOW(),
     expires_at TIMESTAMP,
     is_active BOOLEAN DEFAULT true
   );
   ```

2. Generate secure API keys with `crypto.randomBytes(32)`
3. Store bcrypt-hashed keys (same as passwords)
4. Add API key validation middleware
5. Add key rotation endpoint
6. Add usage analytics tracking
7. Update documentation

**Estimated effort**: 8 hours + testing

*Source: HTTP Basic Auth implementation (2025-12-26), docs/HTTP_BASIC_AUTH_FINAL_SUMMARY.md*
*Added: 2025-12-26*

---

### Unified Authentication Middleware Pattern (MANDATORY - NEW 2025-12-27)

**Context:** Routes that need to support both HTTP Basic Auth (for API clients/agents) AND session-based auth (for browsers) require a flexible authentication strategy.

**Problem:** Using separate `basicAuth` and session auth middleware creates:
- Route duplication (e.g., `/api/watchlists` vs `/api/v1/watchlists`)
- Inconsistent CSRF protection
- Maintenance burden (same logic in two places)
- Type safety gaps

**Pattern:** Use `flexibleAuth` middleware that tries Basic Auth first, then falls back to session auth.

#### ✅ CORRECT - flexibleAuth Middleware Pipeline

**CRITICAL**: `withAuth()` wrapper is **MANDATORY**, not optional. It provides:
1. **Runtime guarantee** - Verifies `req.user` exists before handler executes
2. **Type safety** - TypeScript knows `req.user` is defined in handler
3. **Security enforcement** - Returns 401 if neither auth method succeeds
4. **CSRF integration** - Sets `req.isBasicAuth` flag for downstream middleware

```typescript
// server/routes/watchlist-routes.ts

import { flexibleAuth } from '../middleware/flexible-auth';
import { csrfProtection } from '../middleware/security';
import { withAuth } from './helpers';

// ✅ GET route - Read-only
app.get('/api/watchlists',
  flexibleAuth,              // 1. Try Basic Auth → Session auth → Reject
  withAuth(async (req, res) => {  // 2. MANDATORY: Verify req.user exists
    const userId = req.user.id;   // 3. Type-safe access (no null check needed)
    const watchlists = await storage.getUserWatchLists(userId);
    sendSuccess(res, { watchlists });
  })
);

// ✅ POST route - Mutation with CSRF protection
app.post('/api/watchlists',
  flexibleAuth,                   // 1. Authenticate (sets req.isBasicAuth flag)
  csrfProtection,                 // 2. CSRF check (auto-exempts Basic Auth)
  withAuth(async (req, res) => {  // 3. MANDATORY: Verify req.user exists
    const userId = req.user.id;
    const data = createWatchListSchema.parse(req.body);
    const watchlist = await storage.createWatchList(userId, data);
    sendSuccess(res, watchlist, 201);
  })
);
```

#### ❌ WRONG - Missing withAuth() Wrapper

```typescript
// ❌ SECURITY RISK: No runtime check that req.user exists!
app.get('/api/watchlists',
  flexibleAuth,
  async (req, res) => {
    // flexibleAuth might have failed silently
    // req.user could be undefined here!
    const userId = req.user.id; // Runtime error if auth failed
    // ...
  }
);

// ❌ TYPE SAFETY VIOLATION: Unsafe type assertion
app.get('/api/watchlists',
  flexibleAuth,
  async (req, res) => {
    // CLAUDE.md violation: undocumented type assertion
    const skipCache = shouldSkipCache(req as AuthenticatedRequest);
    // What if flexibleAuth failed? Type assertion lies!
  }
);
```

#### Why withAuth() is NOT Optional

**Security Defense in Depth:**

```
Layer 1: flexibleAuth - Authenticates user (Basic Auth or Session)
Layer 2: withAuth      - Verifies req.user exists, enforces type safety
Layer 3: Handler       - Executes business logic with guaranteed user context
```

**What happens without withAuth():**

1. `flexibleAuth` might fail to authenticate but not call `next()` properly
2. Handler executes with `undefined` req.user
3. Runtime error when accessing `req.user.id`
4. Type system can't infer `req.user` exists

**What withAuth() prevents:**

```typescript
// server/routes/helpers.ts
export function withAuth(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    // Runtime check - ALWAYS runs before handler
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return; // Handler never executes
    }

    // Handler only runs if req.user exists
    // TypeScript knows this is safe
    await handler(req, res);
  };
}
```

#### CSRF Protection Integration

**Automatic CSRF exemption for Basic Auth:**

```typescript
// server/middleware/flexible-auth.ts
if (req.headers?.authorization?.startsWith('Basic ')) {
  req.isBasicAuth = true;   // Signal to csrfProtection: EXEMPT
  return basicAuth(req, res, next);
}

if (req.isAuthenticated()) {
  req.isBasicAuth = false;  // Signal to csrfProtection: REQUIRE TOKEN
  return next();
}
```

```typescript
// server/middleware/security.ts - csrfProtection reads the flag
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Basic Auth requests are stateless - CSRF-immune
  if (req.isBasicAuth) {
    return next(); // Skip CSRF validation
  }

  // Session-based requests need CSRF token
  return csurf({ cookie: false })(req, res, next);
};
```

**Benefits:**
- No path-based CSRF exemption rules (error-prone)
- Explicit auth method detection (clear intent)
- Single middleware pipeline (no route duplication)
- Type-safe (isBasicAuth flag is typed)

#### Common Mistakes During Migration

**Issue 1: Duplicate middleware (Phase 2 finding - 12 instances)**

```typescript
// ❌ WRONG - Automated migration created duplicates
app.post('/api/watchlists',
  flexibleAuth,        // First instance
  csrfProtection,
  flexibleAuth,        // Duplicate! (from failed sed script)
  withAuth(...)
);

// ✅ CORRECT
app.post('/api/watchlists',
  flexibleAuth,        // Single instance only
  csrfProtection,
  withAuth(...)
);
```

**Detection:**
```bash
grep -n "flexibleAuth" server/routes/watchlist-routes.ts | \
  awk '{print $1}' | \
  uniq -d  # Shows duplicate line numbers
```

**Issue 2: Type assertions instead of runtime checks (Phase 3 finding - 2 instances)**

```typescript
// ❌ WRONG - Type assertion without runtime guarantee
app.get('/api/products/search',
  flexibleAuth,
  async (req, res) => {
    // CLAUDE.md violation: undocumented 'as' cast
    const skipCache = shouldSkipCache(req as AuthenticatedRequest);
    // What if flexibleAuth failed? Assertion is unsafe!
  }
);

// ✅ CORRECT - withAuth provides runtime guarantee
app.get('/api/products/search',
  flexibleAuth,
  withAuth(async (req, res) => {
    // withAuth guarantees req.user exists
    // No type assertion needed - TypeScript infers correctly
    const skipCache = shouldSkipCache(req);
  })
);
```

#### Migration Checklist

When migrating routes to flexibleAuth:

- [ ] **Import flexibleAuth** - `import { flexibleAuth } from '../middleware/flexible-auth';`
- [ ] **Replace auth middleware** - `basicAuth` → `flexibleAuth` or add to session routes
- [ ] **Add withAuth wrapper** - MANDATORY for all authenticated routes
- [ ] **Check for duplicates** - Ensure flexibleAuth appears only once
- [ ] **Remove type assertions** - `req as AuthenticatedRequest` → trust withAuth
- [ ] **Update CSRF comments** - Document why Basic Auth is CSRF-exempt
- [ ] **Test both auth methods** - Verify Basic Auth AND session auth work
- [ ] **Verify error responses** - 401 for no auth, 403 for wrong role

#### Testing Pattern

```typescript
// Test both authentication methods
describe('GET /api/watchlists', () => {
  it('should work with session auth', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });
    const res = await agent.get('/api/watchlists');
    expect(res.status).toBe(200);
  });

  it('should work with Basic Auth', async () => {
    const res = await request(app)
      .get('/api/watchlists')
      .auth('username', 'password');  // HTTP Basic Auth
    expect(res.status).toBe(200);
  });

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/watchlists');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });
});
```

**Rationale:**
- **Defense in Depth**: Multiple layers prevent single points of failure
- **Type Safety**: withAuth wrapper enables TypeScript to infer req.user exists
- **CSRF Security**: Explicit flag-based exemption (not path-based guessing)
- **Zero Breaking Changes**: Both auth methods work on same routes
- **Code Quality**: Eliminates type assertions, reduces duplication

**Related Patterns:**
- See `docs/04_SECURITY_PATTERNS.md` - Intentional passwordHash exposure for auth
- See `docs/01_TYPESCRIPT_PATTERNS.md` - Type assertions vs runtime checks
- See `docs/08_TESTING_PATTERNS.md` - Integration testing with multiple auth methods

*Source: Unified Auth Migration (Phases 1-3), 89 endpoints migrated, 23 issues fixed*
*Code Reviews: PHASE_2_CODE_REVIEW_FIXES.md, PHASE_3_CODE_REVIEW_FIXES.md*
*Added: 2025-12-27*

---

### Protected Route Pattern

```typescript
// middleware/auth.ts
import { sendError } from './utils/api-response';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (req.session.role !== 'admin') {
    sendError(res, 'Admin access required', 403);
    return;
  }

  next();
}

export function requireOwnership(resourceGetter: (req: Request) => Promise<{ userId?: number }>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    try {
      const resource = await resourceGetter(req);

      if (!resource) {
        sendError(res, 'Resource not found', 404);
        return;
      }

      if (resource.userId !== req.session.userId && req.session.role !== 'admin') {
        sendError(res, 'Access denied', 403);
        return;
      }

      req.resource = resource; // Attach for route handler
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Usage
router.put('/api/watchlists/:id',
  csrfProtection,
  requireOwnership(async (req) => {
    const id = parseIntSafe(req.params.id, 'watchlistId');
    return storage.getWatchlistById(id);
  }),
  async (req, res) => {
    // User owns this watchlist or is admin
    const updated = await storage.updateWatchlist(req.params.id, req.body);
    res.json(updated);
  }
);
```

---

## API Checklist

- [ ] **Route Organization**
  - [ ] Routes organized by domain
  - [ ] Specific routes before parameterized routes
  - [ ] Storage layer abstraction used
  - [ ] Correct import paths (`../` for parent directories)

- [ ] **Middleware Pipeline**
  - [ ] Correct middleware order in server/index.ts
  - [ ] CSRF per-route (not global)
  - [ ] CSRF before auth middleware
  - [ ] Error handler last

- [ ] **Request Validation**
  - [ ] Zod schemas for body/query
  - [ ] Safe parameter parsing (parseIntSafe)
  - [ ] Input sanitization

- [ ] **Response Patterns**
  - [ ] sendSuccess/sendError/sendErrorFromException helpers
  - [ ] No nested response wrappers
  - [ ] Proper HTTP status codes
  - [ ] Consistent error messages

- [ ] **Authentication**
  - [ ] Protected routes use withAuth/withAdmin
  - [ ] CSRF protection on mutations
  - [ ] Middleware uses sendError()

- [ ] **Testing**
  - [ ] Validation helpers (expectSuccessResponse)
  - [ ] No variable shadowing
  - [ ] PostgreSQL type conversions handled
  - [ ] Test data setup/cleanup

- [ ] **Performance**
  - [ ] Pagination implemented
  - [ ] Caching where appropriate
  - [ ] Rate limiting configured
  - [ ] Cache-before-limit pattern

- [ ] **Error Handling**
  - [ ] handleRouteError() in catch blocks
  - [ ] notFound() for 404s
  - [ ] No manual createErrorResponse
  - [ ] Actionable error messages

---

## References

**Source Documents Merged:**
1. `docs/API_PATTERNS.md` (1,658 lines)
2. `docs/API_TESTING_PATTERNS.md` (816 lines)
3. `docs/SERVICE_INTEGRATION_PATTERNS.md` (561 lines)
4. `docs/MIDDLEWARE_API_PATTERNS.md` (393 lines)
5. `.claude/knowledge/route-error-handling-patterns.md` (379 lines)
6. `docs/PATTERNS.md` (route sections only)

**Related Documentation:**
- `docs/SECURITY_PATTERNS.md` - CSRF, input validation, password hash exposure
- `docs/ERROR_HANDLING_PATTERNS.md` - Error sanitization, validation errors
- `docs/DATABASE_PATTERNS.md` - N+1 prevention, transactions, foreign keys
- `docs/TYPESCRIPT_PATTERNS.md` - Type safety, avoiding `any`
- `server/utils/api-response.ts` - Response helper implementations
- `server/routes/helpers.ts` - Route helper implementations
- `.github/WORKFLOWS.md` - CI/CD pipeline documentation

---

**Version History:**
- v1.0: Initial API_PATTERNS.md (API design, route organization, middleware)
- v1.1: Added API standardization migration patterns (sendSuccess/sendError)
- v2.0: **Consolidated 6 documents into single authoritative reference** (2025-11-29)

**Migration Complete**: 210/210 endpoints (100%) use standardized patterns
