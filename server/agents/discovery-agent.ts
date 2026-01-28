import { BaseAgent, AgentConfig } from './base-agent';
import { storage } from '../storage';
import type { InsertTrendingProduct } from '../../shared/schema';
import type { TrendData, DiscoveryTaskData } from './types';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { safeTrendAnalysis, type AITrendAnalysis } from './ai-validation-schemas';
import { agentQueryLimiter } from '../services/agent-query-limiter';

// ============================================================================
// ELECTRONICS SCOPE CONFIGURATION
// ============================================================================
// PriceCompare is scoped to Canadian electronics price comparison.
// Only Electronics category products are processed by the discovery agent.
// This reduces API costs and focuses the product catalog on the target market.
// ============================================================================

/**
 * Allowed categories for product discovery.
 * Currently scoped to Electronics only for Canadian market focus.
 * All other categories are rejected during trend analysis.
 */
const ALLOWED_CATEGORIES = ['Electronics'] as const;
type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

/**
 * Check if a category is allowed for discovery.
 * Used to filter out non-Electronics trends.
 */
function isAllowedCategory(category: string | undefined): category is AllowedCategory {
  if (!category) return false;
  // SAFETY: Type assertion needed for .includes() on const array; function is a type guard
  return ALLOWED_CATEGORIES.includes(category as AllowedCategory);
}

// Local abstract base class for trend sources (distinct from the type in ./types)
abstract class BaseTrendSource {
  abstract getTrends(categories?: string[], limit?: number): TrendData[] | Promise<TrendData[]>;
}

export class ProductDiscoveryAgent extends BaseAgent {
  private openai: OpenAI | null = null;
  private isAIEnabled = false;
  private trendSources: Map<string, BaseTrendSource>;

  constructor() {
    const config: AgentConfig = {
      name: 'Product Discovery Agent',
      type: 'discovery',
      maxConcurrentTasks: 3,
      retryAttempts: 2,
      retryDelay: 1000,
    };

    super(config);

    // Only initialize OpenAI if API key is available (graceful degradation)
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.isAIEnabled = true;
    } else {
      logger.warn('OpenAI API key not configured - AI trend analysis disabled');
    }

