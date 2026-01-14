# TODO 211: Admin Routes Missing Authorization Checks

**Priority**: P1 - HIGH
**File(s)**: `server/admin-routes.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Several admin endpoints use `withAuth` middleware instead of `withAdmin`, allowing any authenticated user to access admin functionality. This is a privilege escalation vulnerability.

**Security Impact**: Regular users can:
- List all users in the system
- Delete products
- Access admin dashboard data
- Potentially modify system settings

## Root Cause

Likely copy-paste error during development - `withAuth` was used instead of `withAdmin` on some routes.

## Solution Approach

1. Audit all routes in `server/admin-routes.ts`
2. Replace `withAuth` with `withAdmin` on all admin endpoints
3. Ensure CSRF protection is also applied to mutation endpoints
4. Add tests verifying non-admin users are rejected

## Implementation Steps

### Step 1: Audit Admin Routes

- [ ] List all endpoints in `server/admin-routes.ts`
- [ ] Identify which use `withAuth` instead of `withAdmin`
- [ ] Document each endpoint's current state

### Step 2: Fix Authorization

- [ ] Replace all `withAuth` with `withAdmin` in admin routes
- [ ] Ensure `csrfProtection` is applied to POST/PUT/DELETE endpoints
- [ ] Verify middleware order: `csrfProtection` → `withAdmin` → handler

### Step 3: Add Tests

- [ ] Test that non-admin users receive 403 on admin endpoints
- [ ] Test that admin users can access all admin endpoints
- [ ] Test that unauthenticated users receive 401

## Technical Details

**Current Implementation (INSECURE):**
```typescript
// ❌ WRONG - Any authenticated user can access!
app.get('/api/admin/users', withAuth(async (req, res) => {
  const users = await storage.getAllUsers();
  res.json(users);
}));

app.delete('/api/admin/products/:id', withAuth(async (req, res) => {
  await storage.deleteProduct(req.params.id);
  res.json({ success: true });
}));
```

**Fixed Implementation:**
```typescript
// ✅ CORRECT - Only admin users can access
app.get('/api/admin/users', withAdmin(async (req, res) => {
  const users = await storage.getAllUsers();
  res.json(users);
}));

app.delete('/api/admin/products/:id', 
  csrfProtection,  // CSRF first for mutations
  withAdmin(async (req, res) => {
    const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
    await storage.deleteProduct(id);
    res.json({ success: true });
  })
);
```

**Audit Command:**
```bash
# Find routes that might be missing withAdmin
grep -n "'/api/admin" server/admin-routes.ts | grep -v "withAdmin"
```

## Checklist

- [ ] All admin routes audited
- [ ] All `withAuth` replaced with `withAdmin`
- [ ] CSRF protection on mutation endpoints
- [ ] Input validation on all parameters
- [ ] Tests for authorization enforcement

## Success Criteria

- [ ] `grep "withAuth" server/admin-routes.ts` returns no matches
- [ ] All admin endpoints return 403 for non-admin users
- [ ] All admin endpoints return 401 for unauthenticated users
- [ ] Admin users can access all admin endpoints
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking admin functionality | Low | Medium | Test all admin features after change |
| Missing an endpoint | Low | High | Use grep to verify all routes |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm no `withAuth` in admin routes
  ```bash
  # Should return NO matches
  grep -n "withAuth" server/admin-routes.ts
  
  # Should return matches for all admin endpoints
  grep -n "withAdmin" server/admin-routes.ts
  ```

- [ ] **File inspection**: Review all admin route definitions
  ```bash
  grep -n "'/api/admin" server/admin-routes.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute admin route tests
  ```bash
  npm test -- admin
  ```

- [ ] **Manual authorization testing**:
  ```bash
  # As non-admin user (should return 403):
  curl -X GET http://localhost:5000/api/admin/users -H "Cookie: session=<non-admin-session>"
  
  # As admin user (should return 200):
  curl -X GET http://localhost:5000/api/admin/users -H "Cookie: session=<admin-session>"
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
