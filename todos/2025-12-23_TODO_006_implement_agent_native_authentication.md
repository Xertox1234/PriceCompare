# TODO 006: Implement Agent-Native Authentication (API Keys)

**Priority**: P2 (ARCHITECTURE - AGENT ACCESSIBILITY)
**File(s)**:
- `server/middleware/api-key-auth.ts` (NEW)
- `server/routes/auth-routes.ts` (NEW endpoints)
- `shared/schema.ts` (NEW table)
- `migrations/0028_create_api_keys_table.sql` (NEW)
- `server/routes/scraping-routes.ts` (Update middleware)
- `server/middleware/security.ts` (Update CSRF middleware)

**Estimated Time**: 6-8 hours
**Status**: Not Started

## Problem Statement

The scraping system has **23 programmatic capabilities** but **0% are accessible to AI agents** due to authentication barriers:

**Current State**:
- ✅ All UI actions have API endpoints
- ❌ Session-based authentication ONLY (requires cookies)
- ❌ CSRF tokens tied to sessions (incompatible with stateless requests)
- ❌ No API key authentication mechanism
- ❌ No service account support

**Impact**:
- AI agents cannot authenticate programmatically
- Workflow automation impossible
- Manual admin intervention required for all scraping operations
- Violates "agent-native architecture" principle

**Example Blocked Workflow**:
```bash
# AI agent tries to trigger scraping
curl -X POST http://api.pricecompare.com/api/scraping/discover-trends \
  -H "Content-Type: application/json"
# Response: 401 Unauthorized - "Authentication required"
```

**Review Finding Reference**: Agent-Native Reviewer - Critical Gap #1

## Root Cause

The authentication system was designed for browser-based users only:
1. Passport.js with session cookies
2. CSRF tokens stored in session
3. No consideration for stateless agent authentication

This is a common pattern for traditional web apps but incompatible with AI/agent workflows.

## Solution Approach

Implement **dual authentication** system:
1. **Session-based** for browser users (existing)
2. **API key-based** for agents and automation (NEW)

**Design Principles**:
- API keys work alongside sessions (not replacing them)
- CSRF protection conditional (skip for API key auth)
- API keys have same role/permissions as users
- Full audit trail for API key usage

## Implementation Steps

### Step 1: Database Schema for API Keys

- [ ] Add `api_keys` table to `shared/schema.ts`
- [ ] Create migration 0028

**Schema**:
```typescript
// shared/schema.ts
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(), // SHA-256 of actual key
  name: varchar('name', { length: 255 }).notNull(), // User-friendly name
  isActive: boolean('is_active').notNull().default(true),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // Optional expiration
  permissions: jsonb('permissions'), // Future: granular permissions
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
```

**Migration**:
```sql
-- migrations/0028_create_api_keys_table.sql
BEGIN;

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  permissions JSONB
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = true;

COMMIT;
```

### Step 2: Create API Key Authentication Middleware

- [ ] Create `server/middleware/api-key-auth.ts`
- [ ] Implement key verification and user loading
- [ ] Add rate limiting for API key requests
- [ ] Track last_used_at

**Implementation**:
```typescript
// server/middleware/api-key-auth.ts
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import crypto from 'crypto';

/**
 * API Key Authentication Middleware
 * Checks for X-API-Key header and authenticates if present
 * Falls through to session auth if no API key
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('X-API-Key');

  if (!apiKey) {
    return next(); // No API key, continue to session-based auth
  }

  try {
    // Hash the provided key
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Verify API key
    const apiKeyRecord = await storage.getApiKeyByHash(keyHash);

    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive API key',
        errorCode: 'INVALID_API_KEY'
      });
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
      return res.status(401).json({
        success: false,
        error: 'API key has expired',
        errorCode: 'EXPIRED_API_KEY'
      });
    }

    // Load user and attach to request
    const user = await storage.getUserById(apiKeyRecord.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'API key user not found',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    req.user = user;

    // Track usage (async, don't await)
    storage.updateApiKeyLastUsed(apiKeyRecord.id).catch(err =>
      logger.error('Failed to update API key last_used_at', { error: err })
    );

    next();
  } catch (error) {
    logger.error('API key authentication error', { error });
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      errorCode: 'AUTH_ERROR'
    });
  }
}
```

### Step 3: Update Auth Middleware to Support Both Methods

- [ ] Update `requireAuth` to accept API key authentication
- [ ] Ensure role checks work for API key users

