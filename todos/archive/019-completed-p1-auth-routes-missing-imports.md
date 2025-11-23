---
status: completed
priority: p1
issue_id: "019"
tags: [typescript, runtime-error, auth, imports, code-review]
dependencies: []
completed_date: 2025-11-23
---

# Fix Missing Imports in auth-routes.ts Password Reset

## Problem Statement

**CRITICAL RUNTIME ERROR**: The password reset transaction in `auth-routes.ts` uses `db`, `schema`, and `eq` without importing them. This will cause a runtime error when password reset is attempted.

**Impact:** Users cannot reset their passwords - feature completely broken.

## Findings

Discovered during comprehensive code audit by kieran-typescript-reviewer agent on 2025-11-23.

**Location:** `server/routes/auth-routes.ts` lines 366-384

**Evidence:**
```typescript
// Missing imports at top of file:
// import { db } from '../db';
// import { eq } from 'drizzle-orm';
// import * as schema from '@shared/schema';

// Line 366-384 uses these without imports:
await db.transaction(async (tx) => {
  await tx.update(schema.users)
    .set({ passwordHash: hashedPassword })
    .where(eq(schema.users.id, user.id));
});
```

## Proposed Solutions

### Option 1: Add Missing Imports (Recommended)

**Effort:** Small (15 minutes)

**Implementation:**
```typescript
// Add at top of file with other imports:
import { db } from '../db';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
```

## Recommended Action

Add the missing imports to fix the runtime error.

## Technical Details

- **Affected Files**: `server/routes/auth-routes.ts`
- **Related Components**: Password reset flow
- **Database Changes**: None

## Acceptance Criteria

- [ ] Missing imports added
- [ ] Password reset functionality works
- [ ] TypeScript compilation passes
- [ ] No runtime errors

## Work Log

### 2025-11-23 - TypeScript Audit Discovery
**By:** Claude Code Review System (kieran-typescript-reviewer agent)
**Actions:**
- Identified missing imports causing runtime error
- Categorized as P1 CRITICAL bug

## Notes

Source: Comprehensive code audit performed on 2025-11-23
