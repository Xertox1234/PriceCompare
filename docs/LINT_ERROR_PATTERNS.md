# Common Lint Error Patterns & Quick Fixes

**Version**: 1.0
**Date**: 2025-12-03
**Context**: Analysis of ~1624 lint errors fixed across multiple commits

## Overview

This document codifies the most common ESLint error patterns discovered during the TypeScript strict mode migration, providing quick-fix solutions and prevention strategies. These patterns are now integrated into the pre-commit hook for proactive detection.

## Historical Context

Between November 24-30, 2025, the PriceCompare codebase underwent comprehensive ESLint enforcement:

- **Starting point**: 1624 lint errors + warnings
- **Final state**: 0 errors, 469 warnings (non-blocking)
- **Major fix commits**:
  - `28450f3`: 287 unused variable fixes
  - `63524aa`: 52 floating promise fixes
  - `f961c6f`: 45 misused promise fixes
  - `2f2bac8`, `d51fb87`: 100+ explicit `any` type fixes

**Goal**: Prevent these patterns from being reintroduced by catching them early in the development workflow.

---

## Pattern 1: Floating Promises ⚡

**Severity**: Error
**ESLint Rule**: `@typescript-eslint/no-floating-promises`
**Frequency**: Very High (52 instances fixed in one commit)

### What It Is

A "floating promise" occurs when an async operation returns a promise that is neither awaited nor explicitly marked as fire-and-forget. This can lead to:
- Unhandled promise rejections
- Race conditions
- Silent failures in background operations

### Common Occurrences

#### 1. React Query Cache Invalidation

**Problem**: Cache invalidations are async but often don't need to be awaited.

```typescript
// ❌ WRONG - Floating promise
export function useDeleteProduct() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] }); // ❌ ESLint error
    },
  });
}

// ✅ CORRECT - Explicit fire-and-forget
onSuccess: () => {
  void queryClient.invalidateQueries({ queryKey: ['/api/products'] });
},
```

**Why void?**: Cache invalidation is a best-effort operation. If it fails, the UI will refetch on next access. We don't want to block the success callback.

#### 2. Background Service Calls

**Problem**: Service methods like email sending are often fire-and-forget in event handlers.

```typescript
// ❌ WRONG - Floating promise
app.post('/api/users', async (req, res) => {
  const user = await storage.createUser(req.body);
  emailService.sendWelcome(user.email); // ❌ ESLint error
  sendSuccess(res, user, 201);
});

// ✅ CORRECT - Explicit fire-and-forget
emailService.sendWelcome(user.email).catch(err =>
  logger.error('Welcome email failed', { error: err })
);
// OR
void emailService.sendWelcome(user.email);

// ✅ ALSO CORRECT - If you need to wait
await emailService.sendWelcome(user.email);
```

**Pattern**: For non-critical background operations (emails, notifications, analytics), use `void` or `.catch()` for fire-and-forget.

#### 3. Socket.io Room Operations

**Problem**: Socket.io methods return promises in some configurations but are typically fire-and-forget.

```typescript
// ❌ WRONG - Floating promise
io.on('connection', (socket) => {
  socket.on('join-room', (roomId: string) => {
    socket.join(roomId); // ❌ ESLint error
    socket.to(roomId).emit('user-joined', socket.id); // ❌ ESLint error
  });
});

// ✅ CORRECT - Explicit fire-and-forget
socket.on('join-room', (roomId: string) => {
  void socket.join(roomId);
  void socket.to(roomId).emit('user-joined', socket.id);
});
```

### Detection Strategy

**Pre-commit hook check**:
```bash
# Search for common floating promise patterns
git diff --cached | grep -E "^\+" | grep -E "queryClient\.invalidate|Service\.[a-z]+\(|socket\.(join|emit)" | grep -v "await\|void"
```

**Manual review**:
```bash
# Find all queryClient.invalidateQueries calls
grep -rn "queryClient.invalidate" client/src/hooks/ --include="*.ts"

# Check for service method calls
grep -rn "Service\.[a-z]+\(" server/ --include="*.ts"
```

### Quick Fixes

1. **Fire-and-forget (preferred for non-critical operations)**:
   ```typescript
   void asyncOperation();
   ```

2. **Await (if you need the result or want to catch errors)**:
   ```typescript
   await asyncOperation();
   ```

