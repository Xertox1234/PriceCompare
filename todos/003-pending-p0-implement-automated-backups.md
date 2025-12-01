---
status: pending
priority: p0
issue_id: "003"
tags: [code-review, infrastructure, data-integrity, critical]
dependencies: []
source: code-review-2025-11-30
---

# Implement Automated Database Backups

## Problem Statement

**CRITICAL:** No automated backup strategy exists for production database. Current state:

- ❌ No backup scripts in `/migrations/scripts/`
- ❌ No GitHub Actions workflow for scheduled backups
- ❌ Manual backups only (mentioned in migration 0012: `pg_dump -Fc pricecompare > backup.dump`)
- ❌ No retention policy documented
- ❌ No disaster recovery plan
- ❌ No backup testing/restoration drills

**Risk:** Catastrophic data loss in production without recovery capability.

## Findings

**Discovery:** Data Integrity Guardian identified no backup automation

**Current State:**
- Migration 0012 mentions manual backup command
- No evidence of scheduled backups
- No backup storage configuration
- No point-in-time recovery capability

**Production Requirements:**
- Daily automated backups (minimum)
- 30-day retention (minimum)
- Off-site storage (S3/GCS/Azure Blob)
- Quarterly restoration testing
- Point-in-time recovery for production

## Proposed Solutions

### Option 1: GitHub Actions Daily Backup (RECOMMENDED for small-scale)

**Pros:**
- Free for public repos, cheap for private
- Easy to implement and maintain
- Version controlled workflow
- Email notifications on failure

**Cons:**
- Requires database accessible from GitHub runners
- 6-hour job timeout limit
- Manual upload to cloud storage needed

**Implementation:**

```yaml
# .github/workflows/database-backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Create backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          BACKUP_FILE="pricecompare-$(date +%Y%m%d-%H%M%S).dump"
          pg_dump -Fc $DATABASE_URL > $BACKUP_FILE
          echo "BACKUP_FILE=$BACKUP_FILE" >> $GITHUB_ENV

      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws s3 cp $BACKUP_FILE s3://pricecompare-backups/daily/$BACKUP_FILE

      - name: Cleanup old backups (30-day retention)
        run: |
          CUTOFF_DATE=$(date -d '30 days ago' +%Y%m%d)
          aws s3 ls s3://pricecompare-backups/daily/ | while read -r line; do
            BACKUP_DATE=$(echo $line | grep -oP '\d{8}')
            if [ "$BACKUP_DATE" -lt "$CUTOFF_DATE" ]; then
              BACKUP_NAME=$(echo $line | awk '{print $4}')
              aws s3 rm s3://pricecompare-backups/daily/$BACKUP_NAME
            fi
          done

      - name: Notify on failure
        if: failure()
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 465
          username: ${{ secrets.MAIL_USERNAME }}
          password: ${{ secrets.MAIL_PASSWORD }}
          subject: 'Database Backup FAILED'
          to: admin@pricecompare.com
          from: backups@pricecompare.com
          body: 'Daily database backup failed. Check GitHub Actions logs.'
```

### Option 2: Cloud Provider Native Backups (RECOMMENDED for production)

**For AWS RDS:**
- Automated daily snapshots
- Point-in-time recovery (5-minute granularity)
- Cross-region replication
- Managed retention policies

**For Azure Database:**
- Automatic daily backups
- Geo-redundant storage
- 7-35 day retention

**Pros:**
- Fully managed (zero maintenance)
- Point-in-time recovery built-in
- Faster restore times
- Better disaster recovery

**Cons:**
- Costs more than DIY
- Requires cloud provider database

### Option 3: pg_auto_failover + WAL Archiving

**Pros:**
- Self-hosted solution
- Sub-second recovery point
- High availability built-in

**Cons:**
- Complex setup
- Requires multiple servers
- Higher operational overhead

## Recommended Action

**Implement Option 1 immediately (GitHub Actions), migrate to Option 2 for production.**

### Phase 1: Immediate Protection (Week 1)

1. **Create GitHub Actions backup workflow**
2. **Set up S3 bucket** with 30-day lifecycle policy
3. **Test backup creation** (manual workflow trigger)
4. **Document restoration procedure**

### Phase 2: Production Readiness (Week 2-3)

5. **Implement restoration script**
6. **Perform restoration drill** (backup → new database → verify)
7. **Set up monitoring** (backup success/failure alerts)
8. **Document disaster recovery runbook**

### Phase 3: Production Migration (Future)

9. **Migrate to cloud provider native backups** (when moving to production)
10. **Enable point-in-time recovery**
11. **Set up cross-region replication**

## Technical Details

- **Backup Format:** PostgreSQL custom format (`-Fc`) - compressed, best for pg_restore
- **Estimated Size:** ~100MB per backup (depends on data volume)
- **Storage Cost:** S3 ~$0.023/GB/month = ~$2.30/month for 30 days of backups
- **Backup Duration:** <5 minutes for small database
- **Retention:** 30 days (configurable)

### Restoration Command:
```bash
# Restore from backup
pg_restore -d pricecompare_restored backup.dump

# OR restore to existing database (drop existing first)
pg_restore -d pricecompare --clean --if-exists backup.dump
```

## Acceptance Criteria

- [ ] GitHub Actions workflow created and tested
- [ ] S3 bucket configured with lifecycle policy
- [ ] Daily backups running successfully (3-day verification)
- [ ] Backup success/failure notifications working
- [ ] Restoration script created and tested
- [ ] Restoration drill completed successfully (backup → restore → verify data)
- [ ] Disaster recovery runbook documented in `docs/BACKUP_RECOVERY_GUIDE.md`
- [ ] Team trained on restoration procedure
- [ ] Monitoring dashboard shows backup health

## Work Log

### 2025-11-30 - Code Review Discovery
**By:** Data Integrity Guardian Agent
**Actions:**
- Discovered no automated backup system
- Identified manual backup mention in migration 0012
- Assessed catastrophic data loss risk

**Learnings:**
- Backups are **not optional** for production systems
- Manual backups = no backups (humans forget)
- Point-in-time recovery prevents data loss from user errors

## Resources

- PostgreSQL Backup Guide: https://www.postgresql.org/docs/current/backup.html
- AWS RDS Automated Backups: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html
- GitHub Actions Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets

## Notes

**Estimated Effort:** 1-2 days
- Workflow creation: 2-3 hours
- S3 setup: 1 hour
- Testing: 2-3 hours
- Documentation: 2 hours
- Restoration drill: 2-3 hours

**Risk Level:** Low (implementation risk)
**Impact Level:** CRITICAL (prevents catastrophic data loss)

**Urgency:** IMMEDIATE
- Production database without backups = unacceptable risk
- Should be deployed before any production launch

**Success Metric:** 100% backup success rate for 30 consecutive days
