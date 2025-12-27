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

## Proposed Solution (REVISED after parallel review)

### Atomic Transaction with Optimistic Locking (Recommended)

**Approach:** Create new atomic method `resetPassword()` that performs all steps in a single READ COMMITTED transaction, using atomic UPDATE for optimistic locking.

**Key Changes from Initial Plan:**
1. ❌ **Remove SERIALIZABLE isolation** - READ COMMITTED (default) is sufficient
2. ✅ **Combine token validation + mark used** - Single atomic UPDATE query
3. ✅ **Simplify return type** - Return userId directly, throw on error
4. ✅ **Invalidate ALL reset tokens** - Not just the one used
5. ✅ **Clear active sessions** - Force re-login after password change
6. ✅ **Pre-transaction validation** - Validate inputs before locking rows

**Implementation:**
```typescript
/**
 * Atomically reset user password and invalidate reset token.
 *
 * SECURITY: All operations are wrapped in a transaction to prevent
 * token reuse if server crashes mid-operation.
 *
 * @throws {Error} If token is invalid, expired, or already used
 * @returns User ID of the password reset owner
 */
async resetPassword(
  tokenValue: string,
  newPasswordHash: string
): Promise<number> {
  // Pre-transaction validation (avoid locking for invalid input)
  if (!newPasswordHash || newPasswordHash.length < 60) {
    throw new Error('Invalid password hash format');
  }

  return await db.transaction(async (tx) => {
    // Step 1: Atomically validate token AND mark as used (single query)
    // The WHERE clause acts as optimistic locking - if another request
    // already marked it used, this UPDATE matches zero rows
    const [token] = await tx.update(passwordResetTokens)
      .set({ isUsed: true, usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.token, tokenValue),
        eq(passwordResetTokens.isUsed, false),
        gt(passwordResetTokens.expiresAt, new Date())
      ))
      .returning();

    if (!token) {
      // Same error message for all failure modes (prevent information leakage)
      throw new Error('Invalid or expired reset token');
    }

    // Step 2: Update password
    await tx.update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date() // Audit trail
      })
      .where(eq(users.id, token.userId));

    // Step 3: Invalidate ALL other reset tokens for this user
    // Scenario: User requested reset twice, both tokens should be invalidated
    await tx.update(passwordResetTokens)
      .set({ isUsed: true })
      .where(and(
        eq(passwordResetTokens.userId, token.userId),
        eq(passwordResetTokens.isUsed, false)
      ));

    // Step 4: Invalidate all sessions (force re-login)
    // SECURITY: Attacker with stolen session cookie loses access
    await tx.delete(sessions)
      .where(eq(sessions.userId, token.userId));

    return token.userId;
  }); // Default READ COMMITTED isolation is correct
}
```

**Pros:**
- All-or-nothing guarantee (ACID)
- Prevents token reuse vulnerability via atomic UPDATE
- Simpler than SERIALIZABLE (no serialization conflicts)
- Better performance (one query instead of two for validation)
- Complete audit trail (usedAt timestamp)
- Server crash safety
- Invalidates all user tokens (prevents multi-token attack)
- Clears sessions (prevents stolen cookie attack)

**Cons:**
- None (this is the correct approach)

**Effort:** 2-3 hours (including enhanced tests)

**Risk:** Low (atomic UPDATE is standard database pattern)

**Review Consensus:**
- ✅ **DHH:** "One query instead of two... Default isolation level is fine"
- ✅ **Kieran:** "The core idea is CORRECT... implementation needs work"
- ✅ **Simplicity:** "30-40% LOC reduction possible... proceed with simplifications"

## Recommended Action

**MUST IMPLEMENT** - This is a security vulnerability.

**Priority:** P1 (Critical) - Should be fixed before next release.

**Post-Review Status:** Ready for implementation with revised approach.

## Technical Details

