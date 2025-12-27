---
status: pending
priority: p2
issue_id: "007"
tags: [api, agent-native, architecture, http-basic-auth]
dependencies: []
---

# Expand Agent-Native API Coverage from 2.5% to 25%

## Problem Statement

Despite excellent HTTP Basic Authentication infrastructure (TODO 006 completed 2025-12-26), only **5 of 203 endpoints (2.5%)** are accessible to agents via `/api/v1/*` routes. Core features like watchlists, price alerts, product search, and notifications remain session-only, blocking agent automation and violating the agent-native principle: "Whatever the user can do, the agent can do."

**Impact:** HIGH - Agents cannot automate common workflows, limiting platform usefulness for API consumers, CLI tools, and integrations.

## Findings

**From Agent-Native Review (2025-12-26):**

**Current State:**
- Total API surface: ~203 endpoints across 25 route files
- Agent-accessible: 5 endpoints (2.5%) - scraping operations only
- Session-only: 198 endpoints (97.5%)
- Documentation: 100% for implemented endpoints (`docs/HTTP_BASIC_AUTH.md`)

**Agent-Accessible (Current):**
- `POST /api/v1/scraping/discover-trends`
- `POST /api/v1/scraping/extract-product`
- `POST /api/v1/scraping/batch-extract`
- `GET /api/v1/scraping/status`
- `GET /api/v1/scraping/history`

**Critical Gaps (User can, Agent cannot):**

| Feature Domain | User Access | Agent Access | Impact |
|----------------|-------------|--------------|--------|
| **Watchlists** | ✅ `/api/watchlists/*` (10+ endpoints) | ❌ None | **CRITICAL** |
| **Price Alerts** | ✅ `/api/price-alerts/*` (4+ endpoints) | ❌ None | **CRITICAL** |
| **Products** | ✅ `/api/products/*` (12+ endpoints) | ❌ None | **HIGH** |
| **Notifications** | ✅ `/api/notifications/*` (8+ endpoints) | ❌ None | **MEDIUM** |
| **Admin** | ✅ `/api/admin/*` (15+ endpoints) | ❌ None | **MEDIUM** |

## Proposed Solutions

### Option 1: Phased Rollout - Priority Features First (Recommended)

**Approach:** Incrementally add agent-native variants for high-value features over 3 phases.

**Phase 1 (Immediate - 2-4 hours):** Read-only core features
```typescript
// Watchlist read operations
GET  /api/v1/watchlists           // List user's watchlists
GET  /api/v1/watchlists/:id       // Get watchlist details
GET  /api/v1/watchlists/:id/products  // Get products in list

// Price alert read operations
GET  /api/v1/price-alerts         // List user's alerts
GET  /api/v1/price-alerts/:id     // Get alert details

// Product read operations
GET  /api/v1/products/search      // Search products
GET  /api/v1/products/:id         // Product details
GET  /api/v1/products/:id/price-history  // Historical data
```

**Impact:** 9 endpoints → raises coverage to ~7% (14/203)

**Phase 2 (Short-term - 4-6 hours):** Write operations
```typescript
// Watchlist mutations
POST   /api/v1/watchlists         // Create watchlist
PATCH  /api/v1/watchlists/:id     // Update watchlist
DELETE /api/v1/watchlists/:id     // Delete watchlist
POST   /api/v1/watchlists/:id/products  // Add product
DELETE /api/v1/watchlists/:id/products/:productId  // Remove product

// Price alert mutations
POST   /api/v1/price-alerts       // Create alert
PATCH  /api/v1/price-alerts/:id   // Update alert
DELETE /api/v1/price-alerts/:id   // Delete alert

// Notifications
GET    /api/v1/notifications      // List notifications
PATCH  /api/v1/notifications/:id/read  // Mark as read
```

**Impact:** +11 endpoints → raises coverage to ~12% (25/203)

**Phase 3 (Medium-term - 8-12 hours):** Advanced features + discovery
```typescript
// Advanced search
GET  /api/v1/advanced-search      // Advanced search with filters

// Analytics (read-only)
GET  /api/v1/analytics/user       // User's price tracking stats

// Admin monitoring (read-only)
GET  /api/v1/admin/system-health  // System status
GET  /api/v1/admin/stats          // Platform statistics

// API discovery
GET  /api/v1/openapi.json         // Auto-generated OpenAPI spec
GET  /api/v1                      // API capabilities list
```

**Impact:** +6 endpoints + OpenAPI → raises coverage to ~15% (31/203)

**Total Effort:** 14-22 hours across 3 phases
**Total Impact:** 2.5% → 15% coverage (6x improvement)

**Pros:**
- Incremental delivery of value
- Can validate approach with Phase 1 before committing to rest
- Prioritizes high-impact features
- Low risk (can pause/adjust between phases)

**Cons:**
- Not full parity yet (15% vs 100%)
- Requires sustained effort across multiple sprints

**Risk:** Low

---

### Option 2: Full Parity Migration

**Approach:** Systematically add agent-native variants for ALL 203 endpoints.

