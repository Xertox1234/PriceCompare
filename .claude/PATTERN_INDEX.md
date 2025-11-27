# Master Pattern Index

**Last Updated**: 2025-11-27
**Purpose**: Central reference for all pattern documentation and subagent access mapping

This index provides a complete overview of all pattern files, their relationships, and which subagents reference them.

## Quick Stats

- **Total Pattern Files**: 19 files (10 in docs/, 9 in .claude/knowledge/)
- **Total Lines**: ~12,562 lines of pattern documentation
- **Subagents with Pattern Access**: 10 agents
- **Average Patterns per Subagent**: 4-6 patterns

---

## All Pattern Files by Location

### Primary Patterns (/docs)

| File | Version | Lines | Domain | Last Updated | Status |
|------|---------|-------|--------|--------------|--------|
| DATABASE_PATTERNS.md | 1.0 | 1,243 | Backend/Data | 2025-11-24 | Active |
| API_PATTERNS.md | 1.0 | 1,167 | Backend/Routes | 2025-11-20 | Active |
| TYPESCRIPT_PATTERNS.md | 1.0 | 1,064 | Universal | 2025-11-25 | Active |
| ERROR_HANDLING_PATTERNS.md | 1.0 | 1,032 | Cross-cutting | 2025-11-26 | Active |
| SECURITY_PATTERNS.md | 1.0 | 973 | Backend/Security | 2025-11-20 | Active |
| BACKGROUND_JOBS_PATTERNS.md | 1.0 | 614 | Backend/Jobs | 2025-11-20 | Active |
| FRONTEND_PATTERNS.md | 1.0 | 570 | Frontend | 2025-11-20 | Active |
| SERVICE_INTEGRATION_PATTERNS.md | 1.0 | 492 | Backend/Services | 2025-11-26 | Active |
| PATTERNS.md | 1.0 | 450 | Backend/General | 2025-11-16 | Active |
| AUTHENTICATION_PATTERNS.md | 1.0 | 262 | Backend/Auth | 2025-11-17 | Active |
| VALIDATION_PATTERNS.md | 1.0 | 403 | Cross-cutting | 2025-11-25 | Active |

**Subtotal**: 8,270 lines

### Subagent Knowledge (/.claude/knowledge)

| File | Version | Lines | Purpose | Last Updated |
|------|---------|-------|---------|--------------|
| claude-code-subagent-setup-guide.md | 1.0 | 1,581 | Subagent system guide | 2025-11-20 |
| storage-refactoring-patterns.md | 1.0 | 1,071 | Large file refactoring | 2025-11-25 |
| subagent-architecture-guide.md | 1.0 | 650 | Architecture patterns | 2025-11-20 |
| phase-2-lessons-learned.md | 1.0 | 424 | Project history | 2025-11-18 |
| route-error-handling-patterns.md | 1.0 | 340 | Route error patterns | 2025-11-20 |
| storage-review-patterns.md | 1.0 | 253 | Storage review guide | 2025-11-25 |
| subagent-quick-reference.md | 1.0 | 250 | Quick reference | 2025-11-20 |
| review-guidelines.md | 1.0 | 196 | Review process | 2025-11-20 |
| route-file-review-checklist.md | 1.0 | 193 | Route review | 2025-11-20 |

**Subtotal**: 4,958 lines

**Grand Total**: 13,228 lines of pattern documentation

---

## Subagent → Pattern Mapping

### backend-architect
**Domain**: Node.js/TypeScript/Express backend development

**Patterns**:
- ✅ API_PATTERNS.md - Route organization, middleware, validation
- ✅ DATABASE_PATTERNS.md - Query optimization, transactions
- ✅ SERVICE_INTEGRATION_PATTERNS.md - Guard patterns, storage layer
- ✅ ERROR_HANDLING_PATTERNS.md - Error responses, recovery
- ✅ SECURITY_PATTERNS.md - Auth, validation, sanitization
- ✅ TYPESCRIPT_PATTERNS.md - Type safety, Zod integration
- ✅ storage-refactoring-patterns.md - Large file decomposition

**Coverage**: 7 patterns | **Status**: Comprehensive ✅

---

### frontend-specialist
**Domain**: React 19/Vite/UI development

**Patterns**:
- ✅ TYPESCRIPT_PATTERNS.md - Type safety, Zod integration
- ✅ ERROR_HANDLING_PATTERNS.md - Error sanitization, React Query
- ✅ DESIGN_SYSTEM.md - Design tokens, styling
- ✅ COMPONENT_GUIDE.md - React component architecture
- ✅ API_PATTERNS.md - API contracts, validation schemas *(Added 2025-11-26)*

**Coverage**: 5 patterns | **Status**: Complete ✅

---

### database-engineer
**Domain**: PostgreSQL/Drizzle/schema design

**Patterns**:
- ✅ DATABASE_PATTERNS.md - Query optimization, transactions, N+1 prevention
- ✅ SECURITY_PATTERNS.md - Field selection security, password hashes
- ✅ TYPESCRIPT_PATTERNS.md - Type safety in queries
- ✅ storage-refactoring-patterns.md - Large file refactoring