**Affected files:**
- `server/services/password-reset-service.ts` - Add `resetPassword()` method
- `server/routes/auth-routes.ts` - Update to call new atomic method
- `server/storage/domains/user-storage.ts` - May need session cleanup helper

**Database tables:**
- `password_reset_tokens` (token, isUsed, usedAt, expiresAt, userId)
- `users` (id, passwordHash, updatedAt)
- `sessions` (userId) - Cleared on password reset

**Transaction isolation:**
- **READ COMMITTED** (PostgreSQL default) - Sufficient for this operation
- Atomic UPDATE with WHERE clause provides optimistic locking
- No retry logic needed (no serialization conflicts)

**Database indexes required:**
- UNIQUE index on `password_reset_tokens.token` (prevent duplicate tokens)
- Index on `password_reset_tokens(userId, isUsed)` (for invalidation query)
- Index on `sessions.userId` (for session cleanup)

**Audit trail:**
- `usedAt` timestamp records when token was consumed
- `users.updatedAt` records password change timestamp
- Password change logged via existing auth logging

**Security enhancements:**
- All reset tokens for user invalidated (prevents multi-token attack)
- All sessions cleared (prevents stolen cookie attack)
- Same error message for all failure modes (prevents information leakage)
- Input validation before transaction (prevents DB locking for invalid input)

## Resources

**Documentation:**
- **Pattern:** `docs/02_DATABASE_PATTERNS.md` - Transaction Boundaries section
- **Security:** `docs/04_SECURITY_PATTERNS.md` - Auth and password reset patterns
- **Testing:** `docs/08_TESTING_PATTERNS.md` - Integration test patterns

**Code Examples:**
- **Counter-example:** `server/storage/domains/user-storage.ts:275-305` - First-user admin assignment uses SERIALIZABLE (different use case - prevents race condition on aggregate query)
- **Session management:** Check existing session cleanup patterns in auth routes

**Review Artifacts:**
- **Data Integrity Review:** 2025-12-26 findings (initial discovery)
- **Parallel Plan Review:** 2025-12-26 (DHH + Kieran + Simplicity reviewers)

## Acceptance Criteria

**Core Functionality:**
- [ ] All password reset steps wrapped in single READ COMMITTED transaction
- [ ] Token validation + mark used combined into single atomic UPDATE query
- [ ] Function returns userId directly (not wrapped in object)
- [ ] Pre-transaction input validation (passwordHash length check)
- [ ] Existing password reset functionality unchanged (backward compatible)

**Security Enhancements:**
- [ ] ALL reset tokens for user invalidated (not just the one used)
- [ ] ALL active sessions cleared on password reset
- [ ] Same error message for all failure modes (no information leakage)
- [ ] UNIQUE index exists on `password_reset_tokens.token`

**Testing:**
- [ ] Unit test: Token reuse prevented after successful reset
- [ ] Unit test: Multiple tokens invalidated when one is used
- [ ] Unit test: Sessions cleared on password reset
- [ ] Integration test: Crash simulation (rollback scenario) - CRITICAL
- [ ] Integration test: Concurrent reset attempts handled safely
- [ ] Integration test: Invalid input rejected before transaction starts

