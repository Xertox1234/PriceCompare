# CI/CD Setup Checklist

Complete this checklist to enable full CI/CD automation for PriceCompare.

## ☑️ Prerequisites

- [ ] GitHub repository exists at `https://github.com/Xertox1234/PriceCompare`
- [ ] You have admin access to the repository
- [ ] Local pre-commit hook is working
- [ ] All tests pass locally (`npm test`)

---

## 📋 Setup Steps

### Step 1: Enable Workflow Files (5 minutes)

- [ ] **Remove .gitignore block:**
  ```bash
  # Edit .gitignore and remove the line:
  # .github/workflows/

  # Or use this command:
  sed -i '' '/\.github\/workflows\//d' .gitignore
  ```

- [ ] **Create .github directory:**
  ```bash
  mkdir -p .github/workflows
  mkdir -p .github/ISSUE_TEMPLATE
  ```

- [ ] **Move workflow files:**
  ```bash
  cp workflows/*.yml .github/workflows/
  cp workflows/dependabot.yml .github/dependabot.yml
  ```

- [ ] **Commit and push:**
  ```bash
  git add .github/ .gitignore
  git commit -m "ci: add GitHub Actions CI/CD workflows"
  git push origin add_scraping
  ```

---

### Step 2: GitHub Repository Settings (10 minutes)

**Enable Actions:**
- [ ] Go to Settings → Actions → General
- [ ] Select "Allow all actions and reusable workflows"
- [ ] Workflow permissions: "Read and write permissions"
- [ ] Check "Allow GitHub Actions to create and approve pull requests"

**Branch Protection (Recommended):**
- [ ] Go to Settings → Branches → Add rule
- [ ] Branch name pattern: `main`
- [ ] Enable:
  - [x] Require a pull request before merging
  - [x] Require status checks to pass before merging
  - [x] Require branches to be up to date before merging
- [ ] Required status checks:
  - [x] Code Quality
  - [x] Test Suite
  - [x] Security Audit
  - [x] Build Verification
  - [x] All Checks Passed

**Security Settings:**
- [ ] Go to Settings → Code security and analysis
- [ ] Enable:
  - [x] Dependabot alerts
  - [x] Dependabot security updates
  - [x] Dependabot version updates
  - [x] Code scanning (CodeQL)
  - [x] Secret scanning

---

### Step 3: Configure Secrets (5 minutes)

- [ ] Go to Settings → Secrets and variables → Actions
- [ ] Add repository secrets:

**Optional but recommended:**
```
CODECOV_TOKEN=<your-token>  # Get from https://codecov.io
```

**Future deployment secrets (when needed):**
```
DOCKER_USERNAME=<username>
DOCKER_PASSWORD=<password>
DEPLOY_KEY=<ssh-key>
```

---

### Step 4: Test CI Pipeline (15 minutes)

**Create a test PR:**
- [ ] Create a new branch:
  ```bash
  git checkout -b test/ci-pipeline
  ```

- [ ] Make a small change (add a comment):
  ```bash
  echo "// CI test" >> server/index.ts
  git add server/index.ts
  git commit -m "test: verify CI pipeline"
  git push origin test/ci-pipeline
  ```

- [ ] Create PR on GitHub
- [ ] Wait for all checks to run (~10-15 minutes)
- [ ] Verify all 5 jobs pass:
  - ✅ Code Quality
  - ✅ Test Suite
  - ✅ Security Audit
  - ✅ Build Verification
  - ✅ Pre-commit Checks

**If checks fail:**
- [ ] Review workflow logs in Actions tab
- [ ] Fix issues locally
- [ ] Push fixes and re-run

