# Pattern Documentation Index

This directory contains comprehensive pattern documentation organized by domain. All patterns enforce best practices learned from production code reviews and are checked by pre-commit hooks.

## Core Patterns (Read These First)

Essential patterns that apply across the entire codebase:

- **[01_TYPESCRIPT_PATTERNS.md](01_TYPESCRIPT_PATTERNS.md)** - v1.0 - Type safety, Zod integration, avoiding `any`, error handling
- **[02_DATABASE_PATTERNS.md](02_DATABASE_PATTERNS.md)** - v1.0 - Query optimization, transactions, field selection, N+1 prevention
- **[03_API_PATTERNS.md](03_API_PATTERNS.md)** - v1.0 - Route organization, middleware pipeline, validation, caching
- **[04_SECURITY_PATTERNS.md](04_SECURITY_PATTERNS.md)** - v1.0 - Authentication, CSRF, input validation, error sanitization
- **[08_TESTING_PATTERNS.md](08_TESTING_PATTERNS.md)** - v1.0 - Test infrastructure, date handling, mocking, avoiding skipped tests

## Domain-Specific Patterns

### Backend Patterns

- **[03_API_PATTERNS.md](03_API_PATTERNS.md)** - v1.0 - Route organization, middleware pipeline, validation, caching
- **[07_BACKGROUND_JOBS_PATTERNS.md](07_BACKGROUND_JOBS_PATTERNS.md)** - v1.0 - Scheduled tasks, Bull queues, distributed locking
- **[AUTHENTICATION_PATTERNS.md](AUTHENTICATION_PATTERNS.md)** - v1.0 - Auth flow specifics, session management, password reset
- **[PATTERNS.md](PATTERNS.md)** - v1.0 - General backend patterns overview, job locking, aggregations
- **[SERVICE_INTEGRATION_PATTERNS.md](SERVICE_INTEGRATION_PATTERNS.md)** - v1.0 - Guard patterns, cache-before-limit, service composition *(Coming soon)*

### Frontend Patterns

- **[05_FRONTEND_PATTERNS.md](05_FRONTEND_PATTERNS.md)** - v2.1 - React components, hooks, state management, React Query, CSS/Tailwind 4

### Testing Patterns

- **[08_TESTING_PATTERNS.md](08_TESTING_PATTERNS.md)** - v1.0 - Test infrastructure, mocking, timezone-safe dates, avoiding skipped tests

### Cross-Cutting Patterns

Patterns that span multiple domains:

- **[06_ERROR_HANDLING_PATTERNS.md](06_ERROR_HANDLING_PATTERNS.md)** - v1.0 - Error responses, validation errors, recovery strategies
- **[VALIDATION_PATTERNS.md](VALIDATION_PATTERNS.md)** - v1.0 - Input validation, Zod schemas, sanitization *(To be moved from storage-layer/)*

## Cross-Functional Guides

Specialized guides for multi-domain collaboration:

- **[guides/testing-security-patterns.md](guides/testing-security-patterns.md)** - Security testing checklist *(Coming soon)*
- **[guides/database-performance-review.md](guides/database-performance-review.md)** - DB performance guide *(Coming soon)*
- **[guides/extension-security.md](guides/extension-security.md)** - Extension security patterns *(Coming soon)*

## Quick Lookup by Topic

Find patterns by common concerns:

| Topic | Primary Pattern | Related Patterns |
|-------|----------------|------------------|
| **Password/Hash Security** | SECURITY_PATTERNS | DATABASE_PATTERNS (field selection) |
| **Input Validation** | SECURITY_PATTERNS | TYPESCRIPT_PATTERNS (Zod), VALIDATION_PATTERNS |
| **Error Handling** | ERROR_HANDLING_PATTERNS | API_PATTERNS, SECURITY_PATTERNS |
| **CSRF Protection** | SECURITY_PATTERNS | API_PATTERNS (middleware) |
| **N+1 Queries** | DATABASE_PATTERNS | API_PATTERNS (route optimization) |
| **Type Safety** | TYPESCRIPT_PATTERNS | All patterns (cross-cutting) |
| **Transaction Boundaries** | DATABASE_PATTERNS | ERROR_HANDLING_PATTERNS |
| **Rate Limiting** | API_PATTERNS | BACKGROUND_JOBS_PATTERNS |
| **Caching Strategy** | API_PATTERNS (Single Cache Abstraction) | advanced-caching.md, DOMAIN_CACHING_STRATEGIES.md |
| **Authentication** | AUTHENTICATION_PATTERNS | SECURITY_PATTERNS, API_PATTERNS |
| **Testing** | TESTING_PATTERNS | FRONTEND_PATTERNS, SECURITY_PATTERNS |
| **Date/Time in Tests** | TESTING_PATTERNS | FRONTEND_PATTERNS |
| **Mocking Redis** | TESTING_PATTERNS | API_PATTERNS |
| **CSS/Tailwind 4** | FRONTEND_PATTERNS | COMPONENT_GUIDE, DESIGN_SYSTEM |
| **Theme Tokens** | FRONTEND_PATTERNS | DESIGN_SYSTEM |

