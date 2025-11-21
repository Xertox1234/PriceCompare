# PriceCompare Subagent System Architecture

## Overview

The PriceCompare project uses a sophisticated multi-agent architecture to maximize development efficiency, maintain code quality, and preserve context across complex tasks. This system was enhanced in January 2025 to address critical gaps in technology-specific guidance and pattern file access.

## System Architecture

```
User Request
    ↓
Main Claude Code Instance (Coordinator)
    ↓
orchestrator (Strategic Planning)
    ↓
Specialized Subagents (Domain Experts)
    ├─ backend-architect
    ├─ frontend-specialist
    ├─ database-engineer
    ├─ test-engineer
    ├─ security-auditor
    ├─ extension-builder
    ├─ scraper-expert
    └─ code-review-specialist
```

## Agent Inventory

### 1. orchestrator
**Role:** Strategic coordinator for multi-domain tasks
**Tools:** Read, Grep, Glob, WebSearch, WebFetch, Task
**Model:** Sonnet

**Capabilities:**
- Breaks down complex tasks into subtasks
- Delegates to specialized subagents using Task tool
- Passes context between stages
- Synthesizes results from multiple specialists
- Maintains architectural coherence

**When to Use:**
```bash
# For complex multi-domain features
"Use orchestrator to implement price alert notifications"

# For features requiring backend + frontend + tests
"Use orchestrator to add product comparison feature"
```

**Pattern Files:** All core patterns (5/5)
- DATABASE_PATTERNS.md
- SECURITY_PATTERNS.md
- TYPESCRIPT_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- API_PATTERNS.md

---

### 2. backend-architect
**Role:** Backend development expert
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- Node.js/Express API routes and middleware
- RESTful API design and validation
- Bull job queues and Redis caching
- Playwright web scraping
- WebSocket real-time features
- Middleware pipeline configuration

**Critical Knowledge Added (2025-01):**
- ✅ Redis dual-client architecture (ioredis vs redis package)
- ✅ Middleware pipeline order (18-step sequence)
- ✅ WebSocket/Socket.io patterns
- ✅ Bull queue and distributed locking

**When to Use:**
```bash
# API endpoints
"Use backend-architect to implement GET /api/products/:id/price-history"

# Background jobs
"Use backend-architect to create daily price snapshot job"

# WebSocket features
"Use backend-architect to add real-time price updates"
```

**Pattern Files:** All core patterns (5/5)
- API_PATTERNS.md
- DATABASE_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- SECURITY_PATTERNS.md
- TYPESCRIPT_PATTERNS.md

---

### 3. frontend-specialist
**Role:** React/UI development expert
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- React 19 components and hooks
- React Query state management
- Recharts data visualization
- Design system compliance
- Radix UI component integration
- Wouter routing

**Critical Knowledge Added (2025-01):**
- ✅ Design system enforcement (design tokens, component reuse)
- ✅ Radix UI component library patterns
- ✅ React 19 features (`use()` hook)
- ✅ Pre-commit hook requirements

**When to Use:**
```bash
# React components
"Use frontend-specialist to create PriceHistoryChart component"

# Design system work
"Use frontend-specialist to build product card with design tokens"

# State management
"Use frontend-specialist to add React Query caching for products"
```

**Pattern Files:** All frontend patterns (4/4)
- TYPESCRIPT_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- DESIGN_SYSTEM.md
- COMPONENT_GUIDE.md

---

### 4. database-engineer
**Role:** Database and ORM specialist
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- PostgreSQL schema design
- Drizzle ORM migrations and queries
- Transaction management
- Foreign key cascade strategies
- Database optimization and indexing

**Critical Knowledge Added (2025-01):**
- ✅ storage.ts abstraction layer (MANDATORY pattern)
- ✅ Transaction boundaries and isolation levels
- ✅ Foreign key cascade strategy (CASCADE vs SET NULL)
- ✅ Security patterns (password hash handling)

**When to Use:**
```bash
# Schema changes
"Use database-engineer to add price_snapshots table with indexes"

# Complex queries
"Use database-engineer to optimize product search with JOINs"

# Migrations
"Use database-engineer to create migration for foreign key cascades"
```

**Pattern Files:** All database-related patterns (3/3)
- DATABASE_PATTERNS.md
- SECURITY_PATTERNS.md
- TYPESCRIPT_PATTERNS.md

---

### 5. test-engineer
**Role:** Testing specialist (unit, integration, E2E)
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- Vitest unit and integration tests
- React Testing Library component tests
- Playwright E2E testing
- API testing with supertest
- Mock data and fixtures

