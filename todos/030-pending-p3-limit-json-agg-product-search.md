---
status: pending
priority: p3
issue_id: "030"
tags: [code-review, performance, database]
dependencies: []
---

# Add Database-Level Limit to JSON Aggregation in Product Search

## Problem Statement

`searchProducts` limits to top 3 offers in post-processing (line 732), but `json_agg()` fetches ALL offers from database first.

## Findings

- Discovered by Performance Oracle agent
- Location: `server/storage.ts:647-675`

## Recommended Action

Add window function to limit at database level:
```sql
(SELECT json_agg(offer_data)
 FROM (
   SELECT ... FROM product_offers
   WHERE product_id = products.id
   ORDER BY price ASC
   LIMIT 3
 ) AS offer_data)
```

## Acceptance Criteria

- [ ] Database query only fetches top 3 offers
- [ ] Network/memory usage reduced
- [ ] Search results unchanged