    this.trendSources = new Map([
      ['google_trends', new GoogleTrendsSource()],
      ['social_media', new SocialMediaSource()],
      ['news', new NewsSource()],
      ['seasonal', new SeasonalSource()],
    ]);
  }

  async processTask(taskData: DiscoveryTaskData): Promise<TrendData[]> {
    const taskId = `discovery_${Date.now()}`;

    const result = await this.executeTask(taskId, () => this.discoverTrendingProducts(taskData), {
      jobType: 'discovery',
      targetData: JSON.stringify(taskData),
    });

    if (result.success) {
      return result.data as TrendData[];
    } else {
      throw new Error(result.error || 'Discovery task failed');
    }
  }

  private async discoverTrendingProducts(taskData: DiscoveryTaskData): Promise<TrendData[]> {
    const allTrends: TrendData[] = [];

    // ELECTRONICS SCOPE: Override categories to Electronics only
    // This ensures we only discover products relevant to Canadian electronics market
    const electronicsCategories = ['Electronics'];
    const filteredCategories =
      taskData.categories?.filter((c) => isAllowedCategory(c)) || electronicsCategories;

    if (filteredCategories.length === 0) {
      logger.info('Discovery task filtered - no allowed categories requested', {
        requestedCategories: taskData.categories,
        allowedCategories: ALLOWED_CATEGORIES,
      });
      return [];
    }

    logger.info('Discovery task starting with electronics scope', {
      requestedCategories: taskData.categories,
      filteredCategories,
      allowedCategories: ALLOWED_CATEGORIES,
    });

    // Discover trends from each requested source
    for (const sourceName of taskData.sources) {
      const source = this.trendSources.get(sourceName);
      if (!source) {
        logger.warn(`Unknown trend source: ${sourceName}`);
        continue;
      }

      try {
        const trends = await source.getTrends(filteredCategories, taskData.limit);
        allTrends.push(...trends);
      } catch (error) {
        logger.error(`Error getting trends from ${sourceName}`, {
          error: error instanceof Error ? error.message : String(error),
          sourceName,
        });
      }
    }

    // Use AI to analyze and categorize trends
    const analyzedTrends = await this.analyzeTrendsWithAI(allTrends);

    // ELECTRONICS SCOPE: Filter analyzed trends to only include Electronics category
    const electronicsTrends = analyzedTrends.filter((trend) => {
      // Get category from trend or from AI analysis metadata
      let category = trend.category;
      if (!category && trend.metadata) {
        // AI analysis stores category in metadata.aiAnalysis object
        const aiAnalysis = trend.metadata.aiAnalysis;
        if (typeof aiAnalysis === 'object' && aiAnalysis !== null && 'category' in aiAnalysis) {
          category = String((aiAnalysis as { category: unknown }).category);
        }
      }
      if (!isAllowedCategory(category)) {
        logger.debug('Trend rejected - non-Electronics category', {
          query: trend.query,
          category,
          allowedCategories: ALLOWED_CATEGORIES,
        });
        return false;
      }
      return true;
    });

    logger.info('Electronics filter applied to trends', {
      totalTrends: analyzedTrends.length,
      electronicsOnly: electronicsTrends.length,
      filtered: analyzedTrends.length - electronicsTrends.length,
    });

    // Store trending products in database
    await this.storeTrendingProducts(electronicsTrends);

    return electronicsTrends;
  }

  private async analyzeTrendsWithAI(trends: TrendData[]): Promise<TrendData[]> {
    if (trends.length === 0) return trends;

    // If AI is not enabled, return trends without AI analysis
    if (!this.isAIEnabled || !this.openai) {
      logger.debug('AI disabled, skipping trend analysis - returning raw trends', {
        trendCount: trends.length,
      });
      // Return trends as-is without AI filtering/normalization
      return trends;
    }

    try {
      const prompt = `
        TASK: Analyze trending search queries and identify commercially viable products for a price comparison platform.

        CONTEXT:
        - Platform: Multi-retailer price comparison (Amazon, Walmart, Target, etc.)
        - Goal: Identify real, purchasable products suitable for price tracking
        - Users: Price-conscious shoppers comparing prices across retailers

        TRENDING ITEMS TO ANALYZE:
        ${trends.map((t) => `- "${t.query}" (source: ${t.source}, trending score: ${t.score})`).join('\n')}

        ANALYSIS CRITERIA:

        1. PRODUCT SUITABILITY (isProduct: true/false)
           ✓ YES if: Physical product, sold by multiple retailers, has standardized pricing
           ✗ NO if: Service, subscription, location-specific, one-time event, vague concept, person/brand name only

           Examples:
           - "iPhone 15 Pro" → YES (product)
           - "Black Friday deals" → NO (event)
           - "iPhone" → NO (too vague, need specific model)
           - "Apple" → NO (brand only, not a product)
           - "Netflix subscription" → NO (service)

        2. CATEGORY ASSIGNMENT (must use EXACT categories below)
           - Electronics (phones, laptops, TVs, audio, cameras, gaming)
           - Home & Kitchen (appliances, cookware, furniture, decor)
           - Fashion & Apparel (clothing, shoes, accessories, jewelry)
           - Sports & Outdoors (fitness, camping, sports equipment)
           - Health & Beauty (skincare, cosmetics, supplements, grooming)
           - Toys & Games (kids toys, board games, collectibles)
           - Books & Media (books, movies, music)
           - Automotive (car accessories, tools, parts)
           - Office & School (supplies, desk items, organization)
           - Pet Supplies (pet food, toys, accessories)
           - Other (if truly doesn't fit above)

        3. NORMALIZED NAME (product name standardization)
           - Remove brand if too generic: "Apple Watch" → "Apple Watch Series 9"
           - Add specificity: "AirPods" → "Apple AirPods Pro 2nd Generation"
           - Remove marketing fluff: "Amazing Gaming Headset RGB" → "Gaming Headset"
           - Use standard format: "[Brand] [Product Line] [Model] [Key Feature]"
           - Keep it searchable (2-6 words)

        4. CONFIDENCE SCORE (0-100)
           90-100: Specific product model, multiple retailers confirmed sell it
           70-89: Clear product but model/variant unclear
           50-69: Product category clear but specific item needs research
           30-49: Ambiguous - could be product or something else
           0-29: Likely not a product or unsuitable for price comparison

        5. REASON (concise explanation)
           - State why it is/isn't a product
           - Note any ambiguity or concerns
           - Max 15 words

        OUTPUT FORMAT:
        Return a valid JSON array (no markdown, no code blocks, just raw JSON).

        [
          {
            "originalQuery": "exact query from input",
            "normalizedName": "standardized product name",
            "category": "exact category from list above",
            "confidence": 85,
            "isProduct": true,
            "reason": "brief explanation"
          }
        ]

        EXAMPLE ANALYSIS:

        Input: "iPhone 15 Pro trending now"
        Output:
        {
          "originalQuery": "iPhone 15 Pro trending now",
          "normalizedName": "Apple iPhone 15 Pro",
          "category": "Electronics",
          "confidence": 95,
          "isProduct": true,
          "reason": "Specific smartphone model sold by all major retailers"
        }

        Input: "Apple"
        Output:
        {
          "originalQuery": "Apple",
          "normalizedName": "",
          "category": "Electronics",
          "confidence": 20,
          "isProduct": false,
          "reason": "Brand name only, no specific product identified"
        }

        Now analyze the trending items listed above and return ONLY the JSON array.
      `;

      // Check daily query limit before making OpenAI call
      const limitResult = await agentQueryLimiter.checkAndIncrement('openai_completion');
      if (!limitResult.allowed) {
        throw new Error(`Daily agent query limit exceeded. ${limitResult.reason}`);
      }

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a senior e-commerce product analyst with 10+ years of experience in trend analysis, product categorization, and market research for price comparison platforms.

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
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      const rawResponse = response.choices[0].message.content || '[]';

      // Parse and validate AI response with Zod schema
      let aiAnalysis: AITrendAnalysis[];
      try {
        const parsed: unknown = JSON.parse(rawResponse);
        const validationResult = safeTrendAnalysis(parsed);

        if (!validationResult.success) {
          logger.error('AI response validation failed', {
            errors: validationResult.error.issues,
            rawResponse: rawResponse.substring(0, 500),
          });
          throw new Error('Invalid AI response format');
        }

        aiAnalysis = validationResult.data;
        logger.debug('AI response validated successfully', {
          validatedCount: aiAnalysis.length,
        });
      } catch (parseError) {
        logger.error('Failed to parse or validate AI response', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          rawResponse: rawResponse.substring(0, 500),
        });
        throw parseError;
      }

      // Merge AI analysis with original trend data
      const mappedTrends = trends.map((trend) => {
        const analysis = aiAnalysis.find((a) => a.originalQuery === trend.query);
        if (analysis && analysis.isProduct && analysis.confidence > 60) {
          return {
            ...trend,
            query: analysis.normalizedName,
            category: analysis.category,
            score: Math.round(trend.score * (analysis.confidence / 100)),
            metadata: {
              ...trend.metadata,
              aiAnalysis: analysis,
            },
          };
        }
        return trend;
      });
      return mappedTrends.filter((trend): trend is TrendData => {
        const aiAnalysis = trend.metadata?.aiAnalysis;
        return (
          typeof aiAnalysis === 'object' &&
          aiAnalysis !== null &&
          'isProduct' in aiAnalysis &&
          Boolean(aiAnalysis.isProduct)
        );
      });
    } catch (error) {
      logger.error('AI analysis failed, returning original trends', {
        error: error instanceof Error ? error.message : String(error),
        trendCount: trends.length,
      });
      return trends;
    }
  }

  private async storeTrendingProducts(trends: TrendData[]): Promise<void> {
    const productsToInsert: InsertTrendingProduct[] = trends.map((trend) => ({
      name: trend.query,
      category: trend.category,
      trendScore: trend.score,
      searchVolume: trend.volume,
      source: trend.source,
      sourceData: JSON.stringify(trend.metadata),
      status: 'discovered',
    }));

    if (productsToInsert.length > 0) {
      try {
        await storage.bulkCreateTrendingProducts(productsToInsert);
        logger.info(`Stored ${productsToInsert.length} trending products`);
      } catch (error) {
        logger.error('Failed to store trending products', {
          error: error instanceof Error ? error.message : String(error),
          productCount: productsToInsert.length,
        });
      }
    }
  }

  async getStoredTrendingProducts(limit = 50) {
    return storage.getTrendingProducts('discovered', limit);
  }
}

