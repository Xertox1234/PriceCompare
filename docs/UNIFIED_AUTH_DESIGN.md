# Unified Authentication Middleware Design

**Status:** Proposed Design
**Created:** 2025-12-27
**Purpose:** Replace dual authentication system with unified middleware accepting both session and Basic Auth

---

## Problem Statement

### Current State Issues

1. **Route Duplication**
   - 14 endpoints in `/api/v1/*` (Basic Auth)
   - ~200 endpoints in `/api/*` (Session)
   - Handlers are 95% identical - only middleware differs
   - Every new feature requires dual implementation

2. **Critical Security Gap** 🔴
   ```typescript
   // basicAuth middleware (server/middleware/basic-auth.ts:48-50)
   if (!authHeader || !authHeader.startsWith('Basic ')) {
     return next(); // Falls through to session auth!
   }
   ```

   **Attack scenario:**
   ```bash
   # Attacker crafts CSRF request to /api/v1/* WITHOUT Basic Auth header
   POST /api/v1/scraping/discover-trends
   Cookie: connect.sid=<victim_session>
   # No Authorization header → falls through to session
   # No CSRF token required → attack succeeds
   ```

3. **Maintenance Burden**
   - Bug fixes needed in 2 places
   - Tests duplicated
   - Documentation diverges
   - Coverage gaps (97.5% of API session-only)

### Goal

**Single authentication system** that:
- ✅ Accepts EITHER session OR Basic Auth
- ✅ CSRF protection for sessions (stateful)
- ✅ CSRF exempt for Basic Auth (stateless)
- ✅ Zero route duplication
- ✅ Backward compatible
- ✅ Fixes security gap

---

## Architecture Design

### 1. Flexible Auth Middleware

```typescript
// server/middleware/flexible-auth.ts

import { Request, Response, NextFunction } from 'express';
import { basicAuth } from './basic-auth';
import passport from 'passport';

/**
 * Unified authentication middleware supporting both session and Basic Auth
 *
 * Authentication priority:
 * 1. HTTP Basic Auth (if Authorization header present)
 * 2. Session auth (if session exists)
 * 3. Reject (401 Unauthorized)
 *
 * CSRF handling:
 * - Basic Auth: CSRF exempt (stateless, no session)
 * - Session: CSRF required for mutations (POST/PUT/PATCH/DELETE)
 */
export async function flexibleAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Priority 1: Try Basic Auth (explicit Authorization header)
  if (req.headers.authorization?.startsWith('Basic ')) {
    // Mark request as using Basic Auth for CSRF exemption
    req.isBasicAuth = true;
    return basicAuth(req, res, next);
  }

  // Priority 2: Try session auth (Passport deserializeUser)
  if (req.isAuthenticated()) {
    req.isBasicAuth = false;
    return next();
  }

  // Priority 3: No auth available
  res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
  sendError(res, 'Authentication required', 401);
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      isBasicAuth?: boolean;
    }
  }
}
```

**Key design decisions:**

