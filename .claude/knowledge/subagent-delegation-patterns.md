# Subagent Delegation Patterns

**Created:** 2025-12-04
**Context:** Learnings from Phase 1 & 2 pre-commit hook enhancement implementation
**Purpose:** Codify effective patterns for orchestrator-to-subagent task delegation

---

## Overview

Effective subagent delegation follows predictable patterns that maximize quality while minimizing token usage and context fragmentation. This guide documents patterns learned from multi-agent implementations.

---

## 1. Domain Expertise Mapping

### Task-to-Agent Assignment Matrix

| Task Category | Primary Agent | Supporting Agent | Rationale |
|---------------|---------------|------------------|-----------|
| Pre-commit hook implementation | backend-architect | security-auditor | Shell scripting + security pattern knowledge |
| CSRF protection validation | security-auditor | code-review-specialist | Security focus + pattern validation |
| Transaction boundary analysis | database-engineer | backend-architect | Schema expertise + service integration |
| N+1 query detection/fix | database-engineer | code-review-specialist | Query optimization + pattern enforcement |
| Type safety enforcement | typescript-reviewer | code-review-specialist | Type expertise + integration review |
| API route implementation | backend-architect | security-auditor | Route patterns + security validation |
| Frontend component creation | frontend-specialist | code-review-specialist | React patterns + quality review |
| Test implementation | test-engineer | code-review-specialist | Testing patterns + coverage review |
| Schema changes | database-engineer | backend-architect | Schema design + migration coordination |
| Performance optimization | backend-architect | database-engineer | Caching + query optimization |

### When to Use Multiple Agents

**Sequential delegation (Agent A then Agent B):**
- Agent A implements, Agent B reviews
- Example: backend-architect implements feature, code-review-specialist validates

**Parallel delegation (Agents A and B simultaneously):**
- Tasks are independent and can run concurrently
- Example: frontend-specialist builds UI while backend-architect builds API

**Collaborative delegation (Agents A and B iteratively):**
- Complex task requires multiple perspectives
- Example: database-engineer designs schema, backend-architect reviews service integration, iterate

---

## 2. Task Handoff Protocol

### Pre-Task Handoff Template (Orchestrator -> Subagent)

```markdown
## Task: [Clear, actionable title]

### Context
[Explain the broader goal and why this specific task is needed]
[Reference any prior work or related tasks]

### Specific Deliverables
1. [Concrete deliverable 1]
2. [Concrete deliverable 2]
3. [Concrete deliverable N]

### Success Criteria
- [ ] Criterion 1 (measurable)
- [ ] Criterion 2 (testable)
- [ ] Criterion N (verifiable)

### Constraints
- Must not break [existing functionality]
- Must follow patterns in [specific pattern file]
- Token budget consideration: [estimated complexity]
- Time constraint: [if applicable]

### Relevant Files to Read
- `path/to/file1.ts` - [why relevant]
- `path/to/file2.ts` - [why relevant]

### Expected Output Format
[Describe what format the response should take]
[Specify conciseness level - summary vs detailed]
```

### Post-Task Report Template (Subagent -> Orchestrator)

```markdown
## Task Completion Report

### Status: [Success | Partial | Failed]

### What Was Done
- [Bullet point 1]
- [Bullet point 2]
- [Bullet point N]

### Files Modified
- `path/to/file1.ts` - [brief description of changes]
- `path/to/file2.ts` - [brief description of changes]

### Issues Encountered
- [Issue 1 and how it was resolved]
- [Issue 2 that remains a blocker]
OR
- None

### Integration Points
[What other agents/components need to know about these changes]

### Recommendations for Follow-Up
- [Follow-up task 1]
- [Follow-up task 2]
OR
- None
```

---

## 3. Context Management Strategies

### Minimize Context Transfer

**Do:**
- Give subagents only the context they need
- Reference file paths rather than including full content
- Summarize prior work rather than including full history

**Don't:**
- Dump entire conversation history
- Include unrelated files "just in case"
- Repeat context that's in standard agent configurations

### Leverage Agent Knowledge Base

Each agent has domain-specific knowledge in their configuration. Reference it:

```markdown
### Context
This task involves transaction boundaries. Refer to your
"Transaction Boundaries (MANDATORY)" section for patterns.
```

### Use Incremental Context Building

For complex tasks, build context incrementally:

```markdown
## Phase 1: Investigation
Read these files and report findings: [list]

## Phase 2: Implementation (after Phase 1 report)
Based on findings, implement: [specific task]
```

---

## 4. Quality Assurance Patterns