3. **Error handling for fire-and-forget**:
   ```typescript
   asyncOperation().catch(err => logger.error('Operation failed', { error: err }));
   ```

---

## Pattern 2: Misused Promises in Event Handlers ⚡

**Severity**: Error
**ESLint Rule**: `@typescript-eslint/no-misused-promises`
**Frequency**: Very High (45 instances fixed in one commit)

### What It Is

Async functions passed directly to React event handlers without proper wrapping cause ESLint errors because React event handlers expect void return types, not promises.

### Common Occurrences

#### 1. onClick with Async Function

**Problem**: Passing async function directly to onClick.

```typescript
// ❌ WRONG - Async function without wrapper
const handleDelete = async () => {
  await deleteProduct(id);
};

<Button onClick={handleDelete}>Delete</Button> // ❌ ESLint error
```

**Solutions**:

```typescript
// ✅ SOLUTION 1: Void wrapper (preferred)
<Button onClick={() => void handleDelete()}>Delete</Button>

// ✅ SOLUTION 2: Explicit async arrow function
<Button onClick={async () => {
  await handleDelete();
}}>Delete</Button>

// ✅ SOLUTION 3: Make handler synchronous with void
const handleDelete = () => {
  void deleteProductMutation.mutate(id);
};
<Button onClick={handleDelete}>Delete</Button>
```

#### 2. onSubmit with Async Function

**Problem**: Form submission handlers are often async.

```typescript
// ❌ WRONG
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  await saveData();
};

<form onSubmit={handleSubmit}> // ❌ ESLint error
```

**Solution**:

```typescript
// ✅ CORRECT
<form onSubmit={(e) => {
  e.preventDefault();
  void handleSubmit();
}}>
```

#### 3. AlertDialog Actions

**Problem**: Confirmation dialogs often have async actions.

```typescript
// ❌ WRONG
<AlertDialogAction onClick={handleDelete}> // ❌ ESLint error
  Delete
</AlertDialogAction>

// ✅ CORRECT
<AlertDialogAction onClick={() => void handleDelete()}>
  Delete
</AlertDialogAction>
```

### Detection Strategy

**Pre-commit hook check**:
```bash
# Search for async event handlers
git diff --cached | grep -E "^\+" | grep -E "onClick.*=.*async|onSubmit.*=.*async" | grep -v "void"
```

**Manual review**:
```bash
# Find onClick with function references
grep -rn "onClick={[a-zA-Z]" client/src/components/ --include="*.tsx"

# Check if those functions are async
grep -B5 "async.*function.*handle" client/src/components/
```

### Quick Fixes

**Preferred pattern** (void wrapper):
```typescript
onClick={() => void asyncHandler()}
```

**Why?**: Shortest, clearest intent (fire-and-forget), consistent with floating promise fix.

---

## Pattern 3: Explicit `any` Types 🎯

**Severity**: Error
**ESLint Rule**: `@typescript-eslint/no-explicit-any`
**Frequency**: Very High (100+ instances fixed across 3 commits)

### What It Is

Using `any` type annotation defeats TypeScript's type safety and should never be used in new code.

### Common Occurrences

#### 1. Function Parameters

**Problem**: Accepting `any` parameter types.

```typescript
// ❌ WRONG
function processProduct(data: any) {
  return {
    id: data.id, // No type checking!
    name: data.name, // Typo-prone
  };
}

// ✅ CORRECT - Import schema type
import { type Product } from '@shared/schema';

function processProduct(data: Product) {
  return {
    id: data.id, // Type-safe
    name: data.name, // Autocomplete works
  };
}
```

#### 2. API Response Handling

**Problem**: Untyped API responses.

```typescript
// ❌ WRONG
const response = await fetch('/api/products');
const data: any = await response.json();

// ✅ CORRECT - Validate with Zod
import { productsArraySchema } from '@shared/schema';

const response = await fetch('/api/products');
const data = productsArraySchema.parse(await response.json());
// data is now Product[] with full type safety
```

#### 3. Test Mocks (NO EXCEPTION!)

**Problem**: Tests historically used `any` for mock setup.

