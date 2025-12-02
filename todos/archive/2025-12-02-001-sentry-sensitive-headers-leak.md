---
status: ready
priority: p2
issue_id: "001"
tags: [security, dependencies, information-disclosure, sentry]
dependencies: []
---

# Update @sentry/node to Fix Sensitive Headers Leak

## Problem Statement

Sentry's `@sentry/node` package (versions 10.11.0 - 10.26.0) has a vulnerability where sensitive HTTP headers are leaked when `sendDefaultPii` is set to `true`. This can expose authentication tokens, session cookies, and other sensitive information in error reports sent to Sentry.

## Findings

- **Vulnerability:** GHSA-6465-jgvq-jhgp
- **CVE:** CWE-201 (Exposure of Sensitive Information to an Unauthorized Actor)
- **Severity:** MODERATE
- **Affected Package:** @sentry/node (and transitive dependency @sentry/node-core)
- **Vulnerable Versions:** 10.11.0 - 10.26.0
- **Fix Available:** Yes (npm audit fix)
- **Advisory URL:** https://github.com/advisories/GHSA-6465-jgvq-jhgp

### Attack Scenario:
1. Application has `sendDefaultPii: true` in Sentry configuration
2. User makes authenticated request with Authorization header
3. Application throws error and sends to Sentry
4. Sentry error report includes Authorization header in plaintext
5. Anyone with Sentry dashboard access can see authentication tokens

## Proposed Solutions

### Option 1: Automated Update (Recommended)
- **Action:** Run `npm audit fix` to update to @sentry/node >= 10.27.0
- **Pros:**
  - Automated fix available
  - Quick resolution (< 15 minutes)
  - Minimal risk of breaking changes
- **Cons:** None significant
- **Effort:** Small
- **Risk:** Low

### Option 2: Manual Update
- **Action:** Manually update package.json and run npm install
- **Pros:** More control over version selection
- **Cons:** Unnecessary given automated fix is available
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Run `npm audit fix` to automatically update @sentry/node to version 10.27.0 or later. After update, verify Sentry integration still works correctly in development environment.

## Technical Details

- **Affected Files:**
  - `package.json` (direct dependency)
  - `package-lock.json` (will be updated automatically)
- **Related Components:** Error tracking, monitoring
- **Database Changes:** No
- **Breaking Changes:** None expected (patch version bump)

## Resources

- Advisory: https://github.com/advisories/GHSA-6465-jgvq-jhgp
- NPM Audit Output: Shows fix available via `npm audit fix`
- Related issues: Part of security audit issue #159

## Acceptance Criteria

- [ ] @sentry/node updated to >= 10.27.0
- [ ] @sentry/node-core updated to >= 10.27.0 (transitive)
- [ ] npm audit shows vulnerability resolved
- [ ] Sentry error tracking tested in development
- [ ] No breaking changes in Sentry integration
- [ ] CI/CD pipeline passes

## Work Log

### 2025-12-02 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Vulnerability discovered during security audit triage (issue #159)
- Categorized as P2 IMPORTANT
- Estimated effort: Small (< 15 minutes)
- Fix available via npm audit fix

**Learnings:**
- Sentry improperly leaked sensitive headers with sendDefaultPii enabled
- Fix available in 10.27.0+ versions
- Low exploitability (requires Sentry dashboard access) but high impact (credential exposure)

## Notes

Source: Triage session on 2025-12-02 for issue #159
Status: Ready to pick up - automated fix available