**Pros:**
- Complete agent-native compliance
- No feature gaps

**Cons:**
- **Massive effort:** 40-80 hours
- Many endpoints may have low agent value (admin UI, settings pages)
- High maintenance burden (duplicate routes)
- Overkill for current needs

**Effort:** 40-80 hours

**Risk:** Medium (scope creep, maintenance burden)

---

### Option 3: Unified Authentication Middleware

**Approach:** Merge `/api/*` and `/api/v1/*` into single route set supporting both session and Basic Auth.

**Implementation:**
```typescript
// Middleware that accepts EITHER session OR Basic Auth
function flexibleAuth(req, res, next) {
  if (req.headers.authorization) {
    return basicAuth(req, res, next); // Agent via Basic Auth
  } else {
    return withAuth(req, res, next);  // Browser via session
  }
}

// Single route definition
app.get('/api/watchlists', flexibleAuth, csrfProtection, handler);
```

**Pros:**
- No route duplication
- Single source of truth
- 100% parity automatically

**Cons:**
- **Security complexity:** CSRF must skip Basic Auth requests
- **Breaking change:** Alters existing API behavior
- **Testing complexity:** Must test both auth paths
- **Risk:** High (could break existing clients)

**Effort:** 20-30 hours (including refactor + testing)

**Risk:** HIGH

## Recommended Action

**IMPLEMENT Option 1 (Phased Rollout)** - Delivers value incrementally with low risk.

**Immediate next step:** Implement Phase 1 (read-only endpoints, 2-4 hours)

## Technical Details

**Implementation pattern:**
```typescript
// server/routes/api-v1-routes.ts

// Reuse existing handlers from route files
import { searchProducts } from './product-routes';
import { getWatchlists, getWatchlist } from './watchlist-routes';

// Add agent-native variants
app.get('/api/v1/products/search', basicAuth, searchProducts);
app.get('/api/v1/watchlists', basicAuth, withAuth(getWatchlists));
app.get('/api/v1/watchlists/:id', basicAuth, withAuth(getWatchlist));
```

**CSRF handling:**
- Basic Auth endpoints exempt from CSRF (stateless)
- Already documented in `server/middleware/security.ts`

**Rate limiting:**
- Consider separate agent rate limits (may be higher for paid API users)
- Document in `docs/HTTP_BASIC_AUTH.md`

**Testing:**
- Integration tests for each agent endpoint
- Verify parity with session-based equivalents
- Test both auth methods work

## Resources

- **Implementation guide:** `docs/HTTP_BASIC_AUTH.md`
- **Pattern:** `docs/03_API_PATTERNS.md` (Section 2.2)
- **Existing example:** `server/routes/api-v1-routes.ts` (scraping endpoints)
- **Agent-Native Review:** 2025-12-26 findings
- **Route inventory:** 25 route files, ~203 total endpoints

## Acceptance Criteria

**Phase 1 (Immediate):**
- [ ] 9 read-only endpoints added to `/api/v1/*`
- [ ] Watchlist read operations accessible via Basic Auth
- [ ] Price alert read operations accessible via Basic Auth
- [ ] Product search/details accessible via Basic Auth
- [ ] Integration tests for all new endpoints
- [ ] Documentation updated with new endpoints
- [ ] Agent coverage: 7% (14/203 endpoints)

**Phase 2 (Short-term):**
- [ ] 11 write operation endpoints added
- [ ] Watchlist mutations accessible via Basic Auth
- [ ] Price alert mutations accessible via Basic Auth
- [ ] Notification read/update accessible via Basic Auth
- [ ] Agent coverage: 12% (25/203 endpoints)

**Phase 3 (Medium-term):**
- [ ] 6 advanced/admin endpoints added (read-only)
- [ ] OpenAPI spec auto-generated from code
- [ ] API capabilities discovery endpoint
- [ ] Agent coverage: 15% (31/203 endpoints)

**Cross-phase:**
- [ ] CSRF properly exempted for Basic Auth
- [ ] Rate limiting documented and enforced
- [ ] Backward compatibility maintained (no breaking changes)
- [ ] Pre-commit hooks pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Agent-Native Reviewer (Code Review)

**Actions:**
- Audited all 203 API endpoints for agent accessibility
- Identified 2.5% current coverage (5 scraping endpoints only)
- Analyzed 14 feature domains for coverage gaps
- Documented critical gaps (watchlists, alerts, products)
- Proposed phased rollout strategy

**Learnings:**
- HTTP Basic Auth infrastructure excellent (TODO 006 completed)
- Route duplication manageable (reuse existing handlers)
- CSRF exemption pattern already established
- Incremental rollout reduces risk
- 15% coverage covers 80% of use cases

## Notes

- **Priority P2 (Important)** - Not blocking, but high user value
- **Phased approach:** Deliver value early, validate, then expand
- **Success metrics:** Track agent API usage after each phase
- **Future:** Consider SDK/client libraries after Phase 3
- **OpenAPI:** Leverage zod-to-openapi for automatic spec generation
- Document agent rate limits and quotas per user tier