// Google Trends implementation
class GoogleTrendsSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 20): TrendData[] {
    // Note: This would require Google Trends API or web scraping
    // For now, returning simulated trending electronics products (Canadian market focus)
    const simulatedTrends: TrendData[] = [
      {
        query: 'iPhone 15 Pro',
        score: 95,
        volume: 50000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'Nintendo Switch OLED',
        score: 88,
        volume: 35000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'Samsung Galaxy S24 Ultra',
        score: 86,
        volume: 32000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'PlayStation 5',
        score: 84,
        volume: 30000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'MacBook Pro M3',
        score: 82,
        volume: 28000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'AirPods Pro 2',
        score: 80,
        volume: 26000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'Sony WH-1000XM5',
        score: 78,
        volume: 24000,
        category: 'Electronics',
        source: 'google_trends',
      },
      {
        query: 'Meta Quest 3',
        score: 76,
        volume: 22000,
        category: 'Electronics',
        source: 'google_trends',
      },
    ];

    // Filter by requested categories (should be Electronics only)
    const filtered = categories
      ? simulatedTrends.filter((t) => categories.includes(t.category || ''))
      : simulatedTrends;

    return filtered.slice(0, limit);
  }
}

// Social Media trends implementation
class SocialMediaSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 15): TrendData[] {
    // This would integrate with Twitter API, Reddit API, etc.
    // Electronics-focused trends for Canadian market
    const socialTrends: TrendData[] = [
      {
        query: 'Steam Deck OLED',
        score: 70,
        volume: 18000,
        category: 'Electronics',
        source: 'social_media',
      },
      {
        query: 'Logitech G Pro X Superlight',
        score: 65,
        volume: 15000,
        category: 'Electronics',
        source: 'social_media',
      },
      {
        query: 'Razer BlackWidow V4 Keyboard',
        score: 60,
        volume: 12000,
        category: 'Electronics',
        source: 'social_media',
      },
      {
        query: 'LG C4 OLED TV',
        score: 58,
        volume: 11000,
        category: 'Electronics',
        source: 'social_media',
      },
    ];

