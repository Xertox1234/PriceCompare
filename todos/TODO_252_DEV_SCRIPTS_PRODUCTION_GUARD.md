# TODO 252: Add Production Environment Guards to Dev Scripts

**Priority**: P1 - CRITICAL (Security)
**Effort**: Small (~30 minutes)
**Category**: Security
**Source**: Code Review - Security Sentinel Agent
**Branch**: add_scraping

## Problem Statement

Developer utility scripts (`scripts/*.ts`) lack environment guards and could be accidentally executed in production, creating security vulnerabilities:

1. **create-user-dev.ts** - Creates admin user with hardcoded weak password (`password123`)
2. **reset-password-dev.ts** - Bypasses all security controls to reset any user's password
3. **clear-rate-limits.ts** - Clears ALL rate limiting keys, enabling brute-force attacks
4. **list-users-dev.ts** - Exposes user PII (emails) to console

## Risk Assessment

- **CVSS Score**: 9.0 (if executed in production)
- **Attack Vector**: Local execution (requires server access)
- **Impact**: Account takeover, security control bypass, PII exposure

## Findings

### 1. create-user-dev.ts (Lines 10-14)
```typescript
// Hardcoded credentials without environment check
const USERNAME = 'william';
const EMAIL = 'william.tower@gmail.com';
const PASSWORD = 'password123';
const ROLE = 'admin';
```

### 2. reset-password-dev.ts (Lines 12-13)
```typescript
// Direct password reset bypassing all security
const EMAIL = 'william.tower@gmail.com';
const NEW_PASSWORD = 'password123';
```

### 3. clear-rate-limits.ts (Line 8)
```typescript
// Clears rate limits for ALL users including attackers
const redis = new Redis(process.env.REDIS_URL!);
```

### 4. list-users-dev.ts (Lines 8-31)
```typescript
// Exposes PII without environment guard
// Lists IDs, usernames, emails, roles
```

## Proposed Solution

Add environment guard at the top of each script:

```typescript
// Add as first lines of each script
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: This script cannot run in production');
  console.error('   Set NODE_ENV to "development" or "test" to proceed');
  process.exit(1);
}
```

### Additional Improvements

1. Remove hardcoded credentials - use command-line arguments or prompts
2. Remove real email addresses from scripts
3. Add confirmation prompts for destructive operations
4. Ensure scripts directory is excluded from production builds

## Acceptance Criteria

- [ ] All 4 dev scripts have `NODE_ENV` check at the top
- [ ] Scripts exit with error if `NODE_ENV === 'production'`
- [ ] Hardcoded email addresses removed or anonymized
- [ ] Scripts use command-line arguments for sensitive values
- [ ] Verify scripts are excluded from production Docker image

## Files to Modify

- `scripts/create-user-dev.ts`
- `scripts/reset-password-dev.ts`
- `scripts/clear-rate-limits.ts`
- `scripts/list-users-dev.ts`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - security sentinel agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Security review finding: Dev scripts missing environment protection
- OWASP: Insecure Direct Object References
