#!/usr/bin/env bash
#
# Database Backup Script for PriceCompare
#
# This script creates a PostgreSQL backup using pg_dump in custom format.
# It supports local backups and optional S3 uploads.
#
# Usage:
#   ./scripts/backup-database.sh [options]
#
# Options:
#   -t, --type TYPE     Backup type: daily, full, schema-only (default: daily)
#   -o, --output DIR    Output directory (default: ./backups)
#   -s, --s3            Upload to S3 (requires AWS CLI configured)
#   -b, --bucket NAME   S3 bucket name (required with -s)
#   -k, --keep DAYS     Keep backups for N days locally (default: 7)
#   -h, --help          Show this help message
#
# Environment Variables:
#   DATABASE_URL        PostgreSQL connection string (required)
#   AWS_ACCESS_KEY_ID   AWS access key (required for S3 upload)
#   AWS_SECRET_ACCESS_KEY AWS secret key (required for S3 upload)
#   AWS_REGION          AWS region (default: us-east-1)
#
# Examples:
#   # Local backup
#   ./scripts/backup-database.sh
#
#   # Schema-only backup
#   ./scripts/backup-database.sh -t schema-only
#
#   # Upload to S3
#   ./scripts/backup-database.sh -s -b my-backup-bucket
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
BACKUP_TYPE="daily"
OUTPUT_DIR="./backups"
UPLOAD_S3=false
S3_BUCKET=""
RETENTION_DAYS=7

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
    head -40 "$0" | grep "^#" | cut -c 3-
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -s|--s3)
            UPLOAD_S3=true
            shift
            ;;
        -b|--bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -k|--keep)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate backup type
if [[ ! "$BACKUP_TYPE" =~ ^(daily|full|schema-only)$ ]]; then
    log_error "Invalid backup type: $BACKUP_TYPE"
    log_error "Valid types: daily, full, schema-only"
    exit 1
fi

# Check required environment variables
if [[ -z "${DATABASE_URL:-}" ]]; then
    log_error "DATABASE_URL environment variable is required"
    exit 1
fi

# Check S3 requirements
if [[ "$UPLOAD_S3" == true ]]; then
    if [[ -z "$S3_BUCKET" ]]; then
        log_error "S3 bucket name is required when using -s flag"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is required for S3 uploads"
        exit 1
    fi

    if [[ -z "${AWS_ACCESS_KEY_ID:-}" ]] || [[ -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
        log_error "AWS credentials required for S3 upload"
        exit 1
    fi
fi

# Check pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump is not installed or not in PATH"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/pricecompare-${BACKUP_TYPE}-${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

log_info "Starting ${BACKUP_TYPE} backup..."
log_info "Output: ${BACKUP_FILE}"

# Build pg_dump options
DUMP_OPTIONS="-Fc --verbose"

if [[ "$BACKUP_TYPE" == "schema-only" ]]; then
    DUMP_OPTIONS="$DUMP_OPTIONS --schema-only"
fi

# Create backup
log_info "Creating backup..."
if pg_dump "$DATABASE_URL" $DUMP_OPTIONS > "$BACKUP_FILE" 2>&1; then
    log_success "Backup created successfully"
else
    log_error "Backup creation failed"
    exit 1
fi

# Verify backup
log_info "Verifying backup integrity..."
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
    log_success "Backup integrity verified"
else
    log_error "Backup integrity check failed"
    exit 1
fi

# Generate checksum
log_info "Generating checksum..."
if command -v sha256sum &> /dev/null; then
    sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"
elif command -v shasum &> /dev/null; then
    shasum -a 256 "$BACKUP_FILE" > "$CHECKSUM_FILE"
else
    log_warn "No SHA256 tool found, skipping checksum"
fi

# Get backup size
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
TABLE_COUNT=$(pg_restore --list "$BACKUP_FILE" 2>/dev/null | grep -c "TABLE" || echo "0")

log_info "Backup size: ${BACKUP_SIZE}"
log_info "Tables in backup: ${TABLE_COUNT}"

# Upload to S3
if [[ "$UPLOAD_S3" == true ]]; then
    log_info "Uploading to S3..."
    BACKUP_FILENAME=$(basename "$BACKUP_FILE")
    CHECKSUM_FILENAME=$(basename "$CHECKSUM_FILE")

    aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${BACKUP_TYPE}/${BACKUP_FILENAME}"
    aws s3 cp "$CHECKSUM_FILE" "s3://${S3_BUCKET}/${BACKUP_TYPE}/${CHECKSUM_FILENAME}"

    log_success "Uploaded to s3://${S3_BUCKET}/${BACKUP_TYPE}/"
fi

# Cleanup old local backups
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$OUTPUT_DIR" -name "pricecompare-*.dump*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

REMAINING_BACKUPS=$(find "$OUTPUT_DIR" -name "pricecompare-*.dump" | wc -l)
log_info "Local backups remaining: ${REMAINING_BACKUPS}"

# Summary
echo ""
echo "========================================"
log_success "Backup completed successfully!"
echo "========================================"
echo ""
echo "Backup File:  ${BACKUP_FILE}"
echo "Checksum:     ${CHECKSUM_FILE}"
echo "Size:         ${BACKUP_SIZE}"
echo "Tables:       ${TABLE_COUNT}"
echo ""
echo "To restore this backup, run:"
echo "  ./scripts/restore-database.sh ${BACKUP_FILE}"
echo ""
