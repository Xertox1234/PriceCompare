# TODO 242: Remove or Relocate Test Debug File

**Created**: 2026-01-16
**Priority**: High
**Category**: Code Quality
**Effort**: 5 minutes

## Problem

A test/debug file with `console.log` statements exists in production code:

**📍 File**: `server/agents/test-html-inspection.ts`

This file contains multiple `console.log` statements and is not a proper test file (not in `__tests__/` directory).

**Risk Level**: Low (Code Quality)

## Current State

The file contains debug code for inspecting HTML responses from retailers:
- Line 29: `console.log('\n=== HTML Inspection: What axios+cheerio Actually Sees ===\n');`
- Line 32: `console.log(\`\n--- ${test.name} ---\`);`
- Line 33: `console.log(\`URL: ${test.url}\n\`);`
- And many more...

## Required Changes

### Option A: Delete the file (Recommended)

If this was a one-time debug script that's no longer needed:

```bash
rm server/agents/test-html-inspection.ts
```

### Option B: Move to proper test location

If this is useful for debugging scraper issues:

```bash
mv server/agents/test-html-inspection.ts server/agents/__tests__/html-inspection.debug.ts
```

And update to use proper logging:
```typescript
import { logger } from '../../utils/logger';

// Replace console.log with logger.debug
logger.debug('HTML Inspection results', { ... });
```

## Acceptance Criteria

- [ ] File removed from `server/agents/` OR moved to `__tests__/`
- [ ] No `console.log` statements in production agent code
- [ ] Pre-commit hooks pass (if they check for console.log)
