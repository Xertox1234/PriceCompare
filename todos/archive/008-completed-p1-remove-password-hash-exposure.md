---
status: completed
priority: p1
issue_id: "008"
tags: [security, data-exposure, critical, code-review]
dependencies: []
completed_at: 2025-11-18
github_issue: 57
github_pr: 58
---

# Remove Password Hash Exposure from API Responses

## Problem Statement

**CRITICAL SECURITY ISSUE**: Password hashes (bcrypt) are being exposed in API responses in at least 2 locations. While bcrypt hashes are salted, exposing them enables offline brute-force attacks, violates principle of least privilege, and creates compliance risks (GDPR, PCI-DSS).

**CVSS Score: 8.1 (High/Critical)**

## Findings

Discovered during comprehensive code audit by security-sentinel agent on 2025-11-18.

**Exposed Locations:**

1. **`/server/forum-storage.ts:187`** - Forum post author query:
```typescript
author: {
  id: users.id,
  username: users.username,
  email: users.email,
  passwordHash: users.passwordHash,  // ❌ EXPOSED
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}
```

2. **`/server/discourse-sso.ts:233`** - Discourse SSO user query:
```typescript
passwordHash: sharedUsers.passwordHash,  // ❌ EXPOSED
```

**Attack Scenario:**
```bash
# Attacker requests forum post
GET /api/forum/topics/1

# Response includes:
{
  "author": {
    "username": "admin",
    "passwordHash": "$2b$12$Hn8z...ABC123"  # ❌ Exposed
  }
}

# Attacker extracts hashes and runs offline attack
hashcat -m 3200 hashes.txt wordlist.txt
# If weak passwords exist, attacker gains access
```

**Impact:**
- Offline brute-force attacks against user passwords
- Credential stuffing if hashes are cracked
- GDPR Article 32 violation (inadequate data protection)
- Compliance violations (PCI-DSS, SOC 2)

## Proposed Solutions

### Option 1: Remove passwordHash from SELECT Queries (Recommended)

**Pros:**
- Simple fix - delete the field
- No risk of re-exposure
- Follows principle of least privilege
- Quick to implement

**Cons:** None

**Effort:** Small (1 hour)

**Risk:** Low

**Implementation:**

```typescript
// Fix for forum-storage.ts:187
author: {
  id: users.id,
  username: users.username,
  // SECURITY: Never expose passwordHash
  // email: users.email,  // Also consider removing email from public APIs
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
}

// Fix for discourse-sso.ts:233
// Remove passwordHash entirely from the SELECT
// Only select fields needed for SSO (id, username, email)
```

### Option 2: Add Runtime Sanitization (Defense in Depth)

**Pros:**
- Catches accidental exposures
- Additional layer of security

**Cons:**
- Performance overhead
- Doesn't fix root cause

**Effort:** Medium (add middleware to strip sensitive fields)

## Recommended Action

**IMMEDIATE FIX REQUIRED**

1. Remove `passwordHash` from both SELECT queries
2. Audit ALL queries for passwordHash exposure:
   ```bash
   grep -r "passwordHash:" server/ --include="*.ts" | grep -v "SECURITY:"
   ```
3. Add pre-commit hook to block passwordHash in SELECT queries
4. Review API responses to ensure no hashes are returned

## Technical Details

**Affected Files:**
- `/server/forum-storage.ts` (Line 187)
- `/server/discourse-sso.ts` (Line 233)

**Related Components:**
- Forum post retrieval
- Discourse SSO integration
- User profile endpoints

**Database Changes:** None (code-only fix)

## Resources

- OWASP: Password Storage Cheat Sheet
- GDPR Article 32: Security of processing
- Pre-commit hook: Check for passwordHash in queries

## Acceptance Criteria

- [x] Remove passwordHash from forum-storage.ts:187
- [x] Remove passwordHash from discourse-sso.ts:233
- [x] Run grep audit: `grep -r "passwordHash:" server/` returns 0 unsafe results
- [x] Test all affected endpoints - verify no hashes in responses
- [x] Add pre-commit hook to prevent future exposures
- [ ] Update API documentation if email is also removed (not needed - email not removed)

