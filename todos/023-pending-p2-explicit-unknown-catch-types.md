---
status: pending
priority: p2
issue_id: "023"
tags: [code-review, typescript, error-handling]
dependencies: []
---

# Add Explicit unknown Type to Catch Blocks

## Problem Statement

Many catch blocks use `(error)` without explicit `: unknown` type annotation, reducing code clarity.

## Findings

- Discovered by TypeScript Reviewer agent
- 50+ catch blocks across server files affected
- While `sendErrorResponse` handles unknown correctly, explicit annotation improves clarity

Example files:
- `server/affiliate-routes.ts` (7 blocks)
- `server/notification-routes.ts` (13 blocks)
- `server/routes/admin-routes.ts` (17 blocks)

## Recommended Action

Add explicit type annotation:
```typescript
// Instead of:
} catch (error) {

// Use:
} catch (error: unknown) {
```

## Acceptance Criteria

- [ ] All catch blocks have explicit `: unknown` type
- [ ] TypeScript strict mode compliance maintained
