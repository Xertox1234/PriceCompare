# TODO 259: Add Profile Editing API Endpoint

**Priority**: P2 - Important (Agent Accessibility)
**Effort**: Small (~1 hour)
**Category**: API / Agent-Native
**Source**: Code Review - Agent-Native Reviewer
**Branch**: add_scraping

## Problem Statement

The storage layer has `updateUserProfile()` method that can update bio, location, website, and avatarUrl. However, there is NO HTTP endpoint exposing this capability. The UI shows "Profile Editing Coming Soon".

This means:
1. Users cannot edit their profile via UI or API
2. Agents cannot update user profile data
3. The capability exists in storage but is inaccessible

## Findings

### Storage Method Exists (user-storage.ts:519-555)
```typescript
async updateUserProfile(
  userId: number,
  data: { bio?: string; location?: string; website?: string; avatarUrl?: string }
): Promise<void> {
  // Implementation exists but no HTTP endpoint exposes it
}
```

### UI Shows "Coming Soon" (profile.tsx:130-138)
```tsx
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Coming Soon: Profile Editing</AlertTitle>
  <AlertDescription>
    Profile editing features will be available soon.
  </AlertDescription>
</Alert>
```

### Missing API Endpoint
- `PATCH /api/user/profile` - Edit user profile

## Proposed Solution

### API Endpoint
```typescript
// In user-routes.ts or auth-routes.ts

const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().max(255).optional(),
  avatarUrl: z.string().url().max(500).optional(),
});

app.patch('/api/user/profile', csrfProtection, withAuth(async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    await storage.updateUserProfile(req.user!.id, data);
    const updatedUser = await storage.getUserByIdSafe(req.user!.id);
    sendSuccess(res, updatedUser);
  } catch (error) {
    sendErrorFromException(res, error, 'UpdateProfile');
  }
}));
```

### Validation Constants
Use existing `USER_CONSTANTS` for field length limits if available, or add:
```typescript
export const USER_CONSTANTS = {
  BIO_MAX_LENGTH: 500,
  LOCATION_MAX_LENGTH: 100,
  WEBSITE_MAX_LENGTH: 255,
  AVATAR_URL_MAX_LENGTH: 500,
};
```

## Acceptance Criteria

- [ ] `PATCH /api/user/profile` endpoint created
- [ ] CSRF protection applied
- [ ] Authentication required (withAuth)
- [ ] Input validation with Zod schema
- [ ] Field length limits enforced
- [ ] URL validation for website and avatarUrl
- [ ] Returns updated user profile on success
- [ ] Remove "Coming Soon" alert from UI (optional - can be separate PR)

## Files to Modify

- `server/routes/user-routes.ts` or `server/routes/auth-routes.ts`
- `client/src/pages/profile.tsx` (optional - remove Coming Soon)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - agent-native reviewer |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Storage method: `server/storage/domains/user-storage.ts:519-555`
- Profile page: `client/src/pages/profile.tsx`
