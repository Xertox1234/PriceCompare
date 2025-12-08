# Contributing to PriceCompare

Thank you for your interest in contributing to PriceCompare! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Security Guidelines](#security-guidelines)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Review Checklist](#code-review-checklist)

---

## Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **PostgreSQL** 14.x or higher
- **Redis** (optional, but recommended for production-like development)
- **npm** 8.x or higher

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/Xertox1234/PriceCompare.git
   cd PriceCompare
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

   If you encounter peer dependency issues:

   ```bash
   PUPPETEER_SKIP_DOWNLOAD=true npm install --legacy-peer-deps
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   **IMPORTANT:** Generate strong secrets (minimum 32 characters):

   ```bash
   # Generate SESSION_SECRET
   openssl rand -base64 32

   # Generate CSRF_SECRET
   openssl rand -base64 32

   # Generate DISCOURSE_SSO_SECRET
   openssl rand -base64 32
   ```

   Update `.env` with these generated values.

4. **Set up the database**

   ```bash
   # Run migrations
   npm run migrate

   # (Optional) Seed sample data
   npm run seed
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5000`

### Troubleshooting Setup

**Port 5000 already in use:**

```bash
# Find and kill the process using port 5000
lsof -ti:5000 | xargs kill -9
```

**Database connection issues:**

- Verify PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Ensure database exists: `createdb price_db`

**Redis connection issues:**

- Redis is optional for development
- App will fall back to in-memory storage
- To use Redis: ensure `REDIS_URL` is set and Redis is running

---

## Code Standards

### TypeScript

- **Strict mode is enabled** - all code must pass TypeScript strict checks
- Use explicit types, avoid `any` unless absolutely necessary
- Prefer interfaces over types for object shapes
- Use Zod schemas for runtime validation

**Example:**

```typescript
// Good
interface User {
  id: number;
  email: string;
  role: 'user' | 'admin';
}

// Avoid
const user: any = { ... };
```

### Code Style

- **Formatting:** Code is formatted automatically on commit (Prettier)
- **Linting:** Run `npm run lint` before committing
- **Naming Conventions:**
  - `camelCase` for variables and functions
  - `PascalCase` for classes and React components
  - `UPPER_SNAKE_CASE` for constants
  - Prefix interfaces with 'I' only when necessary

### File Organization

```
server/
  ├── routes/          # API route handlers
  ├── middleware/      # Express middleware
  ├── services/        # Business logic
  ├── utils/           # Utility functions
  ├── config/          # Configuration
  └── __tests__/       # Server tests

client/
  └── src/
      ├── components/  # React components
      ├── pages/       # Page components
      ├── hooks/       # Custom React hooks
      ├── lib/         # Client utilities
      └── utils/       # Helper functions
```

---

## Security Guidelines

**CRITICAL:** PriceCompare has a strong security posture. All contributions must maintain these standards.

### Input Validation

- ✅ **Always validate user input** using Zod schemas
- ✅ **Use safe integer parsing:** `parseIntSafe()`, `parseFloatSafe()`
- ✅ **Sanitize HTML:** Use DOMPurify for any user-generated HTML
- ❌ **Never trust client input** - validate on the server

**Example:**

```typescript
// Good - using safe parsing
const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

// Bad - direct conversion
const productId = parseInt(req.params.id); // No validation!
```

### SQL Injection Prevention

- ✅ **Always use Drizzle ORM** - never write raw SQL
- ✅ **Use parameterized queries** built into Drizzle
- ❌ **Never concatenate user input** into SQL strings

**Example:**

```typescript
// Good - using Drizzle ORM
const user = await db.select().from(users).where(eq(users.id, userId));

// Bad - raw SQL (DON'T DO THIS)
const user = await db.execute(`SELECT * FROM users WHERE id = ${userId}`);
```

### XSS Prevention

- ✅ **Sanitize all user-generated content** before rendering
- ✅ **Use DOMPurify** for HTML sanitization (client/src/utils/sanitize.ts)
- ✅ **Escape URLs** to prevent javascript: URIs
- ❌ **Never use `dangerouslySetInnerHTML`** without sanitization

### Authentication & Authorization

- ✅ **Check authentication** on protected routes: `withAuth()`, `withAdmin()`
- ✅ **Validate sessions** before processing requests
- ✅ **Use secure cookies:** httpOnly, sameSite, secure flags
- ❌ **Never log passwords** or sensitive data

### CSRF Protection

- ✅ **CSRF tokens are automatic** - the middleware handles this
- ✅ **State-changing operations** (POST, PUT, DELETE) are protected
- ✅ **Include CSRF token** in forms: `X-CSRF-Token` header
- ❌ **Don't disable CSRF** unless you have a very good reason

### Rate Limiting

- ✅ **Rate limits are enforced** globally and per-route
- ✅ **Stricter limits** on auth endpoints
- ✅ **Redis-based limits** for distributed systems
- ❌ **Don't bypass rate limits** in production code

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run security tests only
npm run test:security

# Run AI prompt tests
npm run test:ai
```

### Writing Tests

**Unit Tests:**

```typescript
import { describe, it, expect } from 'vitest';
import { parseIntSafe } from './validation-helpers';

describe('parseIntSafe', () => {
  it('should parse valid integers', () => {
    expect(parseIntSafe('42', 'test')).toBe(42);
  });

  it('should throw on invalid input', () => {
    expect(() => parseIntSafe('invalid', 'test')).toThrow();
  });
});
```

**Integration Tests:**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server';

describe('GET /api/products', () => {
  it('should return products list', async () => {
    const response = await request(app).get('/api/products').expect(200);

    expect(response.body).toHaveProperty('results');
  });
});
```

### Test Coverage Requirements

- **New features:** Must include tests
- **Bug fixes:** Should include regression tests
- **Security features:** Must include security tests
- **Target coverage:** 80%+ for new code

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history.

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `security`: Security improvements

### Examples

```bash
# Feature
git commit -m "feat(products): add price prediction endpoint"

# Bug fix
git commit -m "fix(auth): prevent account lockout race condition"

# Security
git commit -m "security(api): add rate limiting to password reset"

# Documentation
git commit -m "docs: update API documentation for search endpoint"
```

### Commit Best Practices

- ✅ **Write clear, descriptive messages**
- ✅ **Use present tense** ("add feature" not "added feature")
- ✅ **Keep subject line under 72 characters**
- ✅ **Reference issues:** `Fixes #123` or `Closes #456`
- ❌ **Don't commit secrets** or sensitive data
- ❌ **Don't commit commented-out code**

---

## Pull Request Process

### Before Submitting

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Write clean code**
   - Follow code standards
   - Add tests
   - Update documentation

3. **Test thoroughly**

   ```bash
   npm test
   npm run check  # TypeScript type checking
   npm run lint   # ESLint
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add your feature"
   ```

5. **Push to your branch**
   ```bash
   git push origin feat/your-feature-name
   ```

### PR Title Format

```
<type>: <clear description>
```

Examples:

- `feat: Add price volatility calculator`
- `fix: Resolve CSRF token validation issue`
- `security: Implement SSRF prevention for scraping`

### PR Description Template

```markdown
## Description

Brief description of what this PR does.

## Changes Made

- Change 1
- Change 2
- Change 3

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Security Considerations

- [ ] Input validation added
- [ ] No SQL injection risks
- [ ] No XSS vulnerabilities
- [ ] Authentication/authorization checked

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks must pass:**
   - TypeScript compilation
   - Tests
   - Linting

2. **At least one approval** required from maintainers

3. **Address review comments** promptly

4. **Squash commits** if requested before merging

---

## Code Review Checklist

### For Reviewers

**Security:**

- [ ] Input is validated (Zod schemas or safe parsing)
- [ ] No SQL injection risks (using Drizzle ORM)
- [ ] No XSS vulnerabilities (DOMPurify used)
- [ ] Authentication/authorization checked
- [ ] CSRF protection not bypassed
- [ ] No secrets in code
- [ ] Rate limiting considered

**Code Quality:**

- [ ] TypeScript strict mode compliance
- [ ] Clear variable/function names
- [ ] No unnecessary complexity
- [ ] Error handling present
- [ ] Logging appropriate (no sensitive data)
- [ ] No performance regressions

**Testing:**

- [ ] Tests included for new features
- [ ] Edge cases covered
- [ ] Security tests for security features
- [ ] Tests are meaningful (not just coverage)

**Documentation:**

- [ ] Code comments for complex logic
- [ ] API changes documented
- [ ] README updated if needed
- [ ] Migration guide if breaking changes

---

## Questions or Issues?

- **Bug reports:** [Open an issue](https://github.com/Xertox1234/PriceCompare/issues)
- **Feature requests:** [Start a discussion](https://github.com/Xertox1234/PriceCompare/discussions)
- **Security issues:** Email [SECURITY_EMAIL] (do not open public issues)

---

## License

By contributing to PriceCompare, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to PriceCompare!** 🎉
