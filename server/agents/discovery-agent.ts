import { BaseAgent, AgentConfig, TaskResult } from './base-agent.js';
import { db } from '../db.js';
import { trendingProducts } from '../../shared/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { InsertTrendingProduct } from '../../shared/schema.js';
import OpenAI from 'openai';

interface TrendData {
  query: string;
  score: number;
  volume: number;
  category?: string;
  source: string;
  metadata?: any;
}

interface DiscoveryTaskData {
  sources: string[];
  categories?: string[];
  limit?: number;
}

export class ProductDiscoveryAgent extends BaseAgent {
  private openai: OpenAI;
  private trendSources: Map<string, TrendSource>;

  constructor() {
    const config: AgentConfig = {
      name: 'Product Discovery Agent',
      type: 'discovery',
      maxConcurrentTasks: 3,
      retryAttempts: 2,
      retryDelay: 1000
    };

    super(config);
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.trendSources = new Map([
      ['google_trends', new GoogleTrendsSource()],
      ['social_media', new SocialMediaSource()],
      ['news', new NewsSource()],
      ['seasonal', new SeasonalSource()]
    ]);
  }

  async processTask(taskData: DiscoveryTaskData): Promise<TrendData[]> {
    const taskId = `discovery_${Date.now()}`;
    
    const result = await this.executeTask(
      taskId,
      () => this.discoverTrendingProducts(taskData),
      {
        jobType: 'discovery',
        targetData: JSON.stringify(taskData)
      }
    );

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
        console.warn(`Unknown trend source: ${sourceName}`);
        continue;
      }

      try {
        const trends = await source.getTrends(taskData.categories, taskData.limit);
        allTrends.push(...trends);
      } catch (error) {
        console.error(`Error getting trends from ${sourceName}:`, error);
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
        Analyze these trending search queries and product mentions for an e-commerce price comparison platform.
        For each item, determine:
        1. If it's a real product suitable for price comparison
        2. The most appropriate product category
        3. A normalized product name
        4. A confidence score (0-100) for commercial viability

        Trending items:
        ${trends.map(t => `- ${t.query} (source: ${t.source}, score: ${t.score})`).join('\n')}

        Return a JSON array with objects containing:
        - originalQuery: string
        - normalizedName: string
        - category: string (Electronics, Home & Garden, Fashion, Sports, etc.)
        - confidence: number (0-100)
        - isProduct: boolean
        - reason: string (brief explanation)
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert e-commerce analyst specializing in product trend analysis and categorization.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      });

      const aiAnalysis = JSON.parse(response.choices[0].message.content || '[]');
      
      // Merge AI analysis with original trend data
      return trends.map(trend => {
        const analysis = aiAnalysis.find((a: any) => a.originalQuery === trend.query);
        if (analysis && analysis.isProduct && analysis.confidence > 60) {
          return {
            ...trend,
            query: analysis.normalizedName,
            category: analysis.category,
            score: Math.round(trend.score * (analysis.confidence / 100)),
            metadata: {
              ...trend.metadata,
              aiAnalysis: analysis
            }
          };
        }
        return trend;
      }).filter(trend => trend.metadata?.aiAnalysis?.isProduct);

    } catch (error) {
      console.error('AI analysis failed, returning original trends:', error);
      return trends;
    }
  }

  private async storeTrendingProducts(trends: TrendData[]): Promise<void> {
    const productsToInsert: InsertTrendingProduct[] = trends.map(trend => ({
      name: trend.query,
      category: trend.category,
      trendScore: trend.score,
      searchVolume: trend.volume,
      source: trend.source,
      sourceData: JSON.stringify(trend.metadata),
      status: 'discovered'
    }));

    if (productsToInsert.length > 0) {
      try {
        await db.insert(trendingProducts).values(productsToInsert);
        console.log(`Stored ${productsToInsert.length} trending products`);
      } catch (error) {
        console.error('Failed to store trending products:', error);
      }
    }
  }

  async getStoredTrendingProducts(limit = 50) {
    return await db.select()
      .from(trendingProducts)
      .where(eq(trendingProducts.status, 'discovered'))
      .orderBy(desc(trendingProducts.trendScore))
      .limit(limit);
  }
}

// Abstract base class for trend sources
abstract class TrendSource {
  abstract getTrends(categories?: string[], limit?: number): Promise<TrendData[]>;
}

// Google Trends implementation
class GoogleTrendsSource extends TrendSource {
  async getTrends(categories?: string[], limit = 20): Promise<TrendData[]> {
    // Note: This would require Google Trends API or web scraping
    // For now, returning simulated trending products
    const simulatedTrends = [
      { query: 'iPhone 15 Pro', score: 95, volume: 50000, category: 'Electronics', source: 'google_trends' },
      { query: 'Nintendo Switch OLED', score: 88, volume: 35000, category: 'Electronics', source: 'google_trends' },
      { query: 'Air Fryer Ninja', score: 82, volume: 28000, category: 'Home & Kitchen', source: 'google_trends' },
      { query: 'Stanley Cup Tumbler', score: 78, volume: 25000, category: 'Home & Kitchen', source: 'google_trends' },
      { query: 'Lululemon Leggings', score: 75, volume: 22000, category: 'Fashion', source: 'google_trends' }
    ];

    return simulatedTrends.slice(0, limit);
  }
}

// Social Media trends implementation
class SocialMediaSource extends TrendSource {
  async getTrends(categories?: string[], limit = 15): Promise<TrendData[]> {
    // This would integrate with Twitter API, Reddit API, etc.
    const socialTrends = [
      { query: 'Viral TikTok LED Lights', score: 70, volume: 18000, source: 'social_media' },
      { query: 'Trending Skincare Routine Products', score: 65, volume: 15000, source: 'social_media' },
      { query: 'Popular Gaming Headset', score: 60, volume: 12000, source: 'social_media' }
    ];

    return socialTrends.slice(0, limit);
  }
}

// News source implementation
class NewsSource extends TrendSource {
  async getTrends(categories?: string[], limit = 10): Promise<TrendData[]> {
    // This would integrate with News API
    const newsTrends = [
      { query: 'CES 2024 Best Products', score: 85, volume: 30000, source: 'news' },
      { query: 'Black Friday Top Deals', score: 90, volume: 40000, source: 'news' }
    ];

    return newsTrends.slice(0, limit);
  }
}

// Seasonal trends implementation
class SeasonalSource extends TrendSource {
  async getTrends(categories?: string[], limit = 10): Promise<TrendData[]> {
    const month = new Date().getMonth();
    const seasonalTrends = this.getSeasonalProducts(month);
    
    return seasonalTrends.slice(0, limit);
  }

  private getSeasonalProducts(month: number): TrendData[] {
    const seasonalMap: Record<number, TrendData[]> = {
      11: [ // December - Holiday season
        { query: 'Christmas Gift Ideas Tech', score: 85, volume: 35000, source: 'seasonal' },
        { query: 'Holiday Decoration Lights', score: 80, volume: 28000, source: 'seasonal' }
      ],
      0: [ // January - New Year fitness
        { query: 'Home Gym Equipment', score: 75, volume: 25000, source: 'seasonal' },
        { query: 'Fitness Tracker Watches', score: 70, volume: 20000, source: 'seasonal' }
      ],
      5: [ // June - Summer products
        { query: 'Portable Air Conditioner', score: 80, volume: 30000, source: 'seasonal' },
        { query: 'Outdoor Grill BBQ', score: 75, volume: 25000, source: 'seasonal' }
      ]
    };

    return seasonalMap[month] || [];
  }
}