# Security Framework

**Codified Security Patterns to Prevent Recurring Vulnerabilities**

---

## 🎯 Overview

This security framework prevents the recurring security issues found in audits by:
1. **Automating detection** of security anti-patterns
2. **Enforcing secure coding** through pre-commit hooks
3. **Providing reusable utilities** for common security tasks
4. **Documenting patterns** with clear examples

---

## 📂 Framework Components

### 1. Security Guidelines (`SECURITY_GUIDELINES.md`)
Comprehensive documentation of:
- Critical security rules (MUST follow)
- Code patterns and anti-patterns
- Pre-commit checklist
- Quick reference card

### 2. Automated Security Checks (`scripts/security-checks.sh`)
Shell script that scans for:
- Password hash exposure
- Unsafe `as any` casts
- Unvalidated `parseInt()` calls
- Raw error message exposure
- Endpoints without authentication

**Usage:**
```bash
npm run security:check
```

### 3. Security Utilities

#### `/server/utils/validation-helpers.ts`
Safe parsing functions:
- `parseIntSafe()` - Parse integers with validation
- `parseIntOptional()` - Parse optional integers
- `parseFloatSafe()` - Parse floats with validation

**Example:**
```typescript
import { parseIntSafe } from './utils/validation-helpers';

const id = parseIntSafe(req.params.id, 'productId', { min: 1, max: 10000 });
// Automatically rejects NaN, Infinity, and out-of-range values
```

#### `/server/utils/error-sanitizer.ts`
Error message sanitization:
- `sanitizeErrorMessage()` - Environment-aware error filtering
- `createErrorResponse()` - Complete error response builder
- `getErrorStatus()` - Automatic HTTP status detection

**Example:**
```typescript
import { createErrorResponse } from './utils/error-sanitizer';

catch (error) {
  const errorResponse = createErrorResponse(error, 'Product fetch');
  res.status(errorResponse.status).json({
    error: errorResponse.error,
    details: errorResponse.details  // Only in development
  });
}
```

#### `/server/types/express-session.d.ts`
Type-safe session access:
```typescript
// No more (req.session as any)?.userId
const userId = req.session.userId;  // Type-safe!
```

### 4. ESLint Security Rules (`.eslintrc.security.json`)
Enforces:
- No `eval()` or implied eval
- No unsafe regex patterns
- No explicit `any` types
- Security plugin rules

**Usage:**
```bash
npm run lint:security
```

### 5. Pre-Commit Hooks (`.husky/pre-commit`)
Automatically runs before every commit:
- TypeScript type checking
- Security pattern scanning
- npm audit for vulnerabilities

Prevents insecure code from being committed.

### 6. Pull Request Template (`.github/PULL_REQUEST_TEMPLATE.md`)
Comprehensive security checklist for code reviews:
- Authentication & Authorization
- Input Validation
- Type Safety
- Error Handling
- Data Protection
- Resource Management
- SQL & Database
- Webhooks & External APIs

### 7. Security Test Suite (`server/__tests__/security/`)
Automated tests for security utilities:
- Input validation tests
- Error sanitization tests
- NaN injection prevention tests
- Range validation tests

**Usage:**
```bash
npm run test:security
```

---

## 🚀 Quick Start

### For New Developers

1. **Read the guidelines:**
   ```bash
   cat SECURITY_GUIDELINES.md
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run security checks:**
   ```bash
   npm run security:check
   ```

4. **Run security tests:**
   ```bash
   npm run test:security
   ```

### For Existing Code

**Before committing new code:**

```bash
# Run full security check
npm run security:full

# Or individually:
npm run security:check    # Pattern scanning + npm audit
npm run test:security     # Security test suite  
npm run lint:security     # ESLint security rules
npm run check             # TypeScript strict mode
```

---

## 🔒 Common Security Patterns

### Pattern 1: Safe Integer Parsing
```typescript
// ❌ WRONG
const id = parseInt(req.params.id);

// ✅ CORRECT
import { parseIntSafe } from './utils/validation-helpers';
const id = parseIntSafe(req.params.id, 'productId', { min: 1 });
```

### Pattern 2: Input Validation
```typescript
// ❌ WRONG
const status = req.query.status as string;

// ✅ CORRECT
import { validateRequest } from './validation';
import { statusQuerySchema } from './validation/admin-schemas';

app.get("/api/products",
  validateRequest(statusQuerySchema, 'query'),
  async (req, res) => {
    const { status } = req.query;  // Validated
  }
);
```

### Pattern 3: Error Handling
```typescript
// ❌ WRONG
catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ CORRECT
import { createErrorResponse } from './utils/error-sanitizer';

catch (error) {
  console.error('Operation failed:', error);
  const errorResponse = createErrorResponse(error, 'Operation');
  res.status(errorResponse.status).json({
    error: errorResponse.error,
    details: errorResponse.details
  });
}
```

### Pattern 4: Authentication
```typescript
// ❌ WRONG
app.get("/api/admin/stats", async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({...});
});

// ✅ CORRECT
import { requireAuth, requireAdmin } from './auth';

app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
  // User is guaranteed to be authenticated admin
});
```

### Pattern 5: Type-Safe Sessions
```typescript
// ❌ WRONG
const userId = (req.session as any)?.userId;

// ✅ CORRECT (types defined in server/types/express-session.d.ts)
const userId = req.session.userId;
```

---

## 📊 Security Metrics

Track these metrics to measure security posture:

- **Critical/High vulnerabilities:** 0 (goal)
- **`as any` usage:** <10 instances (with justification)
- **parseInt without validation:** 0 instances
- **Endpoints without auth:** 0 admin endpoints
- **Test coverage for security utils:** >90%

Run metrics:
```bash
# Count as any usage
grep -r "as any" server/ --include="*.ts" | wc -l

# Count unsafe parseInt
grep -r "parseInt(" server/ --include="*.ts" | grep -v "parseIntSafe" | wc -l

# Run test coverage
npm run test:coverage
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Security Checks

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run security:check
      - run: npm run test:security
      - run: npm run lint:security
```

---

## 🆘 Troubleshooting

### Pre-commit hook fails
```bash
# See what failed
git commit --dry-run

# Fix issues, then retry
npm run security:check
git add -A
git commit
```

### Security test failures
```bash
# Run tests in watch mode
npm run test:watch server/__tests__/security

# See detailed output
npm run test:security -- --reporter=verbose
```

### ESLint security warnings
```bash
# See all warnings
npm run lint:security

# Auto-fix what's possible
npm run lint:security -- --fix
```

---

## 📚 Additional Resources

- **Security Audit Report:** `SECURITY_AUDIT_REPORT.md`
- **Validation Helpers:** `server/utils/validation-helpers.ts`
- **Error Sanitizer:** `server/utils/error-sanitizer.ts`
- **Validation Schemas:** `server/validation/admin-schemas.ts`

---

## 🔐 Security Contacts

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Run `npm run security:check` to confirm
3. Document the issue with reproduction steps
4. Report to the security team (add contact info here)

---

## ✅ Checklist for New Features

When adding new features, ensure:

- [ ] All endpoints have authentication
- [ ] All inputs validated with Zod schemas
- [ ] Integer parsing uses `parseIntSafe()`
- [ ] Error messages sanitized
- [ ] Session access is type-safe
- [ ] Rate limiting applied
- [ ] Security tests written
- [ ] Pre-commit checks pass
- [ ] Documentation updated

---

**Last Updated:** 2025-11-11  
**Maintained By:** Development Team  
**Status:** Active

This framework evolves with new security patterns. Contribute improvements via pull requests!
