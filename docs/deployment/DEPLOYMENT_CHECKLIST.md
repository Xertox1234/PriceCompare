# Deployment Checklist: Price Aggregation Service

**Version**: 1.0.0
**Date**: 2025-11-16
**Status**: Ready for Production Deployment

---

## Pre-Deployment Checklist

### 1. Database Migration

- [ ] **Apply migration 0010_add_job_locks.sql**

  ```bash
  # Option A: Use npm script (recommended)
  export DATABASE_URL="your-connection-string"
  npm run migrate

  # Option B: Use provided script
  ./migrations/apply-0010-job-locks.sh

  # Option C: Use psql directly
  psql "$DATABASE_URL" -f migrations/0010_add_job_locks.sql
  ```

- [ ] **Verify migration success**

  ```sql
  SELECT tablename FROM pg_tables WHERE tablename = 'job_locks';
  -- Should return: job_locks

  SELECT COUNT(*) FROM job_locks;
  -- Should return: 0 (empty table initially)
  ```

### 2. Environment Variables

- [ ] **DATABASE_URL** is set and valid
- [ ] Database credentials have appropriate permissions:
  - CREATE TABLE
  - CREATE INDEX
  - INSERT/UPDATE/DELETE on job_locks
  - SELECT/INSERT/UPDATE/DELETE on analytics tables

### 3. Code Review

- [ ] Review recent commits:
  ```bash
  git log --oneline -6
  # Should show:
  # 901ad07 feat: Implement optional enhancements for job locking system
  # 49f13ff docs: Add audit report, patterns guide, and job locks migration
  # 993fabe perf: Optimize count queries and add distributed job locking
  # 13ed668 feat: Display retailer names and logos in analytics dashboard
  # e859c1e feat: Add transaction handling for data consistency
  # 1417733 perf: Optimize price aggregation and trend analysis with N+1 query fixes
  ```

- [ ] All tests pass (if applicable)
- [ ] No linter errors
- [ ] Build succeeds without warnings

---

## Deployment Steps

### Step 1: Deploy Database Migration

```bash
# On database server or with access to DATABASE_URL
npm run migrate
```

**Expected output**:
```
🔄 Starting database migrations...

📄 Running migration: 0001_add_pgvector_embeddings.sql
✅ Migration 0001_add_pgvector_embeddings.sql completed successfully
...
📄 Running migration: 0010_add_job_locks.sql
✅ Migration 0010_add_job_locks.sql completed successfully

✨ All migrations completed successfully!
```

### Step 2: Deploy Application Code

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Restart application servers
pm2 restart pricecompare
# OR
systemctl restart pricecompare
```

### Step 3: Verify Deployment

#### A. Check Health Endpoint

```bash
curl http://your-server/api/health/job-locks
```

**Expected response**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-16T...",
  "summary": {
    "totalLocks": 0,
    "activeLocks": 0,
    "expiredLocks": 0
  },
  "byJob": {},
  "activeLockDetails": [],
  "expiredLockDetails": []
}
```

#### B. Check Logs for Job Execution

```bash
# Wait for scheduled jobs to run, or trigger manually
tail -f /var/log/pricecompare/app.log

# Look for:
# [JobLock] Acquired lock for job "price-analytics:weekly-aggregation"
# Weekly price aggregation completed: X aggregates calculated
# [JobLock] Released lock for job "price-analytics:weekly-aggregation"
```

#### C. Manually Trigger a Job (Admin Only)

```bash
# Test weekly aggregation
curl -X POST http://your-server/api/admin/analytics/calculate-weekly \
  -H "Authorization: Bearer your-admin-token"

# Expected: Should see lock acquisition and release in logs
```

---

## Post-Deployment Verification

### Within 24 Hours

- [ ] **Verify daily jobs ran successfully**
  - Daily snapshot generation (1:00 AM)
  - Daily trend analysis (3:00 AM)

  ```bash
  # Check logs for successful execution
  grep "daily.*completed" /var/log/pricecompare/app.log
  ```

- [ ] **Check job lock health**
  ```bash
  curl http://your-server/api/health/job-locks | jq '.summary'
  ```

- [ ] **Verify no duplicate job execution**
  ```bash
  # In multi-server setup, check logs on all servers
  # Should see "skipped - already running on another server" on some servers
  grep "skipped.*another server" /var/log/pricecompare/*.log
  ```

### Within 1 Week

- [ ] **Verify weekly jobs ran successfully**
  - Weekly aggregation (Sunday 11:00 PM)
  - Weekly cleanup (Sunday 2:00 AM)

