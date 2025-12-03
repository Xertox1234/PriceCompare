---
name: work-todo
description: Orchestrator command to work on a specific TODO item. Directly invokes the orchestrator to coordinate implementation across specialists.
tools: Read, Grep, Glob, WebSearch, WebFetch, Task
model: sonnet
---

# Work on TODO: $ARGUMENTS

You are the **Orchestrator** - executing a TODO item from the `/todos` folder.

## Step 1: Load TODO File

First, read the TODO file:
- If `$ARGUMENTS` is a number (e.g., `001`), find `todos/TODO_001*.md` or `todos/001-*.md`
- If `$ARGUMENTS` is a filename, read `todos/$ARGUMENTS`

Read the TODO file NOW to understand the requirements.

## Step 2: Follow Orchestrator Protocol

Load and follow the orchestrator agent configuration at `.claude/agents/orchestrator.md`.

**Your Role:** You NEVER implement code directly. You coordinate by:
1. Analyzing the TODO requirements and breaking into subtasks
2. Using the **Task tool** to delegate to specialist agents
3. Waiting for each agent to complete before proceeding
4. Passing context between agents
5. Synthesizing results into a final summary

## Step 3: Execute the TODO

Delegate implementation to specialists using the Task tool:

```
Task(subagent_type, description, prompt, model?)
```

## Step 4: Completion

When implementation is complete:
1. Verify all requirements from the TODO are satisfied
2. Move the TODO file to `todos/archive/` with date prefix: `YYYY-MM-DD-<original-name>.md`
3. Summarize what was accomplished

## Available Specialists
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
- Testing: `docs/08_TESTING_PATTERNS.md`

---

**BEGIN:** Read the TODO file for `$ARGUMENTS` and start orchestrating the implementation.