    // Filter by requested categories (should be Electronics only)
    const filtered = categories
      ? socialTrends.filter((t) => categories.includes(t.category || ''))
      : socialTrends;

    return filtered.slice(0, limit);
  }
}

// News source implementation
class NewsSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 10): TrendData[] {
    // This would integrate with News API
    // Electronics-focused news trends
    const newsTrends: TrendData[] = [
      {
        query: 'Apple Vision Pro',
        score: 85,
        volume: 30000,
        category: 'Electronics',
        source: 'news',
      },
      {
        query: 'Samsung Galaxy Z Fold5',
        score: 82,
        volume: 28000,
        category: 'Electronics',
        source: 'news',
      },
      {
        query: 'Google Pixel 8 Pro',
        score: 80,
        volume: 26000,
        category: 'Electronics',
        source: 'news',
      },
    ];

    // Filter by requested categories (should be Electronics only)
    const filtered = categories
      ? newsTrends.filter((t) => categories.includes(t.category || ''))
      : newsTrends;

    return filtered.slice(0, limit);
  }
}

// Seasonal trends implementation
class SeasonalSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 10): TrendData[] {
    const month = new Date().getMonth();
    let seasonalTrends = this.getSeasonalProducts(month);

    // Filter by requested categories (should be Electronics only)
    if (categories) {
      seasonalTrends = seasonalTrends.filter((t) => categories.includes(t.category || ''));
    }

    return seasonalTrends.slice(0, limit);
  }

  private getSeasonalProducts(month: number): TrendData[] {
    // Electronics-focused seasonal trends for Canadian market
    const seasonalMap: Record<number, TrendData[]> = {
      11: [
        // December - Holiday season electronics
        {
          query: 'Nintendo Switch Bundle',
          score: 90,
          volume: 40000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Apple Watch Series 9',
          score: 85,
          volume: 35000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Bose QuietComfort Ultra',
          score: 82,
          volume: 30000,
          category: 'Electronics',
          source: 'seasonal',
        },
      ],
      0: [
        // January - New Year tech fitness
        {
          query: 'Fitbit Charge 6',
          score: 75,
          volume: 25000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Apple Watch SE',
          score: 72,
          volume: 22000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Samsung Galaxy Watch 6',
          score: 70,
          volume: 20000,
          category: 'Electronics',
          source: 'seasonal',
        },
      ],
      5: [
        // June - Summer tech
        {
          query: 'JBL Charge 5 Portable Speaker',
          score: 80,
          volume: 30000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'GoPro Hero 12',
          score: 78,
          volume: 28000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Sonos Roam 2',
          score: 75,
          volume: 25000,
          category: 'Electronics',
          source: 'seasonal',
        },
      ],
      8: [
        // September - Back to school
        {
          query: 'iPad 10th Generation',
          score: 85,
          volume: 35000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'MacBook Air M2',
          score: 83,
          volume: 32000,
          category: 'Electronics',
          source: 'seasonal',
        },
        {
          query: 'Dell XPS 13',
          score: 80,
          volume: 28000,
          category: 'Electronics',
          source: 'seasonal',
        },
      ],
    };

    return seasonalMap[month] || [];
  }
}
