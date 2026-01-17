# TODO 243: Enable Content Security Policy Enforcement

**Created**: 2026-01-16
**Priority**: Medium
**Category**: Security
**Effort**: 5 minutes (after monitoring period)

## Problem

Content Security Policy (CSP) is currently in **Report-Only mode** by default. This means the browser logs CSP violations but doesn't actually block them.

**📍 File**: `server/middleware/security.ts` (lines 369-373)

```typescript
const cspHeader =
  process.env.CSP_ENFORCE === 'true'
    ? 'Content-Security-Policy'
    : 'Content-Security-Policy-Report-Only';
```

**Risk Level**: Medium (Security)

## Why Report-Only First?

This is intentional - starting in report-only mode allows you to:
1. Monitor for false positives that would break the app
2. Collect violation reports at `/api/csp-violation-report`
3. Tune CSP directives before enforcement

## Required Changes

### Pre-Launch Checklist

1. **Monitor CSP violations for 24-48 hours**
   - Check server logs for violation reports
   - Verify no legitimate resources are being blocked
   - Adjust directives if needed

2. **Enable enforcement in production**

   Add to production `.env`:
   ```bash
   CSP_ENFORCE=true
   ```

3. **Verify after enabling**
   - Test all pages load correctly
   - Check browser console for CSP errors
   - Verify scripts/styles/fonts all work

## CSP Directives Currently Set

```
default-src 'self'
script-src 'self' 'nonce-{random}'
style-src 'self' 'nonce-{random}'
img-src 'self' data: https:
font-src 'self' data:
connect-src 'self'
frame-ancestors 'none'
```

## Testing

- [ ] Monitor violation reports for 24-48 hours
- [ ] Test all major pages after enforcement
- [ ] Verify third-party integrations work (if any)

## Acceptance Criteria

- [ ] CSP violations monitored in report-only mode
- [ ] No legitimate resources blocked
- [ ] `CSP_ENFORCE=true` set in production environment
- [ ] Application functions correctly with enforcement enabled

---

## Resolution

**Status**: Documentation Complete
**Date**: 2026-01-16

The CSP implementation in `server/middleware/security.ts` is correct and ready for enforcement.

**Documentation added to**: `docs/deployment/DEPLOYMENT_CHECKLIST.md`

The deployment checklist now includes:
- Phase 1: Monitoring (24-48 hours) checklist
- Phase 2: Enable Enforcement steps
- Phase 3: Post-Enforcement Verification
- Current CSP directives reference
- Troubleshooting table for common issues
- Rollback instructions

**Next steps for production**:
1. Deploy with Report-Only mode (default)
2. Monitor CSP violation reports for 24-48 hours
3. Set `CSP_ENFORCE=true` in production .env
4. Verify all pages work correctly
