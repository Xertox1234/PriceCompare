# Security Scanning & Automation

**Last Updated**: November 9, 2025

This document describes the automated security scanning infrastructure for the PriceCompare application.

---

## 🎯 Overview

The PriceCompare application has a multi-layered security scanning system that runs:

1. **Pre-commit** - Local checks before code is committed
2. **CI/CD Pipeline** - Automated checks on pull requests and pushes
3. **Scheduled Scans** - Daily security audits
4. **Manual Scans** - On-demand security checks

---

## 🔧 Local Development Security

### Pre-Commit Hooks

Pre-commit hooks run automatically when you attempt to commit code. They catch security issues early.

**Location**: `.husky/pre-commit`

**Checks Performed**:
- ✅ Hardcoded secrets detection
- ✅ Console.log statements in server code
- ✅ Security-related TODOs
- ✅ TypeScript compilation
- ✅ Vulnerable code patterns (SQL injection, XSS, eval)
- ✅ Environment variable validation
- ✅ Sensitive file detection (.env, private keys)

**Bypassing Pre-Commit Hooks** (NOT RECOMMENDED):
```bash
git commit --no-verify
```

### Manual Security Scan

Run a comprehensive security scan manually:

```bash
# Full security scan
npm run security:scan

# Dependency audit only
npm run security:audit

# Auto-fix dependency vulnerabilities
npm run security:fix

# Complete security check (scan + audit)
npm run security:check
```

**Output Example**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PriceCompare Security Scanner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/6] 📦 Scanning dependencies for vulnerabilities...
✅ No high/critical vulnerabilities in dependencies

[2/6] 🔐 Scanning for hardcoded secrets...
✅ No hardcoded secrets detected

[3/6] 🛡️  Scanning for vulnerable code patterns...
✅ No obvious vulnerable patterns detected

[4/6] 🌍 Checking environment variable usage...
✅ Environment variable usage is secure

[5/6] 🔧 Running TypeScript type checking...
✅ TypeScript compilation successful

[6/6] 📝 Checking for security TODOs...
✅ No security TODOs found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Security Scan Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All security checks passed!
   No issues detected