**Critical Knowledge Added (2025-01):**
- ✅ Comprehensive Playwright E2E section
- ✅ API, DATABASE, SECURITY pattern access
- ✅ Page Object Model patterns
- ✅ E2E test best practices

**When to Use:**
```bash
# Unit tests
"Use test-engineer to add tests for price calculation logic"

# Component tests
"Use test-engineer to test PriceHistoryChart rendering"

# E2E tests
"Use test-engineer to create E2E test for user registration flow"
```

**Pattern Files:** All testing-related patterns (5/5)
- TYPESCRIPT_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- API_PATTERNS.md
- DATABASE_PATTERNS.md
- SECURITY_PATTERNS.md

---

### 6. security-auditor
**Role:** Security review specialist
**Tools:** Read, Grep, Glob, WebSearch, WebFetch (READ-ONLY)
**Model:** Sonnet

**Capabilities:**
- Security vulnerability assessment
- Authentication/authorization review
- Input validation auditing
- SQL injection prevention
- XSS and CSRF protection review

**Critical Knowledge Added (2025-01):**
- ✅ ERROR_HANDLING_PATTERNS.md (error sanitization)
- ✅ TYPESCRIPT_PATTERNS.md (type-based security)
- ✅ API_PATTERNS.md (API security, middleware order)
- ✅ DATABASE_PATTERNS.md (SQL injection prevention)

**Impact:** Pattern coverage increased from 1/5 to 5/5 - now has comprehensive cross-domain security knowledge.

**When to Use:**
```bash
# Security audits
"Use security-auditor to review authentication implementation"

# Pre-production checks
"Use security-auditor to audit API endpoints for vulnerabilities"
```

**Pattern Files:** All core patterns (5/5) - Most comprehensive
- SECURITY_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- TYPESCRIPT_PATTERNS.md
- API_PATTERNS.md
- DATABASE_PATTERNS.md

---

### 7. extension-builder
**Role:** Chrome extension specialist
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- Chrome Extension Manifest V3
- Service workers and background scripts
- Content scripts and injection
- Message passing between contexts
- Extension-specific React components

**When to Use:**
```bash
# Extension features
"Use extension-builder to add price tracking to extension"

# Content scripts
"Use extension-builder to inject price comparison widget"
```

**Pattern Files:** Extension-specific patterns (3/3)
- TYPESCRIPT_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- SECURITY_PATTERNS.md

---

### 8. scraper-expert
**Role:** Web scraping specialist
**Tools:** Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch
**Model:** Sonnet

**Capabilities:**
- Playwright browser automation
- Selector strategies
- Price extraction patterns
- Anti-bot measures
- Rate limiting and error recovery

**Critical Knowledge Added (2025-01):**
- ✅ Playwright usage clarification (npm package, NOT MCP)
- ✅ API_PATTERNS.md (rate limiting, caching)
- ✅ File path corrections

**When to Use:**
```bash
# Scraper implementation
"Use scraper-expert to create Amazon product scraper"

# Debugging
"Use scraper-expert to fix Walmart price extraction"
```

**Pattern Files:** Scraping-specific patterns (3/3)
- ERROR_HANDLING_PATTERNS.md
- SECURITY_PATTERNS.md
- API_PATTERNS.md

---

### 9. code-review-specialist
**Role:** Post-implementation code review
**Tools:** Glob, Grep, Read, WebFetch, TodoWrite, WebSearch, BashOutput, KillShell, mcp__ide__executeCode, AskUserQuestion, mcp__ide__getDiagnostics
**Model:** Haiku (fast reviews)

**Capabilities:**
- Code quality review
- Security vulnerability scanning
- Pattern compliance checking
- Pre-commit hook validation
- Architecture adherence

**When to Use:**
Automatically invoked via `.claude/hooks.json` after commits, or manually:
```bash
"Use code-review-specialist to review recent changes"
```

**Pattern Files:** All core patterns (5/5)
- DATABASE_PATTERNS.md
- SECURITY_PATTERNS.md
- TYPESCRIPT_PATTERNS.md
- ERROR_HANDLING_PATTERNS.md
- API_PATTERNS.md

---

## Pattern File Access Matrix

| Agent | DATABASE | SECURITY | TYPESCRIPT | ERROR | API | DESIGN | COMPONENT |
|-------|----------|----------|------------|-------|-----|--------|-----------|
| orchestrator | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| backend-architect | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| frontend-specialist | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| database-engineer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| test-engineer | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| security-auditor | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| extension-builder | ❌ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ❌ |
| scraper-expert | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| code-review-specialist | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ |

