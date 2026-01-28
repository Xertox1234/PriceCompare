# TODO: Fix CI Checks for PR #185

**Created**: 2026-01-26
**PR**: https://github.com/Xertox1234/PriceCompare/pull/185
**Branch**: `feat/todo-293-agent-native-gaps` → `add_scraping`
**Status**: 13/26 checks passing (was 11/26 at start)

## Context

PR #185 implements TODO 293 (agent-native accessibility with newsletter API and theme preferences). CI checks were failing, blocking the merge.

## Commits Applied (in order)

1. **`e00b54f`** - CodeQL Security Fixes
   - 14 test files: Changed `secure: false` to `secure: process.env.NODE_ENV === 'production'`
   - `server/test/routes/compare-routes-simple.test.ts`: Added `csrfProtection` import and `app.use(csrfProtection)`
   - `migrations/0034_create_newsletter_subscribers.sql`: Changed `TIMESTAMP` → `TIMESTAMP WITH TIME ZONE`

2. **`fa56d4c`** - Workflow Permissions
   - Added `permissions: { contents: read, pull-requests: write }` to:
     - `.github/workflows/pattern-validation.yml`
     - `.github/workflows/migration-test.yml`
     - `.github/workflows/e2e-tests.yml`
     - `.github/workflows/pr-validation.yml`
   - Fixed EOF heredoc delimiter issue in pattern-validation.yml

3. **`d5a3bc2`** - Database Backup Workflow Fix
   - Fixed `if: ${{ secrets.SLACK_WEBHOOK_URL != '' }}` (can't use secrets in `if:` conditions)
   - Changed to pass secret to env and check in shell script with `continue-on-error: true`

4. **`2cffa09`** - Type Safety Fix
   - `server/__tests__/redis-session-storage.test.ts`: Replaced `as any` with proper `SessionData` type

## Issues Resolved ✅

- [x] `HttpError: Resource not accessible by integration` - Fixed by adding `permissions:` blocks
- [x] `Invalid value. Matching delimiter not found 'EOF'` - Fixed heredoc syntax
- [x] CodeQL: `secure: false` in 14 test files - Changed to environment-based check
- [x] CodeQL: Missing CSRF middleware in compare-routes-simple.test.ts - Added middleware
- [x] CodeQL: TIMESTAMP without timezone in migration - Added `WITH TIME ZONE`
- [x] `Unrecognized named-value: 'secrets'` in database-backup.yml - Fixed conditional
- [x] Pattern validation `any` type detection - Fixed with proper SessionData type

## Still Failing ❌

### 1. Pattern Validation
- **File**: `.github/workflows/pattern-validation.yml`
- **Error**: `Process completed with exit code 1`
- **Cause**: The pattern validator checks for `any` types in changed files. May still detect issues.
- **Action**: Check if there are other files with `any` types in the PR diff

### 2. E2E Tests (all 4 shards)
- **File**: `.github/workflows/e2e-tests.yml`
- **Error**: `Process completed with exit code 1`
- **Cause**: Actual test failures (not permissions anymore)
- **Action**: 
  1. Check if `newsletter_subscribers` table exists in CI test database
  2. Verify migrations run before E2E tests in `e2e/global-setup.ts`
  3. May need to add migration 0034 to E2E setup

### 3. Database Migration Testing
- **File**: `.github/workflows/migration-test.yml`
- **Error**: `Process completed with exit code 1` in "Test Migrations" step
- **Cause**: Migration or schema integrity test failing
- **Action**:
  1. Run migrations locally: `npm run migrate`
  2. Check for foreign key cascade issues
  3. Verify newsletter_subscribers FK to users has proper cascade rule

### 4. Pull Request Validation
- **File**: `.github/workflows/pr-validation.yml`
- **Status**: May still be running or have failures
- **Action**: Check CodeQL scan results for remaining issues

### 5. CodeQL Security Scanning
- **Note**: CodeQL runs on its own schedule and may take time to pick up fixes
- **Action**: Wait for new scan after latest commits

## Commands to Debug

```bash
# Check for 'any' types in changed files
git diff origin/add_scraping..HEAD --name-only | grep -E '\.(ts|tsx)$' | xargs grep -l ": any\|<any>\|as any"

# Run migrations locally
npm run migrate

# Run tests locally
npm test

# Check E2E helpers for newsletter_subscribers
grep -n "newsletter" e2e/helpers.ts

# Validate migration syntax
cat migrations/0034_create_newsletter_subscribers.sql
```

## Files Modified in This PR (relevant to CI)

- `server/test/routes/compare-routes-simple.test.ts` - CSRF + secure cookie
- `server/__tests__/user-preferences-routes.test.ts` - secure cookie
- `server/__tests__/redis-session-storage.test.ts` - secure cookie + SessionData type
- `server/routes/__tests__/newsletter-routes.test.ts` - secure cookie
- `migrations/0034_create_newsletter_subscribers.sql` - TIMESTAMP WITH TIME ZONE
- `.github/workflows/*.yml` - permissions and syntax fixes

## Key Patterns to Follow

### Session Cookie in Tests
```typescript
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
}
```

### CSRF in Test Apps
```typescript
import { csrfProtection } from '../../middleware/security';
// After session middleware, before routes:
app.use(csrfProtection);
```

### Workflow Permissions
```yaml
permissions:
  contents: read
  pull-requests: write
```

## Next Steps

1. Wait for latest CI runs to complete on commit `2cffa09`
2. Check CodeQL scan results for any remaining security issues
3. Investigate E2E test failures - likely need to ensure migration 0034 runs in CI
4. Investigate migration test failure - may be FK cascade or schema mismatch
5. Once all checks pass, merge PR #185 into `add_scraping`