1. **No fallthrough:** If Basic Auth header present but invalid, fail immediately (don't try session)
2. **Explicit marker:** `req.isBasicAuth` flag for CSRF middleware to check
3. **Security first:** Prefer explicit auth method over implicit fallback
4. **WWW-Authenticate header:** Signals to clients that auth is required

### 2. Smart CSRF Protection

```typescript
// server/middleware/security.ts (UPDATE)

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // NEW: Skip CSRF for Basic Auth requests (stateless)
  if (req.isBasicAuth === true) {
    logger.debug('CSRF exempt: Basic Auth request', {
      method: req.method,
      path: req.path,
    });
    return next();
  }

  // Check if path is exempt
  const isExempt = CSRF_EXEMPT_PATHS.some(path => req.path.startsWith(path));
  if (isExempt) {
    return next();
  }

  // Existing CSRF validation for session requests...
  // (rest of implementation unchanged)
}
```

**Why this works:**
- Basic Auth = stateless (no CSRF risk)
- Session = stateful (CSRF protection required)
- Flag set by `flexibleAuth` before CSRF middleware runs

### 3. Updated Basic Auth Middleware

```typescript
// server/middleware/basic-auth.ts (UPDATE)

export async function basicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // SECURITY: Require HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.protocol !== 'https') {
    logger.warn('Basic auth attempted over insecure HTTP', { ip: req.ip });
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'HTTPS required for Basic Authentication', 403);
    return;
  }

  const authHeader = req.headers.authorization;

  // REMOVED: Fallthrough to session auth
  // If no Basic Auth header, this middleware shouldn't be called
  // (flexibleAuth handles routing to session or basic)
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="PriceCompare API"');
    sendError(res, 'Basic Authentication required', 401);
    return;
  }

  // ... rest of implementation unchanged (validate credentials, populate req.user)
}
```

**Critical change:**
- ❌ **REMOVED:** `return next()` fallthrough
- ✅ **ADDED:** Explicit 401 if header missing/invalid
- 🔒 **SECURITY:** No more CSRF bypass via missing header

---

## Migration Plan

### Phase 1: Foundation (2-3 hours)

**Goal:** Create unified middleware without changing routes

1. **Create `flexible-auth.ts`** (~1 hour)
   - Implement `flexibleAuth` middleware
   - Add `req.isBasicAuth` flag
   - Unit tests for all auth paths

2. **Update `basic-auth.ts`** (~30 min)
   - Remove fallthrough to session
   - Require Authorization header
   - Test with/without header

3. **Update `csrfProtection`** (~30 min)
   - Check `req.isBasicAuth` flag
   - Skip CSRF for Basic Auth
   - Log exemption for monitoring

4. **Integration tests** (~1 hour)
   - Test session + CSRF (existing behavior)
   - Test Basic Auth + no CSRF (new behavior)
   - Test attack scenarios (CSRF bypass attempts)

### Phase 2: Route Migration (1-2 hours)

**Goal:** Migrate existing routes to unified auth

**Before (session-only):**
```typescript
app.get('/api/watchlists', withAuth(async (req, res) => {
  // handler
}));

app.post('/api/watchlists', csrfProtection, requireAuth, async (req, res) => {
  // handler
});
```

**After (unified):**
```typescript
app.get('/api/watchlists', flexibleAuth, withAuth(async (req, res) => {
  // handler - UNCHANGED
}));

app.post('/api/watchlists', flexibleAuth, csrfProtection, withAuth(async (req, res) => {
  // handler - UNCHANGED
}));
```

**Migration steps:**
1. Add `flexibleAuth` before existing middleware
2. Keep `csrfProtection` (now CSRF-aware)
3. Keep `withAuth` / `requireAuth` (checks `req.user`)
4. Handler code UNCHANGED

**Rollout order:**
- Start with read-only routes (low risk)
- Then watchlists (high value for agents)
- Then price alerts
- Then products

### Phase 3: Cleanup (1 hour)

**Goal:** Remove `/api/v1/*` routes and duplication

1. **Delete `api-v1-routes.ts`** (572 lines removed)
2. **Update documentation** (`HTTP_BASIC_AUTH.md`)
3. **Remove duplicate tests**
4. **Update client examples** (show Basic Auth on any endpoint)

**Result:**
- 100% API coverage (all 203 endpoints)
- Zero route duplication
- Single source of truth

---

## Security Analysis

### CSRF Protection Matrix

| Auth Method | Session Cookie | CSRF Token Required | Why |
|-------------|----------------|---------------------|-----|
| **Session** | ✅ Yes | ✅ Yes (mutations) | Stateful - vulnerable to CSRF |
| **Basic Auth** | ❌ No | ❌ No | Stateless - no CSRF risk |
| **None** | - | - | 401 Unauthorized |

### Attack Scenarios Prevented

#### 1. CSRF via Missing Header (Current vulnerability)
```bash
# BEFORE: Attack succeeds
POST /api/v1/scraping/discover-trends
Cookie: connect.sid=victim_session
# No Authorization → falls through → CSRF bypass

# AFTER: Attack fails
POST /api/watchlists
Cookie: connect.sid=victim_session
# flexibleAuth sees session → requires CSRF → attack blocked
```

#### 2. Basic Auth Credential Theft
```bash
# BEFORE & AFTER: HTTPS required
POST /api/watchlists
Authorization: Basic dXNlcjpwYXNz
# Production requires HTTPS → credentials encrypted in transit
```

#### 3. Session Fixation
```bash
# BEFORE & AFTER: Passport regenerates session ID on login
# Attack: Set victim's session ID → victim logs in → attacker uses ID
# Prevention: Session ID regenerated after auth → old ID invalid
```

### Rate Limiting

**Current state:**
- In-memory rate limiter (10k IP max)
- Redis rate limiter (production, tiered by user role)

**After migration:**
- Same rate limits apply
- Basic Auth requests counted same as session requests
- Consider: Separate agent rate limits (future enhancement)

---

## Testing Strategy

### Unit Tests

```typescript
// flexible-auth.test.ts

describe('flexibleAuth middleware', () => {
  it('uses Basic Auth when Authorization header present', async () => {
    const req = createMockRequest({
      headers: { authorization: 'Basic dXNlcjpwYXNz' }
    });
    await flexibleAuth(req, res, next);
    expect(req.isBasicAuth).toBe(true);
    expect(basicAuth).toHaveBeenCalled();
  });

  it('uses session auth when authenticated', async () => {
    const req = createMockRequest({
      isAuthenticated: () => true,
      user: mockUser,
    });
    await flexibleAuth(req, res, next);
    expect(req.isBasicAuth).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it('rejects when no auth available', async () => {
    const req = createMockRequest({
      isAuthenticated: () => false,
    });
    await flexibleAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

### Integration Tests

```typescript
// watchlist-routes.test.ts

describe('POST /api/watchlists with unified auth', () => {
  it('accepts session auth with CSRF token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });
    const csrfToken = agent.get('X-CSRF-Token');

    const res = await agent
      .post('/api/watchlists')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Test' });

    expect(res.status).toBe(201);
  });

  it('accepts Basic Auth without CSRF token', async () => {
    const res = await request(app)
      .post('/api/watchlists')
      .auth('admin', 'password')
      .send({ name: 'Test' });

    expect(res.status).toBe(201);
  });

  it('rejects session auth without CSRF token', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });

    const res = await agent
      .post('/api/watchlists')
      .send({ name: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF');
  });

  it('rejects invalid Basic Auth', async () => {
    const res = await request(app)
      .post('/api/watchlists')
      .auth('admin', 'wrongpassword')
      .send({ name: 'Test' });

    expect(res.status).toBe(401);
  });
});
```

### Attack Tests

```typescript
// security.test.ts

