# TODO 271: Sync Country Preference Between Client and Server

**Priority**: P2 (IMPORTANT)
**File(s)**: `client/src/context/country-context.tsx`
**Estimated Time**: 30 minutes (revised down from 2 hours)
**Status**: Not Started
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The server correctly implements agent-native preferences API (TODO 258), but the client NEVER syncs with this API. Changes made via API are not reflected in UI, and changes in UI are not persisted to server.

## Root Cause

Client implementation uses localStorage exclusively, without integrating with the server API endpoints (`GET/PUT /api/user/preferences`).

## Evidence

**Server (CORRECT):**
```typescript
// server/routes/auth-routes.ts:789-849
app.get('/api/user/preferences', withAuth(...));
app.put('/api/user/preferences', csrfProtection, withAuth(...));
```

**Client (GAP):**
```typescript
// client/src/context/country-context.tsx:77,105
const [country, setCountryState] = useState<string>(() => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored || defaultCountry;
});

const setCountry = useCallback((countryCode: string) => {
  setCountryState(countryCode);
  localStorage.setItem(STORAGE_KEY, countryCode); // Only localStorage!
}, [countries]);
```

## Solution Approach (REVISED)

**Simplified implementation** - modify existing `CountryProvider` directly with ~20 lines. No separate hook file needed.

1. Add fetch-on-login effect to hydrate from server
2. Add debounced sync effect when country changes
3. Keep localStorage as instant fallback (no loading states)

### What NOT to build (YAGNI)

| Removed from original plan | Reason |
|---------------------------|--------|
| Separate `useUserPreferences` hook | Unnecessary indirection |
| React Query integration | Overkill for single-fetch-on-login |
| Login merge logic | Server preference wins, no merge needed |
| Offline mode handling | Site requires internet anyway |
| Loading skeleton/spinner | <50ms fetch, localStorage provides instant value |
| `invalidateQueries` pattern | Use fire-and-forget with localStorage backup |

## Implementation

### Required Types

```typescript
// Add to country-context.tsx or shared types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface UserPreferences {
  preferredCountry: string;
}
```

### Changes to CountryProvider (~20 lines)

```typescript
// Add imports
import { useDebouncedCallback } from 'use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { getCsrfToken } from '@/lib/csrf';

// Inside CountryProvider component:

const { user } = useAuth();

// Effect 1: Fetch server preference when user logs in
useEffect(() => {
  if (!user) return;

  fetch('/api/user/preferences', { credentials: 'include' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: ApiResponse<UserPreferences>) => {
      if (data.success && data.data?.preferredCountry) {
        setCountryState(data.data.preferredCountry);
        localStorage.setItem(STORAGE_KEY, data.data.preferredCountry);
      }
    })
    .catch(() => {
      // Silent fail - localStorage value persists as fallback
    });
}, [user?.id]);

// Effect 2: Debounced sync to server when country changes
const debouncedServerSync = useDebouncedCallback(
  (countryCode: string) => {
    if (!user) return;

    fetch('/api/user/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken(), // CRITICAL: Required for CSRF protection
      },
      credentials: 'include',
      body: JSON.stringify({ preferredCountry: countryCode }),
    }).catch(() => {
      // Silent fail - localStorage is the backup
    });
  },
  500, // 500ms debounce prevents request storms
  { leading: false, trailing: true }
);

// Update setCountry to trigger debounced sync
const setCountry = useCallback((countryCode: string) => {
  setCountryState(countryCode);
  localStorage.setItem(STORAGE_KEY, countryCode);

  // Debounced sync to server (only when authenticated)
  debouncedServerSync(countryCode);
}, [debouncedServerSync]);
```

## Critical Requirements

### Security (MANDATORY)

- [x] CSRF token in PUT request header (`X-CSRF-Token`)
- [x] `credentials: 'include'` for session cookies

### Type Safety (MANDATORY)

- [x] Explicit `ApiResponse<UserPreferences>` type on response
- [x] Check `res.ok` before `res.json()`

### Performance (MANDATORY)

- [x] 500ms debounce on server sync (prevents dropdown request storms)
- [x] Fire-and-forget mutations (no refetch after update)
- [x] Silent error handling (localStorage is always the backup)

## Checklist

- [ ] Add `ApiResponse` and `UserPreferences` type definitions
- [ ] Add fetch-on-login effect with `res.ok` check
- [ ] Add debounced sync effect with CSRF token
- [ ] Update `setCountry` to call debounced sync
- [ ] Verify `use-debounce` is in dependencies (or add it)
- [ ] Test: authenticated user preference persists on server
- [ ] Test: rapid country changes only fire one request (debounce works)
- [ ] Test: unauthenticated users still use localStorage only

## Success Criteria

- [ ] Authenticated user's country preference persists on server
- [ ] Changing country in UI updates server (debounced)
- [ ] Changing country via API reflects in UI (on next login/mount)
- [ ] Unauthenticated users still use localStorage
- [ ] No loading states or UI flicker (localStorage is instant)
- [ ] No regression in existing functionality

---

## Review History

### 2026-01-24: Multi-Agent Plan Review

**Reviewers**: kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer

**Critical Issues Fixed:**
1. **Missing CSRF token** - Added `X-CSRF-Token` header to PUT request
2. **No type safety** - Added explicit `ApiResponse<T>` types
3. **Missing error handling** - Added `res.ok` checks
4. **Request storms** - Added 500ms debounce on mutations
5. **Over-engineering** - Removed separate hook, React Query, login merge, offline mode

**Complexity Reduction:** ~75% (from ~80 LOC to ~20 LOC)

**Estimated Time Reduction:** 75% (from 2 hours to 30 minutes)

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Revised**: 2026-01-24 (Plan Review)
**Agents**: agent-native-reviewer, kieran-typescript-reviewer, performance-oracle, code-simplicity-reviewer
