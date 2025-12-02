# Work on TODO

Use the orchestrator to coordinate work on a specific TODO item from the `/todos` folder.

**Usage:** `/work-todo <todo-number or filename>`

---

## Task
Work on TODO: $ARGUMENTS

## Instructions

1. **First**, read the TODO file from the `/todos` directory:
   - If a number is provided (e.g., `001`), find `todos/001-*.md`
   - If a filename is provided, read `todos/<filename>`

2. **Then**, invoke the orchestrator agent (`.claude/agents/orchestrator.md`) to:
   - Analyze the TODO requirements
   - Break down into subtasks
   - Delegate to appropriate specialist agents
   - Coordinate the implementation to completion

3. **Finally**, when complete:
   - Move the TODO file to `todos/archive/` with completion date prefix
   - Summarize what was accomplished

## Available TODO Files
Check the `/todos` directory for active TODO items. Format: `NNN-status-priority-description.md`

## Orchestrator Specialists
- `backend-architect` - API, Express, jobs
- `frontend-specialist` - React, UI components
- `database-engineer` - PostgreSQL, Drizzle
- `test-engineer` - Tests, coverage
- `security-auditor` - Security fixes
- `scraper-expert` - Playwright scraping
