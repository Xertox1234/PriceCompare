# ESLint Enforcement Guide

## Overview

ESLint is **strictly enforced** across the PriceCompare codebase to maintain code quality, type safety, and security standards.

## Enforcement Layers

### 1. Pre-Commit Hook (Local)
**Location:** `.git/hooks/pre-commit`

Automatically runs ESLint on all staged TypeScript/JavaScript files before allowing commits.

**What it checks:**
- ❌ BLOCKS commits with `any` types
- ❌ BLOCKS commits with unsafe type operations
- ❌ BLOCKS commits with `console.log` in production code
- ❌ BLOCKS commits with floating promises
- ❌ BLOCKS commits with misused promises

**How to run manually:**
```bash
# Check staged files (what pre-commit runs)
echo "$(git diff --cached --name-only --diff-filter=ACM)" | grep -E '\.(ts|tsx|js|jsx)$' | xargs npx eslint --quiet

# Check all files
ESLINT_USE_FLAT_CONFIG=false npx eslint . --ext .ts,.tsx,.js,.jsx
```

### 2. GitHub Actions (CI/CD)
**Location:** `.github/workflows/pr-validation.yml`

Runs on every pull request before merge is allowed.

**Job:** `quality` → `ESLint` step
- Runs `npm run lint -- --max-warnings 0`
- **Zero warnings** tolerance - all warnings must be fixed
- Blocks PR merge if lint fails

### 3. IDE Integration (Recommended)
Configure your editor to show ESLint errors in real-time:

**VS Code:**
```json
{
  "eslint.enable": true,
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## ESLint Configuration

### Main Config
**Location:** `.eslintrc.json`

**Strict Rules Enforced:**

#### Type Safety (CRITICAL - ERRORS)
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unsafe-assignment`: error
- `@typescript-eslint/no-unsafe-member-access`: error
- `@typescript-eslint/no-unsafe-call`: error
- `@typescript-eslint/no-unsafe-return`: error
- `@typescript-eslint/no-unsafe-argument`: error

#### Async/Promise Safety (CRITICAL - ERRORS)
- `@typescript-eslint/no-floating-promises`: error
  - **What:** Promises without await/then/catch
  - **Fix:** Add `await` or `.catch()` handler

- `@typescript-eslint/no-misused-promises`: error
  - **What:** Promises in conditions or as non-promise return values
  - **Fix:** Await promises before using in conditions

- `@typescript-eslint/await-thenable`: error
  - **What:** Using await on non-promise values
  - **Fix:** Remove unnecessary await

#### Code Quality (ERRORS)
- `@typescript-eslint/no-unused-vars`: error
  - Allows `_` prefix for intentionally unused vars
  - Example: `const { id, _metadata } = data` (if _metadata unused)

- `no-var`: error (use const/let)
- `prefer-const`: error
- `no-throw-literal`: error
- `eqeqeq`: error (always use === except for null checks)

#### Security (ERRORS)
- `no-console`: error (except in utils/logger.ts)
- `no-debugger`: error
- `no-eval`: error
- `no-implied-eval`: error
- `no-new-func`: error

### Ignored Files
**Location:** `.eslintignore`

```
# Dependencies
node_modules/

# Build outputs
dist/
coverage/

# Generated files
*.generated.ts
migrations/*.sql

# Test artifacts
playwright-report/
test-results/
```

## Common ESLint Errors & Fixes

### Error: `@typescript-eslint/no-explicit-any`
```typescript
// ❌ BAD
function process(data: any) {
  return data.value;
}

// ✅ GOOD
import { type Product } from '@shared/schema';

function process(data: Product) {
  return data.value;
}

// ✅ ALSO GOOD (for truly unknown types)
function handleError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
```

### Error: `@typescript-eslint/no-floating-promises`
```typescript
// ❌ BAD - Promise not awaited
async function handler(req, res) {
  emailService.sendWelcome(user.email); // Floating promise!
  res.json({ success: true });
}

// ✅ GOOD - Option 1: Await the promise
async function handler(req, res) {
  await emailService.sendWelcome(user.email);
  res.json({ success: true });
}

// ✅ GOOD - Option 2: Explicit error handling
async function handler(req, res) {
  emailService.sendWelcome(user.email).catch(err => {
    log.error('Failed to send email', err);
  });
  res.json({ success: true });
}

// ✅ GOOD - Option 3: Fire-and-forget with comment
async function handler(req, res) {
  // Intentionally not awaiting - email sending is async and shouldn't block response
  void emailService.sendWelcome(user.email);
  res.json({ success: true });
}
```

### Error: `no-console`
```typescript
// ❌ BAD
console.log('User created:', user);

// ✅ GOOD
import { createLogger } from './utils/logger';
const log = createLogger('UserService');

log.info('User created', { userId: user.id });
```

### Error: `@typescript-eslint/no-unsafe-assignment`
```typescript
// ❌ BAD
const data: any = await fetch('/api/users');
const userName = data.name; // Unsafe!

// ✅ GOOD
import { type User } from '@shared/schema';
import { z } from 'zod';

const userSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email()
});

const response = await fetch('/api/users');
const json: unknown = await response.json();
const data = userSchema.parse(json); // Validated!
const userName = data.name; // Type-safe!
```

## Running ESLint

### Check all files
```bash
npm run lint
```

### Auto-fix fixable issues
```bash
npm run lint:fix
```

### Check specific file
```bash
ESLINT_USE_FLAT_CONFIG=false npx eslint path/to/file.ts
```

### Check only changed files (like pre-commit)
```bash
git diff --name-only | grep -E '\.(ts|tsx|js|jsx)$' | xargs npx eslint
```

## Bypassing ESLint (Not Recommended)

### Bypass pre-commit hook
```bash
git commit --no-verify
```

**⚠️ WARNING:** Only use in emergencies. Your commit will still fail in CI.

### Disable specific rule for one line
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data: any = legacyLibrary.getData();
```

**⚠️ WARNING:** Requires strong justification. Add comment explaining why.

## Troubleshooting

### ESLint not running in pre-commit
```bash
# Verify hook is executable
chmod +x .git/hooks/pre-commit

# Test hook manually
.git/hooks/pre-commit
```

### ESLint version mismatch
The project uses ESLint v9 but with legacy `.eslintrc.json` config via `ESLINT_USE_FLAT_CONFIG=false`.

### Missing TypeScript errors in ESLint
ESLint requires full TypeScript compilation. Run:
```bash
npm run check  # TypeScript compiler
npm run lint   # ESLint with type-aware rules
```

## Performance Impact

**Pre-commit hook:** ~2-5 seconds for typical commit
**GitHub Actions:** ~10-20 seconds for full codebase lint

**Tip:** ESLint runs incrementally in pre-commit (only staged files), so performance impact is minimal.

## Benefits

✅ **Catch bugs early** - Type errors found before runtime
✅ **Consistent code style** - Automated formatting rules
✅ **Security** - Block console.log, eval, unsafe operations
✅ **Better DX** - IDE integration shows errors as you type
✅ **Faster reviews** - Automated checks reduce manual review burden

## Related Documentation

- [TypeScript Patterns](./TYPESCRIPT_PATTERNS.md) - Type safety best practices
- [Security Patterns](./SECURITY_PATTERNS.md) - Security-specific rules
- [Pre-Commit Hook](../.git/hooks/pre-commit) - Full hook source code
- [CI/CD Workflows](../.github/WORKFLOWS.md) - GitHub Actions setup
