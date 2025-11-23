---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, simplification, architecture, dead-code]
dependencies: []
---

# Consolidate Duplicate Locking Services

## Problem Statement

Two completely separate locking implementations exist in the codebase serving the same purpose (preventing duplicate job execution):
- `distributed-lock.ts` (391 lines) - Redis-based with its OWN Redis connection
- `job-lock-service.ts` (281 lines) - Database-based job lock

This creates confusion, maintenance burden, and wastes a Redis connection.

## Findings

- Discovered during comprehensive code review by Code Simplicity Reviewer agent
- Location: `server/services/distributed-lock.ts`, `server/services/job-lock-service.ts`
- The `DistributedLock` class creates its own Redis connection (lines 66-76) separate from the main app's Redis

## Proposed Solutions

### Option 1: Keep job-lock-service.ts only (RECOMMENDED)
- **Change:** Remove `distributed-lock.ts`, migrate all usages to `job-lock-service.ts`
- **Pros:** Uses existing DB, no extra Redis dependency for locks, simpler architecture
- **Cons:** DB-based locks slightly slower than Redis (negligible for job scheduling)
- **Effort:** Medium
- **Risk:** Low

### Option 2: Keep distributed-lock.ts only
- **Change:** Remove `job-lock-service.ts`, use Redis locks everywhere
- **Pros:** Redis locks are faster
- **Cons:** Creates separate Redis connection, more complex
- **Effort:** Medium
- **Risk:** Low

### Option 3: Refactor distributed-lock.ts to use shared Redis client
- **Change:** Modify to use `getRedisClient()` from config
- **Pros:** Keeps both options available
- **Cons:** Still have two lock implementations
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option 1 - Consolidate to `job-lock-service.ts` for simplicity. The DB-based approach is sufficient for job scheduling use cases.

## Technical Details

- **Affected Files:**
  - DELETE: `server/services/distributed-lock.ts`
  - MODIFY: Any files importing `distributed-lock.ts`
- **Related Components:** Job scheduling, cron jobs, background workers
- **Database Changes:** No

### Files to audit for distributed-lock usage:
```bash
grep -r "distributed-lock" server/
grep -r "DistributedLock" server/
```

## Acceptance Criteria

- [ ] All usages of `distributed-lock.ts` migrated to `job-lock-service.ts`
- [ ] `distributed-lock.ts` file deleted
- [ ] No orphaned Redis connections
- [ ] Job locking still works correctly
- [ ] Tests pass

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Code Simplicity Reviewer agent
- Identified as YAGNI violation - two solutions to same problem

**Learnings:**
- Organic codebase growth can lead to duplicate solutions
- Consolidation reduces maintenance burden and developer confusion

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
Estimated LOC reduction: ~391 lines
