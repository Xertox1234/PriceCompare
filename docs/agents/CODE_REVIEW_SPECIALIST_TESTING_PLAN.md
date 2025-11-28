# Code Review Specialist v1.1: Comprehensive Testing Plan

**Agent**: code-review-specialist-v1.1.md
**Testing Date**: 2025-11-28
**Tester**: [To be assigned]
**Status**: Ready for execution

---

## Testing Overview

**Objective**: Validate that v1.1 improvements deliver measurable benefits over v1.0 baseline without introducing regressions.

**Success Criteria**:
- ✅ User corrections drop below 10% (from 15% baseline)
- ✅ False positive rate stays <5%
- ✅ Token usage decreases by 30%+
- ✅ Actionability score improves to 9/10 (from 7/10)
- ✅ Zero critical issues missed in test scenarios

---

## Test Scenario Library (40 Total)

### Category 1: Golden Path Scenarios (10 tests)

**Purpose**: Verify agent correctly identifies and praises good patterns

#### Test 1.1: Route File with Correct Patterns
```typescript
// File: server/routes/example-correct.ts
import { parseIntSafe } from '../utils/validation-helpers';
import { createErrorResponse } from '../utils/error-sanitizer';
import { storage } from '../storage';
import { withAuth } from './helpers';
import { insertProductSchema } from '@shared/schema';

app.post('/api/products', csrfProtection, withAuth(async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    sendSuccess(res, product, 201);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'CreateProduct');
    res.status(errorResponse.status).json(errorResponse);
  }
}));
```

**Expected Output**:
- ✅ Strengths: Correct import paths, input validation, error handling, auth protection
- No critical/important issues
- Maybe 1-2 minor suggestions

**Scoring Rubric**:
- Detection (30%): Should identify NO issues (all patterns correct)
- False Positives (40%): Should NOT flag correct code as wrong
- Tone (30%): Should affirm good patterns, provide encouragement

---

#### Test 1.2: Service with Proper Storage Layer Usage
```typescript
// File: server/services/example-correct-service.ts
import { storage } from '../storage';
import { logger } from '../utils/logger';

export class ProductService {
  async getProductWithOffers(productId: number) {
    if (!productId || productId <= 0) {
      throw new Error('Invalid productId. Must be positive.');
    }

    // Use storage layer (not direct db)
    const product = await storage.getProductById(productId);
    if (!product) {
      return null;
    }

    // Batch query (not N+1)
    const offers = await storage.getProductOffers(productId);

    return {
      ...product,
      offers,
    };
  }
}
```

**Expected Output**:
- ✅ Strengths: Input validation, storage layer usage, null handling, batch query
- No issues

---

#### Test 1.3: Storage Method with Input Validation
```typescript
// File: server/storage.ts
async getPriceHistory(productId: number, days: number): Promise<PriceHistory[]> {
  // Input validation
  if (!productId || productId <= 0) {
    throw new Error(`Invalid productId: ${productId}. Must be positive.`);
  }
  if (!days || days <= 0 || days > 3650) {
    throw new Error(`Invalid days: ${days}. Must be 1-3650.`);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Type assertion: Drizzle returns timestamp as string, convert to Date
  const history = await db
    .select({
      price: priceHistory.price,
      recordedAt: priceHistory.recordedAt,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, startDate)
      )
    )
    .orderBy(desc(priceHistory.recordedAt));

  return history;
}
```

**Expected Output**:
- ✅ Strengths: Comprehensive input validation, type assertion comment, explicit field selection
- No issues

---

#### Test 1.4: Frontend Component with Design System
```typescript
// File: client/src/components/ProductCard.tsx
import { Product } from '@shared/schema';

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-primary text-white rounded-lg p-4 shadow-lg">
      <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
      <p className="text-secondary">${product.price}</p>
    </div>
  );
}
```

**Expected Output**:
- ✅ Strengths: Design tokens (bg-primary, text-secondary), proper imports
- No issues

---

#### Test 1.5: Database Migration with Transactions
```sql
-- File: migrations/001-add-categories.sql
BEGIN;

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categories_name ON categories(name);

ALTER TABLE products
  ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

COMMIT;
```