**Coverage**: 4 patterns | **Status**: Comprehensive ✅

---

### test-engineer
**Domain**: Vitest/Playwright/testing

**Patterns**:
- ✅ TYPESCRIPT_PATTERNS.md - Type safety in tests
- ✅ ERROR_HANDLING_PATTERNS.md - Error test cases
- ✅ API_PATTERNS.md - Route testing patterns
- ✅ DATABASE_PATTERNS.md - Query test patterns
- ✅ SECURITY_PATTERNS.md - Security test cases

**Coverage**: 5 patterns | **Status**: Comprehensive ✅

---

### security-auditor
**Domain**: Security/auth/vulnerability assessment

**Patterns**:
- ✅ SECURITY_PATTERNS.md - Auth, CSRF, validation
- ✅ ERROR_HANDLING_PATTERNS.md - Error sanitization
- ✅ TYPESCRIPT_PATTERNS.md - Type-based security
- ✅ API_PATTERNS.md - Route security
- ✅ DATABASE_PATTERNS.md - Query security

**Coverage**: 5 patterns | **Status**: Excellent ✅

---

### code-review-specialist
**Domain**: Code quality/architecture review

**Patterns**:
- ✅ DATABASE_PATTERNS.md - Query patterns
- ✅ SECURITY_PATTERNS.md - Security violations
- ✅ TYPESCRIPT_PATTERNS.md - Type safety
- ✅ ERROR_HANDLING_PATTERNS.md - Error patterns
- ✅ API_PATTERNS.md - Route patterns
- ✅ review-guidelines.md - Review process
- ✅ storage-review-patterns.md - Storage layer review
- ✅ storage-refactoring-patterns.md - Refactoring patterns

**Coverage**: 8 patterns | **Status**: Exceptional ✅

---

### typescript-reviewer
**Domain**: TypeScript/service pattern review

**Patterns**:
- ✅ storage-review-patterns.md - Storage layer patterns
- ✅ TYPESCRIPT_PATTERNS.md - Type safety, Zod
- ✅ DATABASE_PATTERNS.md - Query optimization
- ✅ ERROR_HANDLING_PATTERNS.md - Validation errors *(Added 2025-11-26)*
- ✅ SECURITY_PATTERNS.md - Type-based security *(Added 2025-11-26)*

**Coverage**: 5 patterns | **Status**: Complete ✅

---

### orchestrator
**Domain**: Task coordination/delegation

**Patterns**:
- ✅ DATABASE_PATTERNS.md - Database operations
- ✅ SECURITY_PATTERNS.md - Security concerns
- ✅ TYPESCRIPT_PATTERNS.md - Type safety
- ✅ ERROR_HANDLING_PATTERNS.md - Error handling
- ✅ API_PATTERNS.md - API design

**Coverage**: 5 patterns | **Status**: Excellent ✅

---

### scraper-expert
**Domain**: Playwright/web scraping

**Patterns**:
- ✅ ERROR_HANDLING_PATTERNS.md - Error recovery, retries
- ✅ SECURITY_PATTERNS.md - Input validation, sanitization
- ✅ API_PATTERNS.md - Rate limiting, caching
- ✅ TYPESCRIPT_PATTERNS.md - Type safety in scrapers *(Added 2025-11-26)*

**Coverage**: 4 patterns | **Status**: Complete ✅

---

### extension-builder
**Domain**: Chrome Extension MV3

**Patterns**:
- ✅ TYPESCRIPT_PATTERNS.md - Type safety for extensions
- ✅ ERROR_HANDLING_PATTERNS.md - Error recovery in extensions
- ✅ SECURITY_PATTERNS.md - CSP compliance, validation
- ✅ DESIGN_SYSTEM.md - Design tokens, UI consistency *(Added 2025-11-26)*
- ✅ COMPONENT_GUIDE.md - React component architecture *(Added 2025-11-26)*

**Coverage**: 5 patterns | **Status**: Complete ✅

---

## Pattern Dependencies

Understanding how patterns reference each other:

```
SECURITY_PATTERNS.md (Core Security)
├── DATABASE_PATTERNS.md (password hash exposure, field selection)
├── API_PATTERNS.md (CSRF middleware, input validation)
└── ERROR_HANDLING_PATTERNS.md (error sanitization)

DATABASE_PATTERNS.md (Core Data)
├── SECURITY_PATTERNS.md (preventing data exposure)
├── API_PATTERNS.md (route query optimization)
└── SERVICE_INTEGRATION_PATTERNS.md (storage layer abstraction)

API_PATTERNS.md (Core Routes)
├── SECURITY_PATTERNS.md (CSRF, authentication)
├── ERROR_HANDLING_PATTERNS.md (route error responses)
├── DATABASE_PATTERNS.md (preventing N+1 in routes)
└── SERVICE_INTEGRATION_PATTERNS.md (guard completeness)

TYPESCRIPT_PATTERNS.md (Universal)
└── Referenced by ALL other patterns (cross-cutting type safety)

SERVICE_INTEGRATION_PATTERNS.md (Service Layer)
├── API_PATTERNS.md (route integration)
├── SECURITY_PATTERNS.md (guard mechanisms)
├── ERROR_HANDLING_PATTERNS.md (service errors)
└── DATABASE_PATTERNS.md (storage layer)

ERROR_HANDLING_PATTERNS.md (Cross-cutting)
├── API_PATTERNS.md (route error handling)
├── SECURITY_PATTERNS.md (error sanitization)
└── SERVICE_INTEGRATION_PATTERNS.md (service error patterns)
```

