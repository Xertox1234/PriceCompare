# Storage Layer Code Review Patterns

**Date**: 2025-01-25
**Context**: Patterns discovered during server/storage.ts comprehensive review (PR #128)

## Critical Patterns to Enforce

### 1. Integer Parsing Safety (ZERO TOLERANCE)

**Rule**: NEVER use raw `parseInt()` or `Number()` for user input or database values without validation.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Can return NaN, no validation
const id = parseInt(req.params.id);
const count = parseInt(userCount[0].count as string);
const limit = Number(req.query.limit);
```

**Correct Patterns**:

**Pattern A: For route parameters (use parseIntSafe)**:
```typescript
// ✅ CORRECT - Validated, throws on invalid input
import { parseIntSafe } from '../utils/validation-helpers';
const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
```

**Pattern B: For SQL count() results (use type guards)**:
```typescript
// ✅ CORRECT - Safe type checking with default
const count = userCount[0]?.count;
const numericCount = typeof count === 'number' ? count : (count ? Number(count) : 0);
```

**Why This Matters**:
- SQL count() returns string or number depending on driver
- parseInt() returns NaN on invalid input (fails silently)
- Type guards prevent runtime errors

**Detection Rule for Code Review**:
- Flag: ANY use of `parseInt(` or `Number(` without immediately following `|| 0` or `?? 0`
- Exception: Safe if preceded by `typeof count === 'number' ? count :`
- Suggest: Use parseIntSafe or type guard pattern

---

### 2. Type Assertion Documentation (MANDATORY)

**Rule**: ALL type assertions (`as` casts) MUST have inline comments explaining WHY.

**Anti-Pattern**:
```typescript
// ❌ WRONG - No explanation for cast
embedding: (product.embedding as number[] | null) || null,
const prices = offers.filter(p => p !== null) as number[];
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Comment explains Drizzle-specific behavior
// Type assertion: Drizzle stores JSON field as unknown, cast to expected vector array format
embedding: (product.embedding as number[] | null) || null,

// ✅ CORRECT - Comment explains filter() guarantees
// Type assertion: filter() removes nulls, TypeScript needs explicit cast to number[]
const prices = offers
  .filter(p => p !== null) as number[];
```

**Comment Format**:
```typescript
// Type assertion: [reason why cast is needed]
// Cast needed: [reason why cast is safe]
// Double type assertion needed: [reason for as unknown as pattern]
```

**Why This Matters**:
- Per TYPESCRIPT_PATTERNS.md, all type assertions need justification
- Helps future developers understand when assertion can be removed
- Documents Drizzle ORM quirks and database-specific behaviors

**Detection Rule for Code Review**:
- Flag: ANY `as SomeType` without comment in previous 1 line
- Exception: Simple casts like `as const` or `as any` (but flag `as any` separately)
- Suggest: Add "Type assertion: [reason]" comment

**Common Valid Reasons**:
- "Drizzle stores JSON field as unknown, cast to expected format"
- "filter() removes nulls, TypeScript needs explicit cast"
- "SQL json_agg() returns unknown, cast through unknown to target type"
- "Database returns string|number for count, safe cast after type guard"

---

### 3. Null vs Undefined Consistency (CRITICAL FOR APIS)

**Rule**: Use `| null` for database/API "not found", not `| undefined`.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Inconsistent return types for similar operations
interface IStorage {
  getRetailerById(id: number): Promise<Retailer | undefined>;  // Old pattern
  getProductById(id: number): Promise<Product | null>;         // New pattern
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Consistent null for "not found"
interface IStorage {
  getRetailerById(id: number): Promise<Retailer | null>;
  getProductById(id: number): Promise<Product | null>;
}

// Implementation:
async getRetailerById(id: number): Promise<Retailer | null> {
  const [result] = await db.select().from(retailers).where(eq(retailers.id, id)).limit(1);
  return result || null;  // Explicit null for "not found"
}
```

**Semantic Distinction**:
- **Use `| null`**: Database operations, API responses, "not found" scenarios
  - Represents: "Queried but no data exists"
  - Examples: getById(), findByEmail(), lookupUser()

- **Use `| undefined`**: Optional parameters, configuration, "not provided" scenarios
  - Represents: "Value was not provided" or "feature disabled"
  - Examples: function params, optional config fields

**Why This Matters**:
- `null` aligns with SQL NULL semantics
- Consistency makes API predictable for consumers
- Clear distinction: null = "searched but empty", undefined = "not searched"

**Detection Rule for Code Review**:
- Flag: Mixed `| undefined` and `| null` for similar CRUD operations in same interface
- Suggest: "Use | null for database operations (represents 'not found')"
- Check: All getById, update, delete methods should return `T | null`

---

### 4. SQL Aggregate Type Handling

**Rule**: SQL aggregates (count, sum, avg) can return string or number. Always handle both.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Assumes count is always number
const userCount = await tx.select({ count: sql`count(*)` }).from(users);
isFirstUser = userCount[0].count === 0;  // Type error if count is string
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Type guard handles both string and number
const userCount = await tx.select({ count: sql`count(*)` }).from(users);
const count = userCount[0]?.count;
const numericCount = typeof count === 'number' ? count : (count ? Number(count) : 0);
isFirstUser = numericCount === 0;
```

**Why This Matters**:
- PostgreSQL drivers may return count as string (e.g., "42")
- Type coercion can fail if not handled properly
- Optional chaining (?.) prevents undefined errors

**Pattern for Different Aggregates**:
```typescript
// COUNT - always returns non-null, default to 0
const count = typeof result.count === 'number' ? result.count : Number(result.count || 0);

// SUM/AVG - can be null if no rows
const avg = result.avg ? (typeof result.avg === 'number' ? result.avg : Number(result.avg)) : null;
```

---

## Review Checklist for Storage Layer

When reviewing `server/storage.ts` or similar files:

### Security
- [ ] No passwordHash in SELECT queries (use explicit field list)
- [ ] No raw parseInt/Number without validation
- [ ] All user input validated via Zod or parseIntSafe

### Type Safety
- [ ] All `as` casts have explanatory comments
- [ ] Consistent null vs undefined usage
- [ ] SQL aggregates handled with type guards

### Database Patterns
- [ ] No N+1 queries (no queries in loops)
- [ ] Multi-step operations use transactions
- [ ] Batch operations use inArray() or JOINs
- [ ] Map() used for O(1) lookups in batch processing

### Documentation
- [ ] Complex type assertions documented
- [ ] Database-specific quirks explained (e.g., Drizzle JSON handling)
- [ ] Validation helpers referenced when used

---

## Common Drizzle ORM Patterns

### JSON Field Handling
```typescript
// Drizzle returns JSON fields as unknown
// Type assertion: Drizzle stores JSON field as unknown, cast to expected format
embedding: (product.embedding as number[] | null) || null,
```

### SQL json_agg() Results
```typescript
// json_agg returns unknown, requires double cast
// Double type assertion needed: Drizzle json_agg() returns unknown
const data = (row.data as unknown as Array<{ id: number; value: string }>) || [];
```

### Count Queries
```typescript
// Count can be string or number
const result = await db.select({ count: sql`count(*)::int` }).from(table);
const count = typeof result[0]?.count === 'number' ? result[0].count : Number(result[0]?.count || 0);
```

---

## Related Documentation

- **TYPESCRIPT_PATTERNS.md** - Type assertion rules, avoiding `any`
- **SECURITY_PATTERNS.md** - Input validation, passwordHash exposure
- **DATABASE_PATTERNS.md** - N+1 prevention, transactions, query optimization
- **storage-refactoring-patterns.md** - Large file decomposition, facade pattern, domain boundaries

---

---

### 5. Stale Object Reference After UPDATE (CRITICAL - Production Bug #1)

**Date Added**: 2025-11-28
**Context**: Bug discovered during forum storage API testing migration

**Rule**: When you UPDATE a record within a transaction and need to return the updated values, you MUST use `.returning()` and reassign the variable. Never return a stale object captured before the UPDATE.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Returns stale object with old values
async createTopicWithFirstPost(topicData: TopicInsert, postData: PostInsert): Promise<Topic> {
  return await db.transaction(async (tx) => {
    // Step 1: Create topic
    const [topic] = await tx.insert(forumTopics).values(topicData).returning();
    // topic.postCount is 0 here (default value)

    // Step 2: Create post
    await tx.insert(forumPosts).values({ topicId: topic.id, ...postData });

    // Step 3: Update the topic's postCount
    await tx.update(forumTopics)
      .set({ postCount: 1, lastPostAt: new Date() })
      .where(eq(forumTopics.id, topic.id));
    // NO .returning() - the update is applied to DB but not captured!

    // ❌ BUG: Returns original 'topic' object with postCount=0
    return topic;
  });
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Use .returning() and reassign variable
async createTopicWithFirstPost(topicData: TopicInsert, postData: PostInsert): Promise<Topic> {
  return await db.transaction(async (tx) => {
    // Step 1: Create topic
    let [topic] = await tx.insert(forumTopics).values(topicData).returning();

    // Step 2: Create post
    await tx.insert(forumPosts).values({ topicId: topic.id, ...postData });

    // Step 3: Update AND CAPTURE the updated topic
    // BUG FIX: Use .returning() to get the updated values
    const [updatedTopic] = await tx.update(forumTopics)
      .set({ postCount: 1, lastPostAt: new Date() })
      .where(eq(forumTopics.id, topic.id))
      .returning();  // <-- CRITICAL: Capture updated values

    // ✅ Return the updated topic with correct postCount=1
    return updatedTopic;
  });
}
```

**Why This Happens**:
- JavaScript objects are captured by reference at assignment time
- Drizzle's `.returning()` returns the row state at INSERT time
- Subsequent UPDATEs modify the database but not the captured object
- Without `.returning()` on UPDATE, you return stale data

**Detection Rule for Code Review**:
- Flag: Any transaction that does INSERT + UPDATE on same table but returns the INSERT result
- Flag: `await tx.update(...).set(...).where(...)` without `.returning()` when the result is needed
- Pattern to look for: Variable from INSERT returned after UPDATE on same record

**Test Verification Pattern**:
```typescript
it('should return topic with postCount=1 after creation', async () => {
  const result = await storage.createTopicWithFirstPost(topicData, postData);

  // This test catches the stale object bug
  expect(result.postCount).toBe(1);  // Would fail with 0 if bug exists
});
```

---

### 6. Derived Field Truncation for Database Constraints (CRITICAL - Production Bug #2)

**Date Added**: 2025-11-28
**Context**: Bug discovered when creating forum topic with 500-character title

**Rule**: When generating derived fields (slugs, codes, identifiers) from user input, ALWAYS truncate to fit database constraints BEFORE insertion. Never assume user input will naturally fit within field limits.

**Anti-Pattern**:
```typescript
// ❌ WRONG - No truncation, will fail for long titles
async createTopic(topicData: TopicInsert): Promise<Topic> {
  // Generate slug from title
  const slug = topicData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // ❌ BUG: 500-char title creates 500-char slug
  // Database constraint: slug VARCHAR(255)
  // This INSERT will fail with constraint violation!
  const [topic] = await db.insert(forumTopics).values({
    ...topicData,
    slug,  // Could be 500 characters!
  }).returning();

  return topic;
}
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Truncate slug to fit constraint
async createTopic(topicData: TopicInsert): Promise<Topic> {
  // Generate slug from title
  // Truncate to ensure it fits in VARCHAR(255) database constraint
  const MAX_SLUG_LENGTH = 250;  // Leave room for random suffix if needed
  const slug = topicData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, MAX_SLUG_LENGTH);  // <-- CRITICAL: Truncate

  const [topic] = await db.insert(forumTopics).values({
    ...topicData,
    slug,  // Guaranteed to fit in VARCHAR(255)
  }).returning();

  return topic;
}
```

**Common Derived Fields to Check**:
- **Slugs**: Generated from titles/names (truncate to 250-255)
- **Username/handle**: May be derived or sanitized (truncate to column limit)
- **Reference codes**: Generated from multiple fields (check combined length)
- **File paths**: Concatenated directory + filename (check OS limits too)
- **Search keys**: Generated from multiple fields (truncate to index limit)

**Detection Rule for Code Review**:
- Flag: Any `.replace()` or transformation chain without `.substring()` or `.slice()`
- Flag: String concatenation used in INSERT without length validation
- Check: What's the VARCHAR limit on the target column?

**Related Schema Pattern**:
```typescript
// In schema.ts - Document the constraint
export const forumTopics = pgTable('forum_topics', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 500 }),  // Up to 500 chars
  slug: varchar('slug', { length: 255 }),    // NOTE: Must truncate derived slug!
  // ...
});
```

---

### 7. Drizzle ORM Error Code Detection (CRITICAL - Production Bug #3)

**Date Added**: 2025-11-28
**Context**: SERIALIZABLE transaction retries failing because error codes were not detected

**Rule**: When implementing retry logic for Drizzle ORM database errors, check BOTH `error.message` patterns AND `error.cause.code` for PostgreSQL error codes. Drizzle wraps PostgreSQL errors in a cause property.

**Anti-Pattern**:
```typescript
// ❌ WRONG - Only checks error message, misses wrapped PostgreSQL error codes
export const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // This pattern misses Drizzle-wrapped errors!
  return message.includes('could not serialize') ||
         message.includes('deadlock detected');
};
```

**Correct Pattern**:
```typescript
// ✅ CORRECT - Check both message patterns AND PostgreSQL error codes
export const isTransientDatabaseError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  // Step 1: Check PostgreSQL error codes from error.cause (Drizzle wrapping)
  const cause = (error as unknown as { cause?: { code?: string } }).cause;
  if (cause?.code) {
    const pgErrorCode = cause.code;
    // PostgreSQL error codes for retryable errors:
    // 40001 = serialization_failure (SERIALIZABLE transaction conflict)
    // 40P01 = deadlock_detected
    // 08000-08999 = connection errors
    // 53000-53999 = insufficient resources
    const retryableCodes = ['40001', '40P01'];
    if (retryableCodes.includes(pgErrorCode)) {
      return true;
    }
  }

  // Step 2: Also check message patterns as fallback
  const message = error.message.toLowerCase();
  const transientPatterns = [
    'could not serialize',
    'deadlock detected',
    'connection refused',
    'connection terminated',
    // ... other patterns
  ];

  return transientPatterns.some(pattern => message.includes(pattern));
};
```

**PostgreSQL Error Code Reference**:
| Code | Name | When Retryable |
|------|------|----------------|
| 40001 | serialization_failure | SERIALIZABLE transaction conflict - RETRY |
| 40P01 | deadlock_detected | Deadlock - RETRY |
| 08000-08999 | connection errors | Connection issues - RETRY |
| 23505 | unique_violation | Data conflict - DO NOT RETRY |
| 23503 | foreign_key_violation | Data integrity - DO NOT RETRY |

**Why Drizzle Wraps Errors**:
- Drizzle ORM catches PostgreSQL errors and wraps them in JavaScript Error objects
- The original PostgreSQL error is preserved in `error.cause`
- `error.message` may be transformed/simplified by Drizzle
- `error.cause.code` contains the raw PostgreSQL SQLSTATE error code

**Detection Rule for Code Review**:
- Flag: Retry logic that only checks `error.message` without checking `error.cause`
- Flag: `isRetryable` functions without PostgreSQL error code handling
- Pattern to verify: Uses `(error as unknown as { cause?: { code?: string } }).cause?.code`

**Test Pattern for Retry Logic**:
```typescript
it('should retry on SERIALIZABLE conflict (error code 40001)', async () => {
  // Simulate Drizzle-wrapped PostgreSQL error
  const serialError = new Error('database error');
  (serialError as { cause?: { code: string } }).cause = { code: '40001' };

  expect(isTransientDatabaseError(serialError)).toBe(true);
});

it('should not retry on unique violation (error code 23505)', async () => {
  const uniqueError = new Error('unique constraint violation');
  (uniqueError as { cause?: { code: string } }).cause = { code: '23505' };

  expect(isTransientDatabaseError(uniqueError)).toBe(false);
});
```

---

## Session Context

**Issue**: PR #128 - Fix TypeScript errors in server/storage.ts
**Files Changed**: server/storage.ts (3 commits)
**Review Agent**: code-review-specialist
**Fixes Applied**:
1. Removed duplicate IStorage interface (64 lines)
2. Fixed unsafe parseInt() usage (1 instance)
3. Added type assertion comments (6 instances)
4. Standardized null vs undefined (7 method signatures + implementations)

**Key Learning**: Systematic code review caught critical issues that would have caused runtime errors and maintenance nightmares. The duplicate interface issue alone could have caused massive confusion during refactoring.

---

## Production Bugs Fixed (2025-11-28)

**Context**: Forum storage API testing migration discovered 3 critical production bugs.

### Bug #1: postCount Remaining at 0
- **File**: server/storage/domains/forum-storage.ts:209-219
- **Root Cause**: Stale object reference - variable captured pre-UPDATE state
- **Fix**: Use `.returning()` on UPDATE and reassign variable
- **Pattern**: Section 5 above

### Bug #2: Long Title/Slug Handling
- **File**: server/storage/domains/forum-storage.ts:164-171
- **Root Cause**: No truncation of generated slugs before database insertion
- **Fix**: Truncate slug to MAX_SLUG_LENGTH (250 chars)
- **Pattern**: Section 6 above

### Bug #3: SERIALIZABLE Transaction Retry
- **File**: server/utils/retry-with-backoff.ts:75-88
- **Root Cause**: Retry logic only checked error.message, not error.cause.code
- **Fix**: Added PostgreSQL error code detection for Drizzle-wrapped errors
- **Pattern**: Section 7 above
