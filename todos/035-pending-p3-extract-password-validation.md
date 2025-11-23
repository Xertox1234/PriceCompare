---
status: pending
priority: p3
issue_id: "035"
tags: [code-review, dry, validation]
dependencies: []
---

# Extract Password Validation to Shared Utility

## Problem Statement

Password validation logic is duplicated in auth-routes.ts (lines 85-115 and 385-407).

## Findings

- Discovered by Architecture Strategist agent
- Same inline validation repeated for registration and password reset

## Recommended Action

Create shared validation function or Zod schema:
```typescript
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Must contain lowercase')
  .regex(/[A-Z]/, 'Must contain uppercase')
  .regex(/[0-9]/, 'Must contain number');
```

## Acceptance Criteria

- [ ] Shared password validation created
- [ ] Both registration and reset use shared validation
- [ ] Validation rules consistent