---

## Pattern Coverage by Concern

### Security Patterns
- **Primary**: SECURITY_PATTERNS.md
- **Supporting**: DATABASE_PATTERNS.md, API_PATTERNS.md, ERROR_HANDLING_PATTERNS.md
- **Subagents**: security-auditor, code-review-specialist, all backend agents

### Type Safety Patterns
- **Primary**: TYPESCRIPT_PATTERNS.md
- **Supporting**: DATABASE_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md
- **Subagents**: typescript-reviewer, all development agents

### Performance Patterns
- **Primary**: DATABASE_PATTERNS.md (N+1 prevention, query optimization)
- **Supporting**: API_PATTERNS.md (caching), SERVICE_INTEGRATION_PATTERNS.md (cache-before-limit)
- **Subagents**: database-engineer, backend-architect, code-review-specialist

### Error Handling Patterns
- **Primary**: ERROR_HANDLING_PATTERNS.md
- **Supporting**: API_PATTERNS.md, SECURITY_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md
- **Subagents**: All agents

### UI/UX Patterns
- **Primary**: FRONTEND_PATTERNS.md, DESIGN_SYSTEM.md, COMPONENT_GUIDE.md
- **Supporting**: ERROR_HANDLING_PATTERNS.md (React Query), TYPESCRIPT_PATTERNS.md
- **Subagents**: frontend-specialist, extension-builder

---

## Version History

| Pattern | v1.0 Release | Latest Version | Last Updated | Recent Changes |
|---------|--------------|----------------|--------------|----------------|
| DATABASE_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-24 | Foreign key cascade rules |
| API_PATTERNS.md | 2025-11-01 | 1.1 | 2025-11-27 | **Nested response wrapper anti-pattern** |
| TYPESCRIPT_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-25 | Validation code type safety |
| ERROR_HANDLING_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-26 | createErrorResponse patterns |
| SECURITY_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-20 | CSRF token attachment |
| SERVICE_INTEGRATION_PATTERNS.md | 2025-11-23 | 1.0 | 2025-11-26 | Added version header, storage layer |
| VALIDATION_PATTERNS.md | 2025-11-25 | 1.0 | 2025-11-25 | Moved from storage-layer/ |
| FRONTEND_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-20 | React Query patterns |
| BACKGROUND_JOBS_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-20 | Distributed locking |
| AUTHENTICATION_PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-17 | Session management |
| PATTERNS.md | 2025-11-01 | 1.0 | 2025-11-16 | General backend overview |

---

## Usage Guidelines

### For Developers

1. **Before Starting Work**: Review core patterns (DATABASE, SECURITY, TYPESCRIPT)
2. **During Development**: Reference domain-specific patterns
3. **Before Committing**: Check pre-commit hook requirements
4. **During Code Review**: Use patterns as checklist

### For Subagents

Subagents automatically have access to their configured patterns. When working with a subagent:

1. Reference specific pattern sections in your prompts
2. Ask subagents to verify compliance with patterns
3. Use pattern terminology (e.g., "cache-before-limit", "guard completeness")

### For Code Reviewers

1. Use `.claude/PATTERN_INDEX.md` to find relevant patterns
2. Reference pattern file and section in review comments
3. Check if new code introduces patterns worth documenting
4. Ensure pattern compliance before approval

---

## Maintenance

### Adding New Patterns

1. Create pattern file in `/docs` with version header
2. Update `PATTERNS_INDEX.md` in docs/
3. Update this `.claude/PATTERN_INDEX.md`
4. Add to relevant subagent configurations
5. Update related pattern cross-references
6. Test pre-commit hooks if adding enforcement

### Updating Existing Patterns

1. Increment version number (minor for additions, major for breaking changes)
2. Update "Last Updated" date
3. Update version history table in this file
4. Notify affected subagents if behavior changes

### Deprecating Patterns

1. Mark as "Deprecated" in status column
2. Add deprecation notice to pattern file
3. Document migration path to replacement pattern
4. Remove from subagent configurations after grace period

---

## Related Documentation

- **[docs/PATTERNS_INDEX.md](../docs/PATTERNS_INDEX.md)** - User-facing pattern index
- **[docs/README.md](../docs/README.md)** - General documentation index
- **[CLAUDE.md](../CLAUDE.md)** - Main project guidelines
- **[.claude/knowledge/](./knowledge/)** - Subagent-specific patterns
- **[ARCHITECTURE.md](../docs/ARCHITECTURE.md)** - System architecture

---

**Maintained By**: PriceCompare Development Team + Claude Code
**Update Frequency**: As patterns evolve
**Next Review**: 2025-12-26 (monthly)