```typescript
// ❌ WRONG - Tests must be type-safe too!
const mockRequest: any = {
  params: { id: '123' },
  user: { id: 1 },
};

// ✅ CORRECT - Partial with proper types
import { type Request } from 'express';
import { type SafeUser } from '@shared/schema';

const mockRequest = {
  params: { id: '123' },
  user: { id: 1 } as SafeUser,
} as Partial<Request>;
```

**Note**: Test files get NO exception from the `any` rule. This ensures test code remains maintainable.

### When to Use `unknown` Instead

If you truly don't know the type at compile time (external API, dynamic config), use `unknown` with type guards:

```typescript
// ✅ CORRECT - Unknown with type guard
function handleError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}
```

### Detection Strategy

**Pre-commit hook check**:
```bash
# Search for explicit any types
git diff --cached | grep -E "^\+" | grep -E ":\s*any[^a-zA-Z]|\sany\s*=" | grep -v "eslint-disable"
```

**Manual review**:
```bash
# Find all any types in codebase
grep -rn ": any" --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|eslint-disable"
```

### Quick Fixes

1. **Import schema types**: `import { type Product } from '@shared/schema'`
2. **Use `unknown` + type guard**: For truly unknown types
3. **Create interface**: For complex shapes not in schema
4. **Use generics**: `<T>` for reusable functions

---

## Pattern 4: Missing await on Async Operations ⏱️

**Severity**: Error (runtime bug risk)
**ESLint Rule**: `@typescript-eslint/no-floating-promises` (indirect)
**Frequency**: High

### What It Is

Calling async functions without `await` results in getting a Promise instead of the resolved value, leading to runtime errors.

### Common Occurrences

#### 1. Database Operations

**Problem**: Drizzle ORM methods return promises.

```typescript
// ❌ WRONG - Missing await
const products = db.select().from(products);
// products is Promise<Product[]>, not Product[]!

if (products.length > 0) { // ❌ Runtime error: Promise has no .length
  console.log('Has products');
}

// ✅ CORRECT - Await the promise
const products = await db.select().from(products);
// Now products is Product[]

if (products.length > 0) { // ✅ Works correctly
  console.log('Has products');
}
```

#### 2. Storage Layer Calls

**Problem**: All storage methods are async.

```typescript
// ❌ WRONG
const product = storage.getProductById(id);
// product is Promise<Product | null>, not Product | null!

if (product) { // ❌ Always truthy (Promise object)
  return product; // Returns Promise, not data
}

// ✅ CORRECT
const product = await storage.getProductById(id);

if (product) { // ✅ Correctly checks for null
  return product; // Returns actual product data
}
```

#### 3. Fetch Calls

**Problem**: fetch() and response.json() are both async.

```typescript
// ❌ WRONG - Missing await on fetch
const response = fetch('/api/products'); // Promise<Response>
const data = response.json(); // ❌ Promise doesn't have .json()

// ✅ CORRECT
const response = await fetch('/api/products');
const data = await response.json();
```

### Detection Strategy

**Pre-commit hook check**:
```bash
# Search for async operations without await
git diff --cached | grep -E "^\+" | grep -E "= (fetch|db\.(select|insert|update|delete)|storage\.[a-z]+)\(" | grep -v "await\|void"
```

### Quick Fixes

