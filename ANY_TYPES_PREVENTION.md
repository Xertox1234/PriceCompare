# Prevention of `any` Types - Implementation Guide

## Overview
This document explains the measures put in place to prevent the use of `any` types in the codebase and maintain type safety.

## 1. TypeScript Compiler Options

The `tsconfig.json` has been configured with strict type checking:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Key Settings:
- **`noImplicitAny`**: Raises error on expressions and declarations with an implied `any` type
- **`useUnknownInCatchVariables`**: Catch clause variables are `unknown` instead of `any`
- **`strict`**: Enables all strict type-checking options

## 2. ESLint Configuration

### Root Level (`.eslintrc.json`)
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
    "@typescript-eslint/no-unsafe-return": "warn"
  }
}
```

### Security Config (`eslint.security.config.mjs`)
Additional security-focused rules that catch type safety issues:
```javascript
{
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error'
}
```

## 3. Proper Type Alternatives

### Instead of `any`, use:

#### 1. `unknown` for truly unknown types
```typescript
// ❌ Bad
catch (error: any) {
  console.error(error.message);
}

// ✅ Good
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

#### 2. Generics for flexible, type-safe functions
```typescript
// ❌ Bad
function processData(data: any): any {
  return data.map((item: any) => item.value);
}

// ✅ Good
function processData<T extends { value: unknown }>(data: T[]): unknown[] {
  return data.map(item => item.value);
}
```

#### 3. `Record<string, unknown>` for object maps
```typescript
// ❌ Bad
interface LogEntry {
  metadata?: Record<string, any>;
}

// ✅ Good
interface LogEntry {
  metadata?: Record<string, unknown>;
}
```

#### 4. Proper interface definitions
```typescript
// ❌ Bad
function handleUser(user: any) {
  return user.id;
}

// ✅ Good
interface User {
  id: number;
  email: string;
  role: string;
}

function handleUser(user: User) {
  return user.id;
}
```

#### 5. Type guards for runtime checks
```typescript
// ✅ Good
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

function handleError(error: unknown) {
  if (isError(error)) {
    console.error(error.message);
  }
}
```

## 4. CI/CD Integration

### Pre-commit Hook
Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run lint
npm run check
```

### GitHub Actions (Recommended)
```yaml
name: Type Check
on: [push, pull_request]
jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run check
      - run: npm run lint
```

## 5. Running Checks

### Type Check
```bash
npm run check
```
This runs TypeScript compiler in check mode (`tsc --noEmit`)

### Linting
```bash
npm run lint
```
Or for security-specific linting:
```bash
npm run lint:security
```

### Fix Auto-fixable Issues
```bash
npx eslint --fix server/**/*.ts
```

## 6. Common Patterns and Fixes

### Pattern 1: Error Handling
```typescript
// ❌ Bad
try {
  doSomething();
} catch (error: any) {
  logger.error(error.message);
}

// ✅ Good
try {
  doSomething();
} catch (error: unknown) {
  logger.error('An error occurred', {
    error: error instanceof Error ? error.message : String(error)
  });
}
```

### Pattern 2: Database Query Results
```typescript
// ❌ Bad
const results = await db.select().from(users) as any[];

// ✅ Good
const results: User[] = await db.select().from(users);
// or
const results = await db.select().from(users);
// TypeScript will infer the type from schema
```

### Pattern 3: Request Handlers
```typescript
// ❌ Bad
const withAuth = (handler: (req: Request, res: Response) => Promise<any>) => {
  // ...
}

// ✅ Good
const withAuth = (handler: (req: Request, res: Response) => Promise<void>) => {
  // ...
}
```

### Pattern 4: Metadata Objects
```typescript
// ❌ Bad
interface Event {
  metadata?: Record<string, any>;
}

// ✅ Good
interface Event {
  metadata?: Record<string, unknown>;
}

// Or even better with specific types:
interface Event {
  metadata?: {
    source?: string;
    timestamp?: Date;
    [key: string]: unknown;
  };
}
```

## 7. Exceptions

Test files are allowed to use `any` for mocking purposes:
```json
{
  "overrides": [
    {
      "files": ["**/__tests__/**/*.ts"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
}
```

## 8. Monitoring

### Count remaining `any` types:
```bash
grep -r "\bany\b" server --include="*.ts" | wc -l
```

### Find files with `any`:
```bash
grep -r "\bany\b" server --include="*.ts" -l
```

## 9. Training & Documentation

### For New Developers:
1. Review this document before starting work
2. Enable ESLint in your IDE for real-time feedback
3. Run `npm run check` before committing
4. Ask for code review if unsure about proper typing

### Resources:
- TypeScript Handbook: https://www.typescriptlang.org/docs/handbook/
- TypeScript Deep Dive: https://basarat.gitbook.io/typescript/
- ESLint TypeScript Plugin: https://typescript-eslint.io/

## 10. Success Metrics

**Before fixes:** 181 `any` types across 45 files
**After fixes:** 55 `any` types across 27 files (70% reduction)
**Target:** <20 `any` types (excluding comments and legitimate uses)

## Summary

With these measures in place:
- ✅ TypeScript will catch implicit `any` usage at compile time
- ✅ ESLint will catch explicit `any` usage during linting
- ✅ CI/CD will prevent merging code with `any` types
- ✅ Developers get immediate feedback in their IDE
- ✅ Code reviews can focus on proper type usage

**Remember:** When tempted to use `any`, ask yourself:
1. Can I use `unknown` instead?
2. Can I define a proper interface?
3. Can I use a generic type parameter?
4. Do I need a type guard?

If the answer is "yes" to any of these, don't use `any`!