### Code Review Loop

```
1. Orchestrator assigns implementation to Agent A
2. Agent A completes and reports
3. Orchestrator assigns review to code-review-specialist
4. code-review-specialist reports issues
5. If issues found:
   - Orchestrator assigns fixes to Agent A
   - Repeat from step 3
6. If no issues: Task complete
```

### Security Validation Loop

```
1. Any route/API implementation
2. security-auditor reviews for:
   - CSRF protection
   - Input validation
   - Auth/authz checks
   - Error sanitization
3. Issues fed back to implementing agent
```

### Testing Loop

```
1. Feature implementation complete
2. test-engineer reviews test coverage
3. If coverage gaps:
   - test-engineer implements tests
   - OR assigns back to implementing agent
4. Verify tests pass
```

---

## 5. Error Recovery Patterns

### Subagent Task Failure

**Symptoms:**
- Agent returns "Status: Failed"
- Agent reports blockers
- Agent's output doesn't meet success criteria

**Recovery Protocol:**
1. Analyze failure reason
2. If knowledge gap: Provide additional context and retry
3. If wrong agent: Reassign to correct specialist
4. If scope too large: Break into smaller tasks
5. If blocked by external issue: Document and pause

### Context Overflow

**Symptoms:**
- Agent output is truncated
- Agent reports being unable to complete due to context limits
- Agent skips parts of the task

