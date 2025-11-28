# Next Session: Auth Routes API Testing Migration

## Quick Start Prompt

```
Continue the API testing migration. Migrate auth-routes.test.ts to use standardized validation helpers and achieve 100% test pass rate.

Current Progress:
- ✅ 3/15+ test suites completed (98.9% passing - 89/90 tests)
- ✅ 9 production bugs fixed across 3 suites
- ✅ Patterns codified into reviewer agents

Next Target: server/routes/__tests__/auth-routes.test.ts

Context Files:
- TODO_API_TESTING_MIGRATION.md - Migration status and patterns
- docs/API_TESTING_PATTERNS.md - Testing patterns reference
- server/__tests__/helpers/response-validators.ts - Validation helpers

Goal: Migrate auth-routes.test.ts to use expectSuccessResponse/expectErrorResponse and achieve 100% test pass rate.
```

---

## Context

### What Was Completed

#### Test Suite Migrations (3/15+)
1. ✅ **alert-routes.test.ts** - 29/30 passing (96.7%)
   - 1 test skipped due to Drizzle field selection bug
   - Fixed invalid ID handling, error message consistency

2. ✅ **retailer-routes.test.ts** - 18/18 passing (100%)
   - Fixed variable naming conflicts (8 instances)
   - Updated test expectations for active-only filtering

3. ✅ **product-routes.test.ts** - 42/42 passing (100%)
   - Fixed PostgreSQL DECIMAL type conversion
   - Fixed missing basePrice in error response
   - Fixed empty object anti-pattern
   - Fixed wrong response helper usage

#### Production Bugs Fixed (9 total)
- 4 bugs in product-routes (session just completed)
- 3 bugs in alert-routes (previous session)
- 2 bugs in retailer-routes (previous session)

#### Patterns Codified
All learnings from 3 test suite migrations have been embedded into:
- `typescript-reviewer.md` - PostgreSQL type handling (Pattern #1)
- `code-review-specialist.md` - Response anti-patterns (3 new)
- `test-engineer.md` - API testing patterns (comprehensive)

### Current Statistics

- **Test Suites Completed**: 3/15+ (20%)
- **Overall Pass Rate**: 98.9% (89/90 tests)
- **Tests Skipped**: 1 (Drizzle bug)
- **Bugs Fixed**: 9 distinct production issues
- **Documentation**: Comprehensive guides created

---

## Next Target: auth-routes.test.ts

### Priority: HIGH (Critical Security Functionality)

### Expected Scope
Authentication routes typically include:
- User registration (POST /api/auth/register)
- User login (POST /api/auth/login)
- User logout (POST /api/auth/logout)
- Password reset request (POST /api/auth/forgot-password)
- Password reset confirmation (POST /api/auth/reset-password)
- Session validation (GET /api/auth/session)
- Profile retrieval (GET /api/auth/me)

### Expected Challenges

1. **CSRF Protection Testing**
   - All mutating operations require CSRF tokens
   - Mock implementation in tests
   - Verify token validation

2. **Session Management**
   - Session creation on login
   - Session destruction on logout
   - Session persistence across requests
   - Mock session store behavior

3. **Password Hashing**
   - Never expose passwordHash in responses
   - Verify bcrypt/argon2 usage
   - Test password validation

4. **Security-Sensitive Error Messages**
   - Don't reveal whether email exists
   - Generic error messages for security
   - "Invalid credentials" vs "Email not found"

5. **Rate Limiting**
   - Login attempts should be rate-limited
   - Password reset requests rate-limited
   - May need to mock rate limiter

---

## Success Criteria

- [ ] All tests in auth-routes.test.ts passing (100% or near-100%)
- [ ] No security vulnerabilities introduced
- [ ] No passwordHash exposure in tests or responses
- [ ] CSRF protection verified on all mutations
- [ ] Session management tested correctly
- [ ] Error messages don't reveal sensitive information
- [ ] Documentation updated
- [ ] Changes committed and pushed to GitHub

---

## Testing Command

```bash
# Run auth routes tests
npm test server/routes/__tests__/auth-routes.test.ts
```

Ready to start the next migration! 🚀
