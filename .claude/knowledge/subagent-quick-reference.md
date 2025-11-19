# Claude Code Subagent Quick Reference

## 🚀 Quick Start

```bash
# Run setup script
cd /path/to/your/pricecompare-project
bash setup-subagents.sh
```

## 📋 Subagent Roster

| Subagent | Use For | Example |
|----------|---------|---------|
| **orchestrator** | Complex multi-domain tasks | "Use orchestrator to implement user authentication" |
| **backend-architect** | API routes, jobs, scraping | "Use backend-architect to add a price update job" |
| **frontend-specialist** | React components, UI | "Use frontend-specialist to create ProductCard component" |
| **extension-builder** | Chrome Extension features | "Use extension-builder to add context menu" |
| **database-engineer** | Schema, queries, migrations | "Use database-engineer to add price_alerts table" |
| **scraper-expert** | Web scraping with Playwright | "Use scraper-expert to fix Amazon price selector" |
| **test-engineer** | Writing tests | "Use test-engineer to test ProductCard" |
| **security-auditor** | Security reviews | "Use security-auditor to review auth implementation" |

## 💡 Common Patterns

### Starting a New Feature
```
Use orchestrator to plan and implement [feature name]:
- [requirement 1]
- [requirement 2]  
- [requirement 3]
```

### Fixing a Bug
```
Use [appropriate-subagent] to fix [specific issue]:
The bug is in [file path] where [description].
```

### Adding Tests
```
Use test-engineer to add tests for [component/function name].
The file is at [path] and should test [scenarios].
```

### Security Review
```
Use security-auditor to review [feature/file].
Focus on [auth/validation/etc].
```

## 🎯 When to Use Each Subagent

### Use **orchestrator** when:
- ✅ Feature spans backend + frontend + database
- ✅ Need coordination between multiple components
- ✅ Complex architectural decisions
- ✅ Multi-step implementation with dependencies

### Use **backend-architect** when:
- ✅ Creating/modifying API endpoints
- ✅ Implementing background jobs (Bull queues)
- ✅ Web scraping with Playwright
- ✅ Redis caching logic
- ✅ Express middleware

### Use **frontend-specialist** when:
- ✅ Creating React components
- ✅ Implementing React Query hooks
- ✅ Building charts with Recharts
- ✅ Client-side state management
- ✅ Vite configuration

### Use **extension-builder** when:
- ✅ Chrome Extension features
- ✅ Service worker logic
- ✅ Content script injection
- ✅ Extension popup UI
- ✅ Message passing between contexts

### Use **database-engineer** when:
- ✅ Creating/modifying database schema
- ✅ Writing complex queries
- ✅ Adding indexes
- ✅ Creating migrations
- ✅ Query optimization

### Use **scraper-expert** when:
- ✅ Implementing new product scrapers
- ✅ Debugging price extraction logic
- ✅ Updating broken selectors
- ✅ Handling anti-bot measures
- ✅ Optimizing scraping performance
- ✅ Working with Playwright MCP tools

### Use **test-engineer** when:
- ✅ Writing any tests (unit, integration, component)
- ✅ Debugging test failures
- ✅ Improving test coverage
- ✅ Setting up test fixtures

### Use **security-auditor** when:
- ✅ Reviewing authentication/authorization
- ✅ Checking for vulnerabilities
- ✅ Pre-production security audit
- ✅ Validating input handling

## 🔧 Token Optimization Commands

```bash
# Monitor context usage
/context

# Monitor token costs
/cost

# Compact conversation at 70% capacity
/compact

# Clear context between features
/clear

# Switch models
/model sonnet   # Default
/model opus     # For complex planning
/model haiku    # For simple tasks
```

## 📊 Token Savings Workflow

### ❌ OLD WAY (High Token Usage)
```
Single session → 150K+ tokens
- Main agent reads all files
- Accumulates debug logs
- Context polluted with implementation details
- Performance degrades after 20 iterations
```

### ✅ NEW WAY (50-70% Token Savings)
```
Orchestrator (10-20K tokens) → Delegates to subagents
- backend-architect (20-30K tokens)
- frontend-specialist (20-30K tokens)  
- test-engineer (20-30K tokens)
Total: 70-100K tokens with isolated contexts
```

## 🎬 Example Workflows

### Workflow 1: New Feature (Full Stack)
```
1. "Use orchestrator to implement price drop alerts:
   - Users set target price for products
   - Background job checks prices daily
   - Send notifications when price drops below target
   - Frontend UI to manage alerts"

2. Orchestrator delegates:
   → backend-architect: API endpoints + job
   → database-engineer: alerts table schema
   → frontend-specialist: alert management UI
   → test-engineer: integration tests
   → security-auditor: review implementation

3. Review and merge!
```

### Workflow 2: Bug Fix (Focused)
```
1. Identify bug domain (backend/frontend/database)

2. "Use backend-architect to fix the Redis caching bug 
   where product prices aren't invalidating after scrape.
   File: src/jobs/price-update.ts"

3. Test fix

4. Done!
```

### Workflow 3: Refactoring
```
1. "Use orchestrator to refactor the product scraping system:
   - Extract scraper logic into separate modules
   - Add retry mechanism
   - Improve error handling
   - Update tests"

2. Orchestrator coordinates:
   → backend-architect: refactor implementation
   → test-engineer: update tests
   → security-auditor: review changes

3. Commit!
```

## 🚨 Best Practices

### DO ✅
- Use orchestrator for multi-domain work
- Clear context after completing features (`/clear`)
- Compact at 70% capacity (`/compact`)
- Start new chats for unrelated work
- Commit before major refactors
- Monitor token usage regularly (`/cost`)

### DON'T ❌
- Run 20+ iterations without clearing
- Keep stale error logs in context
- Reuse long chats for new features
- Load entire codebase unnecessarily
- Enable all MCP servers at once

## 🐛 Troubleshooting

### Subagent not invoked automatically?
- Make description more specific
- Explicitly call: "Use [agent-name] to..."
- Check agent exists in `.claude/agents/`

### Context still too large?
- Compact more aggressively (60% not 70%)
- Delegate research to subagents
- Start new sessions for each feature
- Keep CLAUDE.md concise

### Subagent making mistakes?
- Improve subagent's system prompt
- Provide clearer delegation instructions
- Add project-specific patterns to prompt

## 📈 Measuring Success

Track these metrics to see improvements:

- **Token usage per feature**: Should decrease 50-70%
- **Context window utilization**: Stay below 80%
- **Iterations per task**: Fewer with better delegation
- **Code quality**: Consistent patterns across subagents

## 🔗 Resources

- Full Guide: `claude-code-subagent-setup-guide.md`
- Agent Files: `.claude/agents/*.md`
- Project Context: `CLAUDE.md`

---

**Remember**: The goal is to keep the orchestrator focused on high-level coordination while subagents handle implementation details in isolated contexts. This preserves context quality and dramatically reduces token usage!
