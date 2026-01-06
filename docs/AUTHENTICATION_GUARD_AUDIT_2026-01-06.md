# Authentication Guard Audit - React Query Hooks

**Date**: 2026-01-06
**Context**: TODO_014 product image visibility bug revealed missing authentication guards
**Issue**: Hooks calling authenticated endpoints without `enabled: !!user` trigger HTTP Basic Auth popups

## 🎯 Summary

**Total Hooks Audited**: 15 files using React Query
**Vulnerable Hooks Found**: 15 hooks lacking proper authentication guards (13 initial + 2 discovered in code review)
**Risk Level**: **HIGH** - Can trigger browser auth popups and make unnecessary API calls
**Status**: ✅ **ALL FIXED** (2026-01-06)

---

## ❌ VULNERABLE HOOKS (Require Immediate Fix)

### 1. **client/src/hooks/use-community.ts**

#### `useSharedWatchLists()` - Line 595
- **Endpoint**: `/api/watchlists/shared` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Same bug as TODO_014 if called on public pages
- **Fix**: Add `enabled: !!user`

```typescript
// ❌ CURRENT (line 595-609)
export function useSharedWatchLists() {
  return useQuery<SharedWatchListWithStats[]>({
    queryKey: ['/api/watchlists/shared'],
    queryFn: async () => { /* ... */ },
    // Missing: enabled: !!user
  });
}

// ✅ SHOULD BE
export function useSharedWatchLists() {
  const { data: user } = useAuth();
  return useQuery<SharedWatchListWithStats[]>({
    queryKey: ['/api/watchlists/shared'],
    queryFn: async () => { /* ... */ },
    enabled: !!user, // Prevent auth popup
  });
}
```

#### `useIsWatching()` - Line 322
- **Endpoint**: `/api/watchlists/is-watching/:productId` (authenticated)
- **Current**: Only checks `enabled: !!productId`
- **Risk**: MEDIUM - Will make API calls when unauthenticated
- **Fix**: Add user check: `enabled: !!productId && !!user`

#### `useWatchedProducts()` - Line 207
- **Endpoint**: `/api/watchlists/products` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

#### `useWatchList()` - Line 666 ⚠️ **DISCOVERED IN CODE REVIEW**
- **Endpoint**: `/api/watchlists/:id` (authenticated, uses `withAuth`)
- **Current**: Only checks `enabled: !!listId`
- **Risk**: MEDIUM - Will make API calls when unauthenticated
- **Fix**: Add user check: `enabled: !!listId && !!user`

#### `useUserReputation()` - Line 414 ⚠️ **DISCOVERED IN CODE REVIEW**
- **Endpoint**: `/api/community/reputation` (authenticated, uses `withAuth`)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

---

### 2. **client/src/hooks/use-notifications.ts**

#### `useNotifications()` - Line 41
- **Endpoint**: `/api/notifications` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup on public pages
- **Fix**: Add `enabled: !!user`

#### `useNotificationStats()` - Line 55
- **Endpoint**: `/api/notifications/stats` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

#### `useNotificationPreferences()` - Line 64
- **Endpoint**: `/api/notifications/preferences` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

---

### 3. **client/src/hooks/use-smart-alerts.ts**

#### `useSmartThresholdSuggestions()` - Line 78
- **Endpoint**: `/api/smart-alerts/suggestions/:productId` (authenticated)
- **Current**: Only checks `enabled: !!productId && !!currentPrice`
- **Risk**: MEDIUM - Will make API calls when unauthenticated
- **Fix**: Add user check: `enabled: !!productId && !!currentPrice && !!user`

#### `usePredictiveAlerts()` - Line 124
- **Endpoint**: `/api/smart-alerts/predictive` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

#### `useAlertEffectiveness()` - Line 172
- **Endpoint**: `/api/smart-alerts/effectiveness` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

#### `useAlertAnalytics()` - Line 209
- **Endpoint**: `/api/smart-alerts/analytics` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

---

### 4. **client/src/hooks/use-wishlist.ts**

#### `useWishlists()` - Line 44
- **Endpoint**: `/api/wishlists` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup on public pages
- **Fix**: Add `enabled: !!user`

#### `useWishlistItems()` - Line 63
- **Endpoint**: `/api/wishlists/items` (authenticated)
- **Current**: NO `enabled` guard
- **Risk**: HIGH - Can trigger auth popup
- **Fix**: Add `enabled: !!user`

#### `useWishlist()` - Line 53
- **Endpoint**: `/api/wishlists/:id` (authenticated)
- **Current**: Only checks `enabled: !!wishlistId`
- **Risk**: MEDIUM - Will make API calls when unauthenticated
- **Fix**: Add user check: `enabled: !!wishlistId && !!user`

#### `useIsInWishlist()` - Line 73
- **Endpoint**: `/api/wishlists/check/:productId` (authenticated)
- **Current**: Only checks `enabled: !!productId`
- **Risk**: MEDIUM - Will make API calls when unauthenticated
- **Fix**: Add user check: `enabled: !!productId && !!user`

---

## ✅ ALREADY PROTECTED (No Action Needed)