✅ = Has access
❌ = No access
⚠️ = Conditional access

---

## Critical Enhancements (January 2025)

### Enhancement Summary

**Agents Enhanced:** 7/9
**Pattern Files Added:** 14 references
**Critical Sections Added:** 10 major sections
**Total Lines Added:** ~2000 lines of documentation

### Before → After Comparison

#### 1. **Redis Architecture** (CRITICAL)
- **Before:** Generic Redis mentions, no dual-client guidance
- **After:** Comprehensive dual-client architecture documented
  - ioredis for application logic
  - redis package for sessions only
  - Production requirements
  - Common patterns

#### 2. **Middleware Pipeline** (CRITICAL)
- **Before:** No guidance on middleware order
- **After:** 18-step mandatory pipeline documented
  - CSRF token attachment before protection
  - Sentry handlers at both ends
  - Security layers before business logic

#### 3. **Storage Abstraction Layer** (CRITICAL)
- **Before:** Direct db queries allowed
- **After:** storage.ts mandatory pattern enforced
  - IStorage interface required
  - No direct db access from routes
  - Testability and caching benefits

#### 4. **Transaction Boundaries** (CRITICAL)
- **Before:** Basic transaction mentions
- **After:** Comprehensive transaction patterns
  - When to use SERIALIZABLE
  - Common patterns (Create+Notification, etc.)
  - GitHub issue #67 references

#### 5. **Design System Enforcement** (HIGH)
- **Before:** No design system guidance
- **After:** Complete design system documentation
  - Design tokens mandatory
  - Component reuse patterns
  - Pre-commit hook warnings

#### 6. **Playwright E2E Testing** (HIGH)
- **Before:** E2E testing completely missing
- **After:** Comprehensive E2E section
  - Test structure and patterns
  - Page Object Model
  - Best practices

#### 7. **Pattern File Coverage** (CRITICAL)
- **security-auditor:** 1/5 → 5/5 patterns (+400% improvement)
- **database-engineer:** 1/3 → 3/3 patterns (+200% improvement)
- **test-engineer:** 2/5 → 5/5 patterns (+150% improvement)
- **frontend-specialist:** 2/4 → 4/4 patterns (+100% improvement)

---

## Usage Patterns

### Pattern 1: Simple Single-Domain Task
```bash
# Direct delegation to specialist
User: "Use backend-architect to add GET /api/products/:id/offers endpoint"
```

### Pattern 2: Complex Multi-Domain Feature
```bash
# Use orchestrator for automatic delegation
User: "Use orchestrator to implement product comparison feature"

# Orchestrator workflow:
# 1. Analyzes requirements
# 2. Task(backend-architect) → Implements comparison API
# 3. Task(frontend-specialist) → Creates comparison UI
# 4. Task(test-engineer) → Adds comprehensive tests
# 5. Synthesizes results
```

### Pattern 3: Sequential Workflow
```bash
# Manual step-by-step
User: "Use backend-architect to implement price alert API"
# ... after completion ...
User: "Use frontend-specialist to create alert management UI"
# ... after completion ...
User: "Use test-engineer to add E2E tests for price alerts"
```

### Pattern 4: Review After Implementation
```bash
# After implementing features
User: "Use code-review-specialist to review recent changes"
```

---

## Token Efficiency

### Without Orchestrator
```
Single Context Window:
- All backend files: 30K tokens
- All frontend files: 40K tokens
- All test files: 20K tokens
- Implementation details: 60K tokens
Total: 150K tokens in one context
```

### With Orchestrator
```
Orchestrator Context: 10K tokens
├─ Backend specialist: 35K tokens (isolated)
├─ Frontend specialist: 35K tokens (isolated)
└─ Test specialist: 25K tokens (isolated)
Total: 105K tokens across isolated contexts
Savings: 30% reduction + better quality
```

---

## Best Practices

### 1. Choose the Right Agent
```bash
# ✅ CORRECT - Direct to specialist for focused work
"Use backend-architect to add caching to product endpoint"

# ✅ CORRECT - Orchestrator for multi-domain work
"Use orchestrator to implement user authentication system"

# ❌ WRONG - Orchestrator for single-domain task
"Use orchestrator to fix a typo in ProductCard component"
```

### 2. Provide Context
```bash
# ✅ CORRECT - Specific context
"Use frontend-specialist to create PriceHistoryChart component
Requirements:
- Display 30-day price trend
- Use Recharts LineChart
- Data from GET /api/products/:id/price-history
- Follow design system (bg-primary color)"

# ❌ WRONG - Vague request
"Use frontend-specialist to add a chart"
```

