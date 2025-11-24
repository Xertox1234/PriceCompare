# Storage Layer Migration Patterns

This document codifies patterns learned from the storage layer migration session on 2025-11-23.

## Background

During migration of services (job-lock-service, password-reset-service, affiliate-link-service) from direct database access to the storage abstraction layer, several critical issues were discovered and fixed. These patterns ensure future migrations are complete and secure.

## Critical Patterns

### 1. SQL Injection Prevention with sql.raw()

**CRITICAL VULNERABILITY**: Never use `sql.raw()` with user-controllable values, even if validated.

```typescript
// ❌ VULNERABLE - SQL Injection (even with number validation)
const additionalSeconds = 3600; // User input
await db.update(jobLocks).set({
  expiresAt: sql`${jobLocks.expiresAt} + INTERVAL '${sql.raw(additionalSeconds.toString())} seconds'`
});

// ✅ SAFE - Parameterized multiplication
await db.update(jobLocks).set({
  expiresAt: sql`${jobLocks.expiresAt} + (${additionalSeconds} * INTERVAL '1 second')`
});

// ✅ SAFE - Alternative with make_interval
await db.update(jobLocks).set({
  expiresAt: sql`${jobLocks.expiresAt} + make_interval(secs => ${additionalSeconds})`
});
```

**Key Points:**
- `sql.raw()` bypasses ALL parameterization
- Even validated numbers can be exploited when converted to strings
- For SQL intervals, always use parameterized multiplication or PostgreSQL functions

### 2. Complete Storage Layer Migration

When migrating services from direct database access to storage layer, ensure COMPLETE migration:

#### Step 1: Identify All Database Operations
```typescript
// These imports MUST ALL be removed:
import { db } from '../db';
import { eq, and, sql, gt, lt, desc } from 'drizzle-orm';
import { users, products, jobLocks } from '@shared/schema';
```

#### Step 2: Create Storage Methods FIRST
Before removing db access, ensure all needed methods exist in storage.ts:

```typescript
// Add to IStorage interface
interface IStorage {
  getUserByIdSafe(id: number): Promise<SafeUser | null>;
  countActiveTokensForUser(userId: number): Promise<number>;
  extendJobLock(jobName: string, additionalSeconds: number): Promise<void>;
}

// Implement the methods
async getUserByIdSafe(id: number): Promise<SafeUser | null> {
  // SECURITY: Never expose passwordHash - explicit field selection
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    // Explicitly exclude passwordHash
  }).from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}
```

#### Step 3: Update Service
```typescript
// ❌ BEFORE - Direct db access
import { db } from '../db';
import { eq } from 'drizzle-orm';
const user = await db.select().from(users).where(eq(users.id, userId));

// ✅ AFTER - Storage abstraction
import { storage } from '../storage';
const user = await storage.getUserByIdSafe(userId);
```

#### Step 4: Verification Checklist
- [ ] NO `import { db }` statements remain
- [ ] NO drizzle-orm operator imports (eq, and, sql, etc.)
- [ ] ALL database operations go through storage
- [ ] Service only imports TYPES from @shared/schema, not tables

### 3. Count Query Performance Pattern

**Never fetch all records just to count them.**

```typescript
// ❌ WRONG - Performance anti-pattern (fetches all records)
const tokens = await db.select().from(passwordResetTokens).where(...);
return tokens.length;

// ✅ CORRECT - Efficient COUNT query
const [result] = await db.select({
  count: sql<number>`COUNT(*)::int`
}).from(passwordResetTokens).where(...);
return result?.count ?? 0;
```

**Why this matters:**
- Fetching all records uses memory proportional to table size
- Network transfer of unnecessary data
- JavaScript counting is orders of magnitude slower than SQL COUNT
- Can cause OOM errors on large tables

### 4. Safe User Data Retrieval

**Always create dedicated methods for retrieving user data without sensitive fields.**

```typescript
// ❌ VULNERABLE - Exposes passwordHash
async getUserById(id: number) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

// ✅ SAFE - Explicit field selection
async getUserByIdSafe(id: number): Promise<SafeUser | null> {
  // SECURITY: Never expose passwordHash
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    // SECURITY: NEVER include passwordHash
  }).from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}
```

**Naming Convention:**
- Use `getUserByIdSafe()` for methods that exclude sensitive fields
- Document with `// SECURITY: Never expose passwordHash` comments
- Define `SafeUser` type that excludes sensitive fields

## Common Mistakes to Avoid

1. **Incomplete Migration**: Leaving some db operations after "completing" migration
2. **Missing Storage Methods**: Not creating storage methods before removing db access
3. **Residual Imports**: Forgetting to remove drizzle-orm operator imports
4. **Direct Schema Imports**: Importing tables instead of just types from @shared/schema
5. **Count Anti-Pattern**: Using `.length` on fetched arrays instead of SQL COUNT()
6. **sql.raw() Usage**: Using sql.raw() for any user-controllable values
7. **Password Hash Exposure**: Not using explicit field selection when querying users

## Migration Process Summary

1. **Audit First**: List ALL database operations in the service
2. **Storage Methods**: Create ALL needed storage methods FIRST
3. **Migrate**: Replace db calls with storage calls
4. **Clean Imports**: Remove ALL db and drizzle-orm imports
5. **Verify**: Run the verification checklist
6. **Review**: Have code-review-specialist check the migration

## Review Integration

These patterns have been codified into the following reviewer configurations:
- `.claude/agents/code-review-specialist.md` - Architecture compliance and migration completeness
- `.claude/agents/security-auditor.md` - SQL injection and password hash exposure
- `.claude/agents/database-engineer.md` - Query performance and migration patterns

## References

- Original migration PR: Storage layer migration for job-lock, password-reset, and affiliate-link services
- Related issues: SQL injection vulnerability in extendJobLock method
- Pattern files: `docs/DATABASE_PATTERNS.md`, `docs/SECURITY_PATTERNS.md`