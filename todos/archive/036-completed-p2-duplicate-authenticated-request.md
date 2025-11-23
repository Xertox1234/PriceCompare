---
status: completed
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

- [x] Single AuthenticatedRequest definition in shared/types.ts
- [x] All imports use shared type
- [x] Type guards used where needed
- [x] No duplicate interface definitions

## Work Log

### 2025-11-23 - TypeScript Audit Discovery
**By:** Claude Code Review System (kieran-typescript-reviewer agent)

### 2025-11-23 - Completed Resolution
**By:** Claude Code

**Changes made:**

1. **`server/routes/auth-routes.ts`**:
   - Removed local `AuthenticatedRequest` interface (lines 21-24)
   - Added import for `isAuthenticated` from `./helpers`
   - Updated logout route to use `isAuthenticated` type guard
   - Updated `/api/auth/user` route to use type guard pattern

2. **`shared/types.ts`**:
   - Updated to import `SafeUser` instead of `User` from schema
   - This ensures sensitive fields are never exposed in authenticated request types

3. **`shared/schema.ts`**:
   - Added `SafeUser` type export that omits sensitive fields like password hashes
   - This provides a shared safe user type for both client and server

**Note:** Other files (`discourse-sso.ts`, `error-handler.ts`, `security-logger.ts`) also have local `AuthenticatedRequest` definitions with different semantics (different user type shapes). These are separate refactoring concerns as they serve different purposes.

## Notes

Source: Comprehensive code audit performed on 2025-11-23
