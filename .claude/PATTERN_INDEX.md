# Master Pattern Index

**Last Updated**: 2026-01-21
**Purpose**: Central reference for consolidated pattern documentation

## CONSOLIDATION STATUS (Updated 2026-01-21)

**Pattern files were consolidated from 21 files (16,449 lines) into 9 domain-specific files.**

### Current State
- ✅ 9 consolidated, domain-specific files
- ✅ ONE canonical location per pattern
- ✅ Domain-based organization (TypeScript, Database, API, etc.)
- ✅ All patterns visible in docs/
- ✅ Active maintenance with versioned updates

### Historical Context (2025-11-29 Consolidation)
- Started with 21 pattern files scattered across docs/ and .claude/knowledge/
- 16,449 total lines with massive duplication (CSRF in 8 files, floating promises in 9 files)
- Reduced to ~10,000 lines (39% reduction via deduplication)

---

## Core Pattern Files (docs/)

| # | File | Domain | Version | Last Updated | Status |
|---|------|--------|---------|--------------|--------|
| 1 | `01_TYPESCRIPT_PATTERNS.md` | Type Safety | 2.10 | 2026-01-20 | ✅ Active |
| 2 | `02_DATABASE_PATTERNS.md` | Database/Drizzle | 2.15 | 2026-01-17 | ✅ Active |
| 3 | `03_API_PATTERNS.md` | Routes/Middleware | 2.0 | - | ✅ Active |
| 4 | `04_SECURITY_PATTERNS.md` | Security/Auth | 2.8 | 2026-01-17 | ✅ Active |
| 5 | `05_FRONTEND_PATTERNS.md` | React/UI | 2.1 | - | ✅ Active |
| 6 | `06_ERROR_HANDLING_PATTERNS.md` | Errors/Recovery | 1.0 | - | ✅ Active |
| 7 | `07_BACKGROUND_JOBS_PATTERNS.md` | Jobs/Queues | 1.0 | - | ✅ Active |
| 8 | `08_TESTING_PATTERNS.md` | Testing | 3.9 | 2026-01-17 | ✅ Active |
| 9 | `09_CODE_REVIEW_PATTERNS.md` | Code Review | 1.0 | 2026-01-06 | ✅ Active |

---

## What Got Merged Where

### 01_TYPESCRIPT_PATTERNS.md (v2.10)
**Migrated From:**
- docs/TYPESCRIPT_PATTERNS.md (v1.0)
- docs/PHASE1_WATCHLIST_PATTERNS.md (Pattern 9: Async handlers)

**Key Sections:**
- Type safety, avoiding `any`
- Async/Promise patterns (floating promises, `void` operator)
- Zod integration
- Database Schema-Aware Type Guards (NEW)

### 02_DATABASE_PATTERNS.md (v2.15)
**Migrated From:**
- docs/DATABASE_PATTERNS.md
- .claude/knowledge/storage-refactoring-patterns.md (now archived)
- .claude/knowledge/phase-8-storage-migration-patterns.md (now archived)
- .claude/knowledge/storage-review-patterns.md (now archived)
- docs/PHASE0_WATCHLIST_PATTERNS.md (NULL-safe constraints)
- docs/PHASE1_WATCHLIST_PATTERNS.md (pagination)

**Key Sections:**
- Storage layer architecture
- N+1 query prevention
- Transaction patterns
- Production bugs catalog
- Drizzle ORM Timestamp patterns (NEW)

### 03_API_PATTERNS.md (v2.0)
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

### 04_SECURITY_PATTERNS.md (v2.8)
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
- PostgreSQL Identifier Injection Prevention (NEW)

### 05_FRONTEND_PATTERNS.md (v2.1)
**Migrated From:**
- docs/FRONTEND_PATTERNS.md
- docs/PHASE1_WATCHLIST_PATTERNS.md (React Query patterns)

**Key Sections:**
- React component patterns
- React Query
- Form handling
- Pagination UI

### 06_ERROR_HANDLING_PATTERNS.md (v1.0)
**Migrated From:**
- docs/ERROR_HANDLING_PATTERNS.md
- docs/PHASE0_WATCHLIST_PATTERNS.md (PostgreSQL error codes)

**Key Sections:**
- Error response standardization
- PostgreSQL error code classification
- Validation errors
- Recovery strategies

### 07_BACKGROUND_JOBS_PATTERNS.md (v1.0)
**Key Sections:**
- Scheduled tasks
- Bull queues
- Distributed locking

### 08_TESTING_PATTERNS.md (v3.9) - Added post-consolidation
**Key Sections:**
- Test environment configuration
- Integration test patterns
- E2E CSRF token patterns
- WebSocket testing patterns
- Race condition prevention
- Mock completeness patterns

### 09_CODE_REVIEW_PATTERNS.md (v1.0) - Added post-consolidation
**Key Sections:**
- Two-phase code review pattern
- Code review checklist
- Data completeness validation

---

## Subagent → Pattern Mapping

**All subagents now reference the 9 consolidated files only.**

Old pattern file references should be updated to:
- ~~DATABASE_PATTERNS.md~~ → `02_DATABASE_PATTERNS.md`
- ~~API_PATTERNS.md~~ → `03_API_PATTERNS.md`
- ~~SECURITY_PATTERNS.md~~ → `04_SECURITY_PATTERNS.md`
- ~~AUTHENTICATION_PATTERNS.md~~ → `04_SECURITY_PATTERNS.md`
- ~~VALIDATION_PATTERNS.md~~ → `04_SECURITY_PATTERNS.md`
- ~~SERVICE_INTEGRATION_PATTERNS.md~~ → `03_API_PATTERNS.md`
- ~~PHASE0_WATCHLIST_PATTERNS.md~~ → Merged into core files
- ~~PHASE1_WATCHLIST_PATTERNS.md~~ → Merged into core files

---

## Pattern Location Quick Reference

| Looking For | File |
|-------------|------|
| Type safety, `any` types, async/await | 01_TYPESCRIPT_PATTERNS.md |
| N+1 queries, transactions, storage layer | 02_DATABASE_PATTERNS.md |
| Routes, middleware, service integration | 03_API_PATTERNS.md |
| CSRF, auth, validation, authentication | 04_SECURITY_PATTERNS.md |
| React, forms, pagination UI | 05_FRONTEND_PATTERNS.md |
| Error responses, PostgreSQL errors | 06_ERROR_HANDLING_PATTERNS.md |
| Bull queues, cron jobs | 07_BACKGROUND_JOBS_PATTERNS.md |
| Test infrastructure, mocking, E2E | 08_TESTING_PATTERNS.md |
| Code review, quality assurance | 09_CODE_REVIEW_PATTERNS.md |

---

## Usage Guidelines

### For Developers
1. Use numeric prefixes for ordering (01 → 09)
2. One canonical location per pattern
3. Cross-references between files, no duplication

### For Subagents
- Reference patterns by number and name
- All 9 files accessible to all subagents
- No more .claude/knowledge/ hidden patterns (except subagent-specific guides)

---

## Related Documentation

- **CLAUDE.md** - Main project guidelines (references 9 core files)
- **docs/patterns/PATTERNS_INDEX.md** - Detailed index with quick lookup
- **docs/guides/** - Cross-functional collaboration guides
- **docs/learnings/** - Session-specific learnings and investigations

---

**Maintained By**: Development Team + Claude Code
**Next Review**: 2026-02-21 (monthly)
**Last Consolidation Review**: 2026-01-21
