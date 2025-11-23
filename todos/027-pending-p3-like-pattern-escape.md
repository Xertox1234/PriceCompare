---
status: pending
priority: p3
issue_id: "027"
tags: [code-review, security, database]
dependencies: []
---

# Escape LIKE Pattern Special Characters in getProductByUrl

## Problem Statement

`getProductByUrl` uses `like()` with user input directly. LIKE special characters (`%`, `_`) could cause unintended pattern matching.

## Findings

- Discovered by Security Sentinel agent
- Location: `server/storage.ts:843`
- Not SQL injection (Drizzle parameterizes), but pattern matching issue

## Recommended Action

Escape LIKE special characters:
```typescript
const escapedUrl = productUrl.replace(/[%_]/g, '\\$&');
.where(like(productOffers.productUrl, `%${escapedUrl}%`))
```

## Acceptance Criteria

- [ ] LIKE special characters escaped in user input
- [ ] URL search works correctly with special characters