**Expected Output**:
- ✅ Strengths: Transaction boundary, index creation, proper cascade rule
- No issues

---

### Category 2: Known Issue Detection (15 tests)

**Purpose**: Verify agent catches documented anti-patterns

#### Test 2.1: N+1 Query in Loop
```typescript
// File: server/services/buggy-service.ts
async getUserWishlistItems(userId: number) {
  const items = await db.select().from(wishlistItems)
    .where(eq(wishlistItems.userId, userId));

  for (const item of items) {
    // N+1 QUERY!
    const offers = await this.getProductOffers(item.productId);
    item.offers = offers;
  }

  return items;
}
```

**Expected Output**:
- 🚨 Critical: N+1 query detected (lines X-Y)
- Pattern: DATABASE_PATTERNS.md § 3.2
- Confidence: ⬤⬤⬤⬤⬤ (100%)
- Concrete fix with batch query using inArray()

**Scoring**:
- Detection (30%): Must flag N+1 pattern
- Specificity (25%): File:line + "queries in loop"
- Actionability (25%): Show batch query alternative
- Context (20%): Reference DATABASE_PATTERNS.md

---

#### Test 2.2: Password Hash Exposure
```typescript
// File: server/routes/auth-routes.ts
app.get('/api/profile', withAuth(async (req, res) => {
  const user = await db.select().from(users)
    .where(eq(users.id, req.user!.id));
  res.json({ success: true, data: user }); // Exposes passwordHash!
}));
```

**Expected Output**:
- 🚨 Critical: Password hash exposure (line X)
- Pattern: SECURITY_PATTERNS.md § 2.1
- Priority: P0 🔴
- Show explicit field selection fix

**Scoring**:
- Detection (40%): MUST catch this (security critical)
- Severity (30%): Must be marked as CRITICAL
- Fix (30%): Explicit field list provided

---

#### Test 2.3: Missing Input Validation
```typescript
// File: server/routes/product-routes.ts
app.get('/api/products/:id', async (req, res) => {
  const id = parseInt(req.params.id); // No validation!
  const product = await storage.getProductById(id);
  res.json({ success: true, data: product });
});
```

**Expected Output**:
- 🚨 Critical: Raw parseInt without validation (line X)
- Pattern: SECURITY_PATTERNS.md
- Fix: Use parseIntSafe with min: 1 validation

---

#### Test 2.4: Incorrect Route File Import Paths
```typescript
// File: server/routes/new-route.ts
import { log } from './utils/logger'; // WRONG!
import { storage } from './storage';  // WRONG!
import { createErrorResponse } from './utils/error-sanitizer'; // WRONG!

app.get('/api/data', async (req, res) => {
  // ...
});
```

**Expected Output**:
- 🚨 Critical: Import path errors (lines 1-3)
- Reasoning trace: File in server/routes/, needs '../' prefix
- Quick fix command with sed

**Scoring**:
- Detection (25%): Must catch all 3 wrong imports
- Reasoning (30%): Show path resolution trace
- Fix (25%): Provide sed command
- Context (20%): Explain server/routes/ subdirectory pattern

---

#### Test 2.5: `any` Type Usage
```typescript
// File: server/middleware/buggy-middleware.ts
export function processData(data: any) {
  return data.map((item: any) => item.value);
}
```

**Expected Output**:
- ⚠️ Important: `any` types (lines X, Y)
- Pattern: TYPESCRIPT_PATTERNS.md
- Fix: Use proper types with generics or unknown + type guards

---

#### Test 2.6: Missing Error Sanitization
```typescript
// File: server/routes/buggy-routes.ts
app.post('/api/data', async (req, res) => {
  try {
    // ... business logic
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    }); // Exposes internals!
  }
});
```

**Expected Output**:
- 🚨 Critical: Manual error handling exposes internals (lines X-Y)
- Pattern: ERROR_HANDLING_PATTERNS.md
- Fix: 2-line createErrorResponse pattern

---

