# Backup and Recovery Guide

This guide documents the database backup and disaster recovery procedures for PriceCompare.

## Table of Contents

- [Overview](#overview)
- [Automated Backups](#automated-backups)
- [Manual Backups](#manual-backups)
- [Restoration Procedures](#restoration-procedures)
- [Disaster Recovery](#disaster-recovery)
- [Configuration](#configuration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Overview

### Backup Strategy

PriceCompare uses a multi-tier backup strategy:

| Tier | Frequency | Retention | Storage | Purpose |
|------|-----------|-----------|---------|---------|
| Automated Daily | Daily @ 02:00 UTC | 30 days | S3 | Primary backup |
| GitHub Artifacts | Daily | 7 days | GitHub | Secondary/quick access |
| Manual On-Demand | As needed | Varies | Local/S3 | Pre-deployment, testing |
| Schema-Only | On-demand | N/A | Local | Migration reference |

### Backup Format

All backups use PostgreSQL custom format (`pg_dump -Fc`):
- **Compressed**: ~10x smaller than SQL dumps
- **Parallel restore**: Faster restoration on multi-core systems
- **Selective restore**: Can restore specific tables/schemas
- **Integrity verification**: Built-in TOC verification

---

## Automated Backups

### GitHub Actions Workflow

The automated backup runs via `.github/workflows/database-backup.yml`:

```yaml
# Schedule: Daily at 2 AM UTC
schedule:
  - cron: '0 2 * * *'
```

### What Gets Backed Up

- All PostgreSQL tables in the `public` schema
- Table data, indexes, constraints
- Sequences and their current values
- Functions and triggers

### What's NOT Backed Up

- PostgreSQL system catalogs
- Temporary tables
- Session data (stored in Redis)

### Triggering Manual Backup

1. Go to **Actions** → **Database Backup**
2. Click **Run workflow**
3. Select backup type:
   - `daily` - Standard data backup
   - `full` - Complete backup with all metadata
   - `schema-only` - Structure only, no data

---

## Manual Backups

### Using the Backup Script

```bash
# Basic daily backup
./scripts/backup-database.sh

# Schema-only backup (no data)
./scripts/backup-database.sh -t schema-only

# Backup with S3 upload
./scripts/backup-database.sh -s -b my-backup-bucket

# Custom output directory
./scripts/backup-database.sh -o /path/to/backups

# Keep backups for 14 days locally
./scripts/backup-database.sh -k 14
```

### Direct pg_dump Command

For quick manual backups:

```bash
# Set database URL
export DATABASE_URL="postgresql://user:pass@host:5432/pricecompare"

# Create backup
pg_dump -Fc $DATABASE_URL > pricecompare-$(date +%Y%m%d).dump

# Verify backup
pg_restore --list pricecompare-$(date +%Y%m%d).dump
```

### Pre-Deployment Backup

**ALWAYS** create a backup before major deployments:

```bash
# Create pre-deployment backup with timestamp
./scripts/backup-database.sh -t full -o ./backups/pre-deploy

# Verify it worked
ls -la ./backups/pre-deploy/
```

---

## Restoration Procedures

### Standard Restoration

```bash
# Restore from local backup
./scripts/restore-database.sh ./backups/pricecompare-daily-20251201.dump

# Restore from S3
./scripts/restore-database.sh --from-s3 pricecompare-daily-20251201.dump -b my-bucket
```

### Restoration Options

```bash
# Verify backup without restoring (RECOMMENDED first)
./scripts/restore-database.sh backup.dump --verify-only

# Dry run - see what would happen
./scripts/restore-database.sh backup.dump --dry-run

# Drop existing data before restore (DANGEROUS)
./scripts/restore-database.sh backup.dump --drop

# Restore to different database (for testing)
./scripts/restore-database.sh backup.dump -d postgresql://localhost:5432/test_restore
```

### Restoring to New Database

When setting up a new environment:

```bash
# 1. Create the database
createdb -h localhost -U postgres pricecompare_restored

# 2. Enable required extensions
psql -h localhost -U postgres -d pricecompare_restored -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 3. Restore backup
./scripts/restore-database.sh backup.dump -d postgresql://postgres:password@localhost:5432/pricecompare_restored

# 4. Run any pending migrations
DATABASE_URL=postgresql://postgres:password@localhost:5432/pricecompare_restored npm run migrate
```

### Selective Restoration

Restore specific tables only:

```bash
# List tables in backup
pg_restore --list backup.dump | grep "TABLE"

# Restore specific table
pg_restore -d $DATABASE_URL --table=products backup.dump

# Restore multiple tables
pg_restore -d $DATABASE_URL --table=products --table=product_offers backup.dump
```

---

## Disaster Recovery

### Recovery Time Objectives

| Scenario | RTO Target | RPO Target |
|----------|------------|------------|
| Single table corruption | 15 minutes | 24 hours |
| Database corruption | 1 hour | 24 hours |
| Full server failure | 2 hours | 24 hours |
| Complete data center loss | 4 hours | 24 hours |

**RTO** = Recovery Time Objective (how long to restore)  
**RPO** = Recovery Point Objective (max data loss acceptable)

### Disaster Recovery Runbook

#### Scenario 1: Table Corruption

```bash
# 1. Identify corrupted table
# 2. Download latest backup
./scripts/restore-database.sh --from-s3 latest-backup.dump -b my-bucket --verify-only

# 3. Restore specific table to temp database
createdb pricecompare_recovery
./scripts/restore-database.sh backup.dump -d postgresql://localhost/pricecompare_recovery

# 4. Copy data from recovery database
psql $DATABASE_URL -c "
  TRUNCATE products;
  INSERT INTO products SELECT * FROM dblink('dbname=pricecompare_recovery', 'SELECT * FROM products') AS t(...);
"

# 5. Drop recovery database
dropdb pricecompare_recovery
```

#### Scenario 2: Full Database Recovery

```bash
# 1. Stop application
pm2 stop all  # or systemctl stop pricecompare

# 2. Download latest backup
aws s3 cp s3://backup-bucket/daily/latest.dump ./recovery.dump

# 3. Verify backup
./scripts/restore-database.sh recovery.dump --verify-only

# 4. Drop and recreate database
dropdb pricecompare
createdb pricecompare
psql -d pricecompare -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. Restore
./scripts/restore-database.sh recovery.dump

# 6. Run migrations (may be needed)
npm run migrate

# 7. Restart application
pm2 start all

# 8. Verify functionality
curl -I https://yourapp.com/api/health
```

#### Scenario 3: S3 Backups Unavailable

If S3 is inaccessible, use GitHub artifacts:

1. Go to **Actions** → **Database Backup**
2. Find recent successful run
3. Download artifact: `database-backup-YYYYMMDD-HHMMSS`
4. Extract and restore locally

---

## Configuration

### Required Secrets

Configure in GitHub repository settings (Settings → Secrets → Actions):

| Secret | Description | Required |
|--------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `BACKUP_S3_BUCKET` | S3 bucket name for backups | Yes (for S3) |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes (for S3) |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes (for S3) |
| `AWS_REGION` | AWS region (default: us-east-1) | No |
| `SLACK_WEBHOOK_URL` | Slack webhook for alerts | No |

### S3 Bucket Setup

```bash
# Create bucket
aws s3 mb s3://pricecompare-backups

# Set lifecycle policy (30-day retention)
aws s3api put-bucket-lifecycle-configuration \
  --bucket pricecompare-backups \
  --lifecycle-configuration file://s3-lifecycle.json
```

Example `s3-lifecycle.json`:
```json
{
  "Rules": [
    {
      "ID": "DeleteOldBackups",
      "Status": "Enabled",
      "Filter": { "Prefix": "daily/" },
      "Expiration": { "Days": 30 }
    },
    {
      "ID": "ArchiveFullBackups",
      "Status": "Enabled",
      "Filter": { "Prefix": "full/" },
      "Transitions": [
        { "Days": 30, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }
  ]
}
```

### IAM Policy for Backups

Minimum required permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::pricecompare-backups",
        "arn:aws:s3:::pricecompare-backups/*"
      ]
    }
  ]
}
```

---

## Monitoring

### Backup Health Checks

The weekly maintenance workflow (`.github/workflows/scheduled-maintenance.yml`) includes backup integrity checks.

### Manual Health Check

```bash
# Check latest backup age
aws s3 ls s3://pricecompare-backups/daily/ | sort | tail -1

# List all backups
aws s3 ls s3://pricecompare-backups/daily/ --recursive | wc -l

# Verify specific backup
aws s3 cp s3://pricecompare-backups/daily/latest.dump ./temp.dump
pg_restore --list ./temp.dump
rm ./temp.dump
```

### Alert Triggers

Automated alerts are triggered when:

- ❌ Backup job fails
- ⚠️ Latest backup is more than 24 hours old
- ⚠️ Backup integrity check fails

Alerts create GitHub issues with `backup-failure` label.

---

## Troubleshooting

### Common Issues

#### "pg_dump: command not found"

Install PostgreSQL client:
```bash
# macOS
brew install postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql-client-15
```

#### "connection refused" Error

- Verify `DATABASE_URL` is correct
- Check firewall allows connection from GitHub Actions IP ranges
- Verify database user has permission to run pg_dump

#### Backup File Too Large

For databases >1GB, consider:
1. Increase workflow timeout (default: 30 minutes)
2. Use parallel dump: `pg_dump -j 4 ...`
3. Exclude large tables from daily backups

#### Restoration Fails with "already exists"

Use `--drop` flag to clean existing objects:
```bash
./scripts/restore-database.sh backup.dump --drop
```

#### Missing Extensions Error

Before restoring, ensure extensions exist:
```bash
psql -d $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Support

For backup-related issues:

1. Check GitHub Actions logs for detailed error messages
2. Review `backup-failure` labeled issues
3. Consult this guide's troubleshooting section
4. Contact infrastructure team

---

## Restoration Testing

### Quarterly Drill Procedure

Perform restoration drills quarterly to ensure backups are valid:

1. **Download random backup** (not always latest)
2. **Create test database**
3. **Restore backup**
4. **Run application tests against restored DB**
5. **Document results** in drill log
6. **Clean up test resources**

### Drill Script

```bash
#!/bin/bash
# Quarterly backup drill

# 1. Get random backup from last 30 days
BACKUP=$(aws s3 ls s3://pricecompare-backups/daily/ | shuf | head -1 | awk '{print $4}')

# 2. Download
aws s3 cp "s3://pricecompare-backups/daily/$BACKUP" ./drill-backup.dump

# 3. Create test database
createdb pricecompare_drill

# 4. Restore
pg_restore -d pricecompare_drill ./drill-backup.dump

# 5. Run basic verification
psql -d pricecompare_drill -c "SELECT COUNT(*) FROM users;"
psql -d pricecompare_drill -c "SELECT COUNT(*) FROM products;"
psql -d pricecompare_drill -c "SELECT COUNT(*) FROM price_history;"

# 6. Cleanup
dropdb pricecompare_drill
rm ./drill-backup.dump

echo "Drill completed successfully for backup: $BACKUP"
```

### Drill Log Template

Document each drill in `/docs/backup-drill-logs/`:

```markdown
# Backup Drill Log - YYYY-MM-DD

## Summary
- **Date**: YYYY-MM-DD
- **Performed By**: [Name]
- **Backup Used**: pricecompare-daily-YYYYMMDD-HHMMSS.dump
- **Result**: ✅ Success / ❌ Failed

## Verification Results
- Users table: X records
- Products table: X records
- Price history: X records

## Issues Found
- None / [Description of any issues]

## Action Items
- None / [Follow-up actions needed]
```

---

## Quick Reference

### Emergency Commands

```bash
# Create immediate backup
pg_dump -Fc $DATABASE_URL > emergency-$(date +%s).dump

# List S3 backups
aws s3 ls s3://pricecompare-backups/daily/

# Download latest backup
aws s3 cp s3://pricecompare-backups/daily/$(aws s3 ls s3://pricecompare-backups/daily/ | sort | tail -1 | awk '{print $4}') ./latest.dump

# Quick restore (DESTRUCTIVE)
pg_restore -d $DATABASE_URL --clean --if-exists latest.dump
```

### Important Paths

| Path | Description |
|------|-------------|
| `.github/workflows/database-backup.yml` | Automated backup workflow |
| `scripts/backup-database.sh` | Manual backup script |
| `scripts/restore-database.sh` | Restoration script |
| `docs/BACKUP_RECOVERY_GUIDE.md` | This guide |

---

*Last Updated: 2025-12-01*
*Next Review: 2026-03-01*
