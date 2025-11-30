# Master Pattern Index

**Last Updated**: 2025-11-29
**Purpose**: Central reference for consolidated pattern documentation

## CONSOLIDATION COMPLETE (2025-11-29)

**Pattern files were consolidated from 21 files (16,449 lines) into 7 domain-specific files (~10,000 lines).**

### Before Consolidation
- ❌ 21 pattern files scattered across docs/ and .claude/knowledge/
- ❌ 16,449 total lines with massive duplication
- ❌ CSRF in 8 files, floating promises in 9 files
- ❌ Phase-based organization (PHASE0, PHASE1)
- ❌ Hidden patterns in .claude/knowledge/

### After Consolidation
- ✅ 7 consolidated, domain-specific files
- ✅ ~10,000 lines (39% reduction via deduplication)
- ✅ ONE canonical location per pattern
- ✅ Domain-based organization (TypeScript, Database, API, etc.)
- ✅ All patterns visible in docs/

---

## Core Pattern Files (docs/)

| # | File | Domain | Version | Status |
|---|------|--------|---------|--------|
| 1 | `01_TYPESCRIPT_PATTERNS.md` | Type Safety | 2.0 | ✅ Active |
| 2 | `02_DATABASE_PATTERNS.md` | Database/Drizzle | 2.0 | ✅ Active |
| 3 | `03_API_PATTERNS.md` | Routes/Middleware | 2.0 | ✅ Active |
| 4 | `04_SECURITY_PATTERNS.md` | Security/Auth | 2.0 | ✅ Active |
| 5 | `05_FRONTEND_PATTERNS.md` | React/UI | 2.0 | ✅ Active |
| 6 | `06_ERROR_HANDLING_PATTERNS.md` | Errors/Recovery | 2.0 | ✅ Active |
| 7 | `07_BACKGROUND_JOBS_PATTERNS.md` | Jobs/Queues | 1.0 | ✅ Active |

---

## What Got Merged Where

### 01_TYPESCRIPT_PATTERNS.md
**Migrated From:**
- docs/TYPESCRIPT_PATTERNS.md (v1.0)
- docs/PHASE1_WATCHLIST_PATTERNS.md (Pattern 9: Async handlers)

**Key Sections:**
- Type safety, avoiding `any`
- Async/Promise patterns (floating promises, `void` operator)
- Zod integration

### 02_DATABASE_PATTERNS.md
**Migrated From:**
- docs/DATABASE_PATTERNS.md
- .claude/knowledge/storage-refactoring-patterns.md
- .claude/knowledge/phase-8-storage-migration-patterns.md
- .claude/knowledge/storage-review-patterns.md
- docs/PHASE0_WATCHLIST_PATTERNS.md (NULL-safe constraints)
- docs/PHASE1_WATCHLIST_PATTERNS.md (pagination)

**Key Sections:**
- Storage layer architecture
- N+1 query prevention
- Transaction patterns
- Production bugs catalog

### 03_API_PATTERNS.md
**Migrated From:**
- docs/API_PATTERNS.md
- docs/API_TESTING_PATTERNS.md
- docs/SERVICE_INTEGRATION_PATTERNS.md
- docs/MIDDLEWARE_API_PATTERNS.md
- .claude/knowledge/route-error-handling-patterns.md
- docs/PATTERNS.md (route sections)

**Key Sections:**
- Route organization
- Middleware pipeline
- Testing patterns
- Service integration

### 04_SECURITY_PATTERNS.md
**Migrated From:**
- docs/SECURITY_PATTERNS.md
- docs/VALIDATION_PATTERNS.md
- docs/AUTHENTICATION_PATTERNS.md
- docs/PHASE0_WATCHLIST_PATTERNS.md (validation layer)

**Key Sections:**
- **CSRF Protection (SINGLE SOURCE OF TRUTH)** - deduplicated from 8 files
- Authentication & authorization
- Input validation
- Password security

### 05_FRONTEND_PATTERNS.md
**Migrated From:**
- docs/FRONTEND_PATTERNS.md
- docs/PHASE1_WATCHLIST_PATTERNS.md (React Query patterns)

**Key Sections:**
- React component patterns
- React Query
- Form handling
- Pagination UI

### 06_ERROR_HANDLING_PATTERNS.md
**Migrated From:**
- docs/ERROR_HANDLING_PATTERNS.md
- docs/PHASE0_WATCHLIST_PATTERNS.md (PostgreSQL error codes)

**Key Sections:**
- Error response standardization
- PostgreSQL error code classification
- Validation errors
- Recovery strategies

---

## Subagent → Pattern Mapping

**All subagents now reference the 7 consolidated files only.**

Old pattern file references should be updated to:
- ~~DATABASE_PATTERNS.md~~ → `02_DATABASE_PATTERNS.md`
- ~~API_PATTERNS.md~~ → `03_API_PATTERNS.md`
- ~~SECURITY_PATTERNS.md~~ → `04_SECURITY_PATTERNS.md`
- ~~PHASE0_WATCHLIST_PATTERNS.md~~ → Merged into core files
- ~~PHASE1_WATCHLIST_PATTERNS.md~~ → Merged into core files

---

## Pattern Location Quick Reference

| Looking For | File |
|-------------|------|
| Type safety, `any` types, async/await | 01_TYPESCRIPT_PATTERNS.md |
| N+1 queries, transactions, storage layer | 02_DATABASE_PATTERNS.md |
| Routes, middleware, testing | 03_API_PATTERNS.md |
| CSRF, auth, validation | 04_SECURITY_PATTERNS.md |
| React, forms, pagination UI | 05_FRONTEND_PATTERNS.md |
| Error responses, PostgreSQL errors | 06_ERROR_HANDLING_PATTERNS.md |
| Bull queues, cron jobs | 07_BACKGROUND_JOBS_PATTERNS.md |

---

## Usage Guidelines

### For Developers
1. Use numeric prefixes for ordering (01 → 07)
2. One canonical location per pattern
3. Cross-references between files, no duplication

### For Subagents
- Reference patterns by number and name
- All 7 files accessible to all subagents
- No more .claude/knowledge/ hidden patterns

---

## Related Documentation

- **CLAUDE.md** - Main project guidelines (references 7 core files)
- **PATTERN_CONSOLIDATION_PLAN.md** - Detailed consolidation strategy
- **docs/archive/sessions/** - Historical completion reports
- **docs/backup-2025-11-29/** - Original files (for rollback)

---

**Maintained By**: Development Team + Claude Code
**Next Review**: 2025-12-29 (monthly)
**Consolidation Date**: 2025-11-29
