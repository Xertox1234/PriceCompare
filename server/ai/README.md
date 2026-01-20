# AI Module Documentation

This directory contains all AI/LLM-related infrastructure for the PriceCompare platform.

## Overview

The AI module provides:

- **Prompt Versioning**: Track and manage prompt versions for A/B testing
- **Output Validation**: JSON schema validation for AI responses
- **Performance Monitoring**: Latency, quality, and cost tracking
- **Testing Framework**: Unit tests for prompt outputs

## Architecture

```
server/ai/
├── prompt-registry.ts       # Central registry of all prompts with versions
├── output-validation.ts     # JSON schema validation system
├── prompt-monitoring.ts     # Performance tracking and metrics
├── __tests__/
│   └── prompt-outputs.test.ts  # Unit tests for AI outputs
└── README.md                # This file
```

## Quick Start

### 1. Using Prompt Registry

```typescript
import { getActivePrompt, renderTemplate } from './prompt-registry';

// Get the active version of a prompt
const prompt = getActivePrompt('search-query-generation');

if (prompt) {
  // Render template with variables
  const userPrompt = renderTemplate(prompt.userPromptTemplate, {
    productName: 'iPhone 15 Pro',
    category: 'Electronics',
  });

  // Use with OpenAI
  const response = await openai.chat.completions.create({
    model: prompt.metadata.model,
    messages: [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: prompt.metadata.temperature,
    max_tokens: prompt.metadata.maxTokens,
  });
}
```

### 2. Validating AI Outputs

```typescript
import { validateOutput, parseAndValidateJSON } from './output-validation';

// Validate array of search queries
const queries = ['query 1', 'query 2', 'query 3'];
const result = validateOutput('search-queries', queries);

if (result.valid) {
  console.log('✅ Valid output:', result.data);
} else {
  console.error('❌ Validation errors:', result.errors);
}

// Parse and validate JSON from AI response
const jsonResult = parseAndValidateJSON(response.choices[0].message.content, 'trend-analysis');
```

### 3. Monitoring Performance

```typescript
import { promptMonitor } from './prompt-monitoring';

// Start tracking
promptMonitor.startExecution(
  'search-query-generation',
  'v2.0.0',
  'gpt-4o-mini',
  { inputLength: 50 }
);

try {
  // Execute your AI call
  const response = await openai.chat.completions.create({...});

  // Validate output
  const validation = validateOutput('search-queries', parseResponse(response));

  // Calculate quality score
  const qualityScore = promptMonitor.calculateQualityScore({
    validationPassed: validation.valid,
    latency: Date.now() - startTime,
    targetLatency: 2000
  });

  // Complete tracking
  promptMonitor.completeExecution('search-query-generation', true, {
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    qualityScore,
    validationPassed: validation.valid,
    validationErrors: validation.errors.length
  });

} catch (error) {
  // Track failure
  promptMonitor.completeExecution('search-query-generation', false, {
    error: (error as Error).message
  });
}
```

### 4. Viewing Metrics

```typescript
// Get summary for a prompt
const summary = promptMonitor.getSummary('search-query-generation', 'v2.0.0');
console.log(`Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
console.log(`Avg latency: ${summary.avgLatency.toFixed(0)}ms`);
console.log(`Avg quality: ${summary.avgQualityScore.toFixed(1)}/100`);
console.log(`Total cost: $${summary.estimatedTotalCost.toFixed(4)}`);

// Print full report
promptMonitor.printReport();
```

## Prompt Schemas

### search-queries

```typescript
{
  type: 'array',
  items: 'string',
  minItems: 3,
  maxItems: 5
}
```

**Example**:

```json
["Sony WH-1000XM5", "Sony wireless noise cancelling headphones", "WH1000XM5 bluetooth headphones"]
```

### trend-analysis

```typescript
{
  type: 'array',
  items: {
    type: 'object',
    required: ['originalQuery', 'normalizedName', 'category', 'confidence', 'isProduct', 'reason'],
    properties: {
      originalQuery: { type: 'string' },
      normalizedName: { type: 'string' },
      category: { type: 'string', enum: [...] },
      confidence: { type: 'number', min: 0, max: 100 },
      isProduct: { type: 'boolean' },
      reason: { type: 'string', maxLength: 200 }
    }
  }
}
```

**Example**:

```json
[
  {
    "originalQuery": "iPhone 15 Pro",
    "normalizedName": "Apple iPhone 15 Pro",
    "category": "Electronics",
    "confidence": 95,
    "isProduct": true,
    "reason": "Specific smartphone model sold by all major retailers"
  }
]
```

### search-suggestions

```typescript
{
  type: 'array',
  items: { type: 'string', minLength: 3, maxLength: 100 },
  minItems: 3,
  maxItems: 3
}
```

**Example**:

```json
["MacBook Air M2", "Dell XPS 13", "HP Spectre x360"]
```

## Versioning System

### Creating a New Version

1. **Add to prompt-registry.ts**:

```typescript
'my-prompt': {
  active: 'v1.0.0',
  versions: {
    'v1.0.0': {
      version: 'v1.0.0',
      systemPrompt: '...',
      userPromptTemplate: '...',
      metadata: {
        author: 'your-name',
        description: 'Initial version',
        createdAt: new Date(),
        tags: ['production'],
        temperature: 0.3,
        maxTokens: 200,
        model: 'gpt-4o-mini'
      }
    }
  }
}
```

2. **Add schema to output-validation.ts**:

```typescript
export const outputSchemas = {
  'my-prompt-output': {
    type: 'array',
    items: 'string',
  },
};
```

3. **Write tests in **tests**/prompt-outputs.test.ts**

4. **Test thoroughly before deploying**

### A/B Testing

```typescript
import { setActivePromptVersion, comparePromptVersions } from './prompt-registry';

