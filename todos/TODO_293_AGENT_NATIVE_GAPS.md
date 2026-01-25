# TODO 293: Close Agent-Native Accessibility Gaps

**Priority**: P3
**File(s)**: Multiple (see details)
**Estimated Time**: 4 hours
**Status**: Not Started
**Tags**: `code-review`, `agent-native`, `accessibility`

## Problem Statement

Three user-facing capabilities lack API access, meaning agents cannot perform these actions:

| Capability | User Access | Agent Access |
|------------|-------------|--------------|
| Compare Products | UI modal | Client-side only (useState) |
| Newsletter Signup | UI form | Simulated - no backend |
| Theme Preferences | UI toggle | localStorage only |

## Gap Details

### 1. Compare Products (Covered by TODO 290)

See TODO 290 for full implementation plan.

### 2. Newsletter Subscription - No Backend

**File**: `client/src/components/newsletter-banner.tsx:77-82`
```typescript
// Simulate API call (UI only - no actual submission)
await new Promise((resolve) => setTimeout(resolve, 1500));
```

**Impact**: Agents cannot subscribe email addresses via API.

### 3. Theme/Accessibility Preferences - Not Server-Persisted

**File**: `client/src/components/theme-toggle.tsx:14-20`
- Uses `useTheme` which stores in localStorage only
- No cross-device sync
- Agents cannot read or set preferences

### 4. Missing data-testid Attributes

Several interactive elements lack automation targeting:

| Component | File | Element |
|-----------|------|---------|
| Hero Search | `hero-section.tsx:30-41` | Input & button |
| Category Dropdown | `filter-sidebar.tsx:89-101` | Select |
| Theme Toggle | `theme-toggle.tsx:24-31` | Button |
| Newsletter Form | `newsletter-banner.tsx:168-194` | Form elements |

## Implementation Steps

### Step 1: Implement Newsletter API

- [ ] Create `server/routes/newsletter-routes.ts`
- [ ] Implement POST `/api/newsletter/subscribe`
- [ ] Create `newsletters` or `subscribers` table
- [ ] Update `newsletter-banner.tsx` to use real API

### Step 2: Add Theme Preferences to User Profile

- [ ] Add `theme` and `highContrast` columns to users table
- [ ] Add to `/api/user/preferences` endpoint
- [ ] Update `theme-toggle.tsx` to sync with server for logged-in users

### Step 3: Add data-testid Attributes

- [ ] Add to `hero-section.tsx` search elements
- [ ] Add to `filter-sidebar.tsx` dropdowns
- [ ] Add to `theme-toggle.tsx` button
- [ ] Add to `newsletter-banner.tsx` form

## Technical Details

```typescript
// newsletter-banner.tsx - Updated
const handleSubscribe = async () => {
  await apiRequest('/api/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  toast({ title: 'Subscribed!', description: '...' });
};

// theme-toggle.tsx - Updated for logged-in users
const { user } = useUser();
const syncThemeToServer = useCallback(async (theme: string) => {
  if (!user) return;
  await apiRequest('/api/user/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ theme }),
  });
}, [user]);
```

## Checklist

- [ ] Newsletter API implemented
- [ ] Theme preferences synced to server
- [ ] data-testid attributes added
- [ ] Agent can perform all user actions

## Success Criteria

- [ ] 12/12 capabilities agent-accessible (currently 9/12)
- [ ] All interactive elements have data-testid
- [ ] Full API parity with UI

---

**Source**: Frontend Code Review (2026-01-25)
**Agents**: agent-native-reviewer