**Recovery Protocol:**
1. Break task into smaller chunks
2. Reduce context by summarizing instead of including full files
3. Use JIT pattern loading (reference patterns, don't include)
4. Consider using a larger-context agent for complex tasks

### Quality Issues

**Symptoms:**
- Code review finds multiple issues
- Implementation doesn't follow patterns
- Security vulnerabilities introduced

**Recovery Protocol:**
1. Document specific issues
2. Reference relevant pattern documentation
3. Assign fixes back to original agent
4. Add pattern check to future task templates

---

## 6. Communication Best Practices

### Be Specific About Expectations

**Bad:**
```
Implement the CSRF check.
```

**Good:**
```
Implement BLOCKER 11 (Missing CSRF on mutations):
- Detect POST/PUT/PATCH/DELETE routes without csrfProtection
- Exclude test files and documented exemptions
- Provide actionable error message with fix example
```

### Provide Examples When Possible

**Bad:**
```
Add error handling.
```

**Good:**
```
Add error handling following this pattern:
try { /* operation */ }
catch (error) { sendErrorFromException(res, error, 'OperationName'); }
```

### Request Specific Output Format

**Bad:**
```
Let me know what you did.
```

**Good:**
```
Return in this format:
Status: Success/Partial/Failed
Files Modified: [list]
Integration Points: [what other components need to know]
Blockers: [any issues] or None
```

---

## 7. Anti-Patterns to Avoid

### Over-Delegation

**Problem:** Breaking every small task into subagent calls
**Impact:** Context fragmentation, overhead, slower execution
**Solution:** Handle simple tasks directly, delegate complex domain-specific work

### Under-Contexting

**Problem:** Not giving subagent enough information to complete task
**Impact:** Failed tasks, multiple retries, wasted tokens
**Solution:** Use handoff template, include success criteria

### Micromanagement

**Problem:** Specifying exact implementation details
**Impact:** Undermines agent expertise, rigid solutions
**Solution:** Specify WHAT and WHY, let agent decide HOW

### Cross-Domain Confusion

**Problem:** Asking wrong agent for specialized task
**Impact:** Lower quality, missed patterns, more iterations
**Solution:** Use task-to-agent matrix, respect domain boundaries

### Context Dumping

**Problem:** Including all possibly relevant information
**Impact:** Token waste, agent confusion, key info buried
**Solution:** Curate context, summarize, reference files

---

## 8. Metrics for Effective Delegation

Track these to improve delegation over time:

1. **First-attempt success rate**: Tasks completed without revisions
2. **Average iteration count**: Handoffs before task complete
3. **Token efficiency**: Tokens per successful task
4. **Code review pass rate**: Implementations passing review first time
5. **Pattern compliance**: Adherence to documented patterns

---

## Real-World Example: Pre-Commit Hook Enhancement (Phase 2)

### Task Assignment

```markdown
## Task: Implement Phase 2 Data Integrity Checks

### Context
We're enhancing the pre-commit hook with data integrity checks.
Phase 1 (CSRF, N+1) is complete. Now implementing Phase 2.

### Specific Deliverables
1. WARNING 11: Check-then-act without SERIALIZABLE detection
2. WARNING 12: Hardcoded password lengths detection
3. WARNING 13: Hardcoded bcrypt rounds detection

### Success Criteria
- [ ] Each warning has detection pattern (grep-based)
- [ ] Each warning has clear error message with RISK, FIX, EXAMPLE
- [ ] Exemption patterns documented
- [ ] Test files excluded from detection

### Constraints
- Must use diff-based detection (staged changes only)
- Must follow existing hook structure
- Must include documentation links

### Relevant Files
- `.git/hooks/pre-commit` - Current hook implementation
- `docs/02_DATABASE_PATTERNS.md` - Transaction patterns
- `docs/04_SECURITY_PATTERNS.md` - Password security patterns

### Expected Output
Standard subagent response format (Status, Files Modified, etc.)
```

### Result

Task completed by backend-architect with:
- 3 new warnings implemented
- Bug discovered (existing bcrypt violation in server/auth.ts:161)
- Documentation created
- Testing validated

### Post-Task Improvement

Learnings codified into:
- `docs/LEARNINGS_PHASE1_PRE_COMMIT_ENHANCEMENTS.md`
- Agent configuration updates
- This delegation patterns guide

---

## Real-World Example: Phase 5 Test Quality (NEW - 2025-12-04)

### Task Assignment with Code Review Integration

```markdown
## Task: Implement Phase 5 Test Quality Checks

### Context
Phase 1-4 complete. Implementing final phase for test quality enforcement.

### Specific Deliverables
1. WARNING 18: Test cleanup using db.delete() detection
2. WARNING 19: String numbers in test data detection

### Success Criteria
- [ ] Detection patterns target test files only
- [ ] Bypass mechanism for legitimate exceptions
- [ ] Clear error messages with concrete examples
- [ ] Hook version updated to 3.4

### Constraints
- Conservative detection (may have false positives)
- Must provide bypass pattern for edge cases
- Test files scanned with find + grep combination
```

### Implementation Flow

```
1. backend-architect implements initial version (v3.4)
2. Orchestrator invokes code-review-specialist
3. Review feedback:
   - WARNING 18: Add bypass for delete functionality tests
   - WARNING 19: Tighten regex from price.*['"]) to price\s*:\s*['"]
4. backend-architect refines patterns (v3.4.1)
5. Review score: 9/10 (Production Ready)
```

### Key Success Factors

**1. Iterative Refinement:**
Initial implementation (v3.4) improved to (v3.4.1) based on review feedback.

**2. Conservative Detection with Bypass:**
```bash
# Detection
VIOLATIONS=$(grep -n "await db\.delete" "$file" | \
  grep -v "Testing delete functionality")

# Bypass documentation in error message
echo "  BYPASS: Add comment '// Testing delete functionality' if intentional"
```

**3. Pattern Precision Evolution:**
```bash
# Initial (broad): price.*['\"][0-9]
# Refined (specific): price\s*:\s*['\"][0-9]  # Field boundary anchors
```

**4. Error Message Structure:**
Every warning includes:
- RISK: Why this matters
- VIOLATIONS FOUND: Specific instances
- FIX: Concrete solution with code examples
- WHY: Benefits of the fix
- BYPASS: How to handle legitimate exceptions
- DOCS: Link to pattern documentation

### Lessons Codified

1. **Code review integration is valuable**
   - Initial implementation improved from feedback
   - Version increments track improvements (3.4 -> 3.4.1)
   - Review score provides objective quality measure

2. **Conservative detection is safer**
   - Better to flag false positives with bypass mechanism
   - Than miss true positives without bypass
   - User education happens through clear error messages

3. **Field boundary anchors reduce noise**
   - `price.*` catches too much (URLs, descriptions)
   - `price\s*:\s*` catches only field assignments
   - Regex precision is worth the complexity

---

## Summary

Effective subagent delegation:
1. **Matches task to domain expertise**
2. **Provides complete context without overload**
3. **Specifies clear success criteria**
4. **Uses structured handoff templates**
5. **Includes quality assurance loops**
6. **Recovers gracefully from failures**
7. **Tracks metrics for improvement**

When delegation works well, complex multi-domain tasks complete efficiently with high quality. When it doesn't, analyze patterns and refine the approach.

---

**Document Version:** 1.1
**Last Updated:** 2025-12-04
**Status:** Active guidance for orchestrator
**Changes in v1.1:**
- Added Phase 5 Test Quality real-world example
- Documented code review integration workflow
- Added pattern precision evolution learnings
- Expanded error message structure guidance
