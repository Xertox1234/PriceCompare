# TODO 213: Session Fixation Vulnerability

**Priority**: P2 - MEDIUM
**File(s)**: `server/auth-routes.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Session ID is not regenerated after successful login, enabling session fixation attacks:

1. Attacker visits site, gets session ID (e.g., via URL parameter or cookie)
2. Attacker tricks victim into using that session ID
3. Victim logs in with attacker's session ID
4. Attacker now has authenticated access via the known session ID

**Security Impact**: Account hijacking without needing credentials.

## Root Cause

Login handler doesn't call `req.session.regenerate()` after successful authentication.

## Solution Approach

1. Call `req.session.regenerate()` after successful login
2. Re-establish user in the new session
3. Apply same pattern to other privilege escalation points (e.g., password change)

## Implementation Steps

### Step 1: Fix Login Handler

- [ ] Add `req.session.regenerate()` after successful authentication
- [ ] Re-establish user in new session with `req.logIn()`
- [ ] Handle regeneration errors appropriately

### Step 2: Fix Other Privilege Changes

- [ ] Regenerate session after password change
- [ ] Regenerate session after email change (if applicable)
- [ ] Regenerate session after role elevation (admin promotion)

### Step 3: Add Tests

- [ ] Test that session ID changes after login
- [ ] Test that user remains authenticated after regeneration
- [ ] Test error handling if regeneration fails

## Technical Details

**Current Implementation (VULNERABLE):**
```typescript
app.post('/api/auth/login', csrfProtection, passport.authenticate('local'), (req, res) => {
  // ❌ Session ID not regenerated after login
  res.json({ user: req.user });
});
```

**Fixed Implementation:**
```typescript
app.post('/api/auth/login', 
  loginLimiter,
  csrfProtection, 
  passport.authenticate('local'), 
  (req, res) => {
    // ✅ Regenerate session ID to prevent session fixation
    const userData = req.user;
    
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        return res.status(500).json({ error: 'Login failed' });
      }
      
      // Re-establish user in new session
      req.logIn(userData, (loginErr) => {
        if (loginErr) {
          console.error('Re-login after regeneration failed:', loginErr);
          return res.status(500).json({ error: 'Login failed' });
        }
        
        res.json({ user: userData });
      });
    });
  }
);
```

**Password Change with Session Regeneration:**
```typescript
app.post('/api/auth/change-password', 
  csrfProtection, 
  withAuth(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    // ... password verification and update logic ...
    
    // ✅ Regenerate session after password change
    const userData = req.user;
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration failed:', err);
        // Password was changed, just return success
        return res.json({ success: true, sessionRegenerated: false });
      }
      
      req.logIn(userData, (loginErr) => {
        if (loginErr) {
          return res.json({ success: true, sessionRegenerated: false });
        }
        res.json({ success: true, sessionRegenerated: true });
      });
    });
  })
);
```

## Checklist

- [ ] Session regenerated after login
- [ ] Session regenerated after password change
- [ ] User remains authenticated after regeneration
- [ ] Error handling for regeneration failures
- [ ] Tests verify session ID changes

## Success Criteria

- [ ] Session ID (cookie value) changes after successful login
- [ ] User object preserved in new session
- [ ] Authentication state preserved after regeneration
- [ ] Graceful handling of regeneration errors
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Session data loss | Low | Medium | Re-establish user with req.logIn() |
| Regeneration failure | Low | Low | Log error, continue with original session |
| Race condition | Low | Low | Synchronous regeneration before response |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm session regeneration exists
  ```bash
  # Verify regenerate is called in login handler
  grep -n "session.regenerate" server/auth-routes.ts
  # Should return: Lines with req.session.regenerate
  
  # Verify logIn is called after regenerate
  grep -A 5 "session.regenerate" server/auth-routes.ts | grep "logIn"
  ```

- [ ] **File inspection**: Review login handler flow
  ```bash
  grep -A 20 "'/api/auth/login'" server/auth-routes.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute auth tests
  ```bash
  npm test -- auth
  npm test -- session
  ```

- [ ] **Manual session fixation test**:
  ```bash
  # 1. Get initial session ID
  curl -c cookies.txt http://localhost:5000/api/csrf-token
  cat cookies.txt | grep connect.sid
  
  # 2. Login with that session
  curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password"}'
  
  # 3. Verify session ID changed
  cat cookies.txt | grep connect.sid
  # Session ID should be DIFFERENT from step 1
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