- [ ] **Check analytics data is being generated**
  ```sql
  SELECT COUNT(*) FROM price_aggregates_weekly
  WHERE created_at > NOW() - INTERVAL '7 days';
  -- Should have new records

  SELECT COUNT(*) FROM price_trends
  WHERE last_analyzed_at > NOW() - INTERVAL '7 days';
  -- Should have updated records
  ```

- [ ] **Monitor database query performance**
  ```sql
  -- Check count query performance (should be fast)
  EXPLAIN ANALYZE SELECT COUNT(*) FROM price_aggregates_weekly;
  -- Should show "Aggregate" with low execution time (<10ms)
  ```

### Within 1 Month

- [ ] **Verify monthly jobs ran successfully**
  - Monthly aggregation (last day of month 11:30 PM)

- [ ] **Review analytics dashboard usage**
  - Check frontend analytics page: `/products/{id}/analytics`
  - Verify retailer names and logos display correctly
  - Confirm trend indicators show accurate data

---

## Rollback Plan

If issues arise, follow this rollback procedure:

### 1. Immediate Rollback (Code Only)

```bash
# Revert to previous version
git revert HEAD~5..HEAD
git push origin main

# Redeploy
npm run build
pm2 restart pricecompare
```

### 2. Full Rollback (Code + Database)

```bash
# Revert code
git revert HEAD~5..HEAD
git push origin main

# Remove job_locks table
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS job_locks CASCADE;"

# Redeploy
npm run build
pm2 restart pricecompare
```

**Note**: Jobs will run without distributed locking after rollback. Safe for single-server deployments.

---

## Monitoring & Alerting

### Key Metrics to Monitor

1. **Job Lock Health**
   - Endpoint: `GET /api/health/job-locks`
   - Alert if: `expiredLocks > 5` (indicates stuck jobs)
   - Alert if: `activeLocks > 10` (unusual, investigate)

2. **Job Execution Success Rate**
   - Monitor logs for "completed successfully" messages
   - Alert if: No completion messages for 24+ hours

3. **Database Performance**
   - Monitor query execution time for analytics queries
   - Alert if: Average query time > 100ms (should be <10ms)

4. **Lock Contention**
   - Monitor for frequent "skipped - already running" messages
   - Expected: ~50% skip rate in 2-server setup
   - Alert if: 100% skip rate (no jobs running)

### Sample Monitoring Queries

```sql
-- Active locks older than expected TTL (stuck locks)
SELECT * FROM job_locks
WHERE expires_at < NOW()
AND locked_at < NOW() - INTERVAL '2 hours';

-- Lock acquisition frequency by job
SELECT job_name, COUNT(*) as lock_count,
       MAX(locked_at) as last_acquired
FROM job_locks
WHERE locked_at > NOW() - INTERVAL '7 days'
GROUP BY job_name;
```

---

## Troubleshooting Guide

### Issue: Jobs not running

**Symptoms**: No log messages for scheduled jobs

**Check**:
1. Are cron schedules correct? (Check server timezone)
2. Is application running? (`pm2 status` or `systemctl status`)
3. Are job startup functions called? (Check `server/index.ts`)

**Solution**:
```bash
# Restart application
pm2 restart pricecompare

# Check logs
tail -f /var/log/pricecompare/app.log
```

### Issue: Duplicate job execution

**Symptoms**: Same job running simultaneously on multiple servers

**Check**:
1. Is migration applied? `SELECT * FROM job_locks;`
2. Do all servers have same DATABASE_URL?
3. Check logs for lock acquisition failures

**Solution**:
```bash
# Verify migration on all servers
psql "$DATABASE_URL" -c "\d job_locks"

# Check application logs for errors
grep "JobLock.*error" /var/log/pricecompare/*.log
```

### Issue: All jobs being skipped

**Symptoms**: Every job logs "skipped - already running on another server"

**Check**:
1. Are locks expired? `SELECT * FROM job_locks WHERE expires_at > NOW();`
2. Is cleanup running? (Should auto-cleanup expired locks)

**Solution**:
```bash
# Manual cleanup of expired locks
psql "$DATABASE_URL" -c "DELETE FROM job_locks WHERE expires_at < NOW();"

# Restart one application server
pm2 restart pricecompare-0
```

### Issue: Slow analytics queries

**Symptoms**: Analytics page loads slowly

**Check**:
1. Is COUNT optimization applied? (Should use `COUNT(*)` not `.length`)
2. Are indexes present? `\di price_aggregates*`

