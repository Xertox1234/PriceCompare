---
status: completed
priority: p1
issue_id: "021"
tags: [patterns, auth, middleware, duplication, code-review]
dependencies: []
completed_date: 2025-11-23
---

# Consolidate Duplicate withAuth Middleware Definitions

## Problem Statement

**PATTERN VIOLATION**: 6 route files define their own `withAuth` middleware instead of importing from `helpers.ts`. This creates:
- Inconsistent auth behavior
- Maintenance burden
- Potential security gaps

**Impact:** Auth logic diverges, bugs in one copy don't get fixed everywhere.

## Findings

Discovered during comprehensive code audit by pattern-recognition-specialist agent on 2025-11-23.

**Affected Files:**
1. `server/routes/community-routes.ts` (line 16-23)
2. `server/routes/notification-routes.ts` (line 17)
3. `server/routes/smart-alerts-routes.ts` (line 17)
4. `server/routes/price-analytics-routes.ts` (lines 30, 35)
5. `server/routes/price-history-routes.ts` (lines 53, 69)

**Shared helper location:** `server/routes/helpers.ts`

**Evidence:**
```typescript
// community-routes.ts - Defines its own withAuth
const withAuth = (handler: AuthHandler) => async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return handler(req as AuthenticatedRequest, res);
};

// Should be:
import { withAuth } from './helpers';
```

## Proposed Solutions

### Option 1: Replace All with Imports (Recommended)

**Effort:** Small (1 hour)

**Implementation:**
For each affected file:
1. Remove local `withAuth` definition
2. Add `import { withAuth } from './helpers';`
3. Verify auth behavior unchanged

## Recommended Action

Replace all local `withAuth` definitions with imports from `helpers.ts`.

## Technical Details

- **Affected Files**: 6 route files listed above
- **Related Components**: `server/routes/helpers.ts`
- **Database Changes**: None

## Acceptance Criteria

- [ ] All local withAuth definitions removed
- [ ] All files import from helpers.ts
- [ ] Auth behavior unchanged
- [ ] Tests pass

## Work Log

### 2025-11-23 - Pattern Recognition Audit Discovery
**By:** Claude Code Review System (pattern-recognition-specialist agent)
**Actions:**
- Identified 6 files with duplicate auth middleware
- Categorized as P1 pattern violation

## Notes

Source: Comprehensive code audit performed on 2025-11-23
