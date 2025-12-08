## Description

<!-- Briefly describe what this PR does -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Security fix
- [ ] Documentation update

## Security Checklist ✅

### Authentication & Authorization

- [ ] All new endpoints have appropriate authentication (`requireAuth`, `requireAdmin`)
- [ ] Authorization checks use middleware, not manual `if` statements
- [ ] No bypasses or backdoors introduced

### Input Validation

- [ ] All query parameters validated with Zod schemas
- [ ] All request bodies validated with Zod schemas
- [ ] All integer parsing uses `parseIntSafe` or `parseIntOptional`
- [ ] No direct `parseInt()`, `parseFloat()` calls without validation

### Type Safety

- [ ] No `as any` type casts (or properly justified with SECURITY comment)
- [ ] Session access uses typed `req.session.userId` (not `as any`)
- [ ] All function parameters properly typed
- [ ] TypeScript strict mode passes (`npm run check`)

### Error Handling

- [ ] Error messages sanitized for production using `createErrorResponse()`
- [ ] No direct `error.message` exposure to clients
- [ ] Stack traces only shown in development mode
- [ ] Appropriate HTTP status codes returned

### Data Protection

- [ ] No password hashes in API responses
- [ ] No sensitive data (tokens, secrets, keys) logged or exposed
- [ ] User emails/PII properly protected

### Resource Management

- [ ] No unbounded growth in memory structures
- [ ] Rate limiting applied to public-facing endpoints
- [ ] Database queries have appropriate limits
- [ ] File uploads (if any) have size limits

### SQL & Database

- [ ] All queries use parameterized statements (Drizzle ORM)
- [ ] No raw SQL string concatenation
- [ ] Slug generation includes collision detection

### Webhooks & External APIs

- [ ] Webhook signatures verified
- [ ] External API calls have timeouts
- [ ] API keys/secrets loaded from environment variables

## Testing ✅

- [ ] Security tests added/updated
- [ ] Authentication tests pass
- [ ] Input validation tests pass
- [ ] Error handling tests pass
- [ ] `npm run test:security` passes

## Pre-Merge Verification

- [ ] `npm run security:check` passes
- [ ] `npm run check` (TypeScript) passes
- [ ] `npm run test` passes
- [ ] Manual testing completed
- [ ] Security Guidelines reviewed (`SECURITY_GUIDELINES.md`)

## Related Issues

<!-- Link to related issues, e.g., Fixes #123 -->

## Screenshots (if applicable)

<!-- Add screenshots for UI changes -->

## Additional Notes

<!-- Any additional information reviewers should know -->

---

**For Reviewers:**
Please verify all items in the Security Checklist above. Refer to `SECURITY_GUIDELINES.md` for patterns and best practices.
