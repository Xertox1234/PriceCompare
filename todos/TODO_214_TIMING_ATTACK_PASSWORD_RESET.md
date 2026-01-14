# TODO 214: Timing Attack in Password Reset

**Priority**: P2 - MEDIUM
**File(s)**: `server/services/password-reset-service.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Password reset response time varies based on whether an email exists in the system, enabling account enumeration:

- **Email exists**: Response takes ~500ms (database lookup + token generation + email send)
- **Email doesn't exist**: Response takes ~10ms (immediate return)

Attackers can determine which emails are registered by measuring response times.

**Security Impact**: User enumeration enables targeted phishing, credential stuffing, and privacy violations.

## Root Cause

The password reset function returns immediately when user is not found, while performing additional operations (token generation, email sending) when user exists.

## Solution Approach

1. Always perform similar operations regardless of user existence
2. Add random delay for non-existent users to match typical response time
3. Return identical responses for both cases

## Implementation Steps

### Step 1: Normalize Response Times

- [ ] Add simulated delay for non-existent users
- [ ] Ensure delay matches typical email-found response time
- [ ] Add randomization to prevent statistical analysis

### Step 2: Normalize Response Content

- [ ] Return identical success response regardless of user existence
- [ ] Never reveal whether email was found
- [ ] Log internally for debugging without exposing to client

### Step 3: Add Tests

- [ ] Test response times are similar for existing/non-existing emails
- [ ] Test response content is identical
- [ ] Test random delay varies appropriately

## Technical Details

**Current Implementation (VULNERABLE):**
```typescript
export async function sendResetEmail(email: string): Promise<void> {
  const user = await storage.getUserByEmail(email);
  
  if (!user) {
    return; // ❌ Returns immediately - timing reveals email exists
  }
  
  const token = generateToken();
  await storage.saveResetToken(user.id, token);
  await emailService.sendResetEmail(email, token); // ❌ Only if user exists
}
```

**Fixed Implementation:**
```typescript
import { randomInt } from 'crypto';

// Typical time for full password reset flow (ms)
const TYPICAL_RESET_TIME_MIN = 200;
const TYPICAL_RESET_TIME_MAX = 600;

export async function sendResetEmail(email: string): Promise<void> {
  const startTime = Date.now();
  const user = await storage.getUserByEmail(email);
  
  // Always generate a token (prevents timing from token generation)
  const token = generateToken();
  
  if (user) {
    // User exists - save token and send email
    await storage.saveResetToken(user.id, token);
    await emailService.sendResetEmail(email, token);
  } else {
    // User doesn't exist - simulate similar delay
    // This prevents timing-based email enumeration
    const elapsedTime = Date.now() - startTime;
    const targetTime = randomInt(TYPICAL_RESET_TIME_MIN, TYPICAL_RESET_TIME_MAX);
    const remainingDelay = Math.max(0, targetTime - elapsedTime);
    
    await sleep(remainingDelay);
    
    // Log internally for debugging (not exposed to client)
    console.debug(`Password reset attempted for non-existent email: ${maskEmail(email)}`);
  }
  
  // ✅ Always return the same - never reveal user existence
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.charAt(0)}***@${domain}`;
}
```

**Alternative: Use Constant-Time Approach**
```typescript
export async function sendResetEmail(email: string): Promise<void> {
  // Start all operations in parallel
  const [user, token] = await Promise.all([
    storage.getUserByEmail(email),
    Promise.resolve(generateToken()),
  ]);
  
  // Use Promise.allSettled to ensure both branches take similar time
  await Promise.allSettled([
    // Only actually save/send if user exists
    user ? storage.saveResetToken(user.id, token) : sleep(50),
    user ? emailService.sendResetEmail(email, token) : sleep(200),
  ]);
  
  // Same response regardless of outcome
}
```

## Checklist

- [ ] Response times normalized for existing/non-existing emails
- [ ] Response content identical for both cases
- [ ] Random delay prevents statistical analysis
- [ ] Internal logging for debugging (masked email)
- [ ] Tests verify timing normalization

## Success Criteria

- [ ] Response times for existing emails: ~200-600ms
- [ ] Response times for non-existing emails: ~200-600ms
- [ ] Statistical analysis cannot distinguish response times
- [ ] API response identical for both cases
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Increased latency for non-users | Certain | Low | Acceptable tradeoff for security |
| Delay not matching real operation | Medium | Low | Calibrate based on actual metrics |
| Statistical bypass | Low | Medium | Add sufficient randomization |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm timing normalization exists
  ```bash
  # Verify delay/sleep is used for non-existent users
  grep -n "sleep\|setTimeout\|delay" server/services/password-reset-service.ts
  
  # Verify early return is removed
  grep -A 3 "if (!user)" server/services/password-reset-service.ts
  # Should NOT have immediate return
  ```

- [ ] **File inspection**: Review password reset flow
  ```bash
  cat server/services/password-reset-service.ts
  ```

### Testing
- [ ] **Run affected tests**: Execute password reset tests
  ```bash
  npm test -- password-reset
  ```

- [ ] **Manual timing test**:
  ```bash
  # Test with existing email
  time curl -X POST http://localhost:5000/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"existing@example.com"}'
  
  # Test with non-existing email
  time curl -X POST http://localhost:5000/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email":"nonexistent@example.com"}'
  
  # Both should take similar time (200-600ms)
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
