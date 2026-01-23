# TODO 255: Fix XSS Vulnerability in ProfileHeader Website URL

**Priority**: P1 - CRITICAL (Security)
**Effort**: Small (~10 minutes)
**Category**: Security
**Source**: Code Review - Security Sentinel Agent
**Branch**: add_scraping

## Problem Statement

The ProfileHeader component renders user-provided website URLs as clickable links without using the existing `sanitizeUrl` utility. This creates a potential XSS vector.

## Risk Assessment

- **CVSS Score**: 6.1 (Medium)
- **Attack Vector**: User-provided profile data
- **Impact**: XSS, session hijacking, malicious redirects

## Findings

### Vulnerable Code (ProfileHeader.tsx:115-129)
```typescript
{user.website && (
  <a
    href={
      user.website.startsWith('http')
        ? user.website
        : `https://${user.website}`
    }
    target="_blank"
    rel="noopener noreferrer"
    ...
  >
```

### Attack Scenario
A user could set their website to `javascript:alert(document.cookie)` which would be prepended with `https://` but could still be exploited through URL encoding or other bypass techniques.

### Existing Utility Available
The codebase already has a `sanitizeUrl` function at `client/src/utils/sanitize.ts` (lines 128-150) that properly blocks:
- `javascript:` protocol
- `data:` protocol
- `vbscript:` protocol
- `file:` protocol

## Proposed Solution

```typescript
// In ProfileHeader.tsx
import { sanitizeUrl } from '@/utils/sanitize';

// Replace the href logic:
{user.website && (
  <a
    href={sanitizeUrl(user.website) || '#'}
    target="_blank"
    rel="noopener noreferrer"
    ...
  >
```

Also apply to avatar URL (lines 77-79):
```typescript
{user.avatarUrl ? (
  <AvatarImage src={sanitizeUrl(user.avatarUrl) || ''} alt={user.username} />
) : null}
```

## Acceptance Criteria

- [ ] Import `sanitizeUrl` from `@/utils/sanitize`
- [ ] Apply to `user.website` href
- [ ] Apply to `user.avatarUrl` src
- [ ] Fallback gracefully if URL is blocked (href="#" or empty src)
- [ ] Test with malicious URLs: `javascript:alert(1)`, `data:text/html,...`

## Files to Modify

- `client/src/components/profile/ProfileHeader.tsx`

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - security sentinel agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Sanitize utility: `client/src/utils/sanitize.ts`
- OWASP XSS Prevention Cheat Sheet
