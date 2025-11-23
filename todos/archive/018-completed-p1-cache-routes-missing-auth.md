---
status: completed
priority: p1
issue_id: "018"
tags: [security, authorization, cache, admin, code-review]
dependencies: []
completed_date: 2025-11-23
---

# Add Authorization to Cache Admin Routes

## Problem Statement

**CRITICAL SECURITY ISSUE**: All cache management routes under `/api/admin/cache/*` are exposed without authentication or authorization middleware. These routes allow clearing caches, invalidating data, and viewing sensitive statistics.

**Impact:** Any unauthenticated user can clear production caches causing DoS, or view internal metrics.

## Findings

Discovered during comprehensive code audit by security-sentinel agent on 2025-11-23.

**Affected Endpoints** (all in `server/routes/cache-routes.ts`):
- `GET /api/admin/cache/stats` (line 33)
- `GET /api/admin/cache/popularity/*` (line 50)
- `POST /api/admin/cache/warm` (line 78)
- `POST /api/admin/cache/invalidate/*` (line 104)
- `POST /api/admin/cache/cleanup/popularity` (line 135)
- `POST /api/admin/cache/stats/reset` (line 163)
- `POST /api/admin/cache/clear` (line 190)
- `GET /api/admin/cache/health` (line 220)

**Evidence:**
```typescript
// Line 33 - No auth middleware
app.get('/api/admin/cache/stats', async (req, res) => {
  // Exposed to anyone
});

// Line 190 - Can clear all caches without auth
app.post('/api/admin/cache/clear', async (req, res) => {
  await advancedCache.clear();
  // Dangerous!
});
```

## Proposed Solutions

### Option 1: Add withAdmin to All Endpoints (Recommended)

**Pros:**
- Simple one-line fix per endpoint
- Uses existing auth helper
- Consistent with other admin routes

**Cons:**
- None

**Effort:** Small (30 minutes)

**Implementation:**
```typescript
import { withAdmin } from './helpers';

app.get('/api/admin/cache/stats', withAdmin(async (req, res) => {
  // Now protected
}));

app.post('/api/admin/cache/clear', withAdmin(async (req, res) => {
  // Now protected
}));
```

## Recommended Action

Apply `withAdmin` middleware to all cache routes immediately. This is a critical security fix.

## Technical Details

- **Affected Files**: `server/routes/cache-routes.ts`
- **Related Components**: None
- **Database Changes**: None

## Acceptance Criteria

- [ ] All cache admin routes require admin authentication
- [ ] Unauthorized requests return 401/403
- [ ] Existing admin functionality unchanged
- [ ] Tests pass

## Work Log

### 2025-11-23 - Security Audit Discovery
**By:** Claude Code Review System (security-sentinel agent)
**Actions:**
- Identified 8 unprotected admin endpoints
- Categorized as P1 CRITICAL security vulnerability

## Notes

Source: Comprehensive code audit performed on 2025-11-23
