import { BaseAgent, AgentConfig } from './base-agent';
import { db } from '../db';
import { trendingProducts } from '../../shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { InsertTrendingProduct } from '../../shared/schema';
import type { TrendData, DiscoveryTaskData } from './types';
import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { safeTrendAnalysis, type AITrendAnalysis } from './ai-validation-schemas';
import { agentQueryLimiter } from '../services/agent-query-limiter';

// Local abstract base class for trend sources (distinct from the type in ./types)
abstract class BaseTrendSource {
  abstract getTrends(categories?: string[], limit?: number): TrendData[] | Promise<TrendData[]>;
}

export class ProductDiscoveryAgent extends BaseAgent {
  private openai: OpenAI;
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

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

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

    // Discover trends from each requested source
    for (const sourceName of taskData.sources) {
      const source = this.trendSources.get(sourceName);
      if (!source) {
        logger.warn(`Unknown trend source: ${sourceName}`);
        continue;
      }

      try {
        const trends = await source.getTrends(taskData.categories, taskData.limit);
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

    // Store trending products in database
    await this.storeTrendingProducts(analyzedTrends);

    return analyzedTrends;
  }

  private async analyzeTrendsWithAI(trends: TrendData[]): Promise<TrendData[]> {
    if (trends.length === 0) return trends;

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
        await db.insert(trendingProducts).values(productsToInsert);
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
    return db
      .select()
      .from(trendingProducts)
      .where(eq(trendingProducts.status, 'discovered'))
      .orderBy(desc(trendingProducts.trendScore))
      .limit(limit);
  }
}

// Google Trends implementation
class GoogleTrendsSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 20): TrendData[] {
    // Note: This would require Google Trends API or web scraping
    // For now, returning simulated trending products
    const simulatedTrends = [
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
        query: 'Air Fryer Ninja',
        score: 82,
        volume: 28000,
        category: 'Home & Kitchen',
        source: 'google_trends',
      },
      {
        query: 'Stanley Cup Tumbler',
        score: 78,
        volume: 25000,
        category: 'Home & Kitchen',
        source: 'google_trends',
      },
      {
        query: 'Lululemon Leggings',
        score: 75,
        volume: 22000,
        category: 'Fashion',
        source: 'google_trends',
      },
    ];

    return simulatedTrends.slice(0, limit);
  }
}

// Social Media trends implementation
class SocialMediaSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 15): TrendData[] {
    // This would integrate with Twitter API, Reddit API, etc.
    const socialTrends = [
      { query: 'Viral TikTok LED Lights', score: 70, volume: 18000, source: 'social_media' },
      {
        query: 'Trending Skincare Routine Products',
        score: 65,
        volume: 15000,
        source: 'social_media',
      },
      { query: 'Popular Gaming Headset', score: 60, volume: 12000, source: 'social_media' },
    ];

    return socialTrends.slice(0, limit);
  }
}

// News source implementation
class NewsSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 10): TrendData[] {
    // This would integrate with News API
    const newsTrends = [
      { query: 'CES 2024 Best Products', score: 85, volume: 30000, source: 'news' },
      { query: 'Black Friday Top Deals', score: 90, volume: 40000, source: 'news' },
    ];

    return newsTrends.slice(0, limit);
  }
}

// Seasonal trends implementation
class SeasonalSource extends BaseTrendSource {
  getTrends(categories?: string[], limit = 10): TrendData[] {
    const month = new Date().getMonth();
    const seasonalTrends = this.getSeasonalProducts(month);

    return seasonalTrends.slice(0, limit);
  }

  private getSeasonalProducts(month: number): TrendData[] {
    const seasonalMap: Record<number, TrendData[]> = {
      11: [
        // December - Holiday season
        { query: 'Christmas Gift Ideas Tech', score: 85, volume: 35000, source: 'seasonal' },
        { query: 'Holiday Decoration Lights', score: 80, volume: 28000, source: 'seasonal' },
      ],
      0: [
        // January - New Year fitness
        { query: 'Home Gym Equipment', score: 75, volume: 25000, source: 'seasonal' },
        { query: 'Fitness Tracker Watches', score: 70, volume: 20000, source: 'seasonal' },
      ],
      5: [
        // June - Summer products
        { query: 'Portable Air Conditioner', score: 80, volume: 30000, source: 'seasonal' },
        { query: 'Outdoor Grill BBQ', score: 75, volume: 25000, source: 'seasonal' },
      ],
    };

    return seasonalMap[month] || [];
  }
}
