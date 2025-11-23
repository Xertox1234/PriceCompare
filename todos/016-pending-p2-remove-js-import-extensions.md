---
status: pending
priority: p2
issue_id: "016"
tags: [code-review, consistency, imports]
dependencies: []
---

# Standardize Import Extensions - Remove .js Suffixes

## Problem Statement

Some files use `.js` extensions in imports (ESM style) while majority do not. Inconsistent across codebase.

## Findings

- Discovered by Pattern Recognition agent
- 70+ occurrences with `.js` extensions in:
  - `server/services/websocket-service.ts`
  - `server/agents/*.ts`
  - `server/monitoring-routes.ts`
- Majority of codebase doesn't use extensions

## Recommended Action

Remove `.js` extensions from TypeScript imports for consistency:
```typescript
// Instead of:
import { db } from './db.js';

// Use:
import { db } from './db';
```

## Acceptance Criteria

- [ ] Consistent import style across codebase
- [ ] No `.js` extensions in TypeScript imports
- [ ] Build still works correctly
