# PriceCompare Documentation

**Modern price comparison platform with AI-powered product discovery**
**Tech Stack:** Express.js + React 19 + PostgreSQL + Redis + Playwright

---

## 🚀 Quick Start

**New to the project?** Start here:
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
2. Review [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - UI patterns
3. Explore [Core Patterns](#core-patterns) - Essential development patterns
4. Check [guides/](./guides/) - Quick reference guides

**Working on a feature?**
- Consult relevant [Core Patterns](#core-patterns) first
- Check [learnings/](./learnings/) for real-world examples
- Follow [PATTERN_CODIFICATION_GUIDE.md](./PATTERN_CODIFICATION_GUIDE.md) to extract new patterns

---

## 📚 Core Patterns (Essential Reading)

These 8 files define the project's development standards. **Read before coding!**

| Pattern | Purpose | Key Topics |
|---------|---------|------------|
| [01_TYPESCRIPT_PATTERNS.md](./01_TYPESCRIPT_PATTERNS.md) | Type safety | Zod, async/await, floating promises |
| [02_DATABASE_PATTERNS.md](./02_DATABASE_PATTERNS.md) | Database operations | N+1 prevention, transactions, storage layer |
| [03_API_PATTERNS.md](./03_API_PATTERNS.md) | API development | Routes, middleware, services |
| [04_SECURITY_PATTERNS.md](./04_SECURITY_PATTERNS.md) | Security standards | Auth, CSRF, input validation |
| [05_FRONTEND_PATTERNS.md](./05_FRONTEND_PATTERNS.md) | React patterns | Components, React Query, forms |
| [06_ERROR_HANDLING_PATTERNS.md](./06_ERROR_HANDLING_PATTERNS.md) | Error handling | Responses, sanitization |
| [07_BACKGROUND_JOBS_PATTERNS.md](./07_BACKGROUND_JOBS_PATTERNS.md) | Background jobs | Bull queues, distributed locking |
| [08_TESTING_PATTERNS.md](./08_TESTING_PATTERNS.md) | Testing strategies | Vitest, integration tests, E2E |

---

## 📂 Documentation Categories

### 🏗️ Architecture & System Design
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview, ADRs, caching
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Design system and UI tokens
- [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) - React component architecture
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference

### 🔒 Security
[security/](./security/) - Auth, encryption, HTTP Basic Auth, security audits

### 🗄️ Database
[database/](./database/) - Schema migrations, storage layer architecture, solutions

### 🧪 Testing
[testing/](./testing/) - E2E test plans, test coverage, database setup

### 🚀 Deployment & Operations
[deployment/](./deployment/) - Deployment guides, monitoring, backup/recovery

### 🔧 Tooling & CI/CD
[tooling/](./tooling/) - ESLint, pre-commit hooks, CI/CD automation, npm overrides

### 📖 Guides & Quick References
[guides/](./guides/) - Quick starts, checklists, how-to guides

### 💡 Features
[features/](./features/) - Browser extension, smart notifications, feature specs

### 📊 Audits & Reports
[audits/](./audits/) - Code audits, security audits, verification reports

### 🧠 Learnings (Real-World Examples)
[learnings/](./learnings/) - 49 documented lessons learned, organized by topic:
- E2E Testing (7 docs)
- Code Review (6 docs)
- Database & Schema (5 docs)
- Security (2 docs)
- Pre-commit Hooks (5 docs)
- TODO Resolutions (18 docs)
- Performance (1 doc)
- Tooling (6 docs)

### 📅 Development Phases
[phases/](./phases/) - Phase completion summaries and timeline

### 📦 API Documentation
[api/](./api/) - Endpoint references, testing plans, unified auth design

### 🗃️ Archive
[archive/](./archive/) - Completed migrations and obsolete documentation

### 🔬 Research & Planning
- [research/](./research/) - Design and UI research
- [planning/](./planning/) - Future planning documents
- [agents/](./agents/) - Code review specialist documentation

---

## 🛠️ Common Tasks

### Starting a New Feature
1. Review relevant [Core Patterns](#core-patterns)
2. Check [learnings/](./learnings/) for similar past work
3. Read [PATTERN_CODIFICATION_GUIDE.md](./PATTERN_CODIFICATION_GUIDE.md)
4. Follow pre-commit hook guidance in [tooling/](./tooling/)

### Database Changes
1. Read [SCHEMA_MIGRATION_QUICK_REFERENCE.md](./SCHEMA_MIGRATION_QUICK_REFERENCE.md)
2. Check [database/](./database/) for migration patterns
3. Validate with `npm run validate:schema` before commit

### Security Review
1. Consult [04_SECURITY_PATTERNS.md](./04_SECURITY_PATTERNS.md)
2. Review [security/](./security/) for specific scenarios
3. Run security checks: `npm run security:full`

### Debugging Issues
1. Check [learnings/](./learnings/) for similar problems
2. Review [LINT_ERROR_PATTERNS.md](./tooling/LINT_ERROR_PATTERNS.md)
3. See [testing/](./testing/) for test debugging

---

## 📝 Pattern Codification

When you solve a significant problem:
1. Document the solution in code
2. Extract learnings to [learnings/](./learnings/)
3. Update relevant [Core Patterns](#core-patterns)
4. Follow [PATTERN_CODIFICATION_GUIDE.md](./PATTERN_CODIFICATION_GUIDE.md)

**When to codify:**
- ✅ Security vulnerabilities fixed
- ✅ Performance optimizations
- ✅ Pre-commit blocks resolved
- ✅ Recurring issues (2+ times)
- ✅ New architectural patterns

---

## 🎯 Quick Reference

| Need | Documentation |
|------|---------------|
| **API routes** | [03_API_PATTERNS.md](./03_API_PATTERNS.md) + [api/](./api/) |
| **Database queries** | [02_DATABASE_PATTERNS.md](./02_DATABASE_PATTERNS.md) + [database/](./database/) |
| **React components** | [05_FRONTEND_PATTERNS.md](./05_FRONTEND_PATTERNS.md) + [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) |
| **Security** | [04_SECURITY_PATTERNS.md](./04_SECURITY_PATTERNS.md) + [security/](./security/) |
| **Testing** | [08_TESTING_PATTERNS.md](./08_TESTING_PATTERNS.md) + [testing/](./testing/) |
| **Pre-commit issues** | [tooling/PRE_COMMIT_HOOK_GUIDE.md](./tooling/PRE_COMMIT_HOOK_GUIDE.md) |
| **Deployment** | [deployment/](./deployment/) |
| **Past problems** | [learnings/](./learnings/) |

---

## 📊 Project Statistics

- **Core Patterns:** 8 files (794 KB)
- **Learnings Documented:** 49 sessions
- **Development Phases:** 5+ completed phases
- **Total Documentation:** 248 files

---

**Last Updated:** January 2, 2026
**Maintained by:** Development team via pattern codification
