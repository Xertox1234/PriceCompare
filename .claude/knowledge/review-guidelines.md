# Code Review Guidelines

## CRITICAL RULES ⛔

### TypeScript Error Resolution Protocol (MANDATORY Pre-Review Step)

**BEFORE reviewing TypeScript errors from CI, ALWAYS verify locally:**

```bash
# Step 1: Run local type check
npm run check

# If 0 errors locally but CI shows errors:
# -> CI infrastructure issue (stale cache, deps, etc.)
# -> Push minimal fix to trigger fresh CI build
# -> DO NOT start refactoring based on CI errors alone

# If errors match locally:
# -> Real code issues, proceed with systematic triage
```

#### CI vs Local Discrepancy Pattern

**Scenario**: CI reports 72 errors, local shows 0 errors.

**Root Cause**: Stale CI cache, outdated dependencies, different Node/TypeScript versions.

**Anti-Patterns to Flag:**
- Changing `tsconfig.json` module/moduleResolution without local verification
- Attempting to fix 50+ errors without running `npm run check` locally
- Assuming all CI errors are real code issues

**Correct Pattern:**
1. Verify locally with `npm run check`
2. If 0 errors locally, CI needs fresh build (push minimal fix)
3. If errors exist locally, create error analysis document
4. Use phase-based remediation (Critical -> High -> Medium -> Low)

#### Error Triage for 20+ Errors

