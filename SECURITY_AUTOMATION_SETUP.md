# Security Automation Setup - Quick Start Guide

**Date**: November 9, 2025
**Status**: ✅ Automated security scanning infrastructure deployed

---

## ✅ What's Been Set Up

### 1. Pre-Commit Security Hooks
**Location**: `.husky/pre-commit`

Automatically runs before every git commit to catch security issues:
- ✅ Hardcoded secret detection (AWS keys, API tokens, passwords)
- ✅ Vulnerable code pattern scanning (SQL injection, XSS, eval)
- ✅ Console.log detection in server code
- ✅ Environment variable validation
- ✅ Sensitive file prevention (.env, .pem, private keys)

### 2. Security Scanning Scripts
**Location**: `scripts/security-scan.sh`

Comprehensive 6-step security audit:
1. Dependency vulnerability scan (npm audit)
2. Secret detection across codebase
3. Vulnerable code pattern analysis
4. Environment variable usage check
5. TypeScript compilation
6. Security TODO tracking

### 3. NPM Security Commands

Run these commands locally:

```bash
# Full security scan (recommended before commits)
npm run security:scan

# Dependency audit only
npm run security:audit

# Auto-fix vulnerable dependencies
npm run security:fix

# Complete security validation
npm run security:check
```

### 4. Secret Detection Configuration
**Files**: 
- `.github/secret-patterns.json` - Detection patterns
- `.secretsignore` - Whitelist for safe files

**Detects**:
- AWS Access/Secret Keys
- GitHub tokens
- Private keys (RSA, DSA, EC, PGP)
- API keys (Stripe, Google, Slack, etc.)
- JWT tokens
- Database credentials
- Hardcoded passwords

### 5. Documentation
**Location**: `docs/SECURITY_SCANNING.md` (650+ lines)

Complete guide covering:
- How to use pre-commit hooks
- Manual security scanning
- Handling security failures
- Customization guide
- Best practices checklist

---

## 🚀 Getting Started

### First Time Setup

1. **Install Husky hooks** (auto-runs on `npm install`):
```bash
npm install
# Or manually: npm run prepare
```

2. **Test the security scanner**:
```bash
npm run security:scan
```

Expected output:
```
🔒 PriceCompare Security Scanner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1/6] 📦 Scanning dependencies...
✅ No high/critical vulnerabilities

[2/6] 🔐 Scanning for secrets...
✅ No hardcoded secrets detected

... (more checks)

✅ All security checks passed!
```

### Daily Workflow

Your commits will now be automatically checked:

```bash
git add .
git commit -m "Your commit message"
# Pre-commit hook runs automatically
# Commit proceeds only if checks pass
```

If checks fail:
```bash
❌ ERROR: Hardcoded secrets found!
server/config.ts:42: const API_KEY = "sk_live_abc123"

# Fix the issue
# Commit again
```

---

## ⚠️ GitHub Actions Workflow (Manual Setup Required)

**File**: `.github/workflows/security-scan.yml`

**Why manual**: GitHub restricts workflow file pushes from apps for security.

### Option 1: Add via GitHub UI

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **New workflow**
4. Click **set up a workflow yourself**
5. Copy content from `.github/workflows/security-scan.yml`
6. Commit directly to main/develop branch

### Option 2: Push from Local Machine

```bash
git checkout main
git pull
git add .github/workflows/security-scan.yml
git commit -m "Add security scanning CI/CD workflow"
git push
```

### Workflow Features

Once added, this workflow will:
- ✅ Run on every push and pull request
- ✅ Daily security scans at 2 AM UTC
- ✅ Dependency review on PRs
- ✅ CodeQL advanced analysis
- ✅ Block merges if critical issues found
- ✅ Post security summaries in PRs

---

## 🔍 Testing the Setup

### Test Pre-Commit Hook

Try committing a file with a "secret":

```bash
# Create a test file
echo 'const API_KEY = "sk_live_test123456789"' > test-secret.ts

# Try to commit
git add test-secret.ts
git commit -m "Test commit"

# Should FAIL with:
# ❌ ERROR: Potential hardcoded secrets found!
```

