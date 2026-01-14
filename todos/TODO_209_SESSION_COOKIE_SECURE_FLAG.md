# TODO 209: Session Cookie Missing `secure` Flag in Production

**Priority**: P0 - CRITICAL
**File(s)**: `server/index.ts`
**Estimated Time**: 15 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Session cookie configuration doesn't enforce `secure: true` in production, allowing session tokens to be transmitted over HTTP. This enables Man-in-the-Middle (MITM) attacks where attackers can intercept session cookies and hijack user sessions.

**Security Impact**: Session hijacking on any network where HTTPS is not enforced end-to-end.

## Root Cause

Session cookie configuration likely copied from development setup without environment-specific settings.

## Solution Approach

Add `secure: process.env.NODE_ENV === 'production'` to session cookie configuration.

## Implementation Steps

### Step 1: Update Session Configuration

- [ ] Add `secure` flag to cookie configuration in `server/index.ts`
- [ ] Ensure flag is `true` only in production (allows HTTP in development)
- [ ] Add comment explaining the security rationale

### Step 2: Verify Related Settings

- [ ] Confirm `httpOnly: true` is set (prevents XSS access to cookies)
- [ ] Confirm `sameSite: 'lax'` or `'strict'` is set (CSRF protection)
- [ ] Verify `maxAge` is appropriate (not excessively long)

### Step 3: Test Configuration

- [ ] Test in development mode (HTTP should work)
- [ ] Test in production mode simulation (verify secure flag)

## Technical Details

**Current Implementation (INSECURE):**
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    // ❌ MISSING: secure flag not set based on environment
  },
  store: new RedisStore({ client: redisClient }),
}));
```

**Fixed Implementation:**
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production', // ✅ HTTPS only in production
  },
  store: new RedisStore({ client: redisClient }),
}));
```

## Checklist

- [ ] Implementation complete
- [ ] Cookie secure flag conditional on NODE_ENV
- [ ] Development workflow still works (HTTP allowed)
- [ ] Production requires HTTPS

## Success Criteria

- [ ] Session cookie has `secure: true` when NODE_ENV=production
- [ ] Session cookie has `secure: false` (or undefined) in development
- [ ] All auth tests pass
- [ ] No TypeScript errors

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaks dev environment | Low | Low | Secure flag only in production |
| Production without HTTPS | Low | High | Document HTTPS requirement in deployment docs |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Run grep/search to confirm all claimed changes exist
  ```bash
  # Verify secure flag exists in session config
  grep -n "secure:" server/index.ts
  # Should return: Line with secure: process.env.NODE_ENV === 'production'
  ```

- [ ] **File inspection**: Manually inspect changed files to verify modifications
  ```bash
  grep -A 10 "app.use(session" server/index.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute tests for modified functionality
  ```bash
  npm test -- auth
  ```

- [ ] **Manual verification**: Test cookie in browser dev tools
  - In development: Cookie should NOT have Secure flag
  - In production: Cookie MUST have Secure flag

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors introduced
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
