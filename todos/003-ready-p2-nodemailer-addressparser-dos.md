---
status: ready
priority: p2
issue_id: "003"
tags: [security, dependencies, dos, nodemailer, email]
dependencies: []
---

# Update nodemailer to Fix addressparser DoS Vulnerability

## Problem Statement

Nodemailer versions <= 7.0.10 contain a vulnerability in the addressparser component that is susceptible to denial of service (DoS) attacks caused by recursive calls. An attacker can craft malicious email addresses that cause stack overflow or excessive recursion, potentially crashing the email service or the entire application.

## Findings

- **Vulnerability:** GHSA-rcmh-qjqh-p98v
- **CVE:** CWE-674 (Uncontrolled Recursion) / CWE-400 (Uncontrolled Resource Consumption)
- **Severity:** LOW (per npm audit, but DoS vulnerabilities should be treated seriously)
- **Affected Package:** nodemailer (direct dependency)
- **Vulnerable Versions:** <= 7.0.10
- **Fix Available:** Yes (npm audit fix)
- **Advisory URL:** https://github.com/advisories/GHSA-rcmh-qjqh-p98v

### Attack Scenario:
1. Attacker submits form with maliciously crafted email address
2. Application attempts to send email via nodemailer
3. addressparser component attempts to parse the malicious address
4. Parser enters deep recursive calls
5. Stack overflow occurs or excessive memory consumed
6. Email service fails or application crashes

### Impact Assessment:
- **Availability:** Medium risk - can disrupt email functionality
- **Confidentiality:** No impact
- **Integrity:** No impact
- **Exploitability:** Low (requires ability to trigger email sending with controlled input)

### Application Context:
Nodemailer is used in this application for:
- User registration (welcome emails)
- Password reset emails
- Price alert notifications
- System notifications

## Proposed Solutions

### Option 1: Automated Update (Recommended)
- **Action:** Run `npm audit fix` to update to nodemailer > 7.0.10
- **Pros:**
  - Automated fix available
  - Quick resolution (< 15 minutes)
  - Maintains compatibility
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Option 2: Manual Update to Latest Version
- **Action:** Manually update to nodemailer@latest (currently 6.9.x stable line)
- **Pros:** Get latest features and fixes
- **Cons:** May require testing email templates
- **Effort:** Small to Medium
- **Risk:** Low to Medium

## Recommended Action

Run `npm audit fix` to automatically update nodemailer to a patched version > 7.0.10. After update, test email sending functionality:
1. User registration emails
2. Password reset emails
3. Price alert notifications
4. Error handling for invalid email addresses

## Technical Details

- **Affected Files:**
  - `package.json` (direct dependency)
  - `package-lock.json` (will be updated automatically)
- **Related Components:**
  - `server/services/email-service.ts` - Email sending service
  - `server/services/password-reset-service.ts` - Password reset flow
  - `server/routes/auth-routes.ts` - Registration endpoint
  - `server/services/alert-service.ts` - Price alert notifications
- **Database Changes:** No
- **Breaking Changes:** None expected (patch/minor version bump)

## Resources

- Advisory: https://github.com/advisories/GHSA-rcmh-qjqh-p98v
- NPM Audit Output: Shows fix available via `npm audit fix`
- Related issues: Part of security audit issue #159
- Nodemailer docs: https://nodemailer.com/

## Acceptance Criteria

- [ ] nodemailer updated to > 7.0.10
- [ ] npm audit shows vulnerability resolved
- [ ] Registration email tested and working
- [ ] Password reset email tested and working
- [ ] Price alert notifications tested
- [ ] Invalid email address handling tested
- [ ] Email service error handling verified
- [ ] CI/CD pipeline passes

## Work Log

### 2025-12-02 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Vulnerability discovered during security audit triage (issue #159)
- Categorized as P2 IMPORTANT (despite LOW npm severity, DoS is serious)
- Estimated effort: Small (< 15 minutes)
- Fix available via npm audit fix

**Learnings:**
- Nodemailer's addressparser vulnerable to recursive DoS
- Affects critical email functionality (registration, password reset, alerts)
- Low exploitability but high impact on email service availability
- Fix available in versions > 7.0.10

## Notes

Source: Triage session on 2025-12-02 for issue #159
Status: Ready to pick up - automated fix available
Priority: P2 despite LOW severity due to DoS nature and critical email functionality
Testing required: All email sending paths should be verified after update
