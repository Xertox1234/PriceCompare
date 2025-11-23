---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, documentation, playwright]
dependencies: []
---

# Fix ARCHITECTURE.md - Replace Puppeteer Reference with Playwright

## Problem Statement

The `ARCHITECTURE.md` documentation incorrectly references Puppeteer for web scraping, but `CLAUDE.md` explicitly mandates that only Playwright should be used for all browser automation.

## Findings

- Discovered during comprehensive code review by Architecture Strategist agent
- Location: `ARCHITECTURE.md:180`
- Current text: `| **Puppeteer** | Web scraping | Headless Chrome, handles dynamic content |`
- CLAUDE.md states: "**NEVER use Puppeteer.** All browser automation, web scraping, and E2E testing MUST use Playwright."

## Proposed Solutions

### Option 1: Update documentation (RECOMMENDED)
- **Change:** Replace "Puppeteer" with "Playwright" in ARCHITECTURE.md
- **Pros:** Documentation matches reality and CLAUDE.md mandate
- **Cons:** None
- **Effort:** Small
- **Risk:** None

## Recommended Action

Simple text replacement in ARCHITECTURE.md line 180.

## Technical Details

- **Affected Files:** `ARCHITECTURE.md`
- **Related Components:** Documentation only
- **Database Changes:** No

### Change:
```markdown
# Before:
| **Puppeteer** | Web scraping | Headless Chrome, handles dynamic content |

# After:
| **Playwright** | Web scraping | Headless Chromium, handles dynamic content |
```

## Acceptance Criteria

- [ ] ARCHITECTURE.md updated to reference Playwright
- [ ] No other Puppeteer references exist in documentation
- [ ] Description updated if needed (Chromium vs Chrome)

## Work Log

### 2025-11-22 - Code Review Discovery
**By:** Claude Code Review System
**Actions:**
- Discovered during comprehensive code review
- Analyzed by Architecture Strategist agent
- Identified documentation inconsistency

**Learnings:**
- Documentation can drift from reality during library migrations
- Single source of truth (CLAUDE.md) should be referenced

## Notes

Source: Code review performed on 2025-11-22
Review command: /compounding-engineering:review codebase