### 3. Sequential vs Parallel
```bash
# Sequential (when steps depend on each other)
1. "Use backend-architect to implement API"
2. Wait for completion
3. "Use frontend-specialist to consume API" (needs API details)

# Parallel (when work is independent)
# Open multiple Claude Code terminals:
Terminal 1: "Use backend-architect to implement API"
Terminal 2: "Use frontend-specialist to create UI mockup"
Terminal 3: "Use database-engineer to optimize schema"
```

### 4. Review After Completion
```bash
# Always review critical features
"Use security-auditor to review authentication implementation"

# Or use automatic hook-based review
# (configured in .claude/hooks.json)
```

---

## File Locations Reference

### Backend
- Routes: `server/routes/*.ts`
- Jobs: `server/jobs/*.ts`
- Services: `server/services/*.ts`
- Middleware: `server/middleware/*.ts`
- Config: `server/config/*.ts`
- Scrapers: `server/scrapers/*.ts`

### Frontend
- Components: `client/src/components/*.tsx`
- Pages: `client/src/pages/*.tsx`
- Hooks: `client/src/hooks/*.ts`
- UI Primitives: `client/src/components/ui/*.tsx`

### Shared
- Schema: `shared/schema.ts`
- Types: `shared/*.ts`

### Testing
- Backend Tests: `server/**/__tests__/*.test.ts`
- Frontend Tests: `client/src/**/*.test.tsx`
- E2E Tests: `tests/e2e/*.spec.ts`

### Extension
- Extension Code: `extensions/chrome/`
- Service Worker: `extensions/chrome/background.js`
- Content Scripts: `extensions/chrome/content-scripts/`

---

## Troubleshooting

### Issue: Agent doesn't have required knowledge
**Solution:** Check pattern file access matrix above. Some agents don't have access to all patterns by design.

### Issue: Orchestrator not delegating
**Symptoms:** Orchestrator provides recommendations instead of executing
**Cause:** Orchestrator needs to actively use Task tool
**Status:** FIXED in 2025-01 enhancement (added Task tool and execution instructions)

### Issue: Pattern file not being referenced
**Solution:** Pattern files must be listed in agent's "Required Reading" section. Check agent configuration file.

### Issue: File paths incorrect
**Symptoms:** Agent looks for files in `src/` instead of `server/`
**Status:** FIXED in 2025-01 enhancement (all file paths updated)

---

## Maintenance

### Adding a New Agent
1. Create agent file in `.claude/agents/new-agent.md`
2. Define frontmatter (name, description, tools, model)
3. Add Required Reading pattern files
4. Document expertise and capabilities
5. Provide key patterns and examples
6. Update this guide with new agent info

### Updating Pattern Access
1. Edit agent's `.claude/agents/agent-name.md`
2. Add pattern file to "Required Reading" section
3. Update pattern file access matrix in this guide
4. Test agent with sample task to verify

### Monitoring Effectiveness
- Review agent usage via `.claude/logs/`
- Check token usage per agent
- Monitor pre-commit hook success rate
- Collect developer feedback

---

## References

- **Orchestrator Configuration:** `.claude/agents/orchestrator.md`
- **All Agent Configurations:** `.claude/agents/*.md`
- **Pattern Files:** `docs/*_PATTERNS.md`
- **Hooks Configuration:** `.claude/hooks.json`
- **Claude Code Documentation:** `.claude/knowledge/claude-code-subagent-setup-guide.md`

---

## Version History

### v2.0 (January 2025) - Major Enhancement
- Added Redis dual-client architecture to backend-architect
- Added Middleware pipeline order to backend-architect
- Added WebSocket and Bull patterns to backend-architect
- Added storage.ts abstraction to database-engineer
- Added transaction boundaries to database-engineer
- Added foreign key cascades to database-engineer
- Expanded security-auditor pattern access (1/5 → 5/5)
- Added design system enforcement to frontend-specialist
- Added Radix UI patterns to frontend-specialist
- Added React 19 features to frontend-specialist
- Expanded test-engineer pattern access (2/5 → 5/5)
- Added comprehensive Playwright E2E to test-engineer
- Fixed orchestrator api-specialist references
- Clarified Playwright usage in scraper-expert
- Fixed file paths across all agents

### v1.0 (November 2024) - Initial System
- Created 9 specialized subagents
- Established pattern file system
- Implemented basic agent architecture

---

**Last Updated:** January 2025
**Authors:** Claude Code Team + PriceCompare Development Team
