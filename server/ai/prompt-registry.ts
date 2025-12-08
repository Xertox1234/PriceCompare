/**
 * Prompt Registry and Versioning System
 *
 * This module provides centralized management for all AI prompts with:
 * - Version tracking for A/B testing
 * - Prompt metadata and documentation
 * - Easy rollback to previous versions
 * - Performance comparison between versions
 */

export interface PromptVersion {
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  metadata: {
    author: string;
    description: string;
    createdAt: Date;
    tags: string[];
    temperature: number;
    maxTokens: number;
    model: string;
  };
  performance?: {
    avgLatency?: number;
    avgQualityScore?: number;
    totalExecutions?: number;
    successRate?: number;
  };
}

export interface PromptRegistry {
  [promptName: string]: {
    active: string; // Active version ID
    versions: {
      [version: string]: PromptVersion;
    };
  };
}

/**
 * Central registry of all AI prompts
 */
export const promptRegistry: PromptRegistry = {
  'search-query-generation': {
    active: 'v2.0.0',
    versions: {
      'v1.0.0': {
        version: 'v1.0.0',
        systemPrompt: 'You are an expert in e-commerce search optimization and product discovery.',
        userPromptTemplate: `Generate 3-5 optimized search queries for finding "{{productName}}" on e-commerce websites.`,
        metadata: {
          author: 'original',
          description: 'Original basic prompt',
          createdAt: new Date('2024-01-01'),
          tags: ['legacy', 'deprecated'],
          temperature: 0.3,
          maxTokens: 200,
          model: 'gpt-4o-mini',
        },
        performance: {
          avgLatency: 1500,
          avgQualityScore: 0.65,
          totalExecutions: 1200,
          successRate: 0.92,
        },
      },
      'v2.0.0': {
        version: 'v2.0.0',
        systemPrompt: `You are an expert e-commerce search optimization specialist with deep knowledge of product discovery patterns across major retailers (Amazon, Walmart, Target).

EXPERTISE:
- Understanding of retailer-specific search algorithms and ranking factors
- Knowledge of how customers search for products (both expert and novice behaviors)
- Expertise in query expansion, semantic matching, and search intent analysis
- Understanding of product taxonomy and category-specific terminology

METHODOLOGY:
1. Analyze the product name for brand, model, category, and features
2. Generate queries that balance specificity (precision) with discoverability (recall)
3. Consider multiple search intents: brand-focused, feature-focused, price-focused
4. Use terminology that matches actual product listings (scrape-friendly terms)
5. Avoid ambiguous terms that could match unrelated products

QUALITY CRITERIA:
- Each query should be actionable and likely to return relevant results
- Queries should be diverse (don't repeat the same pattern 5 times)
- Prioritize queries that work across multiple retailers
- Use common misspellings only if they're widespread

OUTPUT CONSTRAINTS:
- Return EXACTLY 3-5 queries (prefer 5 when possible)
- One query per line, no formatting
- Each query: 2-8 words
- Use natural search syntax (how humans actually search)
- No quotes, no special operators, no Boolean logic`,
        userPromptTemplate: `Generate 3-5 optimized search queries for finding "{{productName}}" on e-commerce websites.
{{#if category}}Product Category: {{category}}{{/if}}

TARGET RETAILERS: Amazon, Walmart, Target

OBJECTIVE: Create search queries that maximize product discovery while maintaining high precision.

QUERY VARIATIONS TO INCLUDE:
1. Exact brand + model (if applicable): "Apple iPhone 15 Pro"
2. Generic category search: "smartphone flagship unlocked"
3. Feature-based search: "phone 5G camera 256GB"
4. Price-conscious search: "best value [product] 2024"

OPTIMIZATION RULES:
- Include brand name variations (e.g., "Instant Pot" vs "instant pressure cooker")
- Add common specifications (size, capacity, model numbers)
- Use terms that appear in product titles (not marketing speak)
- Include both formal and colloquial terms
- Consider seasonal variants if relevant
- Avoid overly specific queries that yield zero results
- Prioritize queries that return 10-100 results (not too broad, not too narrow)

OUTPUT FORMAT:
Return ONLY the search queries, one per line.
No numbering, no bullet points, no explanations.
Each query should be 2-8 words.

EXAMPLE INPUT: "Sony WH-1000XM5 Headphones"
EXAMPLE OUTPUT:
Sony WH-1000XM5
Sony wireless noise cancelling headphones
WH1000XM5 bluetooth headphones
Sony premium over ear headphones
noise cancelling headphones wireless`,
        metadata: {
          author: 'claude',
          description: 'Comprehensive prompt with detailed methodology and examples',
          createdAt: new Date('2024-11-09'),
          tags: ['production', 'active', 'improved'],
          temperature: 0.3,
          maxTokens: 200,
          model: 'gpt-4o-mini',
        },
      },
    },
  },

  'product-trend-analysis': {
    active: 'v2.0.0',
    versions: {
      'v1.0.0': {
        version: 'v1.0.0',
        systemPrompt:
          'You are an expert e-commerce analyst specializing in product trend analysis and categorization.',
        userPromptTemplate: `Analyze these trending search queries and product mentions for an e-commerce price comparison platform.`,
        metadata: {
          author: 'original',
          description: 'Original basic prompt',
          createdAt: new Date('2024-01-01'),
          tags: ['legacy', 'deprecated'],
          temperature: 0.1,
          maxTokens: 2000,
          model: 'gpt-4o-mini',
        },
        performance: {
          avgLatency: 2800,
          avgQualityScore: 0.68,
          totalExecutions: 450,
          successRate: 0.85,
        },
      },
      'v2.0.0': {
        version: 'v2.0.0',
        systemPrompt: `You are a senior e-commerce product analyst with 10+ years of experience in trend analysis, product categorization, and market research for price comparison platforms.

CORE COMPETENCIES:
- Product taxonomy and classification across retail categories
- Market trend analysis and commercial viability assessment
- Understanding of retail inventory systems and product standardization
- Knowledge of what products are sold across multiple major retailers
- Expertise in distinguishing products from services, events, and concepts

ANALYTICAL FRAMEWORK:
1. Evaluate commercial viability (Can this be price compared?)
2. Assess specificity (Is this a specific product or vague concept?)
3. Verify multi-retailer availability (Sold by 2+ major retailers?)
4. Normalize naming conventions (Standardize for searchability)
5. Categorize using established retail taxonomy
6. Score confidence based on clarity and market presence

DECISION-MAKING PRINCIPLES:
- Be conservative: When in doubt, mark isProduct=false
- Prioritize precision over recall (better to miss trends than add noise)
- Consider the end user (price-conscious shoppers need specific products)
- Reject trending topics, events, services, and vague searches
- Only accept trends that map to clear, purchasable products

OUTPUT QUALITY STANDARDS:
- JSON must be valid and parseable (no syntax errors)
- All required fields must be present
- Categories must exactly match the provided list
- Normalized names must be searchable on e-commerce sites
- Confidence scores must reflect true commercial viability
- Reasons must be concise, factual, and actionable

CRITICAL: You must return ONLY valid JSON. No markdown, no explanation, no code blocks. Just the JSON array.`,
        userPromptTemplate: `TASK: Analyze trending search queries and identify commercially viable products for a price comparison platform.

CONTEXT:
- Platform: Multi-retailer price comparison (Amazon, Walmart, Target, etc.)
- Goal: Identify real, purchasable products suitable for price tracking
- Users: Price-conscious shoppers comparing prices across retailers

TRENDING ITEMS TO ANALYZE:
{{trends}}

[Full prompt template - see discovery-agent.ts for complete version]`,
        metadata: {
          author: 'claude',
          description: 'Senior analyst persona with comprehensive analytical framework',
          createdAt: new Date('2024-11-09'),
          tags: ['production', 'active', 'improved'],
          temperature: 0.1,
          maxTokens: 2000,
          model: 'gpt-4o-mini',
        },
      },
    },
  },

  'search-suggestions': {
    active: 'v2.0.0',
    versions: {
      'v1.0.0': {
        version: 'v1.0.0',
        systemPrompt:
          'You are a helpful assistant that suggests product search queries. Return only product names or brands, one per line, no explanations.',
        userPromptTemplate: 'Suggest 3 related product search queries for: "{{query}}"',
        metadata: {
          author: 'original',
          description: 'Original minimal prompt',
          createdAt: new Date('2024-01-01'),
          tags: ['legacy', 'deprecated'],
          temperature: 0.7,
          maxTokens: 100,
          model: 'gpt-4o-mini',
        },
        performance: {
          avgLatency: 800,
          avgQualityScore: 0.6,
          totalExecutions: 3200,
          successRate: 0.95,
        },
      },
      'v2.0.0': {
        version: 'v2.0.0',
        systemPrompt: `You are an expert product search assistant for a price comparison platform. Your role is to help users discover relevant product alternatives and related items they can compare prices for.

EXPERTISE:
- Understanding of product relationships (alternatives, complements, upgrades)
- Knowledge of major brands and product lines across categories
- Insight into what customers typically compare when shopping
- Understanding of product features and specifications that matter for comparison

SUGGESTION STRATEGY:
1. ALTERNATIVE PRODUCTS: Similar products from different brands
2. RELATED MODELS: Different versions/models in the same product line
3. COMPLEMENTARY PRODUCTS: Items commonly purchased together
4. UPGRADE/DOWNGRADE OPTIONS: Higher or lower tier products

QUALITY CRITERIA:
- All suggestions must be real, purchasable products (not generic categories)
- Suggestions should be price-comparable across multiple retailers
- Maintain relevance to the original query (same category or use case)
- Prioritize popular, well-known products that users can easily find
- Ensure suggestions are diverse (don't suggest 3 variations of the same thing)

OUTPUT CONSTRAINTS:
- Return EXACTLY 3 suggestions
- One suggestion per line
- No numbering, bullets, or explanations
- Each suggestion: 2-6 words
- Use specific product names, not vague categories
- Format: [Brand] [Product Name] [Model if applicable]`,
        userPromptTemplate: `TASK: Suggest 3 related product search queries for the following user search.

USER SEARCH: "{{query}}"

CONTEXT: User is on a price comparison platform comparing prices across Amazon, Walmart, Target, and other major retailers.

GOAL: Help the user discover related products they might want to compare prices for.

REQUIREMENTS:
- Suggest real, specific products (not generic categories)
- Ensure products are available at multiple major retailers
- Make suggestions relevant and useful for price comparison
- Consider: alternatives, related models, complementary items, or different tiers

Return only 3 product names, one per line, no formatting or explanations.`,
        metadata: {
          author: 'claude',
          description: 'Expert search assistant with 4 suggestion strategies',
          createdAt: new Date('2024-11-09'),
          tags: ['production', 'active', 'improved'],
          temperature: 0.7,
          maxTokens: 100,
          model: 'gpt-4o-mini',
        },
      },
    },
  },
};

