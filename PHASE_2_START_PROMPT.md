# Storage Layer Refactoring - Phase 2 Start Prompt

Use this prompt to begin Phase 2 (User Domain Extraction) in a new Claude Code session.

---

## 🎯 Prompt for New Session

```
I want to start Phase 2 of the storage layer refactoring outlined in GitHub issue #121.

Context:
- Phase 1 (COMPLETED & MERGED in PR #137) established the foundation:
  - Created server/storage/ directory with types.ts, base-storage.ts, index.ts
  - Extracted 69 type definitions from monolithic storage.ts
  - Established facade pattern for backward compatibility
  - Codified patterns in .claude/knowledge/storage-refactoring-patterns.md

Phase 2 Goal:
Extract the User domain into server/storage/domains/user-storage.ts following the established patterns.

Key Requirements:
1. Follow patterns from .claude/knowledge/storage-refactoring-patterns.md
2. Extend BaseStorage abstract class
3. Implement ~15 user-related methods:
   - getUserCount()
   - getUserByIdSafe()
   - registerUser()
   - resetPassword()
   - createUserWithTransaction()
   - updateUserProfile()
   - updateUserTrustLevel()
   - suspendUser()
   - getAllUsers()
   - getAdminAnalyticsOverview()
   - getUserGrowthData()
   - getForumActivityData()
   - getTopCategories()
4. Update server/storage/index.ts facade to:
   - Import UserStorage
   - Create userStorage instance
   - Delegate user methods to userStorage
5. Maintain ZERO breaking changes (all existing imports work)
6. Follow 7-point implementation guidance from base-storage.ts:
   - Input validation (parseIntSafe)
   - N+1 prevention (JOINs, explicit fields)
   - Security (NEVER expose passwordHash - use SafeUser type)
   - Error handling (use handleError() from BaseStorage)
   - Transactions (wrap multi-step operations)
   - Retry logic (handle transient errors with retryWithBackoff)
   - Logging (use logSuccess() for consistency)

Reference Files:
- GitHub Issue: #121 (Storage Layer God Object Refactoring)
- Patterns: .claude/knowledge/storage-refactoring-patterns.md
- Phase 1 PR: #137 (merged)
- Current storage: server/storage.ts (find user methods to extract)
- Base class: server/storage/base-storage.ts
- Types: server/storage/types.ts (SafeUser, AdminUser, etc.)

Steps:
1. Read storage-refactoring-patterns.md to understand Phase 2 pattern
2. Analyze server/storage.ts to identify all user-related methods
3. Create server/storage/domains/user-storage.ts with UserStorage class
4. Extract and migrate user methods following security patterns
5. Update server/storage/index.ts facade to integrate UserStorage
6. Verify TypeScript compilation: npx tsc --noEmit
7. Verify backward compatibility (no changes to route/service imports)
8. Create commit following Phase 1 commit message style
9. Invoke code-review-specialist agent for review

Let's start with Phase 2 - extract the User domain following the established foundation.
```

---

## 📋 Quick Reference

### User Domain Methods to Extract (~15 methods)

Based on IStorage interface analysis:

**Basic User Operations:**
- `getUserCount()` - Get total user count
- `getUserByIdSafe(id)` - Get user without passwordHash

**User Registration/Auth:**
- `registerUser(userData)` - Register with transaction
- `resetPassword(userId, newPasswordHash, token)` - Password reset with transaction
- `createUserWithTransaction(username, email, passwordHash)` - First-admin logic

**User Profile Management:**
- `updateUserProfile(userId, data)` - Update bio, location, website, avatar
- `updateUserTrustLevel(userId, trustLevel)` - Update trust level
- `suspendUser(userId, reason, moderatorId)` - Suspend with notification

**Admin User Operations:**
- `getAllUsers()` - Get all users (admin view)
- `getAdminAnalyticsOverview()` - User/forum counts
- `getUserGrowthData()` - User registration trends
- `getForumActivityData()` - Forum activity trends
- `getTopCategories(limit)` - Top forum categories

### Key Security Pattern

**CRITICAL**: User methods must NEVER expose passwordHash

```typescript
// ✅ CORRECT - SafeUser type
export interface SafeUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  trustLevel: number | null;
  isActive: boolean | null;
  isSuspended: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  // SECURITY: NEVER expose passwordHash
}

// ❌ WRONG - Never expose full user object
const user = await db.select().from(users).where(eq(users.id, id));

// ✅ CORRECT - Explicit field selection
const user = await db.select({
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  // ... other fields
  // SECURITY: NEVER expose passwordHash
}).from(users).where(eq(users.id, id));
```

### Transaction Pattern for User Operations

```typescript
// Example: registerUser with transaction
async registerUser(userData: {
  username: string;
  email: string;
  passwordHash: string; // SECURITY: NEVER expose
}): Promise<SafeUser> {
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values(userData).returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        // ... SafeUser fields only
        // SECURITY: NEVER expose passwordHash
      });
      return user;
    });
  } catch (error) {
    this.handleError(error, 'registerUser');
  }
}
```

### Facade Integration Pattern

```typescript
// server/storage/index.ts
import { UserStorage } from "./domains/user-storage";

export class DatabaseStorage implements IStorage {
  private userStorage: UserStorage;

  constructor(database: Database) {
    this.userStorage = new UserStorage(database);
  }

  // Delegate user methods
  async getUserByIdSafe(id: number) {
    return this.userStorage.getUserByIdSafe(id);
  }

  async registerUser(userData: { username: string; email: string; passwordHash: string }) {
    return this.userStorage.registerUser(userData);
  }

  // ... delegate all other user methods
}
```

---

## ✅ Success Criteria for Phase 2

- [ ] `server/storage/domains/user-storage.ts` created with UserStorage class
- [ ] All ~15 user methods migrated from storage.ts
- [ ] SafeUser type used (NEVER expose passwordHash)
- [ ] Transactions used for multi-step operations
- [ ] BaseStorage error handling and logging used
- [ ] Facade updated to delegate to UserStorage
- [ ] TypeScript compilation passes with zero errors
- [ ] Zero breaking changes (all routes/services still work)
- [ ] Code review specialist finds no blockers
- [ ] Commit follows Phase 1 style with detailed message

---

## 📚 Essential Reading Order

1. `.claude/knowledge/storage-refactoring-patterns.md` - Phase 2 patterns
2. `server/storage/base-storage.ts` - 7-point implementation guidance
3. `server/storage/types.ts` - SafeUser and AdminUser types
4. `server/storage.ts` (lines 1568-2500) - Current DatabaseStorage user methods
5. GitHub Issue #121 - Overall refactoring context

---

## 🚀 Ready to Start!

Copy the prompt above into a new Claude Code session to begin Phase 2. The foundation from Phase 1 makes this extraction straightforward and low-risk.

**Estimated Duration**: 2-3 hours following established patterns
