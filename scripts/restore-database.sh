#!/usr/bin/env bash
#
# Database Restoration Script for PriceCompare
#
# This script restores a PostgreSQL database from a pg_dump backup.
# It supports restoring from local files or downloading from S3.
#
# Usage:
#   ./scripts/restore-database.sh <backup-file> [options]
#   ./scripts/restore-database.sh --from-s3 <backup-name> [options]
#
# Options:
#   -d, --database URL  Target database URL (default: $DATABASE_URL)
#   --from-s3           Download backup from S3 before restoring
#   -b, --bucket NAME   S3 bucket name (required with --from-s3)
#   -t, --type TYPE     S3 backup type folder: daily, full (default: daily)
#   --drop              Drop existing database objects before restore
#   --dry-run           Show what would be done without making changes
#   --verify-only       Verify backup integrity without restoring
#   -h, --help          Show this help message
#
# Environment Variables:
#   DATABASE_URL        PostgreSQL connection string (required)
#   AWS_ACCESS_KEY_ID   AWS access key (required for S3 download)
#   AWS_SECRET_ACCESS_KEY AWS secret key (required for S3 download)
#   AWS_REGION          AWS region (default: us-east-1)
#
# Examples:
#   # Restore from local backup
#   ./scripts/restore-database.sh ./backups/pricecompare-daily-20251130.dump
#
#   # Restore from S3
#   ./scripts/restore-database.sh --from-s3 pricecompare-daily-20251130.dump -b my-bucket
#
#   # Verify backup without restoring
#   ./scripts/restore-database.sh ./backups/backup.dump --verify-only
#
#   # Restore to different database (for testing)
#   ./scripts/restore-database.sh backup.dump -d postgresql://localhost:5432/test_db
#
# IMPORTANT: This script can destroy data. Always verify your backup
# and target database before running.
#
# See docs/BACKUP_RECOVERY_GUIDE.md for full documentation.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
TARGET_DATABASE="${DATABASE_URL:-}"
FROM_S3=false
S3_BUCKET=""
S3_TYPE="daily"
DROP_EXISTING=false
DRY_RUN=false
VERIFY_ONLY=false
BACKUP_FILE=""

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Help message
show_help() {
    head -50 "$0" | grep "^#" | cut -c 3-
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--database)
            TARGET_DATABASE="$2"
            shift 2
            ;;
        --from-s3)
            FROM_S3=true
            shift
            ;;
        -b|--bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -t|--type)
            S3_TYPE="$2"
            shift 2
            ;;
        --drop)
            DROP_EXISTING=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verify-only)
            VERIFY_ONLY=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            BACKUP_FILE="$1"
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$BACKUP_FILE" ]]; then
    log_error "Backup file is required"
    show_help
    exit 1
fi

if [[ -z "$TARGET_DATABASE" ]] && [[ "$VERIFY_ONLY" == false ]]; then
    log_error "Target database URL is required"
    log_error "Set DATABASE_URL environment variable or use -d flag"
    exit 1
fi

# Check S3 requirements
if [[ "$FROM_S3" == true ]]; then
    if [[ -z "$S3_BUCKET" ]]; then
        log_error "S3 bucket name is required when using --from-s3"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is required for S3 downloads"
        exit 1
    fi
fi

# Check pg_restore is available
if ! command -v pg_restore &> /dev/null; then
    log_error "pg_restore is not installed or not in PATH"
    exit 1
fi

# Download from S3 if needed
if [[ "$FROM_S3" == true ]]; then
    log_info "Downloading backup from S3..."
    LOCAL_BACKUP="./backups/${BACKUP_FILE}"
    mkdir -p ./backups

    aws s3 cp "s3://${S3_BUCKET}/${S3_TYPE}/${BACKUP_FILE}" "$LOCAL_BACKUP"

    # Also download checksum if available
    CHECKSUM_FILE="${BACKUP_FILE}.sha256"
    if aws s3 ls "s3://${S3_BUCKET}/${S3_TYPE}/${CHECKSUM_FILE}" &> /dev/null; then
        aws s3 cp "s3://${S3_BUCKET}/${S3_TYPE}/${CHECKSUM_FILE}" "${LOCAL_BACKUP}.sha256"
        log_info "Checksum file downloaded"
    fi

    BACKUP_FILE="$LOCAL_BACKUP"
    log_success "Downloaded to ${BACKUP_FILE}"
