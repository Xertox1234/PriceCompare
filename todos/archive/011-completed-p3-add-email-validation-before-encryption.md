---
status: completed
priority: p3
issue_id: "011"
tags: [data-quality, validation, security]
dependencies: []
completed_date: 2025-12-26
resolution: already_implemented
---

# Add Email Validation Before Encryption

## Problem Statement

Email addresses are encrypted and stored in the database without format validation in the registration route. Invalid emails are only discovered when attempting to send password reset or notification emails, resulting in bounces and poor user experience. GDPR requires valid contact information.

**Impact:** MEDIUM - Data quality issue with UX and compliance implications.

## Findings

**From Data Integrity Review (2025-12-26):**

**Affected file:** `server/routes/auth-routes.ts:118-122`

**Current implementation:**
```typescript
// ❌ MISSING: Email format validation before encryption
const { user, isFirstUser } = await storage.createUserWithTransaction(
  username,
  email,  // No validation that this is a valid email format!
  passwordHash
);
```

**Risk scenarios:**
1. User typos email during registration (missing @, .com, etc.)
2. Email stored encrypted in database
3. User cannot receive password reset emails (bounce)
4. User cannot receive price alerts or notifications
5. Support team cannot contact user
6. GDPR compliance: Invalid contact information stored

**Existing validation:**
- Zod schema in `shared/schema.ts` likely has email validation
- BUT: Validation may not run before encryption in route handler
- Email stored as `emailHash` (encrypted) - cannot validate post-storage

## Proposed Solutions

### Option 1: Add Pre-Encryption Email Validation (Recommended)

**Approach:** Validate email format before calling storage layer.

**Implementation:**
```typescript
// server/routes/auth-routes.ts
app.post('/api/auth/register', csrfProtection, async (req, res) => {
  try {
    // Parse and validate with Zod schema (includes email format)
    const { username, email, password } = registerSchema.parse(req.body);

    // Additional explicit email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 'Invalid email format', 400);
    }

    // Email is guaranteed valid at this point
    const passwordHash = await hashPassword(password);
    const { user, isFirstUser } = await storage.createUserWithTransaction(
      username,
      email, // Now validated
      passwordHash
    );

    sendSuccess(res, { user, isFirstUser }, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'UserRegistration');
  }
});
```

**Pros:**
- Prevents invalid emails from being stored
- Catches typos at registration time
- Better user experience (immediate feedback)
- GDPR compliance (valid contact info)
- Simple regex validation

**Cons:**
- None (should already be doing this)

**Effort:** 30 minutes

**Risk:** Very Low

---

### Option 2: Verify Email with Confirmation

**Approach:** Send confirmation email, only activate account after click.

**Pros:**
- Validates email deliverability (not just format)
- Industry standard practice
- Prevents spam registrations

**Cons:**
- Larger feature (email verification system)
- More complex UX flow
- Requires email infrastructure
- Separate from format validation

**Effort:** 4-8 hours

**Risk:** Low (standard pattern)

---

### Option 3: Use Email Validation Service

**Approach:** Call external API (like ZeroBounce, Hunter.io) to validate.

**Pros:**
- Validates deliverability, not just format
- Catches disposable emails
- Detects typos in domain names

**Cons:**
- External dependency
- API cost per validation
- Privacy concerns (sending emails to 3rd party)
- Overkill for format validation

**Effort:** 2-3 hours

**Risk:** Medium (external dependency)

## Recommended Action

**IMPLEMENT Option 1** (pre-encryption validation) immediately. Consider Option 2 (email verification) as separate feature.

## Technical Details

**Affected files:**
- `server/routes/auth-routes.ts` - Add validation before encryption
- `shared/schema.ts` - Verify Zod schema includes email validation
- Tests: `server/routes/__tests__/auth-routes.test.ts`

**Email validation regex:**
```typescript
// RFC 5322 simplified (covers 99% of valid emails)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// More comprehensive (optional):
const strictEmailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
```

**Zod schema validation:**
```typescript
// shared/schema.ts (verify this exists)
export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email('Invalid email address'), // ✅ Zod validates format
  password: z.string().min(8),
});
```

**Integration:**
```typescript
// Zod .parse() throws if email invalid
// Explicit regex check adds defense-in-depth
const { email } = registerSchema.parse(req.body); // Validated by Zod
if (!emailRegex.test(email)) {
  // Extra safety check (should never hit if Zod schema correct)
  return sendError(res, 'Invalid email format', 400);
}
```

## Resources

- **Data Integrity Review:** 2025-12-26 findings
- **Zod docs:** https://zod.dev/ (email validation)
- **RFC 5322:** Email address specification
- **GDPR:** Requires accurate personal data

## Acceptance Criteria

- [ ] Email format validated before encryption in registration route
- [ ] Invalid email format returns 400 error with clear message
- [ ] Zod schema email validation confirmed working
- [ ] Explicit regex check added as defense-in-depth
- [ ] Unit test: Invalid email formats rejected
  - Missing @
  - Missing domain
  - Multiple @ signs
  - Spaces in email
  - Missing TLD (.com, etc.)
- [ ] Integration test: Valid emails accepted
- [ ] Existing user registration flow unchanged for valid emails
- [ ] Pre-commit hooks pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Data Integrity Guardian Agent (Code Review)

**Actions:**
- Analyzed user registration route for validation gaps
- Identified email validation missing before encryption
- Documented GDPR compliance risk
- Proposed simple regex validation solution
- Verified Zod schema likely has email validation (needs confirmation)

**Learnings:**
- Email encrypted as `emailHash` (cannot validate post-storage)
- Zod schema parse likely validates, but not explicitly checked
- Simple regex provides defense-in-depth
- GDPR requires valid contact information
- Password reset/notifications depend on valid email

## Notes

- **Priority P3 (Nice-to-have)** - Data quality, not critical bug
- **Quick fix:** 30 minutes, high value
- **Defense-in-depth:** Even if Zod validates, explicit check is good practice
- **User experience:** Better to reject at registration than at password reset
- **Follow-up:** Consider email verification (Option 2) as separate feature
- Verify Zod schema actually includes `.email()` validation
