# Git Hooks

This directory contains the canonical git hooks for the PriceCompare project.

## Installation

After cloning the repository, run:

```bash
bash .github/hooks/install.sh
```

This copies the hooks to `.git/hooks/` where git will execute them.

## Available Hooks

### pre-commit

Comprehensive pre-commit validation including:

- **TypeScript type checking** - Full codebase type validation
- **ESLint checking** - Code quality and style enforcement
- **Security checks** - Blocks dangerous patterns:
  - Password hash exposure (excludes `scripts/` dev utilities)
  - Console.log in production code
  - `any` types in new code
  - N+1 query patterns
  - Hardcoded secrets
  - SQL injection patterns
  - Unsafe parseInt on request params
  - Missing foreign key cascade rules
- **Architecture enforcement** - Storage layer patterns, middleware order
- **Warning checks** - Non-blocking issues like missing transactions

## Updating Hooks

When modifying hooks:

1. Edit the hook in `.github/hooks/`
2. Run `bash .github/hooks/install.sh` to apply locally
3. Commit the changes to `.github/hooks/`
4. Other developers run `install.sh` after pulling

## Bypassing Hooks (Not Recommended)

```bash
git commit --no-verify
```

Only use this for genuine false positives. Document the reason in your commit message.
