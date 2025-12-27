# TODO 001: Add SSRF Protection for Webhook URLs

**Status:** archived-not-applicable
**Priority:** ~~P2 (High)~~ N/A
**Created:** 2025-12-26
**Archived:** 2025-12-26
**Tags:** security, ssrf, webhooks, false-positive

---

## ⚠️ ARCHIVED: NOT APPLICABLE

**Resolution:** This TODO was closed as "not applicable" after multi-agent code review revealed the vulnerability does not exist.

**Key Finding:** The webhook URL comes from `process.env.SLACK_WEBHOOK_URL` (environment variable), NOT user input. Environment variables are controlled by the deployment/ops team, not end users.

**Review Summary:**
- DHH Reviewer: "Security theater - defending against ghosts"
- Kieran Quality Reviewer: "False positive - no user input attack surface"
- Simplicity Reviewer: "YAGNI violation - solving non-existent problem"

**Action Taken:** Added security comment to `alert-service.ts:177` explaining why SSRF validation is not needed for environment variables.

**Future Consideration:** If user-configurable webhooks are added, reuse existing `validateWebhookUrl()` from `server/utils/url-validation.ts` (63 tests, production-grade).

---

## Original Problem Statement (False Positive)

~~The alert service fetches user-provided webhook URLs without validation~~, creating an SSRF (Server-Side Request Forgery) vulnerability. Attackers could make the server request internal services or cloud metadata endpoints.

**Reality:** Webhook URL is NOT user-provided - it's an ops-controlled environment variable.

**Why This Matters:**
- **Security Risk:** Attackers could access AWS metadata (`http://169.254.169.254/latest/meta-data/`)
- **Internal Reconnaissance:** Access to Redis (`localhost:6379`), PostgreSQL, or other internal services
- **OWASP Top 10:** A10:2021 - Server-Side Request Forgery

---

## Findings

**Source:** Security Sentinel Agent Review (2025-12-26)

**Vulnerable Code:**
```typescript
// File: server/services/alert-service.ts:212-218
const response = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

**Attack Scenarios:**
1. User sets webhook to `http://localhost:6379/` → Access Redis
2. User sets webhook to `http://169.254.169.254/latest/meta-data/` → AWS credentials
3. User sets webhook to `http://192.168.1.1/admin` → Internal network scanning

---

## Proposed Solutions

### Solution 1: URL Validation Utility (Recommended)

**Pros:**
- Reusable across codebase
- Comprehensive protection (protocol, IP ranges, DNS rebinding)
- Easy to test

**Cons:**
- Requires new utility file
- Need to maintain blocklist

**Effort:** 2-3 hours
**Risk:** Low

**Implementation:**
```typescript
// Create: server/utils/url-validator.ts
import { URL } from 'url';

export function isValidWebhookUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') return false;

    // Block private IP ranges
    const hostname = url.hostname;
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,                    // Loopback
      /^10\./,                     // Private Class A
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B
      /^192\.168\./,               // Private Class C
      /^169\.254\./,               // AWS metadata
      /^::1$/,                     // IPv6 localhost
      /^fc00:/,                    // IPv6 private
      /^fe80:/,                    // IPv6 link-local
    ];

    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Usage in alert-service.ts
import { isValidWebhookUrl } from '../utils/url-validator';

if (!isValidWebhookUrl(webhookUrl)) {
  throw new Error('Invalid webhook URL: must be HTTPS and not internal');
}
```

### Solution 2: DNS Resolution Check

**Pros:**
- Prevents DNS rebinding attacks
- Validates IP address after DNS lookup

**Cons:**
- Adds latency (DNS lookup)
- More complex implementation

**Effort:** 4-5 hours
**Risk:** Medium (async DNS operations)

### Solution 3: Use Safe Fetch Library

**Pros:**
- Battle-tested solution
- Handles edge cases

**Cons:**
- Additional dependency
- May not match exact requirements

**Effort:** 1-2 hours
**Risk:** Low

---

## Recommended Action

**Implement Solution 1** (URL Validation Utility)

**Rationale:**
- Lightweight, no dependencies
- Comprehensive protection
- Reusable for future webhook/URL features
- Easy to test and maintain

---

## Technical Details

**Affected Files:**
- `server/services/alert-service.ts` (line 212)
- New file: `server/utils/url-validator.ts`
- New test: `server/utils/__tests__/url-validator.test.ts`

**Database Changes:** None

**Migration Required:** No

---

## Acceptance Criteria

- [ ] Create `url-validator.ts` with `isValidWebhookUrl()` function
- [ ] Block HTTP protocol (HTTPS only)
- [ ] Block loopback addresses (`localhost`, `127.0.0.1`)
- [ ] Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
- [ ] Block cloud metadata endpoints (169.254.x)
- [ ] Block IPv6 private ranges
- [ ] Add comprehensive unit tests (15+ test cases)
- [ ] Integrate into `alert-service.ts:212`
- [ ] Update webhook creation endpoint to validate on input
- [ ] Document SSRF protection in `docs/04_SECURITY_PATTERNS.md`

---

## Work Log

**2025-12-26:** Issue identified during comprehensive security audit

---

## Resources

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [AWS Metadata SSRF](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-metadata.html)
- File: `server/services/alert-service.ts`
- Security Audit Report: 2025-12-26
