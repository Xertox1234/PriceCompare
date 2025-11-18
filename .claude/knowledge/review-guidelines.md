# Code Review Guidelines

## CRITICAL RULES ⛔

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

## Code Quality Standards

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