**When all pass:**
- [ ] Close the test PR (don't merge)
- [ ] Delete the test branch

---

### Step 5: Enable Dependabot (2 minutes)

Dependabot should auto-enable from `.github/dependabot.yml`, but verify:

- [ ] Go to Insights → Dependency graph → Dependabot
- [ ] Verify "Dependabot version updates" is enabled
- [ ] Check that weekly schedule is configured
- [ ] Within 1 week, you should see first Dependabot PRs

---

### Step 6: Add Status Badges (5 minutes)

**Update README.md:**
- [ ] Add badges at the top:

```markdown
# PriceCompare

[![PR Validation](https://github.com/Xertox1234/PriceCompare/actions/workflows/pr-validation.yml/badge.svg)](https://github.com/Xertox1234/PriceCompare/actions/workflows/pr-validation.yml)
[![Security Scan](https://github.com/Xertox1234/PriceCompare/actions/workflows/security-scan.yml/badge.svg)](https://github.com/Xertox1234/PriceCompare/actions/workflows/security-scan.yml)
[![codecov](https://codecov.io/gh/Xertox1234/PriceCompare/branch/main/graph/badge.svg)](https://codecov.io/gh/Xertox1234/PriceCompare)

> AI-powered price comparison platform with community features
```

- [ ] Commit and push:
  ```bash
  git add README.md
  git commit -m "docs: add CI status badges"
  git push
  ```

---

## ✅ Verification

After setup, verify everything is working:

### Immediate Checks:
- [ ] Actions tab shows workflows
- [ ] Branch protection rules are active
- [ ] Dependabot alerts are visible (if any)

### Within 24 Hours:
- [ ] Dependabot creates first PRs (if updates available)
- [ ] Security scanning completes without errors
- [ ] Status badges show "passing" on README

### Within 1 Week:
- [ ] Weekly security scan runs (Sunday 2 AM UTC)
- [ ] Scheduled maintenance report generated
- [ ] All automated PRs handled correctly

---

## 📊 Success Metrics

Track these metrics to measure CI/CD effectiveness:

**Week 1 Targets:**
- [ ] All PRs pass CI checks before merge
- [ ] 0 security vulnerabilities (high/critical)
- [ ] Build success rate >95%

**Month 1 Targets:**
- [ ] Average PR merge time <24 hours
- [ ] Automated dependency updates: 5-10 PRs
- [ ] Test coverage increased by 5-10%

**Quarter 1 Targets:**
- [ ] 100% PRs validated by CI
- [ ] Zero production bugs from missing tests
- [ ] Deployment confidence: High

---

## 🐛 Troubleshooting

### "Workflow not found" error
- Ensure workflow files are in `.github/workflows/`, not `workflows/`
- Check file permissions (should be readable)
- Verify YAML syntax with: `yamllint .github/workflows/*.yml`

### Tests failing in CI but pass locally
- Check PostgreSQL/Redis service logs in workflow
- Verify environment variables match local setup
- Review timeout settings (may need increase)

### Dependabot not creating PRs
- Verify `.github/dependabot.yml` exists and is valid
- Check repository settings → Code security → Dependabot
- Wait up to 24 hours for first run

### CodeQL analysis failing
- Ensure `actions/checkout@v4` fetches full history
- Check that TypeScript builds successfully
- Review CodeQL logs for specific errors

---

## 🎯 Next Steps After Setup

Once CI/CD is working:

1. **Monitor for 1 week** - Ensure no false positives
2. **Tune thresholds** - Adjust coverage requirements, timeouts
3. **Add deploy previews** - See Tier 2 in CI_CD_AUTOMATION_GUIDE.md
4. **Enable auto-merge** - For Dependabot security patches
5. **Add E2E tests** - Playwright tests in CI

---

## 📚 Additional Resources

- **Workflow documentation:** `workflows/README.md`
- **Full guide:** `docs/CI_CD_AUTOMATION_GUIDE.md`
- **GitHub Actions docs:** https://docs.github.com/en/actions
- **Dependabot docs:** https://docs.github.com/en/code-security/dependabot

---

## ✍️ Notes

Use this space to track customizations or issues:

```
Date: _______________
Notes:




Issues encountered:




Customizations made:




```

---

**Setup completed by:** _______________
**Date:** _______________
**Time spent:** _______________ minutes
**Issues encountered:** _____ (circle: 0 1 2 3+)

🎉 **Congratulations! Your CI/CD pipeline is now live!**