fi

# Verify backup file exists
if [[ ! -f "$BACKUP_FILE" ]]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Get backup info
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
log_info "Backup file: ${BACKUP_FILE}"
log_info "Backup size: ${BACKUP_SIZE}"

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ -f "$CHECKSUM_FILE" ]]; then
    log_info "Verifying checksum..."
    if command -v sha256sum &> /dev/null; then
        if sha256sum -c "$CHECKSUM_FILE" &> /dev/null; then
            log_success "Checksum verified"
        else
            log_error "Checksum verification failed!"
            exit 1
        fi
    elif command -v shasum &> /dev/null; then
        if shasum -a 256 -c "$CHECKSUM_FILE" &> /dev/null; then
            log_success "Checksum verified"
        else
            log_error "Checksum verification failed!"
            exit 1
        fi
    else
        log_warn "No SHA256 tool found, skipping checksum verification"
    fi
fi

# Verify backup integrity
log_info "Verifying backup integrity..."
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
    log_success "Backup integrity verified"
else
    log_error "Backup integrity check failed - file may be corrupted"
    exit 1
fi

# Show backup contents
TABLE_COUNT=$(pg_restore --list "$BACKUP_FILE" 2>/dev/null | grep -c "TABLE" || echo "0")
log_info "Tables in backup: ${TABLE_COUNT}"

# Show what would be restored
if [[ "$DRY_RUN" == true ]] || [[ "$VERIFY_ONLY" == true ]]; then
    log_info "Backup contents:"
    pg_restore --list "$BACKUP_FILE" 2>/dev/null | head -50
    echo ""

    if [[ "$VERIFY_ONLY" == true ]]; then
        log_success "Verification complete - backup is valid"
        exit 0
    fi

    log_info "DRY RUN - No changes made"
    exit 0
fi

# Safety confirmation
echo ""
echo "========================================"
log_warn "DATABASE RESTORATION WARNING"
echo "========================================"
echo ""
echo "This will restore the following backup:"
echo "  File:   ${BACKUP_FILE}"
echo "  Size:   ${BACKUP_SIZE}"
echo "  Tables: ${TABLE_COUNT}"
echo ""

if [[ "$DROP_EXISTING" == true ]]; then
    echo -e "${RED}WARNING: --drop flag is set. Existing data will be DESTROYED.${NC}"
fi

# Extract database name from URL for display
if [[ -n "$TARGET_DATABASE" ]]; then
    DB_NAME=$(echo "$TARGET_DATABASE" | sed -E 's/.*\/([^?]+).*/\1/')
    echo "Target database: ${DB_NAME}"
fi
echo ""

read -p "Are you sure you want to proceed? (yes/no): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restoration cancelled"
    exit 0
fi

# Build pg_restore options
RESTORE_OPTIONS="--verbose --no-owner --no-privileges"

if [[ "$DROP_EXISTING" == true ]]; then
    RESTORE_OPTIONS="$RESTORE_OPTIONS --clean --if-exists"
fi

# Perform restoration
log_info "Starting database restoration..."
echo ""

if pg_restore -d "$TARGET_DATABASE" $RESTORE_OPTIONS "$BACKUP_FILE" 2>&1; then
    echo ""
    log_success "Database restoration completed successfully!"
else
    # pg_restore returns non-zero even on warnings, check if critical
    RESTORE_EXIT=$?
    if [[ $RESTORE_EXIT -eq 1 ]]; then
        log_warn "Restoration completed with warnings (this is often normal)"
    else
        log_error "Restoration failed with exit code: $RESTORE_EXIT"
        exit 1
    fi
fi

# Verify restoration
log_info "Verifying restoration..."
if command -v psql &> /dev/null; then
    RESTORED_TABLES=$(psql "$TARGET_DATABASE" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    log_info "Tables in restored database: ${RESTORED_TABLES}"
fi

echo ""
echo "========================================"
log_success "Restoration Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Verify application connectivity"
echo "  2. Run any pending migrations: npm run migrate"
echo "  3. Test critical functionality"
echo ""
