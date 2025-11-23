---
status: pending
priority: p2
issue_id: "026"
tags: [security, validation, zod, routes, code-review]
dependencies: []
---

# Add Input Validation to Unvalidated Endpoints

## Problem Statement

Several endpoints accept `req.body` properties without proper Zod schema validation, relying only on basic null checks.

**Impact:** Type confusion attacks, prototype pollution, or injection of unexpected data types could bypass business logic.

## Findings

Discovered during security audit on 2025-11-23.

**Affected Locations:**

1. **`server/routes/enhanced-forum-routes.ts`** (Lines 36, 78, 126, 198, 253):
```typescript
// Line 36 - Only basic property extraction
const { bio, location, website, avatarUrl } = req.body;
// No schema validation

// Line 78 - Tags not validated
const { tags = [], title, content, categoryId: categoryIdRaw } = req.body;
```

2. **`server/routes/affiliate-routes.ts`** (Line 56):
```typescript
const { affiliateId, affiliateProgram, baseAffiliateUrl, commissionRate, affiliateStatus, affiliateConfig } = req.body;
// Validation schema exists but only for testUrl
```

3. **`server/routes/cache-routes.ts`** (Lines 138-140):
```typescript
const options = {
  topProductsCount: req.body.topProductsCount || 100,  // No type validation
  includeAnalytics: req.body.includeAnalytics !== false,
  includeSearches: req.body.includeSearches !== false,
};
```

4. **`server/routes/community-routes.ts`** (Lines 219, 297, 381):
```typescript
const { name, description, color, icon } = req.body;  // No schema validation
```

## Proposed Solutions

### Option 1: Create Zod Schemas for All Endpoints (Recommended)

**Effort:** Medium (3-4 hours)

**Implementation:**
```typescript
const updateProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

app.put("/api/users/profile", withAuth(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  // ...
}));
```

## Acceptance Criteria

- [ ] All endpoints have Zod schema validation
- [ ] Validation errors return 400 with details
- [ ] No raw req.body property access without validation
- [ ] Tests cover validation edge cases

## Work Log

### 2025-11-23 - Security Audit Discovery
**By:** Claude Code Review System (security-sentinel agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
