
# TODO 246: Remove Backup Route Files

**Created**: 2026-01-16
**Priority**: Low
**Category**: Code Quality
**Effort**: 5 minutes

## Problem

There's a backup file in the routes directory that shouldn't be in the codebase:

**📍 File**: `server/routes/auth-routes.ts.backup`

Backup files should not be committed to version control - use git history instead.

**Risk Level**: Low (Code Quality)

## Current State

The file appears to be an older version of `auth-routes.ts`, based on grep results showing similar route definitions.

## Required Changes

### 1. Remove the backup file

```bash
rm server/routes/auth-routes.ts.backup
```

### 2. Add to .gitignore (if not already)

Ensure `.gitignore` includes:
```
*.backup
*.bak
*.orig
```

## Verification

- Check git history if you need to reference old code: `git log -p server/routes/auth-routes.ts`

## Acceptance Criteria

- [ ] Backup file removed
- [ ] `.gitignore` updated to prevent future backup commits
- [ ] No other `.backup` files in codebase