#### Test 2.7: Nested Response Wrapper
```typescript
// File: server/routes/metrics-routes.ts
app.get('/api/metrics', async (req, res) => {
  const metrics = await getMetrics();
  sendSuccess(res, {
    success: true,
    data: metrics
  }); // Double-wrapped!
});
```

**Expected Output**:
- 🚨 Critical: Nested response wrapper (line X)
- Impact: Breaks API contract, frontend needs .data.data
- Fix: Pass metrics directly to sendSuccess

---

#### Test 2.8: Raw parseInt() Usage
```typescript
// File: server/routes/pagination-route.ts
app.get('/api/items', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  // ... use page and limit
});
```

**Expected Output**:
- 🚨 Critical: Raw parseInt/Number (lines X, Y)
- Fix: parseIntSafe and parseIntOptional with validation

---

#### Test 2.9: Missing Transaction Boundaries
```typescript
// File: server/services/user-service.ts
async suspendUser(userId: number, reason: string) {
  await db.update(users)
    .set({ isSuspended: true })
    .where(eq(users.id, userId));

  await db.insert(notifications).values({
    userId,
    type: 'moderation',
    content: reason
  });
  // Not atomic! Notification could fail after suspension.
}
```

**Expected Output**:
- 🚨 Critical: Missing transaction boundary (lines X-Y)
- Pattern: DATABASE_PATTERNS.md § 5
- Fix: Wrap in db.transaction()

---

#### Test 2.10: SQL Injection Risk
```typescript
// File: server/routes/search-routes.ts
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  // Vulnerable!
  const results = await db.raw(`SELECT * FROM products WHERE name LIKE '%${query}%'`);
  res.json({ results });
});
```

**Expected Output**:
- 🚨 Critical: SQL injection vulnerability (line X)
- Fix: Use parameterized query with Drizzle

---

#### Test 2.11-2.15: Additional Issues
- Test 2.11: Missing CSRF protection
- Test 2.12: Cache-before-limit violation
- Test 2.13: Incorrect Redis client usage
- Test 2.14: Missing type assertion comments
- Test 2.15: Optional vs required parameter ambiguity

---

### Category 3: Edge Cases (10 tests)

**Purpose**: Test agent's handling of complex or ambiguous scenarios

#### Test 3.1: Multiple Pattern Violations in One File
```typescript
// File: server/routes/complex-buggy.ts
import { log } from './utils/logger'; // Wrong import

app.post('/api/process', async (req, res) => {
  const id = parseInt(req.params.id); // Raw parseInt

  const items = await db.select().from(items); // SELECT *
  for (const item of items) {
    await processItem(item.id); // N+1 query
  }

  try {
    // ... logic
  } catch (error) {
    res.status(500).json({ error: error.message }); // Raw error
  }
});
```

**Expected Output**:
- 🚨 Critical Issues: 5 violations found
  1. Import path (line X)
  2. Raw parseInt (line Y)
  3. SELECT * without fields (line Z)
  4. N+1 query (lines A-B)
  5. Raw error exposure (line C)
- Prioritized by severity (security > performance > style)
- Comprehensive fixes for each

**Scoring**:
- Detection (40%): Must find ALL 5 issues
- Prioritization (30%): Correct severity levels
- Completeness (30%): All issues addressed

---

#### Test 3.2: File with Zero Issues
```typescript
// File: server/routes/perfect-route.ts
import { parseIntSafe } from '../utils/validation-helpers';
import { createErrorResponse } from '../utils/error-sanitizer';
import { storage } from '../storage';
import { withAuth } from './helpers';

app.get('/api/data/:id', csrfProtection, withAuth(async (req, res) => {
  try {
    const id = parseIntSafe(req.params.id, 'id', { min: 1 });
    const data = await storage.getDataById(id);
    if (!data) {
      sendError(res, 'Data not found', 404);
      return;
    }
    sendSuccess(res, data);
  } catch (error) {
    const errorResponse = createErrorResponse(error, 'GetData');
    res.status(errorResponse.status).json(errorResponse);
  }
}));
```

**Expected Output**:
- ✅ Strengths: [List all good patterns]
- No critical/important issues
- Affirm: "This code exemplifies project standards"

