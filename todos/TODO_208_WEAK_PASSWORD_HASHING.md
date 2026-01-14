# TODO 208: Fix Weak Password Hashing (bcrypt rounds = 1)

**Priority**: P0 - CRITICAL
**File(s)**: `server/auth/auth-utils.ts`
**Estimated Time**: 1 hour (includes migration strategy)
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Password hashing uses only 1 bcrypt round, making hashes trivially crackable. Industry standard is minimum 10-12 rounds. A single GPU can crack 1-round bcrypt hashes in seconds, whereas 12-round hashes take years.

**Security Impact**: If database is compromised, all user passwords can be recovered almost instantly.

## Root Cause

Likely a development/testing optimization that was never updated for production.

## Solution Approach

1. Increase bcrypt rounds to 12 (industry standard)
2. Implement password rehashing on next login for existing users
3. Consider forced password reset for security-critical deployment

## Implementation Steps

### Step 1: Update bcrypt Configuration

- [ ] Change `bcrypt.genSalt(1)` to `bcrypt.genSalt(12)` in `server/auth/auth-utils.ts`
- [ ] Add constant `BCRYPT_ROUNDS = 12` for configurability
- [ ] Add comment explaining the security rationale

### Step 2: Implement Transparent Rehashing

- [ ] On successful login, check if hash needs upgrade (compare rounds)
- [ ] If hash is weak, rehash password with new rounds
- [ ] Update user record with new hash

### Step 3: Update Tests

- [ ] Update any tests that verify password hashing
- [ ] Add test verifying bcrypt rounds >= 10

## Technical Details

**Current Implementation (INSECURE):**
```typescript
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(1); // ❌ CRITICAL: Only 1 round!
  return bcrypt.hash(password, salt);
}
```

**Fixed Implementation:**
```typescript
const BCRYPT_ROUNDS = 12; // Industry standard: 10-12 rounds

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
}

// Check if password hash needs upgrade
export function hashNeedsUpgrade(hash: string): boolean {
  const rounds = bcrypt.getRounds(hash);
  return rounds < BCRYPT_ROUNDS;
}

// Rehash password with current rounds
export async function upgradePasswordHash(password: string): Promise<string> {
  return hashPassword(password);
}
```

**Login flow with rehashing:**
```typescript
// In login handler after successful password verification
if (hashNeedsUpgrade(user.passwordHash)) {
  const newHash = await upgradePasswordHash(password);
  await storage.updateUserPassword(user.id, newHash);
}
```

## Checklist

- [ ] Implementation complete
- [ ] Tests written/updated
- [ ] Existing user migration strategy documented
- [ ] No performance regression (12 rounds adds ~250ms to login)

## Success Criteria

- [ ] `bcrypt.genSalt()` called with rounds >= 10
- [ ] New user passwords hashed with 12 rounds
- [ ] Existing users transparently upgraded on next login
- [ ] All auth tests pass
- [ ] No TypeScript errors

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Login latency increase | Certain | Low | 12 rounds adds ~250ms, acceptable for auth |
| Existing passwords not upgraded | Medium | High | Implement transparent rehashing on login |
| Test failures due to timing | Low | Low | Adjust test timeouts if needed |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Run grep/search to confirm all claimed changes exist
  ```bash
  # Verify bcrypt rounds constant exists
  grep -n "BCRYPT_ROUNDS" server/auth/auth-utils.ts
  # Should return: Line with BCRYPT_ROUNDS = 12

  # Verify old pattern is gone
  grep -n "genSalt(1)" server/
  # Should return: No matches found
  ```

- [ ] **File inspection**: Manually inspect changed files to verify modifications
  ```bash
  cat server/auth/auth-utils.ts | grep -A 3 "genSalt"
  ```

### Testing
- [ ] **Run affected tests**: Execute tests for modified functionality
  ```bash
  npm test -- auth
  ```

- [ ] **Verify test results**: Confirm expected number of tests pass

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors introduced
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

### Security Verification
- [ ] **Verify bcrypt rounds**: New hashes use 12 rounds
  ```bash
  # Test by creating a new hash and checking rounds
  node -e "const bcrypt = require('bcrypt'); bcrypt.hash('test', 12).then(h => console.log('Rounds:', bcrypt.getRounds(h)))"
  # Should output: Rounds: 12
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