describe('CSRF protection with flexible auth', () => {
  it('blocks CSRF attack via session without token', async () => {
    // Login to get session cookie
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });

    // Attempt mutation without CSRF token (simulated CSRF attack)
    const res = await agent.post('/api/watchlists').send({ name: 'Attack' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('CSRF');
  });

  it('allows Basic Auth request without CSRF token', async () => {
    // Basic Auth should bypass CSRF (stateless)
    const res = await request(app)
      .post('/api/watchlists')
      .auth('admin', 'password')
      .send({ name: 'Legit' });

    expect(res.status).toBe(201);
  });

  it('prevents Basic Auth fallthrough attack', async () => {
    // Attempt to use session without Basic Auth header on /api/v1/* routes
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email, password });

    // After migration, /api/v1/* routes deleted, but test the pattern
    const res = await agent.post('/api/watchlists').send({ name: 'Attack' });

    // Should require CSRF since using session
    expect(res.status).toBe(403);
  });
});
```

---

## Backward Compatibility

### Browser Clients (No Changes)
```javascript
// Existing session-based clients work unchanged
fetch('/api/watchlists', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  credentials: 'include',
  body: JSON.stringify({ name: 'My List' }),
});
```

### API Clients (New Capability)
```bash
# NEW: Basic Auth works on ALL endpoints (not just /api/v1/*)
curl -u "admin:password" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"My List"}' \
  https://api.pricecompare.com/api/watchlists
