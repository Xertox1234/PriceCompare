# TODO 002: Implement setUserActive() Storage Method

**Priority**: P3
**File(s)**: `server/storage.ts`, `server/test/basic-auth.test.ts`
**Line**: 332 (test file)
**Estimated Time**: 1-2 hours
**Status**: Not Started

## Problem Statement

Test file references a `setUserActive()` storage method that doesn't exist:

```typescript
// TODO: Implement setUserActive() method in storage layer
```

This blocks testing of user active/inactive state management.

## Root Cause

Method was designed but never implemented. Test was written anticipating the feature.

## Solution Approach

Implement the `setUserActive()` method in the storage layer following existing patterns.

## Implementation Steps

### Step 1: Add Interface Method

- [ ] Add `setUserActive(userId: number, active: boolean): Promise<void>` to `IStorage`

### Step 2: Implement Storage Method

- [ ] Add implementation in `server/storage.ts`
- [ ] Use proper security patterns (don't expose passwordHash)

### Step 3: Enable Blocked Tests

- [ ] Remove TODO comment in test file
- [ ] Enable/fix any skipped tests dependent on this method

## Technical Details

```typescript
// Interface addition
interface IStorage {
  // ... existing methods
  setUserActive(userId: number, active: boolean): Promise<void>;
}

// Implementation pattern
async setUserActive(userId: number, active: boolean): Promise<void> {
  await db
    .update(users)
    .set({ 
      isActive: active,
      updatedAt: new Date() 
    })
    .where(eq(users.id, userId));
}
```

## Checklist

- [ ] Interface updated in IStorage
- [ ] Implementation added to storage.ts
- [ ] Tests enabled and passing
- [ ] Security patterns followed (explicit field selection)

## Success Criteria

- [ ] `setUserActive()` method exists and works
- [ ] Basic auth tests using this method pass
- [ ] No security issues (password hash not exposed)
