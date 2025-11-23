---
status: pending
priority: p2
issue_id: "014"
tags: [code-review, error-handling, security, consistency]
dependencies: []
---

# Standardize Error Handling to Use createErrorResponse

## Problem Statement

Routes use two different error handling approaches:
- Modern: Uses `createErrorResponse()` (sanitizes errors)
- Legacy: Inline `res.status(500).json({ message: ... })` (may leak details)

## Findings

- Discovered by Pattern Recognition and Security Sentinel agents
- Legacy pattern in 40+ route handlers across:
  - `server/routes/product-routes.ts` - 12+ occurrences
  - `server/routes/admin-routes.ts` - 15+ occurrences
  - `server/routes/auth-routes.ts`
  - `server/community-routes.ts` - 27 occurrences
  - `server/scraping-routes.ts` - exposes raw error messages

## Recommended Action

Replace all inline error responses with `createErrorResponse`:
```typescript
// Instead of:
res.status(500).json({ message: "Failed to search products" });

// Use:
const errorResponse = createErrorResponse(error, 'SearchProducts');
res.status(errorResponse.status).json({ error: errorResponse.error });
```

## Acceptance Criteria

- [ ] All routes use createErrorResponse for error handling
- [ ] No raw error messages exposed in production
- [ ] Consistent error response format across API