```

---

## 🤖 CI/CD Security Pipeline

### GitHub Actions Workflow

**Location**: `.github/workflows/security-scan.yml`

**Triggers**:
- Push to `main`, `master`, `develop`, or `claude/**` branches
- Pull requests to `main`, `master`, or `develop`
- Daily at 2 AM UTC (scheduled scan)
- Manual trigger via GitHub Actions UI

### Security Jobs

#### 1. Security Vulnerability Scan

**Steps**:
1. ✅ Checkout code
2. ✅ Set up Node.js
3. ✅ Install dependencies
4. ✅ Run npm audit
5. ✅ Check for hardcoded secrets
6. ✅ Scan for vulnerable code patterns
7. ✅ TypeScript type checking
8. ✅ Environment variable validation
9. ✅ Upload security report artifact

**Fail Criteria**:
- Critical or high severity npm vulnerabilities
- Hardcoded secrets detected
- Vulnerable code patterns found (SQL injection, eval, insecure randomness)

#### 2. Dependency Review (Pull Requests Only)

**Checks**:
- New dependency vulnerabilities
- License compliance (blocks GPL-3.0, AGPL-3.0)
- Fails on high severity issues
- Posts summary in PR comments

#### 3. CodeQL Security Analysis

**Capabilities**:
- Advanced static analysis
- Security and quality queries
- JavaScript/TypeScript scanning
- Results posted to GitHub Security tab

---

## 🔍 Secret Scanning Configuration

### Patterns Detected

**Critical Severity**:
- AWS Access Keys (`AKIA[0-9A-Z]{16}`)
- AWS Secret Keys
- Private Keys (RSA, DSA, EC, PGP)
- Database connection strings with credentials
- GitHub tokens
- Stripe live API keys

**High Severity**:
- API Keys
- JWT Tokens
- Secret tokens (20+ characters)
- Google API Keys
- Slack tokens

**Medium Severity**:
- Generic secrets (32+ characters)
- Hardcoded passwords

### Whitelist Patterns

Safe to ignore:
- `process.env.*` - Environment variable references
- `getRequiredEnv` / `getOptionalEnv` - Our validation functions
- `CHANGE_THIS` - Placeholder values
- `your_*` - Example values
- `.env.example` - Example file

### Configuration Files

- **`.github/secret-patterns.json`** - Secret detection patterns
- **`.secretsignore`** - Files/patterns to ignore

---

## 📊 Security Reports

### Viewing Reports

1. **GitHub Actions UI**:
   - Go to Actions tab
   - Click on latest "Security Scan" workflow
   - View step summaries

2. **Security Tab** (CodeQL):
   - Go to Security tab
   - Click "Code scanning"
   - View detected issues

3. **Artifacts**:
   - Download `security-audit-report` artifact
   - Contains full npm audit JSON report
   - Retained for 30 days

### Sample Report Output

```markdown
### 📊 Dependency Vulnerabilities

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Moderate | 2 |
| 🔵 Low | 5 |

### 🔒 Security Scan Summary

✅ **All security checks completed**

**Checks performed:**
- Dependency vulnerability scan (npm audit)
- Hardcoded secret detection
- Vulnerable code pattern analysis
- TypeScript type checking
- Environment variable validation

**Scan completed at:** 2025-11-09T22:00:00Z
```

---

## 🚨 Handling Security Issues

### When Pre-Commit Fails

1. **Review the error message**:
   ```
   ❌ ERROR: Potential hardcoded secrets found!
   server/config.ts:42:const API_KEY = "sk_live_abc123"
   ```

2. **Fix the issue**:
   ```typescript
   // BEFORE (INSECURE)
   const API_KEY = "sk_live_abc123";

   // AFTER (SECURE)
   const API_KEY = getRequiredEnv('API_KEY');
   ```

3. **Commit again**:
   ```bash
   git add .
   git commit -m "Fix: Use environment variable for API key"
   ```

### When CI/CD Fails

1. **Check the GitHub Actions log**
2. **Identify the failing check**
3. **Fix locally**
4. **Push the fix**:
   ```bash
   git add .
   git commit -m "Security fix: [describe the fix]"
   git push
   ```

### Dependency Vulnerabilities

**Option 1: Auto-fix** (recommended)
```bash
npm run security:fix
git add package*.json
git commit -m "Fix: Update vulnerable dependencies"
git push
```

**Option 2: Manual update**
```bash
npm update [package-name]
# or
npm install [package-name]@latest
```

**Option 3: Accept risk temporarily** (not recommended)
- Document why in SECURITY_AUDIT_REPORT.md
- Create tracking issue
- Set remediation timeline

---

## 🛠️ Customization

### Adding New Secret Patterns

Edit `.github/secret-patterns.json`:

```json
{
  "patterns": [
    {
      "name": "Custom API Key",
      "pattern": "myapp_[a-zA-Z0-9]{32}",
      "severity": "high",
      "description": "Custom application API key found"
    }
  ]
}
```

### Modifying Pre-Commit Checks

Edit `.husky/pre-commit`:

```bash
# Add new check
echo "🔍 Running custom check..."
if [custom_command]; then
  echo "${RED}❌ Custom check failed!${NC}"
  FAILED=1
fi
```

### Adjusting CI/CD Workflow

Edit `.github/workflows/security-scan.yml`:

```yaml
- name: Custom Security Check
  run: |
    echo "Running custom check..."
    # Add your custom security validation
```

---

## 📋 Checklist: Security Best Practices

**Before Committing**:
- [ ] No hardcoded secrets
- [ ] Environment variables used for sensitive data
- [ ] No `console.log` in server code (or development-only)
- [ ] No SQL string concatenation with user input
- [ ] No `eval()` or `new Function()`
- [ ] No sensitive files in commit (`.env`, `.pem`, etc.)

**Before Pull Request**:
- [ ] All security checks pass locally (`npm run security:check`)
- [ ] No security TODOs remaining
- [ ] Dependencies up to date
- [ ] TypeScript compiles without errors
- [ ] Security documentation updated if needed

**Before Deployment**:
- [ ] All CI/CD checks pass
- [ ] No high/critical vulnerabilities in dependencies
- [ ] Environment variables configured in production
- [ ] Security review completed (for major changes)

---

## 🔒 Security Scanning Schedule

| Scan Type | Frequency | Trigger |
|-----------|-----------|---------|
| Pre-commit | Every commit | Local git hook |
| CI/CD | Every push/PR | GitHub Actions |
| Scheduled | Daily (2 AM UTC) | GitHub Actions cron |
| Manual | On-demand | `npm run security:scan` |
| CodeQL | Every push/PR | GitHub Actions |
| Dependency Review | Every PR | GitHub Actions |

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Husky Documentation](https://typicode.github.io/husky/)

---

## 🆘 Support

If you encounter issues with security scanning:

1. Check this documentation first
2. Review the error messages carefully
3. Search existing GitHub issues
4. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details

---

## 🔄 Updating This Document

This document should be updated when:
- New security checks are added
- Scanning configuration changes
- New vulnerabilities patterns are detected
- CI/CD workflow is modified

**Last Review**: November 9, 2025
**Next Review**: February 9, 2026
