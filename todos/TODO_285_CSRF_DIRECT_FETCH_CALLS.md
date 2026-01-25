# TODO 285: Fix Direct fetch() Calls Missing CSRF Tokens

**Priority**: P1
**File(s)**: Multiple - see list below
**Estimated Time**: 2 hours
**Status**: Not Started
**Tags**: `code-review`, `security`, `csrf`

## Problem Statement

Multiple components make direct `fetch()` calls for mutating operations (POST/PUT/PATCH/DELETE) WITHOUT using the `apiRequest()` wrapper, which means CSRF tokens are NOT included.

This is a **security vulnerability** - attackers could perform CSRF attacks on these endpoints.

## Affected Files and Lines

| File | Lines | Method |
|------|-------|--------|
| `client/src/components/price-history/price-alerts-manager.tsx` | 192-195, 207-211, 309-314, 327-331 | DELETE, PATCH, POST |
| `client/src/components/product-detail-dialog.tsx` | 134-138 | POST |
| `client/src/pages/reset-password.tsx` | 129-134 | POST |
| `client/src/pages/forgot-password.tsx` | 61-66 | POST |
| `client/src/hooks/use-wishlist.ts` | 103-107, 133-137, 158-160, 190-194, 217-219 | POST, PATCH, DELETE |

## Root Cause

Developers used raw `fetch()` instead of the `apiRequest()` wrapper which automatically includes CSRF tokens.

## Evidence

**Vulnerable code** (`price-alerts-manager.tsx:192-195`):
```typescript
const res = await fetch(`/api/price-alerts/${alert.id}`, {
  method: 'DELETE',
  credentials: 'include',
});
// MISSING: X-CSRF-Token header
```

**Correct code** (`login-form.tsx:26-29`):
```typescript
return apiRequest<AuthResponse>('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify(data),
});
// apiRequest() automatically includes CSRF token
```

## Solution Approach

Replace all direct `fetch()` mutation calls with `apiRequest()` wrapper from `@/lib/queryClient`.

## Implementation Steps

### Step 1: Fix price-alerts-manager.tsx

- [ ] Import `apiRequest` from `@/lib/queryClient`
- [ ] Replace line 192-195 DELETE with apiRequest
- [ ] Replace line 207-211 PATCH with apiRequest
- [ ] Replace line 309-314 POST with apiRequest
- [ ] Replace line 327-331 PATCH with apiRequest

### Step 2: Fix product-detail-dialog.tsx

- [ ] Replace line 134-138 POST with apiRequest

### Step 3: Fix auth pages

- [ ] Fix `reset-password.tsx:129-134` POST
- [ ] Fix `forgot-password.tsx:61-66` POST

### Step 4: Fix use-wishlist.ts

- [ ] Import `apiRequest` from `@/lib/queryClient`
- [ ] Replace all 5 mutation fetch calls with apiRequest

## Technical Details

```typescript
// BEFORE
const response = await fetch('/api/wishlists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(data),
});

// AFTER
import { apiRequest } from '@/lib/queryClient';

const response = await apiRequest('/api/wishlists', {
  method: 'POST',
  body: JSON.stringify(data),
});
```

## Checklist

- [ ] All direct fetch() mutation calls replaced
- [ ] Tests pass
- [ ] CSRF tokens included in all mutations
- [ ] Auth endpoints work correctly

## Success Criteria

- [ ] Zero direct fetch() calls for POST/PUT/PATCH/DELETE
- [ ] All mutations include X-CSRF-Token header
- [ ] Security vulnerability closed

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: security-sentinel
