# Security Audit Report

**Date:** 2025-11-11
**Auditor:** Claude Code  
**Project:** PriceCompare
**Commit:** 8fabd85

---

## Executive Summary

This comprehensive security audit identified **23 issues** across the codebase, ranging from critical security vulnerabilities to code quality concerns. The application has good security foundations with proper authentication, rate limiting, and input sanitization, but several high-priority issues need immediate attention.

### Summary of Findings

- **Critical:** 3 issues
- **High:** 6 issues
- **Medium:** 8 issues
- **Low:** 6 issues

---

## Critical Issues (Priority 1)

### 1. Missing Authentication on Public Discourse Webhook Endpoint

**File:** `server/discourse-routes.ts:112`
**Severity:** Critical
**CWE:** CWE-306 (Missing Authentication for Critical Function)

**Issue:**
The `/discourse/webhook` endpoint accepts POST requests without any authentication or signature verification.

**Impact:** An attacker could send fake webhook events to manipulate application state.

**Recommendation:** Add webhook signature verification using HMAC.

---

### 2. Slug Generation Vulnerable to Collision Attacks

**File:** `server/forum-storage.ts:142`
**Severity:** Critical
**CWE:** CWE-330 (Use of Insufficiently Random Values)

**Issue:**
Topic slugs are generated without uniqueness checks, allowing collisions and overwrites.

**Impact:** Duplicate slugs can overwrite existing topics or cause database constraint violations.

**Recommendation:** Check for existing slugs and append random suffix if needed.

---

### 3. Password Hash Exposure in Forum Queries

**File:** `server/forum-storage.ts:64,113`  
**Severity:** Critical
**CWE:** CWE-200 (Exposure of Sensitive Information)

**Issue:**
User password hashes are selected and returned in forum topic queries.

**Impact:** Password hashes could be exposed through API responses, enabling offline cracking attacks.

**Recommendation:** Remove `passwordHash` from all SELECT queries that return user data.

---

## High Severity Issues (Priority 2)

### 4. Inconsistent Authorization Checks

**File:** `server/advanced-search-routes.ts:290-294,312-315`
**Severity:** High
**CWE:** CWE-863 (Incorrect Authorization)

**Issue:** Manual role checks instead of using the existing `requireAdmin` middleware.

**Recommendation:** Use `requireAdmin` middleware consistently on all admin endpoints.

---

### 5. Type Safety Violations with Session Data

**File:** `server/advanced-search-routes.ts:30,146,212`
**Severity:** High  
**CWE:** CWE-843 (Access of Resource Using Incompatible Type)

**Issue:** Session data is accessed with `any` type casting: `(req.session as any)?.userId`

**Recommendation:** Properly extend Express session types using module augmentation.

---

### 6. Missing Input Validation on Query Parameters

**File:** `server/scraping-routes.ts:121,173,254`
**Severity:** High
**CWE:** CWE-20 (Improper Input Validation)

**Issue:** Query parameters are used without validation in multiple endpoints.

**Recommendation:** Apply Zod validation schemas to all endpoint inputs.

---

### 7. Integer Parsing Without Validation

**File:** Multiple files (routes.ts, affiliate-routes.ts, etc.)
**Severity:** High
**CWE:** CWE-20 (Improper Input Validation)

**Issue:** `parseInt()` is used on user input without checking for NaN values.

**Recommendation:** Always validate parsed integers or use Zod coercion.

---

### 8. Error Messages Leaking Implementation Details

**File:** Multiple files (scraping-routes.ts:104,139,164,199)
**Severity:** High
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

**Issue:** Raw error messages including stack traces are exposed to clients.

**Recommendation:** Use centralized error handler that sanitizes messages in production.

---

### 9. Rate Limit Store Grows Unbounded

**File:** `server/middleware/security.ts:16-28`
**Severity:** High
**CWE:** CWE-400 (Uncontrolled Resource Consumption)

**Issue:** In-memory rate limit store could grow unbounded under high traffic.

**Recommendation:** Use Redis for rate limiting in production or add LRU eviction.

---

## Medium Severity Issues (Priority 3)

### 10. Missing Rate Limiting on Search Endpoints

**File:** `server/advanced-search-routes.ts`
**Severity:** Medium