```

### Breaking Changes
**NONE** - This is a strict superset of current functionality:
- Existing session routes gain Basic Auth support
- Existing Basic Auth routes moved to main API
- No client code changes required

---

## Performance Impact

### Minimal Overhead
- Session check: 1 property access (`req.isAuthenticated()`)
- Basic Auth check: 1 string comparison (`startsWith('Basic ')`)
- CSRF flag check: 1 boolean comparison (`req.isBasicAuth === true`)

**Benchmark (estimated):**
- Current: 2-3ms auth overhead per request
- After: 2-4ms auth overhead per request
- Delta: <1ms (negligible)

### Memory Impact
- Remove 572 lines (api-v1-routes.ts)
- Add ~100 lines (flexible-auth.ts)
- Net: -472 lines

---

## Rollback Plan

If issues discovered after Phase 1/2:

1. **Immediate:** Revert `flexible-auth.ts` and `csrfProtection` changes
2. **Restore:** `/api/v1/*` routes from git history
3. **Fix:** Address root cause
4. **Retry:** Re-deploy after testing

**Safe rollback window:** 48 hours (before Phase 3 cleanup)

---

## Success Metrics

### Coverage
- **Before:** 2.5% (5/203 endpoints)
- **After:** 100% (203/203 endpoints)

### Code Quality
- **Before:** 572 duplicate lines in api-v1-routes.ts
- **After:** 0 duplicate route definitions

### Security
- **Before:** CSRF bypass via missing Basic Auth header
- **After:** CSRF enforced for all session requests

### Maintenance
- **Before:** 2 route files per feature
- **After:** 1 route file per feature

---

## Alternative Approaches Considered

### Option A: Keep /api/v1/* Separate
- ❌ Doesn't fix CSRF security gap
- ❌ Maintains duplication
- ❌ Lower API coverage (15% vs 100%)

### Option B: Proxy Basic Auth to Session
- ❌ Complex (convert Basic to session, manage lifecycle)
- ❌ Slower (session creation overhead)
- ❌ Still needs CSRF handling

### Option C: Header-Based Auth Selection
```typescript
// Use X-Auth-Method header to choose auth type
if (req.headers['x-auth-method'] === 'basic') {
  return basicAuth(req, res, next);
}
```
- ❌ Non-standard (clients must know about custom header)
- ❌ More complex than Authorization header check

**Conclusion:** Flexible auth middleware is the simplest, most secure approach.

---

## References

- **Current architecture:** `docs/04_SECURITY_PATTERNS.md`
- **Basic Auth implementation:** `server/middleware/basic-auth.ts`
- **Session auth:** `server/auth.ts`
- **CSRF protection:** `server/middleware/security.ts`
- **Route helpers:** `server/routes/helpers.ts`
- **Security gap identified by:** Kieran Rails Reviewer (2025-12-27)

---

## Questions & Answers

**Q: Why not use passport-http for Basic Auth?**
A: Current `basicAuth` middleware already handles account lockout, suspension checks, and logging. Switching to passport-http would lose these features.

**Q: Should we deprecate /api/v1/* routes gradually?**
A: No need - after migration, they're redundant. Delete immediately in Phase 3.

**Q: What about API versioning (if we need breaking changes)?**
A: Use Accept header versioning or query params (`?api_version=2`), not URL paths. URL versioning forces route duplication.

**Q: Rate limiting per auth method?**
A: Current design treats both equally. Future enhancement: Separate limits for paid API users (Basic Auth).

**Q: Mobile app support?**
A: Basic Auth supported by all HTTP clients. Prefer session for web, Basic Auth for mobile/CLI.

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `server/middleware/flexible-auth.ts`
- [ ] Add `req.isBasicAuth` to Express types
- [ ] Update `server/middleware/basic-auth.ts` (remove fallthrough)
- [ ] Update `server/middleware/security.ts` (CSRF exemption)
- [ ] Write unit tests for `flexibleAuth`
- [ ] Write integration tests for hybrid auth
- [ ] Write attack tests for CSRF bypass prevention

### Phase 2: Route Migration
- [ ] Migrate read-only routes (watchlists, products, alerts)
- [ ] Migrate mutation routes (POST/PUT/PATCH/DELETE)
- [ ] Update E2E tests (Basic Auth on all endpoints)
- [ ] Smoke test in staging environment

### Phase 3: Cleanup
- [ ] Delete `server/routes/api-v1-routes.ts`
- [ ] Delete duplicate tests
- [ ] Update `docs/HTTP_BASIC_AUTH.md`
- [ ] Update `docs/04_SECURITY_PATTERNS.md`
- [ ] Update API examples in README

### Validation
- [ ] All 203 endpoints accessible via session
- [ ] All 203 endpoints accessible via Basic Auth
- [ ] CSRF protection works for session requests
- [ ] CSRF exempt for Basic Auth requests
- [ ] No performance regression
- [ ] Pre-commit hooks pass
- [ ] Security audit clean

---

**Total Effort:** 4-6 hours
**Risk Level:** LOW (incremental, fully reversible)
**Security Impact:** HIGH (fixes CSRF bypass vulnerability)
**Maintenance Impact:** HIGH (eliminates 572 lines of duplication)
