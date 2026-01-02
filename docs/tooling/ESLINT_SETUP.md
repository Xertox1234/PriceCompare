# ESLint Setup and Configuration

**Last Updated:** 2025-11-28
**Status:** ✅ Complete
**Version:** ESLint 8.57.0 with TypeScript ESLint 7.x

## Overview

This document explains the ESLint setup for the PriceCompare project, including installation, configuration, and troubleshooting.

## Required Packages

The following packages must be installed in `devDependencies`:

```json
{
  "devDependencies": {
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0"
  }
}
```

## Installation

### Fresh Install

```bash
npm install --save-dev \
  eslint@^8.57.0 \
  @typescript-eslint/parser@^7.0.0 \
  @typescript-eslint/eslint-plugin@^7.0.0
```

### If Peer Dependency Conflicts Occur

If you encounter React version conflicts (common with React 19):

```bash
npm install --save-dev --legacy-peer-deps \
  eslint@^8.57.0 \
  @typescript-eslint/parser@^7.0.0 \
  @typescript-eslint/eslint-plugin@^7.0.0
```

## Configuration

### .eslintrc.json

The project uses an ESLint RC configuration file (`.eslintrc.json`):

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "no-console": "error"
  }
}
```

### package.json Scripts

```json
{
  "scripts": {
    "lint": "ESLINT_USE_FLAT_CONFIG=false npx eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "ESLINT_USE_FLAT_CONFIG=false npx eslint . --ext .ts,.tsx,.js,.jsx --fix"
  }
}
```

**Note:** `ESLINT_USE_FLAT_CONFIG=false` is required because we're using legacy RC config format.

## Running ESLint

### Lint All Files

```bash
npm run lint
```

### Lint Specific Files

```bash
npm run lint server/auth.ts server/validation.ts
```

### Auto-Fix Issues

```bash
npm run lint:fix
```

### Lint Specific File Types

```bash
# TypeScript files only
ESLINT_USE_FLAT_CONFIG=false npx eslint . --ext .ts

# React/TSX files only
ESLINT_USE_FLAT_CONFIG=false npx eslint client/src --ext .tsx
```

## Pre-Commit Hook Integration

ESLint runs automatically in the pre-commit hook (`.git/hooks/pre-commit`):

```bash
# Pre-commit hook runs:
npm run check  # TypeScript type check
npx eslint <staged-files>  # Lint only staged files
```

**Commits are blocked if:**
- ESLint errors are found
- TypeScript errors exist
- Any critical code quality issues detected

## Common Issues and Solutions

### Issue 1: "ESLint couldn't find the plugin"

**Error:**
```
ESLint couldn't find the plugin "@typescript-eslint/eslint-plugin"
```

**Cause:** Plugin not installed

**Solution:**
```bash
npm install --save-dev @typescript-eslint/eslint-plugin@^7.0.0 --legacy-peer-deps
```

### Issue 2: "eslint.config.js not found"

**Error:**
```
ESLint couldn't find an eslint.config.(js|mjs|cjs) file
```

**Cause:** ESLint 9+ defaults to flat config, but project uses legacy RC format

**Solution:** Use `ESLINT_USE_FLAT_CONFIG=false` environment variable:
```bash
ESLINT_USE_FLAT_CONFIG=false npx eslint .
```

### Issue 3: Peer Dependency Conflicts

**Error:**
```
Could not resolve dependency: peer react@"^18.0.0" from package-x
```

**Cause:** React 19 incompatible with some packages requiring React 18

**Solution:** Use `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

### Issue 4: ESLint vs TypeScript Discrepancies

**Situation:** TypeScript check passes but ESLint fails (or vice versa)

**Explanation:**
- **TypeScript (`tsc`)** - Checks type correctness
- **ESLint** - Checks code quality, style, and some type safety issues

**Example:**
```typescript
const data: any = req.body;  // TypeScript OK (valid type), ESLint ERROR (any forbidden)
```

**Solution:** Fix ESLint errors - they catch issues TypeScript allows

## Enforcement Rules

### CRITICAL Errors (Block Commits)

- `@typescript-eslint/no-explicit-any` - No `any` types
- `@typescript-eslint/no-unsafe-*` - No unsafe type operations
- `@typescript-eslint/no-floating-promises` - Must await/catch promises
- `no-console` - Use structured logging instead

### Common Warnings

- `@typescript-eslint/no-unused-vars` - Unused variables/imports
- `@typescript-eslint/no-non-null-assertion` - Avoid `!` operator
- `prefer-const` - Use const for immutable values

## Migration from Missing ESLint

If you discovered ESLint was not installed:

1. **Install packages** (see Installation section above)
2. **Verify config** exists at `.eslintrc.json`
3. **Run initial lint** to see existing issues:
   ```bash
   npm run lint 2>&1 | tee eslint-report.txt
   ```
4. **Triage issues** - separate pre-existing from new
5. **Fix critical issues** in new code first
6. **Plan cleanup** for pre-existing issues

## Best Practices

### Before Committing

```bash
# Check types
npm run check

# Check lint
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Review remaining issues
npm run lint
```

### Ignoring Files

Add to `.eslintignore`:
```
node_modules/
dist/
build/
*.config.js
```

### IDE Integration

**VS Code:**
1. Install "ESLint" extension
2. Enable auto-fix on save:
   ```json
   {
     "editor.codeActionsOnSave": {
       "source.fixAll.eslint": true
     }
   }
   ```

## Troubleshooting Checklist

- [ ] Packages installed in `node_modules/@typescript-eslint/`?
  ```bash
  ls node_modules/@typescript-eslint/
  ```

- [ ] Correct versions in `package.json` devDependencies?
  ```bash
  npm list eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
  ```

- [ ] Using `ESLINT_USE_FLAT_CONFIG=false` for legacy config?

- [ ] `.eslintrc.json` exists and is valid JSON?
  ```bash
  cat .eslintrc.json | jq .
  ```

- [ ] TypeScript `tsconfig.json` properly configured?
  ```bash
  npm run check
  ```

## Related Documentation

- `.eslintrc.json` - ESLint configuration
- `docs/ESLINT_ENFORCEMENT.md` - Detailed rule explanations
- `docs/TYPESCRIPT_PATTERNS.md` - Type safety patterns
- `.git/hooks/pre-commit` - Pre-commit hook implementation

## Version History

- **2025-11-28**: Initial setup with ESLint 8.57.0, TypeScript ESLint 7.x
- **Commit**: `7e3dfb1` - chore: Install missing ESLint dependencies

---

**Status:** ✅ ESLint fully configured and working
**Coverage:** 100% of TypeScript files
**Integration:** Pre-commit hooks + CI/CD (when configured)