// Switch 50% of traffic to new version
const useNewVersion = Math.random() < 0.5;
const version = useNewVersion ? 'v2.0.0' : 'v1.0.0';

// After collecting metrics, compare
const comparison = comparePromptVersions('search-query-generation', 'v1.0.0', 'v2.0.0');

if (comparison) {
  console.log('Latency diff:', comparison.comparison.latencyDiff);
  console.log('Quality diff:', comparison.comparison.qualityDiff);
  console.log('Success rate diff:', comparison.comparison.successRateDiff);

  // Promote if significantly better
  if (comparison.comparison.qualityDiff > 10) {
    setActivePromptVersion('search-query-generation', 'v2.0.0');
  }
}
```

## Performance Targets

| Metric           | Target       | Notes                    |
| ---------------- | ------------ | ------------------------ |
| Latency          | < 2000ms     | 95th percentile          |
| Quality Score    | > 70/100     | Validation + performance |
| Success Rate     | > 95%        | Valid outputs / total    |
| Token Efficiency | < 500 tokens | Total per execution      |
| Cost             | < $0.001     | Per execution            |

## Monitoring Dashboard

### Key Metrics

```typescript
const summary = promptMonitor.getSummary('prompt-name');

// Core metrics
summary.successRate; // 0-1 (target: > 0.95)
summary.avgLatency; // milliseconds (target: < 2000)
summary.avgQualityScore; // 0-100 (target: > 70)
summary.estimatedTotalCost; // USD
summary.totalTokens; // count

// Distribution
summary.minLatency; // fastest execution
summary.maxLatency; // slowest execution

// Volume
summary.totalExecutions; // all attempts
summary.successfulExecutions; // valid outputs
summary.failedExecutions; // errors
```

### Viewing Recent Failures

```typescript
const failures = promptMonitor.getRecentFailures(10);
failures.forEach((failure) => {
  console.log(`❌ ${failure.promptName}:`, failure.error);
});
```

## Testing

### Running Tests

```bash
npm test -- server/ai/__tests__/prompt-outputs.test.ts
```

### Writing New Tests

```typescript
import { validateOutput } from '../output-validation';

describe('My Prompt Output', () => {
  it('should validate correct output', () => {
    const output = ['item1', 'item2', 'item3'];
    const result = validateOutput('my-prompt-output', output);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid output', () => {
    const output = 'not an array';
    const result = validateOutput('my-prompt-output', output);
    expect(result.valid).toBe(false);
  });
});
```

## Best Practices

### 1. Always Validate AI Outputs

```typescript
// ❌ Bad
const queries = response.choices[0].message.content.split('\n');

// ✅ Good
const validation = parseAndValidateJSON(response.choices[0].message.content, 'search-queries');

if (!validation.valid) {
  console.error('Validation failed:', formatValidationErrors(validation.errors));
  throw new Error('Invalid AI output');
}

const queries = validation.data;
```

### 2. Always Monitor Performance

```typescript
// ❌ Bad
const response = await openai.chat.completions.create({...});

// ✅ Good
promptMonitor.startExecution('prompt-name', 'v1.0.0', 'gpt-4o-mini');

try {
  const response = await openai.chat.completions.create({...});
  const validation = validateOutput('schema-name', parseResponse(response));

  promptMonitor.completeExecution('prompt-name', true, {
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    validationPassed: validation.valid
  });
} catch (error) {
  promptMonitor.completeExecution('prompt-name', false, {
    error: (error as Error).message
  });
  throw error;
}
```

### 3. Use Versioned Prompts

```typescript
// ❌ Bad
const systemPrompt = 'You are helpful';

// ✅ Good
const prompt = getActivePrompt('search-query-generation');
const systemPrompt = prompt.systemPrompt;
```

### 4. Sanitize Outputs

```typescript
import { sanitizeOutput } from './output-validation';

// Remove markdown, trim whitespace
const clean = sanitizeOutput(rawAIOutput);
```

## Troubleshooting

### High Latency

1. Check if prompt is too long (reduce max_tokens)
2. Use faster model (gpt-4o-mini instead of gpt-4)
3. Simplify prompt complexity
4. Check OpenAI API status

### Low Quality Scores

1. Add more examples to prompt (few-shot learning)
2. Make output constraints more explicit
3. Increase temperature for creativity
4. Review validation schema (too strict?)

### Validation Failures

1. Check if AI is returning markdown code blocks
2. Verify schema matches expected output
3. Add sanitization for common issues
4. Review prompt's output format instructions

### High Costs

1. Reduce max_tokens limit
2. Use cheaper model (gpt-4o-mini)
3. Implement caching (already in place)
4. Batch requests when possible

## API Reference

See [Prompt Engineering Guide](/docs/guides/PROMPT_ENGINEERING_GUIDE.md) for detailed documentation.

## Contributing

When adding new AI features:

1. Create schema in `output-validation.ts`
2. Register prompt in `prompt-registry.ts`
3. Write tests in `__tests__/`
4. Add monitoring hooks
5. Update this README
6. Follow the [Prompt Engineering Guide](/docs/guides/PROMPT_ENGINEERING_GUIDE.md)

## License

Internal use only - PriceCompare Platform
