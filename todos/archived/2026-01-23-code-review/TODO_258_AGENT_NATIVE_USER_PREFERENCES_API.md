# TODO 258: Add API Endpoints for User Preferences (Agent-Native)

**Priority**: P2 - Important (Agent Accessibility)
**Effort**: Medium (~2-3 hours)
**Category**: API / Agent-Native
**Source**: Code Review - Agent-Native Reviewer
**Branch**: add_scraping

## Problem Statement

Users can change their country preference via the CountrySelector component, but this is stored only in localStorage. There is no API endpoint for agents to:

1. Read a user's country preference
2. Update a user's country preference
3. Persist country preference to user profile

This violates the agent-native principle: "Any action a user can take, an agent should be able to take via API."

## Impact

- Agents cannot set or read user country preference
- Country preference is device-specific, not account-specific
- User loses preference when clearing browser data or switching devices

## Findings

### Current Implementation (localStorage only)
```typescript
// client/src/context/country-context.tsx:74-111
const setCountry = useCallback((countryCode: string) => {
  setCountryState(countryCode);
  try {
    localStorage.setItem(STORAGE_KEY, countryCode);  // UI-only persistence
  } catch { /* ... */ }
}, [countries]);
```

### Missing API Endpoints
- `GET /api/user/preferences` - Read user preferences
- `PUT /api/user/preferences` - Update user preferences

### Missing Schema
- `preferredCountry` column in users table

## Proposed Solution

### 1. Database Migration (0031)
```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(2) DEFAULT NULL;
```

### 2. Storage Method
```typescript
// In user-storage.ts
async updateUserPreferences(
  userId: number,
  preferences: { preferredCountry?: string }
): Promise<void> {
  await this.db
    .update(users)
    .set({ preferredCountry: preferences.preferredCountry })
    .where(eq(users.id, userId));
}
```

### 3. API Endpoints
```typescript
// GET /api/user/preferences
app.get('/api/user/preferences', withAuth(async (req, res) => {
  const user = req.user!;
  sendSuccess(res, {
    preferredCountry: user.preferredCountry || 'US',
  });
}));

// PUT /api/user/preferences
app.put('/api/user/preferences', csrfProtection, withAuth(async (req, res) => {
  const { preferredCountry } = req.body;
  // Validate country code
  await storage.updateUserPreferences(req.user!.id, { preferredCountry });
  sendSuccess(res, { preferredCountry });
}));
```

### 4. Frontend Sync
Update CountryContext to sync with API when authenticated.

## Acceptance Criteria

- [ ] Migration adds `preferred_country` column
- [ ] `GET /api/user/preferences` returns user preferences
- [ ] `PUT /api/user/preferences` updates user preferences
- [ ] CSRF protection on PUT endpoint
- [ ] Validation for country code
- [ ] CountryContext syncs with API for authenticated users
- [ ] Falls back to localStorage for anonymous users

## Files to Create/Modify

- `migrations/0031_add_user_preferences.sql` (new)
- `server/storage/domains/user-storage.ts`
- `server/routes/user-routes.ts` or `server/routes/auth-routes.ts`
- `client/src/context/country-context.tsx`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - agent-native reviewer |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Agent-native principle: Actions a user can take, an agent should be able to take
- Country context: `client/src/context/country-context.tsx`
