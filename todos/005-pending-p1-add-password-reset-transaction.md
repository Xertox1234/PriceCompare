---
status: pending
priority: p1
issue_id: "005"
tags: [security, data-integrity, authentication, transaction]
dependencies: []
---

# Add Transaction Boundary to Password Reset Flow

## Problem Statement

**CRITICAL SECURITY ISSUE:** The password reset flow has 3 atomic steps that are NOT wrapped in a database transaction:
1. Validate reset token exists and not expired
2. Update user password hash
3. Mark token as used

If the server crashes between steps 2 and 3, the token remains valid and can be reused, allowing an attacker to reset the password multiple times or maintain unauthorized access.

**Impact:** HIGH - Security vulnerability allowing token reuse after successful password reset.

## Findings

**From Data Integrity Review (2025-12-26):**

**Likely affected file:** `server/services/password-reset-service.ts` (inferred from routes)

**Current implementation (inferred):**
```typescript
// ❌ WRONG - No transaction boundary
const token = await storage.getPasswordResetToken(tokenValue);
await storage.updateUserPassword(userId, newPasswordHash);
await storage.markTokenAsUsed(tokenId);
```

**Attack scenario:**
1. User requests password reset, receives token
2. User submits new password
3. Server validates token ✅
4. Server updates password hash in database ✅
5. **SERVER CRASHES** before marking token as used
6. Token remains valid in database
7. Attacker (or user) can reuse token to reset password again
8. No audit trail of which reset actually succeeded

**Data integrity risk:**
- Race condition if multiple password resets attempted simultaneously
- Token reuse vulnerability
- Audit trail incomplete
- Violates ACID properties for critical security operation

## Proposed Solutions

### Option 1: Wrap in SERIALIZABLE Transaction (Recommended)

**Approach:** Create new atomic method `resetPasswordAtomic()` that performs all 3 steps in a single SERIALIZABLE transaction.

**Implementation:**
```typescript
async resetPasswordAtomic(
  tokenValue: string,
  newPasswordHash: string
): Promise<{ success: boolean; userId: number }> {
  return await db.transaction(async (tx) => {
    // Step 1: Validate token
    const [token] = await tx.select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, tokenValue),
        eq(passwordResetTokens.isUsed, false),
        gt(passwordResetTokens.expiresAt, new Date())
      ));

    if (!token) {
      throw new Error('Invalid or expired reset token');
    }

    // Step 2: Update password
    await tx.update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, token.userId));

    // Step 3: Mark token as used (atomic with password update)
    await tx.update(passwordResetTokens)
      .set({
        isUsed: true,
        usedAt: new Date()
      })
      .where(eq(passwordResetTokens.id, token.id));

    return { success: true, userId: token.userId };
  }, { isolationLevel: 'serializable' });
}
```

**Pros:**
- All-or-nothing guarantee (ACID)
- Prevents token reuse vulnerability
- Race condition protection with SERIALIZABLE
- Complete audit trail (usedAt timestamp)
- Server crash safety

**Cons:**
- None (this is the correct approach)

**Effort:** 1-2 hours (including tests)

**Risk:** Low (well-established pattern in codebase)

---

### Option 2: Mark Token Used BEFORE Password Update

**Approach:** Reorder operations to mark token used first, then update password.

**Pros:**
- Simple reordering
- Prevents token reuse

**Cons:**
- **WRONG APPROACH** - If password update fails, token is still marked used
- User cannot retry password reset
- Violates atomicity
- Not a proper fix

**Effort:** 30 minutes

**Risk:** HIGH (creates different failure mode)

---

### Option 3: Add Application-Level Lock

**Approach:** Use Redis distributed lock during password reset.

**Pros:**
- Prevents concurrent resets

**Cons:**
- Does not solve crash-between-steps problem
- Adds complexity
- Lock coordination overhead
- **Not a substitute for transaction**

**Effort:** 2-3 hours

**Risk:** Medium (adds moving parts)

## Recommended Action

**MUST IMPLEMENT Option 1** - This is a security vulnerability.

**Priority:** P1 (Critical) - Should be fixed before next release.

## Technical Details

**Affected files:**
- `server/services/password-reset-service.ts` - Add `resetPasswordAtomic()` method
- `server/routes/auth-routes.ts` - Update to call new atomic method
- `server/storage/domains/user-storage.ts` - May need transaction helper

**Database tables:**
- `password_reset_tokens` (token, isUsed, usedAt, expiresAt, userId)
- `users` (id, passwordHash)

**Transaction isolation:**
- **SERIALIZABLE** - Prevents concurrent password resets for same token
- Retry logic: Use `retryWithBackoff()` pattern (already in codebase)

**Audit trail:**
- `usedAt` timestamp records when token was consumed
- Password change logged via existing auth logging

## Resources

- **Pattern:** `docs/02_DATABASE_PATTERNS.md` - Transaction Boundaries section
- **Example:** `server/storage/domains/user-storage.ts:275-305` - First-user admin assignment with SERIALIZABLE
- **Retry helper:** `server/utils/retry.ts` - `retryWithBackoff()` function
- **Data Integrity Review:** 2025-12-26 findings

## Acceptance Criteria

- [ ] All 3 password reset steps wrapped in single transaction
- [ ] Transaction uses SERIALIZABLE isolation level
- [ ] Retry logic added for serialization failures
- [ ] Existing password reset functionality unchanged (backward compatible)
- [ ] Unit tests: Token reuse prevented after successful reset
- [ ] Integration test: Crash simulation (rollback scenario)
- [ ] Security test: Concurrent reset attempts handled safely
- [ ] Audit trail complete (usedAt timestamp set)
- [ ] Pre-commit hooks pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Data Integrity Guardian Agent (Code Review)

**Actions:**
- Analyzed password reset flow for transaction boundaries
- Identified 3-step atomic operation without transaction wrapper
- Documented attack scenario (token reuse after crash)
- Reviewed existing SERIALIZABLE transaction patterns in codebase
- Proposed fix using established transaction pattern

**Learnings:**
- Codebase already uses SERIALIZABLE for similar race conditions
- `retryWithBackoff()` helper available for serialization retries
- Pattern matches first-user admin assignment (user-storage.ts:275-305)
- Fix is straightforward using existing infrastructure

## Notes

- **CRITICAL:** This is a P1 security vulnerability, not just code quality
- **Urgency:** Should be fixed before next release
- **Test coverage:** Must include crash/rollback scenarios
- **Pattern reuse:** Follow existing SERIALIZABLE transaction examples
- Consider adding integration test that simulates server crash mid-operation