1. **Add await keyword**: `const result = await asyncOperation();`
2. **Fire-and-forget**: `void asyncOperation();` (if you don't need the result)
3. **Check function context**: Ensure the calling function is marked `async`

---

## Pattern 5: console.log in Production Code 🔒

**Severity**: Error (security/maintainability)
**ESLint Rule**: `no-console`
**Frequency**: Medium-High

### What It Is

Debug logging using `console.log` instead of structured logger can leak sensitive data and makes logs unsearchable/unstructured.

### Common Occurrences

#### 1. Development Debug Statements

**Problem**: Debug statements left in code.

```typescript
// ❌ WRONG - console.log (info leak + unstructured)
app.post('/api/users', async (req, res) => {
  console.log('Creating user:', req.body); // ❌ Logs password!
  const user = await storage.createUser(req.body);
  console.log('User created:', user); // ❌ Logs email, data
  sendSuccess(res, user, 201);
});

// ✅ CORRECT - Structured logger
import { createLogger } from './utils/logger';
const log = createLogger('UserRoutes');

app.post('/api/users', async (req, res) => {
  const user = await storage.createUser(req.body);
  log.info('User created', { userId: user.id }); // ✅ Only logs ID
  sendSuccess(res, user, 201);
});
```

#### 2. Error Logging

**Problem**: Using console.error for error handling.

```typescript
// ❌ WRONG
try {
  await processPayment(orderId);
} catch (error) {
  console.error('Payment failed:', error); // ❌ Unstructured
  throw error;
}

// ✅ CORRECT
try {
  await processPayment(orderId);
} catch (error) {
  log.error('Payment processing failed', {
    orderId,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
  throw error;
}
```

### Exceptions

Console logging IS allowed in:
- Test files (`*.test.ts`, `*.spec.ts`, `__tests__/`)
- Build scripts (`scripts/`, `tools/`)
- Development-only code (if properly gated with `if (NODE_ENV === 'development')`)

### Detection Strategy

**Pre-commit hook check**:
```bash
# Search for console.log in production code
git diff --cached --name-only | grep -v "test\|spec\|__tests__" | xargs git diff --cached | grep -E "^\+" | grep "console\."
```

### Quick Fixes

1. **Import logger**: `import { createLogger } from './utils/logger'`
2. **Create instance**: `const log = createLogger('ModuleName')`
3. **Replace calls**:
   - `console.log(msg, data)` → `log.info(msg, { data })`
   - `console.error(msg, err)` → `log.error(msg, { error: err.message })`
   - `console.debug(msg)` → `log.debug(msg)`

---

## Pattern 6: Unused Variables After Refactoring 🧹

**Severity**: Warning (cleanup)
**ESLint Rule**: `@typescript-eslint/no-unused-vars`
**Frequency**: Very High (287 instances fixed in one commit)

### What It Is

Variables declared but never used, typically left behind after refactoring or copy-paste.

### Common Causes

#### 1. Variable Renaming

**Problem**: Old variable name left behind.

```typescript
// ❌ WRONG - Renamed but old declaration remains
const userId = req.user.id; // ❌ Unused (renamed to uid)
const uid = req.user.id;

const data = await storage.getUser(uid);

// ✅ CORRECT - Remove unused variable
const uid = req.user.id;
const data = await storage.getUser(uid);
```

#### 2. Extracted Functions

**Problem**: Variable moved to helper but declaration remains.

```typescript
// ❌ WRONG
function processOrder(order: Order) {
  const tax = calculateTax(order); // ❌ Unused (moved to helper)
  return finalizeOrder(order);
}

function finalizeOrder(order: Order) {
  const tax = calculateTax(order); // Actually used here
  return order.total + tax;
}

// ✅ CORRECT
function processOrder(order: Order) {
  return finalizeOrder(order);
}
```

#### 3. Unused Destructured Imports

**Problem**: Imported type/function no longer used.

```typescript
// ❌ WRONG - validateUser never used
import { validateUser, createUser } from './services';

export async function registerUser(data: UserInput) {
  return await createUser(data); // Only uses createUser
}

// ✅ CORRECT
import { createUser } from './services';
```

### Detection Strategy

**Pre-commit hook check**:
```bash
# Warn if many new variables declared (potential unused vars)
NEW_VARS=$(git diff --cached | grep -E "^\+" | grep -E "^(const|let|var) [a-z]+ =" | wc -l)
if [ "$NEW_VARS" -gt 10 ]; then
  echo "⚠ Many new variables declared - check for unused vars"
fi
```

### Quick Fixes

**Automatic**: Run ESLint with auto-fix:
```bash
npx eslint --fix <file>
```

ESLint will automatically remove:
- Unused variables
- Unused imports
- Unused function parameters (if configured)

**Manual**: Search and remove unused declarations.

---

## Pre-Commit Integration

The pre-commit hook (`.git/hooks/pre-commit`) now includes **proactive pattern detection** (lines 73-162) that runs BEFORE ESLint:

### Fast Checks (Before Full Lint)

```bash
# Pattern detection runs on git diff output
# Much faster than full ESLint (grep vs AST parsing)

Pattern 1: Floating promises
Pattern 2: Misused promises (event handlers)
Pattern 3: Explicit 'any' types
Pattern 4: Missing await
Pattern 5: console.log in production
Pattern 6: Unused variables (if many)
```

### Benefits

1. **Early Detection**: Catch patterns BEFORE full lint runs
2. **Quick Fixes**: Actionable suggestions with examples
3. **Fast Feedback**: Grep-based checks are ~10x faster than ESLint
4. **Commit Friction Reduction**: Fix issues incrementally, not all at once

### Example Output

```bash
🔍 Running pre-commit code review checks...

▶ Proactive lint pattern detection...

⚠ Pattern 1: Potential floating promises detected (3 instances)
  QUICK FIX: Add 'void' prefix for fire-and-forget operations
  EXAMPLE:
    ❌ queryClient.invalidateQueries({ queryKey: [...] });
    ✅ void queryClient.invalidateQueries({ queryKey: [...] });

⚠ Pattern 3: Explicit 'any' types detected (1 instance)
  QUICK FIX: Replace with proper types from @shared/schema
  EXAMPLE:
    ❌ const data: any = await fetch(...);
    ✅ const data: Product = await fetch(...);

⚠ Total: 4 potential lint issues detected
  TIP: Fix these patterns now to avoid ESLint errors

▶ ESLint type safety check...
[Full ESLint runs here if patterns detected]
```

---

## Pattern Summary Table

| Pattern | Rule | Severity | Frequency | Auto-Fix | Detection |
|---------|------|----------|-----------|----------|-----------|
| Floating Promises | `no-floating-promises` | Error | Very High | Manual | Pre-commit |
| Misused Promises | `no-misused-promises` | Error | Very High | Manual | Pre-commit |
| Explicit `any` | `no-explicit-any` | Error | Very High | Manual | Pre-commit + ESLint |
| Missing await | `no-floating-promises` | Error | High | Manual | Pre-commit |
| console.log | `no-console` | Error | Medium | Manual | Pre-commit + ESLint |
| Unused Variables | `no-unused-vars` | Warning | Very High | ✅ Auto | ESLint --fix |

---

## Prevention Strategies

### 1. IDE Integration

**VS Code**: Install ESLint extension for real-time feedback.

`.vscode/settings.json`:
```json
{
  "eslint.validate": ["typescript", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### 2. Pre-Commit Hook

**Already configured** in `.git/hooks/pre-commit` with:
- Proactive pattern detection (fast grep checks)
- Full ESLint validation (comprehensive checks)
- TypeScript type checking (mandatory)

### 3. CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`) runs:
- `npm run lint` - Zero warnings tolerance
- `npm run check` - TypeScript compilation
- Blocks PR merge if any issues found

