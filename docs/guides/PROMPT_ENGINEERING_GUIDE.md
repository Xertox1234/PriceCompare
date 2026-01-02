# Prompt Engineering Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Core Principles](#core-principles)
3. [Prompt Structure](#prompt-structure)
4. [Best Practices](#best-practices)
5. [Versioning and Testing](#versioning-and-testing)
6. [Common Patterns](#common-patterns)
7. [Troubleshooting](#troubleshooting)
8. [Examples](#examples)

---

## Introduction

This guide provides standards and best practices for engineering AI prompts in the PriceCompare platform. All prompts should follow these guidelines to ensure consistency, quality, and maintainability.

### Why Prompt Engineering Matters

- **Consistency**: Well-engineered prompts produce predictable, reliable outputs
- **Cost Efficiency**: Better prompts require fewer retries and less post-processing
- **Maintenance**: Structured prompts are easier to update and improve
- **Quality**: Detailed instructions lead to higher quality AI responses

---

## Core Principles

### 1. Clarity Over Brevity

❌ **Bad**: "Analyze these products"

✅ **Good**: "Analyze these trending search queries and identify commercially viable products for a price comparison platform. For each item, determine if it's a real product suitable for price comparison."

**Why**: LLMs perform better with explicit, detailed instructions.

### 2. Structure Everything

Use clear sections with headers:
- **TASK**: What needs to be done
- **CONTEXT**: Business domain and use case
- **CRITERIA**: Evaluation standards
- **OUTPUT**: Expected format and constraints
- **EXAMPLES**: Few-shot demonstrations

### 3. Define Expertise

Always define the AI's role with specific expertise:

❌ **Bad**: "You are helpful"

✅ **Good**: "You are a senior e-commerce product analyst with 10+ years of experience in trend analysis, product categorization, and market research for price comparison platforms."

### 4. Show, Don't Just Tell

Include 2-3 examples of desired outputs (few-shot learning):

```
EXAMPLE INPUT: "Sony WH-1000XM5 Headphones"
EXAMPLE OUTPUT:
Sony WH-1000XM5
Sony wireless noise cancelling headphones
WH1000XM5 bluetooth headphones
```

### 5. Constrain Outputs Explicitly

Specify exact format requirements:
- Length constraints (min/max)
- Format (JSON, plain text, structured)
- Number of items
- Prohibited content

---

## Prompt Structure

### Complete Prompt Anatomy

```
[SYSTEM PROMPT]
You are [ROLE] with [EXPERTISE].

[COMPETENCIES]
- Competency 1
- Competency 2
- Competency 3

[METHODOLOGY]
1. Step 1
2. Step 2
3. Step 3

[PRINCIPLES]
- Principle 1
- Principle 2

[QUALITY STANDARDS]
- Standard 1
- Standard 2

[USER PROMPT]
TASK: [Clear description]

CONTEXT:
- Context item 1
- Context item 2

INPUT:
[User's actual input]

CRITERIA:
1. [Criterion with examples]
2. [Criterion with examples]

OUTPUT FORMAT:
[Exact specification]

EXAMPLES:

Input: [Example 1 input]
Output: [Example 1 output]

Input: [Example 2 input]
Output: [Example 2 output]
```

### Sections Explained

#### System Prompt
- Defines the AI's role and expertise
- Sets the context for all interactions
- Should be stable across many queries

#### User Prompt
- Contains the specific task
- Includes variable data (user input)
- Provides context and criteria

---

## Best Practices

### 1. Use Hierarchical Structure

```
LEVEL 1: MAJOR SECTIONS (ALL CAPS)
   Level 2: Subsections (Title Case)
   - Level 3: Details (list items)
```

### 2. Be Specific About Edge Cases

```
PRODUCT SUITABILITY:
✓ YES if: Physical product, sold by multiple retailers
✗ NO if: Service, subscription, event, vague concept

Examples:
- "iPhone 15 Pro" → YES (product)
- "Black Friday deals" → NO (event)
- "Apple" → NO (brand only)
```

### 3. Provide Constraints for Lists

```
OUTPUT CONSTRAINTS:
- Return EXACTLY 3-5 queries (prefer 5 when possible)
- One query per line, no formatting
- Each query: 2-8 words
- No quotes, no special operators
```

### 4. Use Templates for Repeated Patterns

Store prompts in `prompt-registry.ts` with variable placeholders:

```typescript
userPromptTemplate: `Analyze "{{productName}}" in category {{category}}`
```

### 5. Version Your Prompts

Every significant change should create a new version:

```typescript
{
  'v2.0.0': {
    version: 'v2.0.0',
    systemPrompt: '...',
    metadata: {
      author: 'your-name',
      description: 'Added edge case handling',
      createdAt: new Date(),
      tags: ['production']
    }
  }
}
```

---

## Versioning and Testing

### Semantic Versioning

- **Major (x.0.0)**: Complete rewrite, different approach
- **Minor (1.x.0)**: Significant improvements, new sections
- **Patch (1.0.x)**: Small tweaks, typo fixes

### Before Deploying New Versions

1. **Create version in prompt-registry.ts**
2. **Write tests** in `__tests__/prompt-outputs.test.ts`
3. **Run validation** against schema
4. **Compare performance** with previous version
5. **A/B test** in production (50/50 split)
6. **Monitor metrics** for 48 hours
7. **Rollback if needed** using `setActivePromptVersion()`

### Testing Checklist

- [ ] Output validates against schema
- [ ] Edge cases handled correctly
- [ ] Performance within acceptable range (< 2s latency)
- [ ] Cost per execution reasonable
- [ ] Quality score > 70/100

---

## Common Patterns

### Pattern 1: Classification Tasks

Use explicit categories with examples:

```
CATEGORIES (must use EXACT values):
- Electronics (phones, laptops, TVs)
- Home & Kitchen (appliances, cookware)
- Fashion & Apparel (clothing, shoes)

EXAMPLES:
"iPhone 15" → Electronics
"Air Fryer" → Home & Kitchen
```

### Pattern 2: Generation Tasks

Provide multiple variation strategies:

```
QUERY VARIATIONS:
1. Exact brand + model: "Apple iPhone 15 Pro"
2. Generic category: "smartphone flagship"
3. Feature-based: "phone 5G camera 256GB"
```

### Pattern 3: Scoring Tasks

Define clear scoring rubrics:

```
CONFIDENCE SCORE (0-100):
90-100: Specific product, confirmed multi-retailer
70-89: Clear product, variant unclear
50-69: Category clear, item needs research
30-49: Ambiguous
0-29: Likely not a product
```

### Pattern 4: JSON Output

Always emphasize JSON requirements:

```
OUTPUT FORMAT:
Return valid JSON array (no markdown, no code blocks).

CRITICAL: Return ONLY valid JSON.
No markdown, no explanation, just the JSON array.
```

---

## Troubleshooting

### Problem: Inconsistent Output Format

**Solution**: Add explicit format constraints and examples

```
OUTPUT FORMAT:
Return ONLY the queries, one per line.
No numbering, no bullet points, no explanations.

BAD: "1. Sony headphones"
GOOD: "Sony headphones"
```

### Problem: Low Quality Responses

**Solutions**:
1. Add more examples (few-shot learning)
2. Define quality criteria explicitly
3. Increase temperature for creativity (0.7+)
4. Decrease temperature for consistency (0.1-0.3)

### Problem: Wrong Categories

**Solution**: Enumerate all valid options

```
CATEGORY (must be ONE of the following):
- Electronics
- Home & Kitchen
- Fashion & Apparel
[...full list...]

Invalid examples:
❌ "Tech" (use "Electronics")
❌ "Kitchen" (use "Home & Kitchen")
```

### Problem: Output Too Verbose

**Solution**: Add length constraints

```
CONSTRAINTS:
- Each query: 2-8 words
- Reason: max 15 words
- No explanations or commentary
```

### Problem: Hallucinated Data

**Solution**: Ground in examples and context

```
IMPORTANT: Suggest only REAL products that are:
- Sold by major retailers (Amazon, Walmart, Target)
- Widely available (not limited editions)
- Currently in production

Do NOT invent product names or models.
```

---

## Examples

### Example 1: Search Query Generation

```typescript
// System Prompt
const systemPrompt = `You are an expert e-commerce search optimization specialist.

EXPERTISE:
- Retailer search algorithms and ranking factors
- Customer search behavior patterns
- Query expansion and semantic matching

METHODOLOGY:
1. Analyze product name for brand, model, features
2. Generate queries balancing specificity and discoverability
3. Consider multiple intents: brand, feature, price-focused

QUALITY CRITERIA:
- Each query actionable and relevant
- Queries diverse (not repetitive)
- Works across multiple retailers`;

// User Prompt
const userPrompt = `Generate 3-5 optimized search queries for "{{productName}}".

OBJECTIVE: Maximize product discovery while maintaining precision.

QUERY VARIATIONS:
1. Exact brand + model
2. Generic category search
3. Feature-based search

OUTPUT FORMAT:
Return ONLY queries, one per line.
Each query: 2-8 words.

EXAMPLE:
Sony WH-1000XM5
Sony wireless noise cancelling headphones
WH1000XM5 bluetooth`;
```

### Example 2: Product Classification

```typescript
const systemPrompt = `You are a senior e-commerce product analyst.

CORE COMPETENCIES:
- Product taxonomy and classification
- Commercial viability assessment
- Multi-retailer product knowledge

ANALYTICAL FRAMEWORK:
1. Evaluate commercial viability
2. Assess specificity
3. Verify multi-retailer availability
4. Normalize naming conventions

DECISION PRINCIPLES:
- Conservative: When in doubt, mark as non-product
- Precision over recall
- Focus on price-comparable items`;

const userPrompt = `Classify trending items as products or non-products.

PRODUCT CRITERIA:
✓ YES: Physical product, multi-retailer, standardized pricing
✗ NO: Service, event, vague concept, brand-only

CATEGORIES (exact):
- Electronics
- Home & Kitchen
- Fashion & Apparel
[...etc...]

OUTPUT: Valid JSON array

EXAMPLES:
{
  "originalQuery": "iPhone 15 Pro",
  "category": "Electronics",
  "isProduct": true,
  "confidence": 95
}`;
```

---

## Metrics and Monitoring

### Key Metrics to Track

1. **Latency**: Response time (target: < 2s)
2. **Quality Score**: Validation + latency + output quality (target: > 70/100)
3. **Success Rate**: Valid outputs / total attempts (target: > 95%)
4. **Token Usage**: Input + output tokens
5. **Estimated Cost**: Per execution

### Monitoring in Code

```typescript
import { promptMonitor } from '../ai/prompt-monitoring';

// Start tracking
promptMonitor.startExecution('search-query-generation', 'v2.0.0', 'gpt-4o-mini');

// ... execute prompt ...

// Complete tracking
promptMonitor.completeExecution('search-query-generation', true, {
  inputTokens: 150,
  outputTokens: 75,
  qualityScore: 85,
  validationPassed: true
});
```

---

## Checklist for New Prompts

Before deploying a new AI prompt:

- [ ] Defined clear role and expertise
- [ ] Structured with proper sections
- [ ] Included 2-3 examples
- [ ] Specified exact output format
- [ ] Listed all valid categories/options
- [ ] Added edge case handling
- [ ] Created schema validation
- [ ] Written unit tests
- [ ] Registered in prompt-registry.ts
- [ ] Set appropriate temperature
- [ ] Defined max_tokens limit
- [ ] Added monitoring hooks
- [ ] Documented in this guide

---

## Resources

- **Prompt Registry**: `/server/ai/prompt-registry.ts`
- **Validation**: `/server/ai/output-validation.ts`
- **Monitoring**: `/server/ai/prompt-monitoring.ts`
- **Tests**: `/server/ai/__tests__/prompt-outputs.test.ts`

---

## Contact

For questions about prompt engineering, contact the AI/ML team or create an issue in the repository.

**Last Updated**: November 9, 2024
**Version**: 1.0.0
