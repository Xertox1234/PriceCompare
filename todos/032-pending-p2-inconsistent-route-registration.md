---
status: pending
priority: p2
issue_id: "032"
tags: [architecture, routes, patterns, code-review]
dependencies: []
---

# Standardize Route Registration Pattern

## Problem Statement

Routes use inconsistent export patterns:
- 20 files use `export function registerXxxRoutes(app: Express)`
- 5 files use `export default router` (Router-based)

**Impact:**
- Confusing for new developers
- Inconsistent middleware application
- Harder to maintain

## Findings

Discovered during architecture audit on 2025-11-23.

**Function-based pattern (20 files):**
```typescript
// auth-routes.ts, product-routes.ts, etc.
export function registerAuthRoutes(app: Express): void {
  app.get('/api/auth/user', ...);
}
```

**Router-based pattern (5 files):**
```typescript
// Some routes
const router = express.Router();
router.get('/api/something', ...);
export default router;
```

## Proposed Solutions

### Option 1: Standardize on Function Pattern (Recommended)

**Effort:** Small (2 hours)

Convert the 5 Router-based files to function pattern for consistency.

**Rationale:**
- Already used by majority (20 files)
- Simpler to understand
- Easier middleware application
- Better TypeScript support with explicit app type

### Option 2: Convert All to Router Pattern

**Effort:** Large (1 day)

Convert all 20 function-based files to Router pattern.

**Pros:**
- More modular
- Can mount at different paths
- Standard Express pattern

**Cons:**
- More boilerplate
- Requires updating index.ts registration

## Acceptance Criteria

- [ ] All route files use same export pattern
- [ ] Route registration in index.ts is consistent
- [ ] Documentation updated

## Work Log

### 2025-11-23 - Architecture Audit Discovery
**By:** Claude Code Review System (architecture-strategist agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
