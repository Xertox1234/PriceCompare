---
status: pending
priority: p2
issue_id: "036"
tags: [typescript, types, patterns, code-review]
dependencies: []
---

# Consolidate Duplicate AuthenticatedRequest Interfaces

## Problem Statement

`AuthenticatedRequest` interface is defined in multiple places with different semantics:
- `shared/types.ts`: `user: User` (required)
- `server/routes/auth-routes.ts`: `user?: User` (optional)

**Impact:** Inconsistent type expectations, potential runtime errors.

## Findings

Discovered during TypeScript audit on 2025-11-23.

**Location 1:** `shared/types.ts` lines 6-8
```typescript
export interface AuthenticatedRequest extends Request {
  user: User;  // Required
}
```

**Location 2:** `server/routes/auth-routes.ts` lines 19-21
```typescript
interface AuthenticatedRequest extends Request {
  user?: User;  // Optional
}
```

## Proposed Solutions

### Option 1: Use Shared Type Everywhere (Recommended)

**Effort:** Small (30 minutes)

1. Remove local definition in auth-routes.ts
2. Import from shared/types.ts
3. Use type guards where user might be undefined

**Implementation:**
```typescript
// auth-routes.ts
import type { AuthenticatedRequest } from '@shared/types';

// For routes that might not have user authenticated yet:
function isAuthenticated(req: Request): req is AuthenticatedRequest {
  return !!req.user;
}

app.get('/api/auth/user', (req, res) => {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // req.user is now guaranteed to exist
  res.json({ user: req.user });
});
```

## Acceptance Criteria

- [ ] Single AuthenticatedRequest definition in shared/types.ts
- [ ] All imports use shared type
- [ ] Type guards used where needed
- [ ] No duplicate interface definitions

## Work Log

### 2025-11-23 - TypeScript Audit Discovery
**By:** Claude Code Review System (kieran-typescript-reviewer agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
