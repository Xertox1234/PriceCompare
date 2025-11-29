# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the PriceCompare project.

## Active Workflows

### pr-validation.yml
**Trigger:** Pull requests to main/develop/add_scraping branches

**Purpose:** Comprehensive validation for all pull requests

**Jobs:**
1. **quality** - Code quality checks
   - ESLint (zero warnings enforcement)
   - TypeScript type checking
   - console.log detection
   - 'any' type detection

2. **test** - Full test suite with coverage
   - PostgreSQL + Redis services
   - Database setup (pgvector, schema, migrations)
   - Unit and integration tests with coverage
   - Upload to Codecov & Coveralls
   - PR coverage comments
   - Coverage artifact archival (30 days)

3. **security** - Security scanning
   - npm audit (moderate+ vulnerabilities)
   - Security-specific test suite

4. **build** - Build verification
   - Production build validation
   - Build artifact archival (7 days)

5. **pre-commit** - Pre-commit hook simulation
   - passwordHash exposure detection
   - N+1 query pattern detection
   - Foreign key cascade rule checks
   - Hardcoded secrets detection

6. **ci-success** - Summary job (requires all jobs to pass)

### e2e-tests.yml
**Trigger:** Pull requests, manual dispatch

**Purpose:** End-to-end browser testing with Playwright

**Features:**
- Chromium browser automation
- Full application build and server startup
- Concurrency control (cancels in-progress runs)
- Test videos on failure
- PR comments on failure
- 20 minute timeout

### security-scan.yml
**Trigger:** Scheduled (likely daily/weekly)

**Purpose:** Regular security audits

### migration-test.yml
**Trigger:** Database migration changes

**Purpose:** Test database migrations in isolation

### scheduled-maintenance.yml
**Trigger:** Cron schedule

**Purpose:** Periodic maintenance tasks

### dependabot-auto-merge.yml
**Trigger:** Dependabot PRs

**Purpose:** Automated dependency updates

### pr-size-labeler.yml
**Trigger:** Pull requests (opened, synchronized, reopened)

**Purpose:** Automatically label PRs by size

**Size Categories:**
- **XS:** 0-10 lines changed
- **S:** 11-100 lines changed
- **M:** 101-500 lines changed
- **L:** 501-1000 lines changed
- **XL:** 1000+ lines changed (with warning message)

**Benefits:**
- Encourages smaller, more reviewable PRs
- Helps prioritize review efforts
- Improves code review quality
- Reduces merge conflicts

## Workflow Strategy

**For Pull Requests:**
- `pr-validation.yml` - Comprehensive checks (quality, tests, security, build)
- `e2e-tests.yml` - Browser automation tests (runs in parallel)

**For Main Branch:**
- Coverage tracking via successful PR merges
- No redundant workflows on main branch pushes

**Periodic:**
- `security-scan.yml` - Regular security audits
- `scheduled-maintenance.yml` - Automated maintenance
- `dependabot-auto-merge.yml` - Dependency updates

## Coverage Reporting

Coverage is reported on every PR via:
- **Codecov** - Coverage trends and diffs
- **Coveralls** - Alternative coverage tracking
- **PR Comments** - Line-by-line coverage changes via lcov-reporter-action

## Performance Optimizations

All workflows include aggressive caching for faster builds:

**node_modules caching:**
- Cache key: `${{ runner.os }}-node-modules-${{ hashFiles('package-lock.json') }}`
- Saves ~30-60s per job on cache hit
- Applied to all jobs in pr-validation.yml and e2e-tests.yml

**Playwright browser caching:**
- Cache key: `${{ runner.os }}-playwright-${{ hashFiles('package-lock.json') }}`
- Saves ~2-3 minutes on cache hit (skips 400MB download)
- Only downloads browsers when package-lock.json changes

**Path filtering:**
- Workflows skip CI for documentation-only changes (*.md, docs/*, etc.)
- Reduces unnecessary runs by ~15-20%

**Artifact retention:**
- Coverage reports: 7 days (reduced from 30)
- Playwright reports: 7 days (reduced from 14)
- Build artifacts: 3 days (reduced from 7)
- Estimated cost savings: ~70% on artifact storage

## Recent Changes (2025-11-28)

### Workflow Consolidation
1. **Removed test-coverage.yml** - Fully redundant with pr-validation.yml
2. **Added ESLint** to pr-validation.yml for lint enforcement
3. **Consolidated coverage** - Single source of truth in pr-validation.yml
4. **Separated E2E** - Isolated in e2e-tests.yml with concurrency control

### Performance Improvements
5. **Added node_modules caching** - All workflows cache dependencies
6. **Added Playwright browser caching** - Skip 400MB download on cache hit
7. **Added path filtering** - Skip CI for docs-only PRs
8. **Reduced artifact retention** - 70% cost savings on storage
9. **Added lint scripts** - Centralized ESLint commands in package.json
10. **Added PR size labeler** - Auto-label PRs by size (XS/S/M/L/XL)