**Audit & Compliance:**
- [ ] Audit trail complete (usedAt timestamp, users.updatedAt)
- [ ] Pre-commit hooks pass
- [ ] Rate limiting exists on password reset route (verify, don't implement if missing)

## Work Log

### 2025-12-26 - Parallel Plan Review (3 Agents)

**By:** DHH Rails Reviewer + Kieran Rails Reviewer + Code Simplicity Reviewer

**Review Focus Areas:**
- **DHH:** Rails philosophy, over-engineering detection, pragmatic solutions
- **Kieran:** Code quality, security, edge cases, high standards
- **Simplicity:** YAGNI principles, minimalism, unnecessary abstractions

**Unanimous Consensus:**
- ✅ Transaction boundary is correct solution to the vulnerability
- ❌ SERIALIZABLE isolation is overkill (use default READ COMMITTED)
- ✅ Atomic UPDATE with WHERE clause provides sufficient race condition protection
- ✅ Combine token validation + mark used into single query (performance + simplicity)

**Key Improvements Identified:**

1. **Remove SERIALIZABLE** (All 3 reviewers)
   - Not a race condition problem, it's an atomicity problem
   - Default READ COMMITTED provides necessary guarantees
   - Avoids serialization conflict overhead

2. **Combine Validation + Mark Used** (All 3 reviewers)
   - Single UPDATE query instead of SELECT then UPDATE
   - WHERE clause acts as optimistic locking
   - Better performance, simpler code

3. **Invalidate ALL User Tokens** (Kieran)
   - Scenario: User requests reset twice → gets 2 tokens
   - Using token #1 should invalidate token #2
   - Prevents multi-token attack vector

4. **Clear Active Sessions** (Kieran)
   - Force re-login after password change
   - Prevents stolen session cookie attack
   - Security best practice

5. **Pre-Transaction Validation** (Kieran)
   - Validate passwordHash format before starting transaction
   - Avoid locking database rows for invalid input
   - Better error handling

6. **Additional Security Concerns** (DHH)
   - Verify UNIQUE index on token column
   - Verify rate limiting on password reset route
   - Consider audit logging for reset attempts

**Implementation Changes:**
- Function name: `resetPasswordAtomic()` → `resetPassword()` (no suffix needed)
- Return type: `{ success: boolean, userId: number }` → `number` (throw on error)
- Queries: 3 queries → 1 query for validation + 3 queries for updates
- Isolation: SERIALIZABLE → READ COMMITTED (default)
- LOC: ~30% reduction from initial plan

**Status:** Plan approved with revisions. Ready for implementation.

---

### 2025-12-26 - Initial Discovery

**By:** Data Integrity Guardian Agent (Code Review)

**Actions:**
- Analyzed password reset flow for transaction boundaries
- Identified 3-step atomic operation without transaction wrapper
- Documented attack scenario (token reuse after crash)
- Reviewed existing SERIALIZABLE transaction patterns in codebase
- Proposed initial fix using SERIALIZABLE transaction pattern

**Learnings:**
- Codebase already uses SERIALIZABLE for similar race conditions
- `retryWithBackoff()` helper available for serialization retries
- Pattern matches first-user admin assignment (user-storage.ts:275-305)
- Initial fix was straightforward but over-engineered (revealed in review)

## Notes

- **CRITICAL:** This is a P1 security vulnerability, not just code quality
- **Urgency:** Should be fixed before next release
- **Test coverage:** Must include crash/rollback scenarios (HIGHEST PRIORITY)

**Key Architectural Insight (from review):**
> Atomic UPDATE with WHERE clause provides the same race condition protection as SERIALIZABLE isolation, but with better performance. PostgreSQL's row-level locking on UPDATE already prevents concurrent modifications to the same token - SERIALIZABLE solves a problem that doesn't exist in this specific operation.

**Pattern Opportunity:**
- This "optimistic locking via UPDATE WHERE" pattern can replace many uses of SERIALIZABLE in the codebase
- Check for similar patterns in user registration, inventory management, etc.
- Guideline: Use SERIALIZABLE only when you need to prevent phantom reads in complex business logic with range queries

**Additional Security Checklist:**
- [ ] Verify UNIQUE index exists on `password_reset_tokens.token`
- [ ] Verify rate limiting exists on `/api/auth/reset-password` route
- [ ] Consider adding audit logging for password reset attempts (IP, user agent, success/failure)
- [ ] Consider constant-time token comparison (use `crypto.timingSafeEqual` if feasible)

**Testing Priority:**
1. Rollback scenario (server crash simulation) - CRITICAL
2. Token reuse prevention
3. Multi-token invalidation
4. Session cleanup
5. Concurrent reset attempts
