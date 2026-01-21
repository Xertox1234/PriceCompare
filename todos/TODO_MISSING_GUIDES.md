# TODO: Create Missing Documentation Guides

**Created**: 2026-01-21
**Priority**: Low
**Category**: Documentation
**Source**: Pattern validation audit

## Background

During the 2026-01-21 pattern validation, we discovered that `docs/patterns/PATTERNS_INDEX.md` referenced guides that don't exist yet. This TODO tracks the creation of these missing guides.

## Missing Guides

### 1. Database Performance Review Guide

**Path**: `docs/guides/database-performance-review.md`
**Purpose**: Guide for reviewing database performance concerns
**Suggested Content**:
- Query performance analysis checklist
- Index usage review patterns
- N+1 query detection methodology
- EXPLAIN ANALYZE interpretation guide
- Connection pool monitoring
- Slow query identification and optimization
- Drizzle ORM-specific performance patterns

**Related Patterns**:
- `02_DATABASE_PATTERNS.md` (N+1 prevention, query optimization)
- `03_API_PATTERNS.md` (route performance)

### 2. Extension Security Guide

**Path**: `docs/guides/extension-security.md`
**Purpose**: Security patterns for Chrome extension development
**Suggested Content**:
- Content script security boundaries
- Message passing security (chrome.runtime.sendMessage)
- Storage security (chrome.storage.local vs sync)
- CSP configuration for extensions
- Permission minimization patterns
- Cross-origin request handling
- Extension update security

**Related Patterns**:
- `04_SECURITY_PATTERNS.md` (general security)
- `05_FRONTEND_PATTERNS.md` (UI security)

## Existing Guide (Reference)

The following guide exists and is active:
- ✅ `docs/guides/testing-security-patterns.md` - v1.0 - Security testing checklist

## Implementation Notes

1. Each guide should follow the standard structure:
   ```markdown
   ---
   Guide: [Name]
   Version: 1.0
   Last Updated: YYYY-MM-DD
   Maintainer: Claude Code / Development Team
   Status: Active
   For: [Target audience]
   Related Patterns: [List]
   ---
   ```

2. Include both checklists and practical examples
3. Cross-reference related pattern files
4. Add entries to `docs/patterns/PATTERNS_INDEX.md` when complete

## Acceptance Criteria

- [ ] `docs/guides/database-performance-review.md` created with comprehensive content
- [ ] `docs/guides/extension-security.md` created with comprehensive content
- [ ] Both guides follow standard structure
- [ ] `docs/patterns/PATTERNS_INDEX.md` updated to remove "(Planned)" markers
- [ ] Cross-references added to related pattern files
