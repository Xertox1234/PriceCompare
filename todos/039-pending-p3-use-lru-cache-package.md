---
status: pending
priority: p3
issue_id: "039"
tags: [code-review, simplification, dependencies]
dependencies: []
---

# Consider Using lru-cache npm Package

## Problem Statement

Custom LRU cache implementation exists when well-tested packages like `lru-cache` are available.

## Findings

- Discovered by Code Simplicity Reviewer agent
- Location: `server/services/advanced-cache.ts:29-85`
- ~55 lines of custom implementation

## Recommended Action

Evaluate replacing with `lru-cache` package:
- Better tested
- More features
- Maintained by community

## Acceptance Criteria

- [ ] lru-cache package evaluated
- [ ] If beneficial, custom implementation replaced
- [ ] ~55 LOC reduction, better reliability
