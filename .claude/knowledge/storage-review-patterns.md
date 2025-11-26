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