Clean up:
```bash
rm test-secret.ts
git restore --staged test-secret.ts
```

### Test Manual Scan

```bash
npm run security:scan
```

Should complete successfully if no issues in codebase.

---

## 🛡️ Security Features Active

| Feature | Status | Trigger |
|---------|--------|---------|
| Pre-commit hooks | ✅ Active | Every `git commit` |
| Manual security scan | ✅ Available | `npm run security:scan` |
| Dependency audit | ✅ Available | `npm run security:audit` |
| Secret detection | ✅ Active | Pre-commit + manual scan |
| Pattern scanning | ✅ Active | Pre-commit + manual scan |
| GitHub Actions | ⏳ Pending | Add workflow manually |
| CodeQL analysis | ⏳ Pending | Add workflow manually |

---

## 📋 Quick Reference

### Commands

```bash
# Security scanning
npm run security:scan       # Full scan
npm run security:audit      # Dependencies only
npm run security:fix        # Auto-fix
npm run security:check      # Scan + audit

# Bypass pre-commit (NOT recommended)
git commit --no-verify

# Manual hook setup
npm run prepare
```

### Files

```
.husky/
  ├── pre-commit              # Pre-commit security hook
  └── _/husky.sh             # Husky helper

.github/
  ├── secret-patterns.json   # Secret detection patterns
  └── workflows/
      └── security-scan.yml  # CI/CD workflow (add manually)

scripts/
  └── security-scan.sh       # Security scanner script

docs/
  └── SECURITY_SCANNING.md   # Complete documentation

.secretsignore               # Whitelist for secret scanner
```

---

## 🐛 Troubleshooting

### Pre-commit hook not running

```bash
# Reinstall hooks
rm -rf .husky
npm run prepare
```

### Permission denied on scripts

```bash
# Make scripts executable
chmod +x .husky/pre-commit
chmod +x scripts/security-scan.sh
chmod +x .husky/_/husky.sh
```

### False positive secret detection

Add pattern to `.secretsignore`:
```
# Your specific case
path/to/safe/file.ts
```

Or whitelist in code:
```typescript
const key = getRequiredEnv('API_KEY'); // ✅ Safe - uses env var
```

### Husky not found

```bash
# Install dependencies
npm install
```

---

## 📊 What Gets Scanned

### Code Patterns

❌ **Blocked**:
- `query + req.body` (SQL injection)
- `eval(userInput)` (Code injection)
- `Math.random()` for passwords/tokens (Insecure randomness)
- Hardcoded secrets

⚠️ **Warned**:
- `dangerouslySetInnerHTML` (Potential XSS)
- `console.log` in server code
- Direct `process.env.SECRET` usage

### Secret Patterns

Detects 13 types:
- AWS keys (AKIA*, secret access keys)
- GitHub tokens (ghp_, ghs_, gho_)
- Private keys (-----BEGIN PRIVATE KEY-----)
- Stripe API keys (sk_live_*)
- Google API keys (AIza*)
- JWT tokens (eyJ*)
- Database credentials
- Generic API keys
- Passwords
- And more...

---

## 🎯 Next Steps

1. ✅ **Done**: Pre-commit hooks active
2. ✅ **Done**: Security scripts available
3. ✅ **Done**: Documentation complete
4. ⏳ **TODO**: Add GitHub Actions workflow manually
5. ⏳ **TODO**: Run first security scan: `npm run security:scan`
6. ⏳ **TODO**: Enable GitHub Security features (Dependabot, Secret Scanning)

---

## 📚 Additional Resources

- **Complete Documentation**: `docs/SECURITY_SCANNING.md`
- **Secret Patterns**: `.github/secret-patterns.json`
- **Workflow Template**: `.github/workflows/security-scan.yml`
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/

---

**Last Updated**: November 9, 2025
**Questions?** See `docs/SECURITY_SCANNING.md` for detailed information.