/**
 * Get the active version of a prompt
 */
export function getActivePrompt(promptName: string): PromptVersion | null {
  const prompt = promptRegistry[promptName];
  if (!prompt) return null;

  return prompt.versions[prompt.active] || null;
}

/**
 * Get a specific version of a prompt
 */
export function getPromptVersion(promptName: string, version: string): PromptVersion | null {
  const prompt = promptRegistry[promptName];
  if (!prompt) return null;

  return prompt.versions[version] || null;
}

/**
 * Set the active version of a prompt (for A/B testing)
 */
export function setActivePromptVersion(promptName: string, version: string): boolean {
  const prompt = promptRegistry[promptName];
  if (!prompt || !prompt.versions[version]) {
    return false;
  }

  prompt.active = version;
  return true;
}

/**
 * Simple template renderer (supports {{variable}} and {{#if}})
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let rendered = template;

  // Replace simple variables {{key}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, String(value || ''));
  }

  // Handle conditional blocks {{#if key}}...{{/if}}
  rendered = rendered.replace(
    /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g,
    (_match, key: string, content: string) => {
      return variables[key] ? content : '';
    }
  );

  return rendered;
}

/**
 * Update performance metrics for a prompt version
 */
export function updatePromptPerformance(
  promptName: string,
  version: string,
  metrics: Partial<PromptVersion['performance']>
): void {
  const prompt = promptRegistry[promptName];
  if (!prompt || !prompt.versions[version]) return;

  const promptVersion = prompt.versions[version];
  if (!promptVersion.performance) {
    promptVersion.performance = {};
  }

  Object.assign(promptVersion.performance, metrics);
}

/**
 * Compare performance between prompt versions
 */
export function comparePromptVersions(
  promptName: string,
  version1: string,
  version2: string
): {
  version1: PromptVersion['performance'];
  version2: PromptVersion['performance'];
  comparison: {
    latencyDiff: number;
    qualityDiff: number;
    successRateDiff: number;
  };
} | null {
  const v1 = getPromptVersion(promptName, version1);
  const v2 = getPromptVersion(promptName, version2);

  if (!v1 || !v2 || !v1.performance || !v2.performance) {
    return null;
  }

  return {
    version1: v1.performance,
    version2: v2.performance,
    comparison: {
      latencyDiff: (v2.performance.avgLatency || 0) - (v1.performance.avgLatency || 0),
      qualityDiff: (v2.performance.avgQualityScore || 0) - (v1.performance.avgQualityScore || 0),
      successRateDiff: (v2.performance.successRate || 0) - (v1.performance.successRate || 0),
    },
  };
}