### **client/src/hooks/use-community.ts**
- `useWatchLists()` - Line 576 ✅ Has `enabled: !!user` (FIXED in TODO_014)
- `useWatchList()` - Line 650 ✅ Has `enabled: id !== null` (partial protection)

### **client/src/hooks/useWatchList.ts** (duplicate file)
- `useWatchLists()` - Line 75 ✅ Has `enabled: !!user` (FIXED in TODO_014)
- `useWatchList()` - Line 90 ✅ Has `enabled: id !== null` (partial protection)

---

## 📊 Risk Assessment

| Risk Level | Count | Description |
|------------|-------|-------------|
| **HIGH** | 11 hooks | No authentication guard - **can trigger browser auth popup** |
| **MEDIUM** | 4 hooks | Has partial `enabled` check but missing `!!user` - makes unnecessary API calls |
| **TOTAL** | **15** | Hooks requiring authentication guards (13 initial + 2 from code review) |
| **FIXED** | **15/15** | ✅ **ALL vulnerabilities resolved** |

---

## 🛠️ Recommended Fix Pattern

### For hooks accessing authenticated endpoints:

```typescript
import { useAuth } from './use-auth';

export function useAuthenticatedData() {
  const { data: user } = useAuth();

  return useQuery<DataType>({
    queryKey: ['/api/authenticated-endpoint'],
    queryFn: async () => apiRequest<DataType>('/api/authenticated-endpoint'),
    enabled: !!user, // ← CRITICAL: Prevents auth popup on public pages
    staleTime: 5 * 60 * 1000,
  });
}
```

### For hooks with other conditions:

```typescript
export function useConditionalData(id?: number) {
  const { data: user } = useAuth();

  return useQuery<DataType>({
    queryKey: ['/api/data', id],
    queryFn: async () => apiRequest<DataType>(`/api/data/${id}`),
    enabled: !!id && !!user, // ← Both conditions required
  });
}
```

---

## 📝 Implementation Checklist

### Phase 1: Critical Fixes (Prevent Auth Popups) ✅ COMPLETED
- [x] Fix `useSharedWatchLists()` in use-community.ts
- [x] Fix `useNotifications()` in use-notifications.ts
- [x] Fix `useNotificationStats()` in use-notifications.ts
- [x] Fix `useNotificationPreferences()` in use-notifications.ts
- [x] Fix `usePredictiveAlerts()` in use-smart-alerts.ts
- [x] Fix `useAlertEffectiveness()` in use-smart-alerts.ts
- [x] Fix `useAlertAnalytics()` in use-smart-alerts.ts
- [x] Fix `useWishlists()` in use-wishlist.ts
- [x] Fix `useWishlistItems()` in use-wishlist.ts
- [x] Fix `useUserReputation()` in use-community.ts ⚠️ **ADDED FROM CODE REVIEW**

### Phase 2: Partial Protection Improvements ✅ COMPLETED
- [x] Add `!!user` to `useIsWatching()` in use-community.ts
- [x] Add `!!user` to `useWatchedProducts()` in use-community.ts
- [x] Add `!!user` to `useSmartThresholdSuggestions()` in use-smart-alerts.ts
- [x] Add `!!user` to `useWishlist()` in use-wishlist.ts
- [x] Add `!!user` to `useIsInWishlist()` in use-wishlist.ts
- [x] Add `!!user` to `useWatchList()` in use-community.ts ⚠️ **ADDED FROM CODE REVIEW**

### Phase 3: Documentation ✅ COMPLETED
- [x] Add JSDoc comments explaining why `enabled: !!user` is critical
- [x] Reference TODO_014 in comments for historical context
- [x] Update audit document with code review discoveries

---

## 🔍 How This Was Discovered

**Original Bug (TODO_014)**:
- Product detail page called `useWatchLists()` unconditionally
- When unauthenticated, `/api/watchlists` returned 401 with `WWW-Authenticate: Basic` header
- Browser showed HTTP Basic Auth popup, blocking entire page including product images
- Users thought images weren't loading, but they were just blocked by auth dialog

**Root Cause**:
- React Query hooks without `enabled: !!user` make API calls immediately on mount
- Authenticated endpoints return 401 with `WWW-Authenticate: Basic` header
- This triggers browser's native authentication dialog (not our UI)
- Dialog is modal and blocks all interaction with the page

**Solution**:
- Add `enabled: !!user` to prevent queries when not authenticated
- This is the canonical React Query pattern for conditional query execution
- Prevents unnecessary API calls AND prevents auth popup UX bug

---

## 📚 References

- **Original Bug**: TODO_014 - Product Image Visibility Fix
- **Fixed Files**:
  - `client/src/hooks/use-community.ts` (useWatchLists)
  - `client/src/hooks/useWatchList.ts` (useWatchLists)
  - `client/src/pages/product-detail-new.tsx` (added useAuth import)
- **Pattern Documentation**: React Query `enabled` option - https://tanstack.com/query/latest/docs/react/guides/disabling-queries
- **Security Context**: HTTP Basic Auth `WWW-Authenticate` header triggers browser dialog
