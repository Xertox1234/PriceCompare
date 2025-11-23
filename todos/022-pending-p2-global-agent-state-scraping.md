---
status: pending
priority: p2
issue_id: "022"
tags: [code-review, architecture, state-management]
dependencies: []
---

# Refactor Global Agent State in Scraping Routes

## Problem Statement

Global mutable state for AI agents is anti-pattern for testability, scaling, and memory management.

## Findings

- Discovered by Architecture Strategist agent
- Location: `server/scraping-routes.ts:98-101`
```typescript
let coordinationAgent: CoordinationAgent | null = null;
let discoveryAgent: ProductDiscoveryAgent | null = null;
let searchAgent: SearchOrchestrationAgent | null = null;
```

## Recommended Action

Implement proper agent lifecycle management:
- Create AgentService class
- Use dependency injection
- Manage agent lifecycle (create/destroy)
- Enable proper mocking for tests

## Acceptance Criteria

- [ ] No global mutable agent state
- [ ] AgentService manages agent lifecycle
- [ ] Agents can be mocked in tests
- [ ] Memory properly managed