### 4. Code Review Checklist

**code-review-specialist agent** now includes common lint patterns in review checklist (see `.claude/agents/code-review-specialist.md`).

---

## Related Documentation

### Core Pattern Files
- **TypeScript Patterns**: `docs/01_TYPESCRIPT_PATTERNS.md` - Comprehensive type safety guide
- **ESLint Enforcement**: `CLAUDE.md` - ESLint rules and enforcement layers

### Implementation Files
- **Pre-commit Hook**: `.git/hooks/pre-commit` (lines 73-162) - Proactive detection
- **ESLint Config**: `.eslintrc.json` - Strict rules configuration
- **Code Review Agent**: `.claude/agents/code-review-specialist.md` - Pattern integration

### Historical Context
- **Commit History**: `git log --grep="eslint\|floating\|any type" --since="2 weeks ago"`
- **Major Fixes**:
  - `63524aa`: Floating promises (52 fixes)
  - `f961c6f`: Misused promises (45 fixes)
  - `28450f3`: Unused variables (287 fixes)

---

## Maintenance

### Updating This Document

When new lint patterns emerge:

1. **Identify Pattern**: Analyze commit history for recurring fixes
2. **Document Pattern**: Add section with examples and quick fixes
3. **Update Pre-Commit Hook**: Add grep-based detection
4. **Update Code Review Agent**: Add to checklist
5. **Test Detection**: Verify pattern is caught early

### Pattern Lifecycle

```
1. Pattern Discovered (recurring commits)
     ↓
2. Pattern Documented (this file)
     ↓
3. Pre-Commit Detection Added (grep check)
     ↓
4. Agent Integration (review checklist)
     ↓
5. Monitor Effectiveness (track occurrences)
```

---

**Last Updated**: 2025-12-03
**Version**: 1.0
**Contributors**: Analysis of commits by @xertox1234 (william.tower@gmail.com)