**Recommendation:** Add endpoint-specific rate limits to search routes.

---

### 11. Overly Broad CORS Origins

**File:** `server/middleware/security.ts:242`  
**Severity:** Medium

**Recommendation:** Enforce explicit CORS configuration in production.

---

### 12. Global Agent Instances Create Race Conditions

**File:** `server/scraping-routes.ts:19-39`
**Severity:** Medium

**Recommendation:** Implement proper singleton pattern with initialization locks.

---

### 13. Missing Validation on Affiliate Routes

**File:** `server/affiliate-routes.ts:58-93`
**Severity:** Medium

**Recommendation:** Apply validation middleware to affiliate configuration endpoint.

---

### 14. SQL Injection Risk via Raw SQL

**File:** `server/storage.ts:403,412,416,424`
**Severity:** Medium

**Note:** Currently safe due to Drizzle parameterization, but add warnings for future modifications.

---

### 15. Insufficient CSRF Protection

**File:** `server/middleware/security.ts:94-117`
**Severity:** Medium

**Recommendation:** Implement token-based CSRF for all state-changing operations.

---

### 16. Unsafe Redirect in Discourse SSO

**File:** `server/discourse-routes.ts:84,100`
**Severity:** Medium  
**CWE:** CWE-601 (URL Redirection to Untrusted Site)

**Recommendation:** Validate redirect URLs against an allowlist.

---

### 17. Missing Input Sanitization on Forum Content

**File:** `server/routes.ts:290,334`
**Severity:** Medium

**Recommendation:** Sanitize forum content on backend using DOMPurify.

---

## Low Severity Issues (Priority 4)

18. Verbose error logging in production
19. Hardcoded pagination limits
20. Weak slug generation algorithm
21. Unvalidated retailer input
22. Incomplete type safety in forum storage
23. Missing cache-control on health endpoints

---

## Dependency Vulnerabilities

**npm audit Results:**

- esbuild: CVE moderate severity (<=0.24.2)
- Fix: Update to esbuild ^0.25.0

**Recommendation:**

```bash
npm update esbuild
npm audit fix
```

---

## Positive Security Findings

✅ Strong password requirements (8+ chars, mixed case, numbers)
✅ Bcrypt password hashing with cost factor of 12
✅ Account lockout mechanism after failed logins  
✅ Rate limiting on API and authentication endpoints
✅ Comprehensive security headers (CSP, X-Frame-Options, etc.)
✅ Input sanitization middleware for XSS prevention
✅ CORS configuration with explicit origin allowlist
✅ Session security (httpOnly, secure, sameSite cookies)
✅ SQL injection prevention through Drizzle ORM
✅ Zod validation schemas for admin routes

---

## Recommendations Summary

### Immediate Actions (Critical/High)

1. Remove password hash from forum user queries
2. Add authentication to Discourse webhook endpoint
3. Implement unique slug generation with collision handling
4. Fix authorization inconsistencies (use requireAdmin consistently)
5. Add input validation to all query parameters
6. Validate parsed integers before use
7. Sanitize error messages in production

### Short-term (Medium)

1. Add rate limiting to search endpoints
2. Implement CSRF tokens for all state-changing operations
3. Validate redirect URLs to prevent open redirects
4. Add backend sanitization for forum content
5. Apply validation middleware to affiliate routes

### Long-term (Low)

1. Implement centralized logging system
2. Move rate limiting to Redis for production
3. Add monitoring and alerting for security events
4. Conduct penetration testing

---

## Testing Recommendations

**Security Testing:**

- Add integration tests for authentication flows
- Test rate limiting under load
- Verify CSRF protection on all endpoints
- Test input validation with malicious payloads

**Static Analysis:**

- Run `npm audit` regularly
- Add ESLint security plugins
- Use SonarQube for code quality

---

## Conclusion

The PriceCompare application demonstrates good security practices in authentication, session management, and input validation. However, several critical issues need immediate attention:

1. Password hash exposure in API responses
2. Missing webhook authentication
3. Slug collision vulnerabilities

**Overall Security Rating: B+** (Good, but needs improvements in critical areas)

**Next Audit Recommended:** After critical issues are resolved (Q1 2026)
