---
status: pending
priority: p2
issue_id: "034"
tags: [patterns, api, consistency, code-review]
dependencies: []
---

# Standardize API Response Format

## Problem Statement

Four different response patterns are used across the API, leading to inconsistent client-side handling.

**Impact:**
- Frontend needs different handling for different endpoints
- Harder to write generic API utilities
- Confusing for API consumers

## Findings

Discovered during pattern-recognition audit on 2025-11-23.

**Pattern 1: Success wrapper with data**
```typescript
res.json({ success: true, data: products, count: products.length });
```

**Pattern 2: Direct data return**
```typescript
res.json(products);
```

**Pattern 3: Results with metadata**
```typescript
res.json({ results: products, metadata: { page, limit, total } });
```

**Pattern 4: Success with message**
```typescript
res.json({ success: true, message: 'Operation completed' });
```

## Proposed Solutions

### Option 1: Standardize on Envelope Pattern (Recommended)

**Effort:** Medium (1-2 days)

All responses follow:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}
```

**Implementation:**
```typescript
// Helper function
function sendSuccess<T>(res: Response, data: T, meta?: object) {
  res.json({ success: true, data, meta });
}

function sendError(res: Response, status: number, error: string) {
  res.status(status).json({ success: false, error });
}

// Usage
sendSuccess(res, products, { page, limit, total });
```

## Acceptance Criteria

- [ ] All endpoints use consistent response format
- [ ] Helper functions created for common patterns
- [ ] Frontend updated to expect consistent format
- [ ] API documentation updated

## Work Log

### 2025-11-23 - Pattern Recognition Audit Discovery
**By:** Claude Code Review System (pattern-recognition-specialist agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