## Work Log

### 2025-11-18 - Security Audit Discovery
**By:** Claude Code Review System (security-sentinel agent)
**Actions:**
- Discovered password hash exposure in 2 locations
- Analyzed compliance implications (GDPR, PCI-DSS)
- Categorized as P1 CRITICAL

**Learnings:**
- Never include passwordHash in SELECT queries
- Apply principle of least privilege - only return needed fields
- Email addresses may also be sensitive (consider removing from public APIs)

### 2025-11-18 - Implementation Complete
**By:** Claude Code
**Actions:**
- Created GitHub issue #57 to track the work
- Set up worktree for isolated development
- Audited codebase for all passwordHash exposures
- Fixed passwordHash exposure in forum-storage.ts:187
- Fixed passwordHash exposure in discourse-sso.ts:233,259
- Verified no unsafe passwordHash exposures remain
- Strengthened pre-commit hook with enhanced detection
- Committed changes with detailed security fix message
- Created pull request #58 for review

**Results:**
- ✅ All 2 critical passwordHash exposures removed
- ✅ Grep audit confirms 0 unsafe exposures remain
- ✅ Pre-commit hook strengthened to prevent future occurrences
- ✅ Pull request ready for review and merge

**Technical Notes:**
- Used empty string for passwordHash in discourse-sso.ts to satisfy type requirements
- Added explicit "SECURITY: Never expose passwordHash" comments
- Only INSERT/UPDATE operations reference passwordHash (safe operations)
- Pre-existing TypeScript errors not introduced by these changes

### 2025-11-18 - Additional auth.ts Fixes (Code Review Follow-up)
**By:** Claude Code
**Actions:**
- Code review specialist identified additional exposures in auth.ts
- Fixed passport strategy (line 50) - Uses explicit field selection with passwordHash only for bcrypt verification
- Fixed deserializeUser (line 89) - Excludes passwordHash from req.user serialization
- Fixed findUserByEmail (line 115) - Returns SafeUser type without passwordHash
- Fixed findUserById (line 120) - Returns SafeUser type without passwordHash
- Created SafeUser type = Omit<User, 'passwordHash'>
- Updated Express.User declaration to use SafeUser
- Fixed createUser() - Returns SafeUser, explicitly extracts safe fields from INSERT...RETURNING
- Removed conflicting Express.User type declaration in routes/helpers.ts
- Committed auth.ts fixes (commit fdf7956)
- Committed final fixes (commit 82a3103)
- Pushed all changes to add_scraping branch

**Results:**
- ✅ 100% password hash exposure remediation complete
- ✅ 0 bare .select() calls exposing passwordHash
- ✅ SafeUser type enforced throughout application
- ✅ 5+ security comments documenting exclusions
- ✅ Zero TypeScript errors in modified files
- ✅ Pre-commit hooks passing

**Technical Notes:**
- SafeUser type provides type-safe guarantee that req.user never contains passwordHash
- Passport strategy correctly maintains passwordHash for bcrypt.compare() verification only
- createUser() now returns SafeUser to prevent passwordHash from appearing in route handlers
- Type conflict in routes/helpers.ts resolved by removing duplicate Express.User declaration

**Commits:**
- ad59f87 - Merge PR #58 (forum & discourse fixes)
- fdf7956 - Fix auth.ts SELECT queries and type safety
- 82a3103 - Fix createUser() and type conflicts (final fix)

## Notes

**SECURITY**: The project's pre-commit hook is supposed to prevent this pattern, but these instances slipped through. After fixing, strengthen the pre-commit validation.

Even though bcrypt hashes are salted and expensive to crack, exposing them violates defense-in-depth principles and creates unnecessary risk. Always use explicit field selection and never include sensitive fields.

Source: Comprehensive code audit performed on 2025-11-18
