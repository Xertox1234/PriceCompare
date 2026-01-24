# TODO 271: Sync Country Preference Between Client and Server

**Priority**: P2 (IMPORTANT)
**File(s)**: `client/src/context/country-context.tsx`
**Estimated Time**: 2 hours
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

## Solution Approach

1. Add React Query hooks to fetch/update server preferences
2. Sync changes to server when user is authenticated
3. Keep localStorage as fallback for unauthenticated users

## Implementation Steps

### Step 1: Add API Integration

- [ ] Create `useUserPreferences` hook with React Query
- [ ] Fetch preferences on mount for authenticated users
- [ ] Use `useMutation` for updates

### Step 2: Update CountryProvider

- [ ] Integrate `useUserPreferences` hook
- [ ] Sync country changes to server when authenticated
- [ ] Handle loading states during initial fetch

### Step 3: Handle Edge Cases

- [ ] Merge localStorage preference on login
- [ ] Clear cached preference on logout
- [ ] Handle offline mode gracefully

## Technical Details

```typescript
// New hook: use-user-preferences.ts
export function useUserPreferences() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      const res = await fetch('/api/user/preferences');
      return res.json();
    },
    enabled: !!user, // Only fetch when authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const mutation = useMutation({
    mutationFn: async (prefs: { preferredCountry: string }) => {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['user-preferences']);
    },
  });

  return { ...query, updatePreferences: mutation.mutate };
}

// Updated CountryProvider
const setCountry = useCallback((countryCode: string) => {
  setCountryState(countryCode);
  localStorage.setItem(STORAGE_KEY, countryCode);

  // Sync to server if authenticated
  if (user) {
    updatePreferences({ preferredCountry: countryCode });
  }
}, [user, updatePreferences]);
```

## Checklist

- [ ] `useUserPreferences` hook created
- [ ] CountryProvider updated to use hook
- [ ] Loading state handled (show skeleton/spinner)
- [ ] Error handling for failed syncs
- [ ] Tests for sync behavior

## Success Criteria

- [ ] Authenticated user's country preference persists on server
- [ ] Changing country in UI updates server
- [ ] Changing country via API reflects in UI (on next mount)
- [ ] Unauthenticated users still use localStorage
- [ ] No regression in existing functionality

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: agent-native-reviewer
