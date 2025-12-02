# Work on GitHub Issue

Use the orchestrator to coordinate work on a GitHub issue from the PriceCompare repository.

**Usage:** `/work-issue <issue-number>`

---

## Task
Work on GitHub Issue: #$ARGUMENTS

## Instructions

1. **First**, fetch the GitHub issue details:
   - Repository: `Xertox1234/PriceCompare`
   - Issue number: $ARGUMENTS
   - Use `gh issue view $ARGUMENTS` to get issue details, labels, and comments

2. **Analyze the issue**:
   - Understand the requirements from title, description, and comments
   - Check labels for priority (P1, P2, P3) and type (bug, feature, security)
   - Note any linked PRs or related issues

3. **Then**, invoke the orchestrator agent (`.claude/agents/orchestrator.md`) to:
   - Break down the issue into implementation subtasks
   - Identify which specialist agents are needed based on the issue type:
     - `bug` label → likely needs `test-engineer` + domain specialist
     - `security` label → needs `security-auditor`
     - `feature` label → may need multiple specialists
     - `database` label → needs `database-engineer`
     - `frontend` label → needs `frontend-specialist`
     - `backend` label → needs `backend-architect`
   - Delegate to appropriate specialists sequentially
   - Coordinate the implementation to completion

4. **During implementation**:
   - Create a feature branch if not already on one: `git checkout -b issue-$ARGUMENTS-<short-description>`
   - Make atomic commits referencing the issue: `git commit -m "fix: description (#$ARGUMENTS)"`
   - Follow project patterns from `docs/` folder

5. **When complete**:
   - Run tests: `npm test`
   - Summarize changes made
   - Optionally create PR with `gh pr create --title "Fix #$ARGUMENTS: <title>" --body "<description>"`

## Orchestrator Specialists
- `backend-architect` - API routes, Express middleware, Bull jobs, WebSocket
- `frontend-specialist` - React components, React Query, Recharts
- `database-engineer` - PostgreSQL, Drizzle ORM, migrations
- `test-engineer` - Vitest, React Testing Library, coverage
- `security-auditor` - Security fixes, auth, vulnerabilities
- `scraper-expert` - Playwright automation, selectors
- `extension-builder` - Chrome Extension MV3

## Pattern Files (Reference as needed)
- Security: `docs/04_SECURITY_PATTERNS.md`
- TypeScript: `docs/01_TYPESCRIPT_PATTERNS.md`
- Database: `docs/02_DATABASE_PATTERNS.md`
- API: `docs/03_API_PATTERNS.md`
- Frontend: `docs/05_FRONTEND_PATTERNS.md`
- Errors: `docs/06_ERROR_HANDLING_PATTERNS.md`
- Jobs: `docs/07_BACKGROUND_JOBS_PATTERNS.md`