Create `docs/TYPESCRIPT_ERRORS_ANALYSIS.md` with:
- Total error count and categorization by error code (TS####)
- Breakdown by file (top offenders)
- Phased remediation plan with expected error reduction per phase
- Detailed fix instructions for each error type

#### Top-Level Await Fix (TS1378)

**WRONG - Changing tsconfig breaks everything:**
```json
// DON'T DO THIS - breaks all imports and path aliases!
{ "module": "NodeNext", "moduleResolution": "NodeNext" }
```

**CORRECT - Use async IIFE (minimal, non-breaking):**
```typescript
// Wrap top-level await in async IIFE
(async () => {
  const { Pool } = await import('@neondatabase/serverless');
  // ... initialization code
})();
```

---

### NO `any` Types
- **NEVER** accept `any` types in code reviews
- Use `unknown` for truly unknown types, then narrow with type guards
- Use proper generics for reusable code
- Use specific union types when multiple types are possible
- Only exception: when interfacing with untyped third-party libraries, use a thin typed wrapper

Examples:
```typescript
// ❌ BAD
function processData(data: any) { ... }
const config: any = loadConfig();

// ✅ GOOD
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null) { ... }
}
type Config = { apiKey: string; timeout: number };
const config: Config = loadConfig();
```

### NO N+1 Queries
- **ALWAYS** flag N+1 query patterns
- Use batch loading, joins, or prefetching instead
- Look for loops that make database/API calls inside them
- Encourage use of DataLoader pattern for GraphQL
- Watch for ORM lazy loading triggering multiple queries

Examples:
```typescript
// ❌ BAD - N+1 Query
const users = await db.users.findAll();
for (const user of users) {
  user.posts = await db.posts.findByUserId(user.id); // N queries!
}

// ✅ GOOD - Single query with join
const users = await db.users.findAll({
  include: [{ model: db.posts }]
});

// ✅ GOOD - Batch loading
const users = await db.users.findAll();
const userIds = users.map(u => u.id);
const posts = await db.posts.findByUserIds(userIds);
const postsByUserId = groupBy(posts, 'userId');
users.forEach(user => {
  user.posts = postsByUserId[user.id] || [];
});
```

## TypeScript Patterns to Encourage

### Strong Typing
- Discriminated unions for state machines
- Builder patterns with fluent interfaces for complex configurations
- Proper use of `unknown` over `any`
- Zod, io-ts, or similar for runtime validation
- Branded types for IDs and other primitives that shouldn't be mixed

### Type Guards
```typescript
// Encourage proper type narrowing
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'email' in obj;
}
```

### Generics with Constraints
```typescript
// Encourage constrained generics over loose ones
function processRecord(record: T): void {
  // Now we know T has an id
}
```

## Database & Performance Anti-patterns to Flag

### N+1 Queries
- Loops containing database queries or API calls
- ORM lazy loading without proper eager loading configuration
- GraphQL resolvers without DataLoader
- Sequential API calls that could be batched

### Missing Indexes
- Database queries on unindexed columns (if schema is visible)
- Full table scans in production code

### Inefficient Data Fetching
- Fetching entire collections when only count is needed
- SELECT * when only specific fields are needed
- Missing pagination on large datasets

## AI/Agent Anti-patterns to Flag

### Type Safety in AI Context
- `any` types for LLM responses (use Zod schemas instead)
- Unvalidated JSON parsing from LLM outputs
- Missing type guards for tool/function results

### Performance Issues
- Hardcoded prompts without variables
- Missing exponential backoff on retries
- No token counting before API calls
- Synchronous blocking on streaming responses
- Not handling partial/interrupted responses
- Missing conversation history management
- N+1 API calls to LLM (batch prompts when possible)

### Prompt Engineering
- Prompts without few-shot examples where appropriate
- Missing system message context
- No structured output formatting instructions
- Prompts that don't specify output format (JSON, XML, etc.)

## Security Patterns

### Required Checks
- API keys never hardcoded (use environment variables)
- Input validation before LLM calls (prevent prompt injection)
- Output sanitization after LLM responses
- Rate limiting on API endpoints
- Proper error messages (don't leak sensitive info)
- **Integer parsing safety (ZERO TOLERANCE)**: NEVER use raw `parseInt()` or `Number()` without validation
  - Use `parseIntSafe()` for required integers with validation
  - Use `parseIntOptional()` for optional integers with defaults
  - Import from `../utils/validation-helpers` in route files
  - Flag patterns: `parseInt()`, `Number()`, `+value`, `parseInt() || default`
- **Error response standardization (DRY PRINCIPLE)**: ALL catch blocks must use `createErrorResponse()`
  - Never expose raw error.message to users
  - Never manually construct error responses
  - Import from `../utils/error-sanitizer` in route files
  - Pattern: 2 lines only - `const errorResponse = createErrorResponse(error, 'OpName'); res.status(errorResponse.status).json(errorResponse);`
  - Flag ANY manual error handling (5+ line catch blocks are a red flag)
- **Route file imports (server/routes/)**: Must use '../' prefix for server utilities
  - Common mistake: Files moved from server/ to server/routes/ need './' → '../' change
  - Examples: `../utils/logger`, `../services/community-service`, `../storage`

## Code Quality Standards

### DRY Principle (Don't Repeat Yourself)
- **Flag repetitive patterns** that could use centralized utilities
- **Error handling**: 20 identical catch blocks = use createErrorResponse utility
- **Validation**: Repeated parsing logic = use validation helpers
- **Common operations**: If you see it 3+ times, it needs abstraction
- **Conditional checks**: Extract to helper functions (shouldSkipCache pattern)
- **Benefits of DRY**: Easier maintenance, consistent behavior, fewer bugs

### Caching Implementation Patterns (2025-12-02)

**When reviewing cache implementations:**
- **Statistics tracking**: Must happen AFTER operations complete, not during
- **Helper centralization**: Extract repeated bypass conditions to `shouldSkipCache()`
- **Cache warming**: Must be non-blocking at startup (fire-and-forget with `void`)
- **Background intervals**: Must be registered with `cleanupManager` for graceful shutdown
- **Cache key versioning**: Include version in keys for zero-downtime schema migration
- **Structured metrics**: Use JSON format for log aggregation compatibility

### Large File Refactoring (God Object Decomposition)
When reviewing refactoring PRs for large files (1000+ lines):

**Required Documentation:**
- [ ] Types file has IMPORTANT NOTES section explaining design decisions
- [ ] Base class includes numbered implementation guidance (7+ points)
- [ ] Facade includes domain roadmap with method counts per domain
- [ ] Phase markers present in all new files (`Phase N: Description`)

**Backward Compatibility:**
- [ ] Existing imports continue to work (facade re-exports)
- [ ] No breaking changes to IStorage interface
- [ ] TypeScript compilation passes without changes to consumers

**Security Markers:**
- [ ] Pre-commit-hook compatible markers: `SECURITY: NEVER expose`
- [ ] SafeUser type explicitly documents passwordHash exclusion
- [ ] Security-sensitive operations documented inline

**Domain Organization:**
- [ ] Types grouped by domain with `// ====` separators
- [ ] Domain boundaries clear (methods grouped by primary table)
- [ ] Roadmap shows all planned domains with responsibilities

**Reference:** See `.claude/knowledge/storage-refactoring-patterns.md` for complete patterns

### Naming
- Clear, self-documenting variable and function names
- Avoid abbreviations unless universally known
- Use verbs for functions (fetchUser, calculateTotal)
- Use nouns for variables (user, totalAmount)

### Error Handling
- Never silently catch errors
- Provide context in error messages
- Use custom error types for different failure modes
- Handle all promise rejections

### Testing
- Flag missing error case tests
- Encourage testing of type guards
- Test edge cases (null, undefined, empty arrays)
- Integration tests for database queries

### E2E Test Review Guidelines (NEW - 2025-12-12)

**Context-Aware Evaluation**: E2E tests have different acceptability criteria than production code.

#### Patterns That Are ACCEPTABLE in E2E Tests

**1. Unused Functions Reserved for Future Phases**
```typescript
// ACCEPTABLE - Documented for future use
/**
 * TODO: Reserved for Phase 2.2 WebSocket testing
 * Future usage: await _waitForNotificationInList(page, 'Price Drop');
 */
async function _waitForNotificationInList(_page: Page, _title: string): Promise<void> {
  return Promise.resolve();
}
```
Requirement: Must have TODO comment with phase reference and usage example.

**2. Hardcoded Timeouts for UI Animations**
```typescript
// ACCEPTABLE - Documented animation timing
/**
 * NOTE: 500ms timeout for CSS transition animation (~300ms + buffer)
 * Alternative: await page.getByRole('menu').waitFor({ state: 'visible' });
 */
await page.waitForTimeout(500);
```
Requirement: Must document why timeout is needed and suggest alternatives.

**3. Defensive Programming Patterns (Graceful Degradation)**
```typescript
// ACCEPTABLE - Good design pattern
const saveButton = page.getByRole('button', { name: /save/i });
if ((await saveButton.count()) > 0) {
  await saveButton.first().click();
} else {
  test.skip();  // UI not implemented yet
}
```
DO NOT flag as incomplete - this is intentional design for incremental development.

**4. "May Need Adjustment" Comments**
```typescript
// ACCEPTABLE - Shows awareness of evolving UI
// Verify newest is first (may need adjustment based on actual UI)
expect(count).toBeGreaterThanOrEqual(3);
```
These comments signal flexibility, NOT incomplete code.

**5. Multiple Selector Fallbacks**
```typescript
// ACCEPTABLE - Handles different UI implementations
const prefsLink = page.getByRole('link', { name: /preference/i });
const prefsButton = page.getByRole('button', { name: /preference/i });
if ((await prefsLink.count()) > 0) {
  await prefsLink.first().click();
} else if ((await prefsButton.count()) > 0) {
  await prefsButton.first().click();
}
```

#### E2E Review Checklist

- [ ] Unused functions have TODO comments with phase/feature reference
- [ ] Hardcoded timeouts have documented justification (animation timing, etc.)
- [ ] Defensive test.skip() patterns are conditional on element existence
- [ ] "May need adjustment" comments seen as intentional flexibility
- [ ] File header documents defensive programming patterns (if used extensively)

#### What to Flag in E2E Tests

- Undocumented unused functions (no TODO explaining future use)
- Undocumented hardcoded timeouts (no explanation of timing requirement)
- Arbitrary test.skip() without conditional check
- `page: any` type issues (should use `Page` from Playwright)

#### Additional Patterns from Phase 2.2 (NEW - 2025-12-12)

**6. Helper Organization (Suggest Improvement)**
```typescript
// SUGGEST MOVE - Large helper (>30 LOC) or likely reusable
// Move to e2e/helpers/search-helpers.ts for reuse
async function seedProductsWithCategories(): Promise<void> {
  const categories = ['Electronics', 'Computers', 'Smartphones'];
  // ... 40+ lines of setup logic
}
```
Decision: Local is acceptable for <30 LOC single-use helpers; suggest shared for larger/reusable helpers.

**7. Flexible Selector Patterns (Exemplary - Praise)**
```typescript
// EXEMPLARY - Multiple selector fallbacks for UI variation
const selectFilter = page.getByLabel(/category/i);
if ((await selectFilter.count()) > 0) {
  await selectFilter.selectOption(category);
  return;
}
// Fallback patterns for button/checkbox...
```
This is EXCELLENT defensive design - praise it, don't flag it.

**8. Test Data Design Documentation (Suggest Improvement)**
```typescript
// SUGGEST - Add JSDoc documenting distribution
/**
 * Distribution:
 * - Categories: Electronics (3), Computers (3), Smartphones (4)
 * - Price ranges: $20-$1000 across 5 tiers
 * - Total: 10 products
 */
async function seedProductsForSearchTesting(): Promise<void>
```
Well-structured seed data maximizes test coverage.

#### E2E Review Checklist (Updated)

- [ ] Unused functions have TODO comments with phase/feature reference
- [ ] Hardcoded timeouts have documented justification (animation timing, etc.)
- [ ] Defensive test.skip() patterns are conditional on element existence
- [ ] "May need adjustment" comments seen as intentional flexibility
- [ ] File header documents defensive programming patterns (if used extensively)
- [ ] Large helpers (>30 LOC) considered for shared modules (NEW)
- [ ] Flexible selector patterns praised as exemplary (NEW)
- [ ] Seed functions have JSDoc documenting data distribution (NEW)

**Reference Files**:
- `e2e/notifications.spec.ts` - Example of well-documented E2E test file (Phase 2.1)
- `e2e/advanced-search.spec.ts` - Example of defensive programming excellence (Phase 2.2)
- `e2e/helpers/search-helpers.ts` - Example of flexible selector patterns