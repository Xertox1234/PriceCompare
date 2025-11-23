---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, architecture, organization]
dependencies: []
---

# Consolidate Route Registration to Single Location

## Problem Statement

Routes are split between two locations without clear separation:
- Core routes in `server/routes/index.ts` (13 files)
- Feature routes in `server/index.ts` (10 files)

No clear criteria distinguishes "core" from "feature" routes.

## Findings

- Discovered by Architecture Strategist and Pattern Recognition agents
- Feature routes bypass centralized registration
- Makes it harder to understand full API surface

## Recommended Action

1. Move all route files to `server/routes/` directory
2. Register all routes in `server/routes/index.ts`
3. Document organizational criteria

## Acceptance Criteria

- [ ] All route files in `server/routes/` directory
- [ ] Single route registration point
- [ ] Clear documentation on route organization
