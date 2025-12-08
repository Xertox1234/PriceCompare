# GitHub Actions Workflow Setup Instructions

This directory should contain `workflows/security-scan.yml` but it cannot be pushed from automated tools due to GitHub security restrictions.

## To Add the Security Workflow:

### Option 1: Via GitHub UI (Recommended)

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Click **New workflow**
4. Click **set up a workflow yourself**
5. Name it `security-scan.yml`
6. Copy the content from the local file `.github/workflows/security-scan.yml`
7. Commit directly to your main branch

### Option 2: Push from Local Machine

```bash
git checkout main
git pull origin main
git add .github/workflows/security-scan.yml
git commit -m "Add security scanning workflow"
git push origin main
```

## Workflow File Location

The workflow file exists locally at:

```
.github/workflows/security-scan.yml
```

You can view it and copy its contents for manual setup.

## What the Workflow Provides

- ✅ Automated security scans on every push/PR
- ✅ Daily scheduled vulnerability checks
- ✅ Dependency review on pull requests
- ✅ CodeQL advanced code analysis
- ✅ Automatic blocking of critical security issues

See `docs/SECURITY_SCANNING.md` for complete documentation.