## Pattern Relationships

Understanding how patterns connect:

```
04_SECURITY_PATTERNS.md
├── 02_DATABASE_PATTERNS.md (password hash exposure, field selection)
├── 03_API_PATTERNS.md (CSRF middleware, input validation)
└── 06_ERROR_HANDLING_PATTERNS.md (error sanitization)

02_DATABASE_PATTERNS.md
├── 04_SECURITY_PATTERNS.md (preventing data exposure)
├── 03_API_PATTERNS.md (route query optimization)
└── SERVICE_INTEGRATION_PATTERNS.md (storage layer)

03_API_PATTERNS.md
├── 04_SECURITY_PATTERNS.md (CSRF, auth)
├── 06_ERROR_HANDLING_PATTERNS.md (route error responses)
└── 02_DATABASE_PATTERNS.md (preventing N+1 in routes)

08_TESTING_PATTERNS.md
├── 05_FRONTEND_PATTERNS.md (component testing)
├── 03_API_PATTERNS.md (route testing, mocking)
└── 04_SECURITY_PATTERNS.md (security testing)

01_TYPESCRIPT_PATTERNS.md
└── All patterns (type safety is cross-cutting)
```

## How to Use These Patterns

### For Developers

1. **Before Starting**: Read core patterns (DATABASE, SECURITY, TYPESCRIPT)
2. **During Development**: Reference domain-specific patterns for your work area
3. **Before Committing**: Check pre-commit hook requirements
4. **During Code Review**: Use patterns as review checklist

### For Code Reviewers

1. Consult the `.claude/PATTERN_INDEX.md` for subagent pattern mappings
2. Use pattern files as review checklists
3. Reference specific pattern sections in review comments
4. Ensure new code follows established patterns

### For New Team Members

**Week 1**: Core Patterns
- DATABASE_PATTERNS.md
- SECURITY_PATTERNS.md
- TYPESCRIPT_PATTERNS.md

**Week 2**: Domain Patterns
- Frontend: FRONTEND_PATTERNS.md, API_PATTERNS.md
- Backend: API_PATTERNS.md, DATABASE_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md

**Week 3**: Specialized Patterns
- ERROR_HANDLING_PATTERNS.md
- AUTHENTICATION_PATTERNS.md
- BACKGROUND_JOBS_PATTERNS.md

## Pre-Commit Hook Enforcement

The following patterns are enforced by git pre-commit hooks:

- ❌ **Password hash exposure** - Blocks commits exposing `passwordHash` field
- ❌ **`any` types** - Flags new uses of TypeScript `any`
- ❌ **`console.log`** - Requires use of `log()` function instead
- ❌ **N+1 queries** - Detects queries inside loops
- ⚠️ **Hardcoded colors** - Warns about hex colors (should use design tokens)
- ⚠️ **Direct `db` imports** - Suggests using `storage.ts` layer

See `.git/hooks/pre-commit` for complete enforcement rules.

## Pattern File Structure

Each pattern file follows this structure:

```markdown
---
Pattern: [Name]
Version: X.X
Last Updated: YYYY-MM-DD
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [List]
---

# Pattern Name

## Overview
[What problem this pattern solves]

## Anti-Patterns (What NOT to Do)
[Common mistakes with ❌ WRONG examples]

## Correct Patterns (What TO Do)
[Best practices with ✅ CORRECT examples]

## When to Use
[Guidance on applicability]

## Related Patterns
[Links to related documentation]
```

## See Also

- **[CLAUDE.md](../CLAUDE.md)** - Main project guidelines and overview
- **[.claude/PATTERN_INDEX.md](../.claude/PATTERN_INDEX.md)** - Subagent pattern mapping *(Coming soon)*
- **[.claude/knowledge/](../.claude/knowledge/)** - Subagent-specific patterns and guides
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and design decisions
- **[COMPONENT_GUIDE.md](COMPONENT_GUIDE.md)** - React component documentation
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - Complete API endpoint reference
- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - UI design system and tokens

## Contributing to Patterns

When adding or updating patterns:

1. **Follow the standard structure** shown above
2. **Include both anti-patterns and correct examples**
3. **Add version header** with update date
4. **Update this PATTERNS_INDEX.md** to reference new patterns
5. **Update .claude/PATTERN_INDEX.md** if affecting subagents
6. **Link related patterns** for cross-referencing
7. **Test pre-commit hooks** if adding enforcement

## Pattern Versioning

- **v1.0** - Initial stable version
- **v1.x** - Minor updates (new examples, clarifications)
- **v2.0** - Major revisions (restructuring, significant new content)

Version numbers help track pattern evolution and enable gradual migration when patterns change significantly.

---

**Last Updated**: 2025-12-02
**Maintained By**: PriceCompare Development Team + Claude Code
