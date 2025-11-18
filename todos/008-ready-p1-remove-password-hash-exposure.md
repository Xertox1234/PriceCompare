---
status: ready
priority: p1
issue_id: "008"
tags: [security, data-exposure, critical, code-review]
dependencies: []
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

- [ ] Remove passwordHash from forum-storage.ts:187
- [ ] Remove passwordHash from discourse-sso.ts:233
- [ ] Run grep audit: `grep -r "passwordHash:" server/` returns 0 unsafe results
- [ ] Test all affected endpoints - verify no hashes in responses
- [ ] Add pre-commit hook to prevent future exposures
- [ ] Update API documentation if email is also removed

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

## Notes

**SECURITY**: The project's pre-commit hook is supposed to prevent this pattern, but these instances slipped through. After fixing, strengthen the pre-commit validation.

Even though bcrypt hashes are salted and expensive to crack, exposing them violates defense-in-depth principles and creates unnecessary risk. Always use explicit field selection and never include sensitive fields.

Source: Comprehensive code audit performed on 2025-11-18