**Update**:
```typescript
// server/auth.ts or server/routes/helpers.ts
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check if already authenticated via API key
  if (req.user) {
    return next();
  }

  // Check session-based auth
  if (req.isAuthenticated()) {
    return next();
  }

  sendError(res, 'Authentication required', 401);
}
```

### Step 4: Conditional CSRF Protection

- [ ] Update `csrfProtection` to skip API key requests
- [ ] Create `csrfProtectionConditional` middleware

**Implementation**:
```typescript
// server/middleware/security.ts

/**
 * Conditional CSRF Protection
 * Skips CSRF for API key authenticated requests
 * Applies CSRF for session-based requests
 */
export function csrfProtectionConditional(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for API key authenticated requests
  if (req.header('X-API-Key')) {
    logger.debug('Skipping CSRF for API key request');
    return next();
  }

  // Apply CSRF for session-based requests
  return csrfProtection(req, res, next);
}
```

### Step 5: Update Scraping Routes to Use Conditional CSRF

- [ ] Replace `csrfProtection` with `csrfProtectionConditional` in all scraping routes
- [ ] Test both session and API key authentication

**Update** (`server/routes/scraping-routes.ts`):
```typescript
// OLD
app.post('/api/scraping/initialize', csrfProtection, requireAuth, requireAdmin, ...)

// NEW
app.post('/api/scraping/initialize', csrfProtectionConditional, requireAuth, requireAdmin, ...)
```

**Affected Routes** (11 endpoints):
- `/api/scraping/initialize`
- `/api/scraping/start-agents`
- `/api/scraping/discover-trends`
- `/api/scraping/search-product`
- `/api/scraping/full-cycle`
- `/api/scraping/google-search`
- `/api/scraping/extract-product`
- `/api/scraping/start-monitoring`
- `/api/scraping/complete-workflow`
- `/api/scraping/cache-clear`

### Step 6: API Key Management Endpoints

- [ ] Create new auth routes for API key CRUD
- [ ] Add admin UI for key management (optional)

**Endpoints**:
```typescript
// server/routes/auth-routes.ts

// Create new API key
POST /api/auth/api-keys
Body: { name: string, expiresAt?: Date }
Response: { key: string, id: number } // Key shown ONCE

// List user's API keys
GET /api/auth/api-keys
Response: { keys: [{ id, name, createdAt, lastUsedAt, expiresAt, isActive }] }

// Revoke API key
DELETE /api/auth/api-keys/:id
Response: { success: true }

// Rotate API key (create new, revoke old)
POST /api/auth/api-keys/:id/rotate
Response: { key: string, newId: number }
```

**Implementation**:
```typescript
// POST /api/auth/api-keys
app.post('/api/auth/api-keys', requireAuth, async (req, res) => {
  const { name, expiresAt } = req.body;
  const userId = req.user!.id;

  // Generate random API key (32 bytes = 64 hex chars)
  const apiKey = crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const apiKeyRecord = await storage.createApiKey({
    userId,
    keyHash,
    name,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: true,
  });

  // Return the key ONCE (user must save it)
  sendSuccess(res, {
    key: apiKey, // ⚠️ ONLY TIME THIS IS SHOWN
    id: apiKeyRecord.id,
    name: apiKeyRecord.name,
    createdAt: apiKeyRecord.createdAt,
    expiresAt: apiKeyRecord.expiresAt,
  }, 201);
});

// GET /api/auth/api-keys
app.get('/api/auth/api-keys', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const keys = await storage.getApiKeysByUserId(userId);

  // NEVER return key_hash
  const sanitizedKeys = keys.map(k => ({
    id: k.id,
    name: k.name,
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
  }));

  sendSuccess(res, { keys: sanitizedKeys });
});

// DELETE /api/auth/api-keys/:id
app.delete('/api/auth/api-keys/:id', requireAuth, async (req, res) => {
  const keyId = parseInt(req.params.id);
  const userId = req.user!.id;

  // Verify ownership
  const apiKey = await storage.getApiKeyById(keyId);
  if (!apiKey || apiKey.userId !== userId) {
    return sendError(res, 'API key not found', 404);
  }

  await storage.revokeApiKey(keyId);
  sendSuccess(res, { success: true });
});
```

### Step 7: Storage Layer Methods

- [ ] Add API key methods to `server/storage/domains/user-storage.ts`

**Methods**:
```typescript
async createApiKey(data: InsertApiKey): Promise<ApiKey>
async getApiKeyByHash(keyHash: string): Promise<ApiKey | null>
async getApiKeysByUserId(userId: number): Promise<ApiKey[]>
async getApiKeyById(id: number): Promise<ApiKey | null>
async revokeApiKey(id: number): Promise<void>
async updateApiKeyLastUsed(id: number): Promise<void>
```

