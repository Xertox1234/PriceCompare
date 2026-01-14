# TODO 215: Missing Password Validation on Change

**Priority**: P2 - MEDIUM
**File(s)**: `server/auth-routes.ts`, `server/storage.ts`
**Estimated Time**: 45 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Password change endpoint doesn't verify the current password before allowing change. If an attacker gains access to a user's session (via XSS, session hijacking, or physical access to unlocked device), they can:

1. Change the password without knowing the current one
2. Lock the legitimate user out of their account
3. Maintain persistent access even after session expires

**Security Impact**: Session compromise escalates to full account takeover.

## Root Cause

Password change handler only requires authentication, not re-verification of credentials.

## Solution Approach

1. Require current password for password change
2. Validate current password before allowing change
3. Invalidate other sessions after password change
4. Add password strength validation

## Implementation Steps

### Step 1: Update Password Change Endpoint

- [ ] Add `currentPassword` to request body validation
- [ ] Fetch user with password hash from storage
- [ ] Verify current password with bcrypt.compare()
- [ ] Only proceed if verification succeeds

### Step 2: Add Session Invalidation

- [ ] After password change, invalidate all other sessions
- [ ] Keep current session active
- [ ] Add storage method for session invalidation

### Step 3: Add Password Strength Validation

- [ ] Minimum 8 characters
- [ ] Consider additional rules (mixed case, numbers, etc.)
- [ ] Return clear error messages for validation failures

### Step 4: Add Tests

- [ ] Test wrong current password is rejected
- [ ] Test correct current password allows change
- [ ] Test other sessions are invalidated
- [ ] Test password strength validation

## Technical Details

**Current Implementation (INSECURE):**
```typescript
app.post('/api/auth/change-password', csrfProtection, withAuth(async (req, res) => {
  const { newPassword } = req.body; // ❌ No currentPassword verification!
  const hashedPassword = await hashPassword(newPassword);
  await storage.updateUserPassword(req.user.id, hashedPassword);
  res.json({ success: true });
}));
```

**Fixed Implementation:**
```typescript
import bcrypt from 'bcrypt';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

app.post('/api/auth/change-password', 
  csrfProtection, 
  withAuth(async (req, res) => {
    // ✅ Validate input
    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors 
      });
    }
    
    const { currentPassword, newPassword } = parseResult.data;
    
    // ✅ Fetch user with password hash
    const user = await storage.getUserWithPassword(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // ✅ Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // ✅ Prevent setting same password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }
    
    // ✅ Hash and save new password
    const hashedPassword = await hashPassword(newPassword);
    await storage.updateUserPassword(req.user!.id, hashedPassword);
    
    // ✅ Invalidate other sessions (keep current one)
    await storage.invalidateUserSessions(req.user!.id, req.sessionID);
    
    res.json({ success: true });
  })
);
```

**Storage Method for Session Invalidation:**
```typescript
// server/storage.ts
async getUserWithPassword(userId: number): Promise<UserWithPassword | null> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      passwordHash: users.passwordHash, // Only for password verification
    })
    .from(users)
    .where(eq(users.id, userId));
  
  return user || null;
}

async invalidateUserSessions(userId: number, exceptSessionId?: string): Promise<void> {
  // If using Redis session store, delete all sessions for user except current
  const pattern = `sess:*`;
  const keys = await redisClient.keys(pattern);
  
  for (const key of keys) {
    const sessionData = await redisClient.get(key);
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed.passport?.user?.id === userId && key !== `sess:${exceptSessionId}`) {
        await redisClient.del(key);
      }
    }
  }
}
```

## Checklist

- [ ] Current password required for change
- [ ] Current password verified before change
- [ ] Password strength validation (8+ chars)
- [ ] Other sessions invalidated after change
- [ ] Clear error messages for all failure cases
- [ ] Tests verify all scenarios

## Success Criteria

- [ ] Password change without current password returns 400
- [ ] Wrong current password returns 401
- [ ] Weak new password returns 400
- [ ] Successful change invalidates other sessions
- [ ] Current session remains active after change
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing clients | Medium | Low | Document API change, version if needed |
| Session invalidation slow | Low | Low | Batch Redis operations |
| User confusion on error | Low | Low | Clear, specific error messages |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm current password verification exists
  ```bash
  # Verify currentPassword is validated
  grep -n "currentPassword" server/auth-routes.ts
  
  # Verify bcrypt.compare is called
  grep -n "bcrypt.compare" server/auth-routes.ts
  
  # Verify session invalidation is called
  grep -n "invalidateUserSessions" server/auth-routes.ts
  ```

- [ ] **File inspection**: Review password change handler
  ```bash
  grep -A 40 "change-password" server/auth-routes.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute password change tests
  ```bash
  npm test -- auth
  npm test -- password
  ```

- [ ] **Manual password change test**:
  ```bash
  # Without current password (should fail)
  curl -X POST http://localhost:5000/api/auth/change-password \
    -H "Content-Type: application/json" \
    -H "Cookie: session=<valid-session>" \
    -d '{"newPassword":"newpassword123"}'
  # Should return 400
  
  # With wrong current password (should fail)
  curl -X POST http://localhost:5000/api/auth/change-password \
    -H "Content-Type: application/json" \
    -H "Cookie: session=<valid-session>" \
    -d '{"currentPassword":"wrongpassword","newPassword":"newpassword123"}'
  # Should return 401
  
  # With correct current password (should succeed)
  curl -X POST http://localhost:5000/api/auth/change-password \
    -H "Content-Type: application/json" \
    -H "Cookie: session=<valid-session>" \
    -d '{"currentPassword":"correctpassword","newPassword":"newpassword123"}'
  # Should return 200
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
