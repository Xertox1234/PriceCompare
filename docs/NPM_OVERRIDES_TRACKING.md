# NPM Overrides Tracking

**Purpose**: Track temporary npm overrides used for security patches and ensure they're removed when parent packages update naturally.

**Review Schedule**: Monthly on 1st of month (part of dependency audit workflow)

---

## Active Overrides

### 1. esbuild (^0.27.0)

**Status**: 🟡 ACTIVE
**Applied**: 2025-11-XX (exact date TBD from git history)
**Vulnerability**: GHSA-67mh-4wv8-2f99 (dev server vulnerability)
**Affected Parents**: Vite, drizzle-kit
**Severity**: HIGH
**Fix Version**: ^0.27.0

**Removal Trigger**:
- When Vite AND drizzle-kit both depend on esbuild >= 0.27.0

**Monitoring**:
- Check: https://github.com/vitejs/vite/releases
- Check: https://github.com/drizzle-team/drizzle-kit/releases
- Last checked: 2025-12-02

**Removal Steps**:
```bash
# 1. Verify parent packages updated
npm outdated vite drizzle-kit esbuild

# 2. Update parent packages
npm install vite@latest drizzle-kit@latest --save-dev

# 3. Remove override from package.json
# Delete: "esbuild": "^0.27.0" from overrides

# 4. Reinstall and verify
npm install
npm ls esbuild  # Should no longer show "overridden"

# 5. Run security checks
npm audit --audit-level=moderate
npm run check
npm run lint
```

---

### 2. body-parser (2.2.1)

**Status**: 🟡 ACTIVE
**Applied**: 2025-12-02
**Vulnerability**: GHSA-wqch-xfxh-vrr4 (DoS via URL encoding)
**Affected Parent**: Express 5.1.0
**Severity**: MODERATE
**Fix Version**: 2.2.1

**Removal Trigger**:
- When Express 5.x naturally depends on body-parser >= 2.2.1

**Monitoring**:
- Check: https://github.com/expressjs/express/releases
- Last checked: 2025-12-02
- Next check: 2025-01-01

**Removal Steps**:
```bash
# 1. Verify Express updated its body-parser dependency
npm view express@latest dependencies.body-parser

# 2. If >= 2.2.1, update Express
npm install express@latest

# 3. Remove override from package.json
# Delete: "body-parser": "2.2.1" from overrides
# Update _comments to remove body-parser reference

# 4. Reinstall and verify
npm install
npm ls body-parser  # Should no longer show "overridden"

# 5. Run security checks
npm audit --audit-level=moderate
npm run check
npm run lint
```

---

## Override Removal History

Track when overrides are successfully removed to demonstrate good hygiene:

| Override | Applied | Removed | Parent Fixed In | Duration |
|----------|---------|---------|-----------------|----------|
| _(none yet)_ | - | - | - | - |

---

## Monthly Review Checklist

**Date**: _________

- [ ] Check Express releases for body-parser update
- [ ] Check Vite releases for esbuild update
- [ ] Check drizzle-kit releases for esbuild update
- [ ] Run `npm outdated` for all overridden packages
- [ ] Review vulnerability advisories for new issues
- [ ] Update "Last checked" dates in this document
- [ ] If parent package fixed: Execute removal steps
- [ ] If removed: Move entry to "Override Removal History"

---

## Best Practices

### When to Add Overrides

✅ **Use overrides when**:
- Security patch available (patch version: x.y.Z)
- Parent package hasn't updated yet
- Immediate mitigation needed
- Low risk of breaking changes

❌ **Don't use overrides for**:
- Major version changes (breaking changes likely)
- Minor version changes (feature additions, might break)
- Non-security updates (wait for parent)
- When you can directly update parent package

### Documentation Requirements

Every override MUST include:
1. **CVE/GHSA reference** in `_comments`
2. **What vulnerability fixed** (brief description)
3. **Removal trigger** (when to remove)
4. **Applied date** (for duration tracking)
5. **Entry in this tracking document**

### Monitoring Frequency

- **Security overrides**: Monthly checks
- **Critical (P0) vulnerabilities**: Weekly checks
- **Low severity**: Quarterly checks (only if no other overrides exist)

---

## Related Documentation

- Security patterns: `docs/04_SECURITY_PATTERNS.md` (Dependency Security section)
- Main project guide: `CLAUDE.md` (Common Pitfalls section)
- Package.json comments: `package.json` (`_comments` field)

---

**Last Updated**: 2025-12-02
**Maintained By**: Development Team / Claude Code