### Step 8: Testing

- [ ] Unit tests for API key middleware
- [ ] Integration tests for dual auth
- [ ] E2E tests for API key workflow

**Test Cases**:
```typescript
describe('API Key Authentication', () => {
  test('authenticates with valid API key', async () => {
    const { key } = await createTestApiKey();

    const res = await request(app)
      .post('/api/scraping/discover-trends')
      .set('X-API-Key', key)
      .send({ sources: ['google_trends'] });

    expect(res.status).toBe(200);
  });

  test('rejects invalid API key', async () => {
    const res = await request(app)
      .post('/api/scraping/discover-trends')
      .set('X-API-Key', 'invalid-key')
      .send({ sources: ['google_trends'] });

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('INVALID_API_KEY');
  });

  test('skips CSRF for API key requests', async () => {
    const { key } = await createTestApiKey();

    // No CSRF token needed
    const res = await request(app)
      .post('/api/scraping/initialize')
      .set('X-API-Key', key);

    expect(res.status).not.toBe(403); // Not CSRF error
  });

  test('enforces CSRF for session requests', async () => {
    const sessionCookie = await loginTestUser();

    // Missing CSRF token
    const res = await request(app)
      .post('/api/scraping/initialize')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(403); // CSRF error
  });

  test('tracks API key usage', async () => {
    const { key, id } = await createTestApiKey();

    await request(app)
      .get('/api/scraping/status')
      .set('X-API-Key', key);

    const apiKey = await storage.getApiKeyById(id);
    expect(apiKey.lastUsedAt).not.toBeNull();
  });
});
```

### Step 9: Documentation

- [ ] Update API documentation with API key section
- [ ] Add setup guide for agents
- [ ] Document security best practices

**Add to** `docs/API_DOCUMENTATION.md`:
```markdown
## Agent Authentication

AI agents can authenticate using API keys instead of session cookies.

### Obtaining an API Key

1. Log in to your admin account at `https://pricecompare.com/admin`
2. Navigate to Settings → API Keys
3. Click "Generate New API Key"
4. Name your key (e.g., "Production Agent")
5. Copy the key immediately (shown only once)
6. Store securely (treat like a password)

### Using API Keys

Include the `X-API-Key` header in all requests:

```bash
curl -X POST https://api.pricecompare.com/api/scraping/discover-trends \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sources": ["google_trends"], "limit": 20}'
```

**No CSRF token required** for API key requests.

### Security Best Practices

- ✅ Store API keys in environment variables (not code)
- ✅ Use separate keys for different environments (dev, staging, prod)
- ✅ Rotate keys every 90 days
- ✅ Revoke unused keys immediately
- ❌ Never commit keys to version control
- ❌ Never share keys in logs or error messages
```

## Checklist

- [ ] Database schema created
- [ ] Migration 0028 created and tested
- [ ] API key auth middleware implemented
- [ ] Conditional CSRF middleware implemented
- [ ] All scraping routes updated
- [ ] API key management endpoints created
- [ ] Storage layer methods added
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Documentation updated
- [ ] Security review completed

## Success Criteria

- [ ] **Agents can authenticate with API keys**:
  ```bash
  curl -X POST http://localhost:5000/api/scraping/discover-trends \
    -H "X-API-Key: test_key_here" \
    -H "Content-Type: application/json" \
    -d '{"sources": ["google_trends"]}'
  # Expected: 200 OK ✅
  ```

- [ ] **Session auth still works**:
  ```bash
  # Login and get session cookie
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "password"}'

  # Use session with CSRF token
  curl -X POST http://localhost:5000/api/scraping/initialize \
    -H "Cookie: session_cookie_here" \
    -H "X-CSRF-Token: csrf_token_here"
  # Expected: 200 OK ✅
  ```

- [ ] **CSRF enforced for sessions, skipped for API keys** ✅
- [ ] **API key management works** (create, list, revoke) ✅
- [ ] **Usage tracking works** (lastUsedAt updated) ✅
- [ ] **All tests pass** ✅

## Agent-Native Score Improvement

**Before**: 0/23 capabilities agent-accessible (0%)
**After**: 23/23 capabilities agent-accessible (100%) ✅

---

**Related Documentation**:
- Agent-native architecture principles
- API authentication best practices
- OWASP API Security Top 10

**Review Reference**: Comprehensive Code Review - Agent-Native Gap
**Impact**: Unlocks full automation potential for scraping system
