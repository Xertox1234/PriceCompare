---
status: pending
priority: p2
issue_id: "024"
tags: [security, csrf, routes, code-review]
dependencies: []
---

# Add CSRF Protection to State-Changing Endpoints

## Problem Statement

Several POST/PATCH/DELETE endpoints rely on authentication but do not explicitly include CSRF protection middleware. While there is global CSRF middleware, several route patterns suggest inconsistent application.

**Impact:** Cross-site request forgery attacks could force authenticated users to create topics, posts, alerts, or modify watchlists without consent.

## Findings

Discovered during security audit on 2025-11-23.

**Affected Files and Endpoints:**

1. **`server/routes/forum-routes.ts`**:
   - `POST /api/forum/topics`
   - `POST /api/forum/posts`

2. **`server/routes/enhanced-forum-routes.ts`**:
   - `PUT /api/users/profile`
   - `POST /api/forum/topics/enhanced`
   - `POST /api/forum/posts/enhanced`
   - `POST /api/forum/posts/:id/like`

3. **`server/routes/community-routes.ts`**:
   - `POST /api/community/watch/:productId`
   - `DELETE /api/community/watch/:productId`
   - All watch list management endpoints

4. **`server/routes/smart-alerts-routes.ts`**:
   - `POST /api/smart-alerts/create-suggested`

5. **`server/routes/alert-routes.ts`**:
   - `POST /api/price-alerts`
   - `PATCH /api/price-alerts/:id`
   - `DELETE /api/price-alerts/:id`

6. **`server/routes/product-routes.ts`**:
   - `POST /api/analytics/product-view`

## Proposed Solutions

### Option 1: Add csrfProtection to Each Endpoint (Recommended)

**Effort:** Medium (2-3 hours)

**Implementation:**
```typescript
import { csrfProtection } from "../middleware/security";

app.post("/api/forum/topics", csrfProtection, withAuth(async (req, res) => {
  // Protected from CSRF
}));
```

## Acceptance Criteria

- [ ] All POST endpoints have csrfProtection middleware
- [ ] All PATCH endpoints have csrfProtection middleware
- [ ] All DELETE endpoints have csrfProtection middleware
- [ ] Client properly sends CSRF token with requests
- [ ] Tests pass

## Work Log

### 2025-11-23 - Security Audit Discovery
**By:** Claude Code Review System (security-sentinel agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