**Solution**:
```sql
-- Rebuild indexes if needed
REINDEX TABLE price_aggregates_weekly;
REINDEX TABLE price_aggregates_monthly;
REINDEX TABLE price_trends;

-- Update statistics
ANALYZE price_aggregates_weekly;
ANALYZE price_aggregates_monthly;
ANALYZE price_trends;
```

---

## Success Criteria

Deployment is successful when:

- [x] Migration applied without errors
- [ ] Health endpoint returns `"status": "ok"`
- [ ] Daily jobs execute successfully for 3 consecutive days
- [ ] Weekly jobs execute successfully
- [ ] No duplicate job execution in multi-server setup
- [ ] Analytics queries return results in <50ms
- [ ] Frontend analytics page loads without errors
- [ ] Retailer names display correctly (not IDs)
- [ ] No errors in application logs related to job locking

---

## Content Security Policy (CSP) Enforcement

### Overview

CSP is deployed in **Report-Only mode** by default. This allows monitoring violations before enforcement.

**Implementation**: `server/middleware/security.ts` (lines 366-374)

### CSP Enforcement Checklist

#### Phase 1: Monitoring (24-48 hours)

- [ ] **Deploy with Report-Only mode (default)**
  - No action needed; CSP_ENFORCE is unset
  - Browser logs violations but does not block content

- [ ] **Monitor CSP violation reports**
  ```bash
  # Check server logs for violation reports
  grep "csp-violation" /var/log/pricecompare/app.log

  # Or check the violation endpoint logs
  grep "POST /api/csp-violation-report" /var/log/pricecompare/access.log
  ```

- [ ] **Review violations for false positives**
  - Inline scripts without nonces (add nonces or move to external files)
  - Third-party resources blocked (add to appropriate directive)
  - Data URIs blocked (verify img-src or font-src includes `data:`)

#### Phase 2: Enable Enforcement

- [ ] **Add environment variable to production**
  ```bash
  # In production .env file
  CSP_ENFORCE=true
  ```

- [ ] **Deploy and restart application**
  ```bash
  pm2 restart pricecompare
  # OR
  systemctl restart pricecompare
  ```

#### Phase 3: Post-Enforcement Verification

- [ ] **Test all major pages**
  - Home page loads correctly
  - Product pages render with images
  - User authentication flows work
  - Admin dashboard functions normally

- [ ] **Check browser console for CSP errors**
  ```
  Open DevTools (F12) -> Console tab
  Look for: "Refused to load..." or "Refused to execute..."
  ```

- [ ] **Verify response header**
  ```bash
  curl -I https://your-domain.com | grep -i content-security
  # Should show: Content-Security-Policy: ...
  # NOT: Content-Security-Policy-Report-Only: ...
  ```

### Current CSP Directives

```
default-src 'self'
script-src 'self' 'nonce-{random}'
style-src 'self' 'nonce-{random}'
img-src 'self' data: https:
font-src 'self' data:
connect-src 'self'
frame-ancestors 'none'
report-uri /api/csp-violation-report
```

### Troubleshooting CSP Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Scripts not executing | Missing nonce | Add `nonce={cspNonce}` to script tags |
| Styles not applying | Missing nonce | Add `nonce={cspNonce}` to style tags |
| Images not loading | src not in img-src | Add domain to `img-src` directive |
| Fonts not loading | Google Fonts blocked | Development mode allows; prod may need update |
| API calls failing | connect-src too restrictive | Add API domain to `connect-src` |

### Rollback CSP Enforcement

If issues arise after enabling enforcement:

```bash
# Remove or comment out CSP_ENFORCE
# CSP_ENFORCE=true

# Restart application
pm2 restart pricecompare

# Browser will see Report-Only header again
# Application continues working while you fix issues
```

---

## Support & Documentation

- **Audit Report**: `docs/AUDIT_2025-11-16.md`
- **Database Patterns**: `docs/02_DATABASE_PATTERNS.md`
- **Background Jobs Patterns**: `docs/07_BACKGROUND_JOBS_PATTERNS.md`
- **Migration Guide**: `migrations/README.md`
- **Implementation**: `server/services/job-lock-service.ts`
- **CSP Implementation**: `server/middleware/security.ts` (securityHeaders function)

For questions or issues, refer to the comprehensive audit report which includes:
- Race condition analysis
- Performance benchmarks
- Testing recommendations
- Edge case handling

---

**Deployment prepared by**: Claude Code
**Reviewed by**: [Your name]
**Approved by**: [Approver name]
**Deployed on**: [Date]