**Scoring**:
- False Positives (50%): MUST NOT flag correct code
- Affirmation (30%): Should praise good patterns
- Tone (20%): Encouraging, educational

---

#### Test 3.3: Incomplete Code Snippet
```typescript
// Partial file provided
export async function processPayment(amount: number) {
  // Implementation missing
}
```

**Expected Output**:
- Cannot perform full review (incomplete code)
- Request: "Please provide complete implementation"
- General guidance on what to check when complete

---

#### Test 3.4: CI/Local TypeScript Discrepancy
**Context**: CI reports 72 errors, local shows 0 errors

**Expected Output**:
- Step 0 recommendation: "Run npm run check locally"
- If 0 errors locally: "CI infrastructure issue, not code issue"
- Guidance: Push minimal fix to trigger fresh CI build
- Warning: Don't refactor based on stale CI errors

---

#### Test 3.5: Acceptable Type Assertions (with Comments)
```typescript
// File: server/storage.ts
// Type assertion: Drizzle stores JSON field as unknown, cast to expected vector format
embedding: (product.embedding as number[] | null) || null,

// Type assertion: SQL count() returns string|number, safe after type guard
const count = typeof result[0]?.count === 'number' ? result[0].count : Number(result[0]?.count || 0);
```

**Expected Output**:
- ✅ Strengths: Type assertions properly documented
- No issues (comments explain why casts are safe)

---

#### Test 3.6-3.10: More Edge Cases
- Test 3.6: Complex multi-step transaction
- Test 3.7: God object refactoring PR (Phase 2 patterns)
- Test 3.8: Documented exception (price-aggregation-service.ts)
- Test 3.9: Mixed severity issues
- Test 3.10: Framework-specific patterns (Drizzle ORM)

---

### Category 4: Adversarial Tests (5 tests)

**Purpose**: Test agent's ability to catch subtle, well-hidden issues

#### Test 4.1: Bypass Pre-Commit Hook Attempt
```typescript
// File: server/routes/sneaky.ts
import { parseIntSafe } from '../utils/validation-helpers';

app.get('/api/user/:id', async (req, res) => {
  const id = parseIntSafe(req.params.id, 'id', { min: 1 });

  // Looks safe, but...
  const user = await db.select({
    id: users.id,
    username: users.username,
    email: users.email,
    // SECURITY: This is the hash, not the password
    passwordHash: users.passwordHash, // ← Sneaky!
  }).from(users).where(eq(users.id, id));

  res.json({ success: true, data: user });
});
```

**Expected Output**:
- 🚨 Critical: Password hash exposure despite comment (line X)
- Detection: Comment is misleading, still exposes passwordHash
- Note: Pre-commit hook would catch this

**Scoring**:
- Detection (60%): MUST catch despite comment
- Analysis (40%): Identify misleading comment pattern

---

#### Test 4.2: Subtle Security Vulnerability
```typescript
// File: server/routes/auth-routes.ts
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  // Validate token (seems secure)
  const resetToken = await db.select()
    .from(passwordResets)
    .where(eq(passwordResets.token, token));

  if (!resetToken) {
    return res.status(404).json({ error: 'Invalid token' });
  }

  // Update password
  await db.update(users)
    .set({ passwordHash: await bcrypt.hash(newPassword, 10) })
    .where(eq(users.email, resetToken[0].email));

  // Subtle bug: Doesn't check token expiration!
  // Doesn't delete token after use!

  res.json({ success: true });
});
```

**Expected Output**:
- 🚨 Critical: Missing token expiration check (security)
- 🚨 Critical: Token not deleted after use (replay attack)
- Pattern: SECURITY_PATTERNS.md

---

#### Test 4.3-4.5: More Adversarial Tests
- Test 4.3: Performance issue hidden in abstraction
- Test 4.4: Type safety hole using advanced TypeScript
- Test 4.5: Architecture violation disguised as valid pattern

---

## Evaluation Rubric

**For each test scenario**:

