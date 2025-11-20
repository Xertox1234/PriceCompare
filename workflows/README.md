# GitHub Actions CI/CD Workflows

This directory contains ready-to-use GitHub Actions workflows for automating testing, security scanning, and deployments.

## 🚀 Quick Start

### Step 1: Remove .gitignore Block

The `.github/workflows/` directory is currently in `.gitignore`. Remove it:

```bash
# Edit .gitignore and remove this line:
# .github/workflows/

# Or use sed:
sed -i '' '/\.github\/workflows\//d' .gitignore
```

### Step 2: Move Workflows to GitHub Directory

```bash
# Create .github directory
mkdir -p .github/workflows

# Move workflow files
mv workflows/*.yml .github/workflows/

# Move dependabot config
mv workflows/dependabot.yml .github/dependabot.yml

# Commit the workflows
git add .github/
git commit -m "ci: add GitHub Actions workflows

- PR validation pipeline (tests, type checking, build)
- Security scanning (npm audit, secret detection, CodeQL)
- Database migration testing
- Dependabot auto-updates
"
git push
```

### Step 3: Configure GitHub Repository Settings

1. **Enable GitHub Actions:**
   - Go to Settings → Actions → General
   - Enable "Allow all actions and reusable workflows"

2. **Configure Branch Protection (recommended):**
   - Go to Settings → Branches → Add rule
   - Branch name pattern: `main`
   - Check "Require status checks to pass before merging"
   - Select required checks:
     - ✅ Code Quality
     - ✅ Test Suite
     - ✅ Security Audit
     - ✅ Build Verification
     - ✅ All Checks Passed

3. **Add Repository Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add secrets:
     - `CODECOV_TOKEN` (optional, for coverage reporting)

4. **Enable Dependabot:**
   - Dependabot configuration is already in `.github/dependabot.yml`
   - GitHub will automatically detect and enable it

---

## 📋 Available Workflows

### 1. PR Validation (`pr-validation.yml`)

**Triggers:** Every pull request to main/develop/add_scraping

**Jobs:**
- **Code Quality** - TypeScript type checking, console.log detection, 'any' type detection
- **Test Suite** - Full test suite with PostgreSQL and Redis services
- **Security Audit** - npm audit, security tests
- **Build Verification** - Production build test
- **Pre-commit Checks** - Simulate pre-commit hook checks

**Duration:** ~10-15 minutes

**Status Badge:**
```markdown
![PR Validation](https://github.com/Xertox1234/PriceCompare/actions/workflows/pr-validation.yml/badge.svg)
```

---

### 2. Security Scanning (`security-scan.yml`)

**Triggers:**
- Every pull request
- Push to main
- Weekly schedule (Monday 9 AM UTC)
- Manual trigger

**Jobs:**
- **Dependency Audit** - npm audit for vulnerabilities
- **Secret Scanning** - TruffleHog + manual patterns
- **Security Tests** - Security test suite execution
- **Docker Security** - Trivy container scanning (if Dockerfile exists)
- **CodeQL Analysis** - GitHub's semantic code analysis

**Duration:** ~15-20 minutes

**Status Badge:**
```markdown
![Security Scan](https://github.com/Xertox1234/PriceCompare/actions/workflows/security-scan.yml/badge.svg)
```

---

### 3. Migration Testing (`migration-test.yml`)

**Triggers:**
- PRs that modify `shared/schema.ts` or migration files
- Manual trigger

**Jobs:**
- **Migration Test** - Fresh migration, schema integrity, performance testing
- **Schema Changes Review** - Automatic PR comment with checklist

**Duration:** ~5-10 minutes

**Features:**
- ✅ Validates foreign key cascade rules
- ✅ Tests migration performance (<30s threshold)
- ✅ Checks for tables without primary keys
- ✅ Auto-comments on PRs with schema changes

---

### 4. Dependabot Auto-Merge (`dependabot-auto-merge.yml`)

**Triggers:** Dependabot PRs

**Features:**
- **Auto-approve** security patches (semver-patch)
- **Auto-merge** after CI passes (squash merge)
- **Manual review** required for major updates
- **Automatic comments** on breaking changes

**Configuration:** `.github/dependabot.yml`

---

## 🔧 Configuration

### Environment Variables for CI

The workflows use GitHub Secrets and environment variables. Here's what you need:

**Required for Tests:**
```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
REDIS_URL: redis://localhost:6379
NODE_ENV: test
SESSION_SECRET: test-secret-key-for-ci
CSRF_SECRET: test-csrf-secret-for-ci
```

**Optional (enhance features):**
```yaml
CODECOV_TOKEN: <your-codecov-token>  # For coverage reporting
```

All required variables are already configured in the workflow files with test values.

---

## 📊 Monitoring CI Health

### Success Metrics

Track these metrics in GitHub Insights → Actions:

| Metric | Target | Current |
|--------|--------|---------|
| Build Success Rate | >95% | - |
| Average PR Duration | <24h | - |
| Security Scan Failures | 0 high/critical | - |
| Test Coverage | >80% | ~40% |

### CI Badges

Add to your `README.md`:

```markdown
[![PR Validation](https://github.com/Xertox1234/PriceCompare/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/Xertox1234/PriceCompare/actions/workflows/pr-validation.yml)
[![Security Scan](https://github.com/Xertox1234/PriceCompare/actions/workflows/security-scan.yml/badge.svg)](https://github.com/Xertox1234/PriceCompare/actions/workflows/security-scan.yml)
[![codecov](https://codecov.io/gh/Xertox1234/PriceCompare/branch/main/graph/badge.svg)](https://codecov.io/gh/Xertox1234/PriceCompare)
```

---

## 🐛 Troubleshooting

### Common Issues

**1. "Actions are disabled for this repository"**
- Go to Settings → Actions → General
- Enable actions

**2. "Resource not accessible by integration"**
- Check workflow permissions in Settings → Actions → General → Workflow permissions
- Set to "Read and write permissions"

**3. "Tests failing in CI but pass locally"**
- Check environment variables in workflow
- Ensure PostgreSQL/Redis services are healthy
- Review service logs in CI output

**4. "Coverage upload failed"**
- Add `CODECOV_TOKEN` to repository secrets
- Or remove coverage upload step if not using Codecov

**5. "Dependabot PRs not auto-merging"**
- Ensure "Allow auto-merge" is enabled in Settings → General
- Check that branch protection allows Dependabot to merge

---

## 📈 Next Steps

### Tier 2: Deploy Previews (Future)

Consider adding deploy preview workflows for:
- **Vercel/Netlify** - Easy setup, limited backend
- **Railway/Render** - Full stack support
- **Self-hosted** - Complete control

See `docs/CI_CD_AUTOMATION_GUIDE.md` for detailed implementation plans.

### Tier 3: Performance Monitoring (Future)

- Lighthouse CI for performance budgets
- Bundle size tracking
- E2E test performance metrics

---

## 🔒 Security Considerations

### Secret Management
- Never commit secrets to workflow files
- Use GitHub Secrets for sensitive values
- Rotate secrets quarterly

### Access Control
- Limit who can bypass required checks
- Use CODEOWNERS for workflow changes
- Enable "Require approval for all outside collaborators"

### Audit Logging
- All workflow runs are logged
- Security scan results archived for 30 days
- Failed runs trigger notifications

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Analysis](https://codeql.github.com/)
- [Trivy Scanner](https://github.com/aquasecurity/trivy)

For questions or issues with these workflows, see `docs/CI_CD_AUTOMATION_GUIDE.md`.
