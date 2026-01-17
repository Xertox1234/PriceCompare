# Dependency & Architecture Change Proposals

**Effective Date**: 2026-01-13
**Status**: Architecture Freeze Active
**Policy**: CLAUDE.md#architecture-freeze--dependency-policy

---

## Overview

This file tracks all dependency additions and architectural change proposals. All new dependencies and architectural changes require written justification and approval before implementation.

**Philosophy**: "The best dependency is no dependency."

---

## Approval Process

1. **Document Justification**: Add proposal section below using template
2. **Get Written Approval**: Project owner reviews and approves
3. **Update Pre-Commit Exception**: Add approval reference to bypass enforcement
4. **Implement Change**: Add dependency or make architectural change

---

## Proposal Template

```markdown
## Proposal: [Package Name / Architectural Change]

**Proposed by**: [Your name]
**Date**: YYYY-MM-DD
**Type**: dependency | devDependency | architecture-change
**Status**: Pending | Approved | Rejected

### Problem Statement

[What problem does this solve? Why can't existing dependencies or patterns solve it?]

### Alternatives Considered

- **Option 1**: [Existing solution] - [Why insufficient]
- **Option 2**: [Different package/pattern] - [Why not chosen]
- **Option 3**: [Build in-house] - [Why not feasible]

### Proposed Solution

**Package**: [package-name@version] (if dependency)
**Bundle size**: [KB] (check bundlephobia.com)
**Weekly downloads**: [count] (npm trends)
**Last published**: [date]
**License**: [license type]
**Security audit**: [npm audit result]

OR

**Architectural Change**: [Description of pattern change]

### Impact Assessment

- Bundle size impact: +[KB] (if dependency)
- Security vulnerabilities: [count]
- Maintenance burden: [Low/Medium/High]
- Breaking changes risk: [Low/Medium/High]
- Affected files: [List of files]

### Justification

[Why this is NECESSARY, not just convenient. What specific functionality cannot be achieved without this change?]

### Approval

- [ ] Reviewed by project owner
- [ ] Approved on [date]
- [ ] Approval reference: [commit hash / issue number]
```

---

## Approved Proposals

### Example: Security Patch for qs vulnerability

**Proposed by**: Claude Code (Orchestrator)
**Date**: 2026-01-13
**Type**: devDependency (security patch)
**Status**: ✅ Approved (Auto-approved - security patch)

**Problem**: CVE-XXXX-YYYY in qs package (DoS vulnerability)

**Solution**: `npm audit fix` to patch vulnerable version

**Justification**: Security patches are auto-approved per policy

**Approval**: Security patches exempt from approval process

---

### Proposal: robots-parser (TODO_240)

**Proposed by**: Claude Code (TODO_240 Resolution)
**Date**: 2026-01-16
**Type**: dependency
**Status**: ✅ Approved

#### Problem Statement

The scraping agents do not check robots.txt before crawling retailer sites. While ethical crawling is mentioned in documentation, it was not implemented in actual code. This poses legal/ethical risk and could result in IP blocks from retailers.

#### Alternatives Considered

- **Option 1**: Manual regex parsing - Insufficient: robots.txt spec is complex (wildcards, crawl-delay, groups)
- **Option 2**: fetch + custom parser - Insufficient: Would need to reimplement entire spec
- **Option 3**: Build in-house - Not feasible: robots.txt parsing is well-defined problem with edge cases

#### Proposed Solution

**Package**: robots-parser@^3.0.1
**Bundle size**: ~5KB minified
**Weekly downloads**: ~1.5M (popular, well-maintained)
**Last published**: 2024 (stable)
**License**: MIT
**Security audit**: 0 vulnerabilities

#### Impact Assessment

- Bundle size impact: +5KB (negligible)
- Security vulnerabilities: 0
- Maintenance burden: Low (stable API, infrequent updates)
- Breaking changes risk: Low (mature package)
- Affected files:
  - `server/utils/robots-txt-checker.ts` (new)
  - `server/agents/extraction-agent.ts` (integration)

#### Justification

**NECESSARY** for ethical web scraping compliance:
1. robots.txt is the standard mechanism for site owners to communicate crawling preferences
2. Respecting robots.txt prevents legal issues (TOS violations, potential litigation)
3. Prevents IP blocks that would degrade scraper reliability
4. No existing dependency can parse robots.txt

#### Approval

- [x] Reviewed by project owner
- [x] Approved on 2026-01-16
- [x] Approval reference: User approved in conversation (TODO 240 approval)

---

## Rejected Proposals

(None yet)

---

## Pending Proposals

(None currently)

---

## Notes

- **Security patches** (`npm audit fix`) are auto-approved
- **Patch version updates** (1.2.3 → 1.2.4) are auto-approved
- **Removing dependencies** is auto-approved
- All other changes require explicit approval

---

**Last Updated**: 2026-01-16
**Maintained by**: Project Owner