| Criterion | Weight | Scoring Guidelines |
|-----------|--------|--------------------|
| **Detection Accuracy** | 30% | Did it find all real issues? Any false positives? |
| **Actionability** | 25% | Are fixes copy-paste ready? Clear steps provided? |
| **Specificity** | 20% | File:line references? Code examples included? |
| **Context Awareness** | 15% | Pattern file citations? Project context explained? |
| **Completeness** | 10% | All relevant checks performed? Edge cases considered? |

**Scoring Scale**:
- 90-100: Excellent - Meets or exceeds all criteria
- 80-89: Good - Meets most criteria with minor gaps
- 70-79: Acceptable - Meets some criteria, room for improvement
- <70: Needs Work - Significant gaps in multiple areas

**Overall Pass Criteria**: Average score ≥85% across all 40 scenarios

---

## A/B Testing Protocol

### Setup
- **Agent A**: code-review-specialist.md (v1.0 - 763 lines)
- **Agent B**: code-review-specialist-v1.1.md (NEW - enhanced)
- **Test Set**: 40 scenarios (representative sample from above)
- **Evaluators**: 2 human reviewers (blind to version)

### Testing Procedure

**Phase 1: Randomization**
```bash
# Shuffle test order and assign to agents
for test in test_scenarios/*.ts; do
  agent=$(shuf -n 1 -e "A" "B")
  echo "$test -> Agent $agent" >> assignments.txt
done
```

**Phase 2: Agent Execution**
```bash
# Run both agents on all tests
for test in test_scenarios/*.ts; do
  run_agent_a "$test" > results/agent_a/"$(basename $test)".md
  run_agent_b "$test" > results/agent_b/"$(basename $test)".md
done
```

**Phase 3: Blind Evaluation**
```bash
# Anonymize outputs (remove version indicators)
anonymize_outputs results/agent_a/ results/blind/version_1/
anonymize_outputs results/agent_b/ results/blind/version_2/

# Evaluators score without knowing which is which
```

**Phase 4: Statistical Analysis**
```python
import scipy.stats as stats

# Compare scores
scores_a = [85, 87, 90, ...]  # From evaluator sheets
scores_b = [92, 94, 91, ...]

# Two-tailed t-test
t_stat, p_value = stats.ttest_ind(scores_a, scores_b)

# Effect size (Cohen's d)
mean_diff = np.mean(scores_b) - np.mean(scores_a)
pooled_std = np.sqrt((np.var(scores_a) + np.var(scores_b)) / 2)
cohens_d = mean_diff / pooled_std

print(f"p-value: {p_value:.4f}")
print(f"Effect size (d): {cohens_d:.2f}")
```

### Metrics to Compare

| Metric | Agent A (v1.0) | Agent B (v1.1) | Δ | Significance |
|--------|----------------|----------------|---|--------------|
| Detection Rate | ?% | ?% | ?% | p < 0.05? |
| False Positive Rate | ?% | ?% | ?% | p < 0.05? |
| Actionability Score (1-10) | ? | ? | ? | p < 0.05? |
| Token Usage (avg) | ? | ? | -?% | N/A |
| User Preference (A vs B) | ?% | ?% | ?% | Chi-square |

### Success Thresholds
- ✅ v1.1 shows ≥10% improvement in actionability score
- ✅ No degradation in detection rate (p > 0.05 for non-inferiority)
- ✅ Token usage reduction ≥30%
- ✅ User preference ≥60% for v1.1 (binomial test p < 0.05)
- ✅ Effect size (Cohen's d) ≥ 0.5 (medium effect)

---

## Execution Checklist

### Pre-Testing
- [ ] Finalize v1.1 agent file
- [ ] Create test scenario files (40 total)
- [ ] Set up evaluation spreadsheet
- [ ] Recruit 2 blind evaluators
- [ ] Prepare anonymization scripts
- [ ] Test agent invocation commands

### Testing Phase
- [ ] Run Agent A on all 40 scenarios
- [ ] Run Agent B on all 40 scenarios
- [ ] Anonymize outputs
- [ ] Distribute to evaluators
- [ ] Collect evaluation scores
- [ ] Measure token usage for each run

### Analysis Phase
- [ ] Calculate mean scores per agent
- [ ] Run statistical tests (t-test, chi-square)
- [ ] Compute effect sizes
- [ ] Analyze qualitative feedback
- [ ] Identify specific strengths/weaknesses
- [ ] Document findings

### Decision Phase
- [ ] Review results against success criteria
- [ ] Make deployment decision (deploy/iterate/rollback)
- [ ] Document lessons learned
- [ ] Update agent if needed
- [ ] Plan v1.2 improvements if applicable

---

## Evaluation Spreadsheet Template

```csv
Test ID,Category,Agent,Detection Accuracy (0-100),Actionability (1-10),Specificity (1-10),Context Awareness (1-10),Completeness (1-10),Overall Score (0-100),Notes
1.1,Golden Path,A,,,,,,,
1.1,Golden Path,B,,,,,,,
2.1,Known Issues,A,,,,,,,
2.1,Known Issues,B,,,,,,,
...
```

**Scoring Instructions for Evaluators**:
1. Detection Accuracy: % of actual issues found (0-100)
2. Actionability: Can fixes be copy-pasted? (1-10)
3. Specificity: File:line refs + code examples? (1-10)
4. Context Awareness: Pattern file citations + reasoning? (1-10)
5. Completeness: All relevant checks done? (1-10)
6. Overall Score: Weighted average per rubric

---

## Timeline

| Week | Activity | Deliverable |
|------|----------|-------------|
| Week 1 | Pre-testing setup | 40 test scenario files, evaluation spreadsheet |
| Week 2 | Agent execution | Results from both agents on all scenarios |
| Week 3 | Blind evaluation | Completed evaluation scores from 2 reviewers |
| Week 4 | Analysis & decision | Statistical analysis report, deployment decision |

---

## Rollback Plan

**Trigger Conditions**:
- False positive rate >5% (from <5% baseline)
- Detection rate drops (statistically significant decrease)
- User preference <50% for v1.1
- Token usage increases instead of decreases
- Critical issues missed in adversarial tests

**Rollback Procedure**:
1. **Immediate**: Revert to v1.0 agent file
2. **Analyze**: Review where v1.1 failed
   - Was it CoT reasoning? (too verbose, wrong conclusions)
   - Was it few-shot examples? (misleading, incorrect patterns)
   - Was it constitutional checks? (too strict, false positives)
   - Was it context loading? (missed important patterns)
3. **Isolate**: Test problematic component separately
4. **Fix**: Address root cause in controlled environment
5. **Retest**: Run mini A/B on fixed version
6. **Redeploy**: Only after passing mini-test

---

## Expected Outcomes

### Hypothesis
v1.1 enhancements will result in:
- **Higher actionability**: +30% due to comprehensive few-shot examples
- **Lower token usage**: -40% due to dynamic module loading
- **Better reasoning**: +20% clarity from explicit chain-of-thought
- **Fewer corrections**: -33% (from 15% to 10%) due to constitutional self-checks

### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|---------|------------|
| CoT too verbose | Medium | Token bloat | Limit reasoning to complex cases |
| Few-shot confusing | Low | Wrong patterns learned | Curate examples carefully |
| Constitutional too strict | Medium | False positives | Adjust thresholds based on testing |
| Module loading buggy | Low | Missed patterns | Test conditional loading thoroughly |

---

## Post-Deployment Monitoring

**After v1.1 deployment, track**:
- User corrections per review (should drop to <10%)
- Token usage per review (should be -30-40%)
- User satisfaction surveys (should improve)
- Pre-commit hook alignment (should stay 100%)
- Time to fix issues (should decrease with better guidance)

**Weekly Review**:
- Analyze correction patterns
- Identify new failure modes
- Gather user feedback
- Plan v1.2 improvements

---

## Contact & Support

**Questions about Testing Plan**:
- Review test scenarios with team before execution
- Clarify evaluation criteria with evaluators
- Adjust timeline if needed

**Feedback During Testing**:
- Document unexpected behaviors
- Note any confusion in evaluation criteria
- Suggest additional test scenarios if gaps found

---

**Status**: Ready for Execution
**Next Step**: Set up test scenario files and recruit evaluators
**Timeline**: 4 weeks from start to deployment decision
