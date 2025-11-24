/**
 * Storage Layer Type Definitions
 *
 * This file contains all TypeScript interfaces and types used across the storage layer.
 * These types are extracted from the original monolithic storage.ts file to improve
 * maintainability and enable better code organization.
 *
 * Organization:
 * - Job Lock Types
 * - Price History Types
 * - Watch List Types
 * - Forum Types
 * - Admin Types
 * - Affiliate Types
 * - User Types
 * - Price Analytics Types
 * - Community Service Types
 * - Monitoring Service Types
 */

// Re-export schema types that are used throughout storage layer
export type {
  Retailer,
  Product,
  ProductOffer,
  PriceHistory,
  WatchList,
  ProductWatch,
  InsertWatchList,
  InsertProductWatch,
  InsertRetailer,
  InsertProduct,
  InsertProductOffer,
  InsertPriceHistory,
  ProductWithOffers,
  SearchFilters,
  User,
  ForumTopic,
  ForumPost,
  Wishlist,
  WishlistItem,
  ProductSpecification,
  InsertWishlist,
  InsertWishlistItem,
  InsertProductSpecification,
  WishlistWithItems,
  WishlistItemWithProduct,
  ProductFull,
  SpecificationGroup,
  PasswordResetToken,
  UserReputation,
  DealSpotting,
  Badge,
  InsertUserReputation,
  InsertDealSpotting,
} from "@shared/schema";

// ============================================================================
// Job Lock Types
// ============================================================================

export interface JobLock {
  id: number;
  jobName: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  metadata: string | null;
}

export interface InsertJobLock {
  jobName: string;
  lockedBy: string;
  expiresAt: Date;
  lockedAt?: Date;
  metadata?: string | null;
}

export interface AcquireLockResult {
  success: boolean;
  id?: number;
}

// ============================================================================
// Price History Types
// ============================================================================

export interface PriceHistoryWithDetails extends import("@shared/schema").PriceHistory {
  retailerName: string;
  retailerLogo: string | null;
}

export interface PriceTrendAnalysis {
  productId: number;
  currentPrice: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  trend: 'rising' | 'falling' | 'stable';
  changePercentage: number;
  daysAnalyzed: number;
}

export interface BestTimeAnalysis {
  productId: number;
  currentPrice: number;
  historicalAverage: number;
  lowestPriceLast90Days: number;
  daysSinceLowest: number;
  recommendation: 'buy_now' | 'wait' | 'good_deal';
  confidenceScore: number;
  priceChangeVelocity: number; // Price change rate ($/day)
}

// ============================================================================
// Watch List Types
// ============================================================================

export interface WatchListWithCount {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean | null;
  sortOrder: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  productCount: number;
}

export interface WatchListWithProducts {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  products: Array<{
    id: number;
    name: string;
    imageUrl: string;
    addedAt: Date;
    currentPrice: number;
    lowestHistoricalPrice: number;
    priceDropPercent: number;
  }>;
}

export interface WatchedProductsOptions {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
  limit?: number;
}

export interface WatchedProductInfo {
  productId: number;
  watchListId: number;
  watchListName: string;
  productName: string;
  imageUrl: string;
  addedAt: Date;
  currentPrice: number;
  lowestPrice: number;
  averagePrice: number;
  priceDropPercent: number;
  savingsPotential: number;
  last7Days: Array<{ date: string; price: number }>;
  alertStatus: 'active' | 'triggered' | 'none';
}

export interface WatchListStats {
  totalWatchLists: number;
  totalProducts: number;
  totalPotentialSavings: number;
  activeAlerts: number;
  triggeredAlerts: number;
  bestDeals: Array<{
    productId: number;
    productName: string;
    currentPrice: number;
    lowestPrice: number;
    discountPercent: number;
  }>;
  weeklyStats: {
    newDeals: number;
    triggeredAlerts: number;
  };
}

export interface WatchListWithStats extends import("@shared/schema").WatchList {
  watchCount: number;
  highPriorityCount: number;
}

export interface CreateWatchListData {
  userId: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder: number;
}

export interface WatchListUpdates {
  name?: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  sortOrder?: number;
}

export interface ProductWatchUpdates {
  category?: string | null;
  notes?: string | null;
  priority?: number;
  targetPrice?: string | null;
  watchListId?: number | null;
}

export interface WatchListProductWithDetails extends import("@shared/schema").ProductWatch {
  productName?: string;
  productImage?: string;
}

export interface WatchListExportData {
  exportDate: string;
  userId: number;
  watchLists: Array<{
    name: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    products: Array<{
      productId: number;
      productName?: string;
      category: string | null;
      notes: string | null;
      priority: number | null;
      targetPrice: string | null;
    }>;
  }>;
}

export interface WatchListImportData {
  watchLists: Array<{
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    products: Array<{
      productId: number;
      category?: string;
      notes?: string;
      priority?: number;
      targetPrice?: string;
    }>;
  }>;
}

// ============================================================================
// Forum Types
// ============================================================================

export interface ForumTopicResult {
  topic: import("@shared/schema").ForumTopic;
}

export interface ForumPostResult {
  post: import("@shared/schema").ForumPost;
}

export interface PriceDropForumPostData {
  dealPost: {
    productId: number;
    productName: string;
    oldPrice: number;
    newPrice: number;
    dropPercent: number;
    dropAmount: number;
    retailer: string;
  };
  userId?: number;
}

// ============================================================================
// Admin Types
// ============================================================================

export interface AdminProduct {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  image: string | null;
  createdAt: Date | null;
}

export interface AdminProductWithOffers extends AdminProduct {
  offers: Array<{
    id: number;
    price: string;
    originalPrice: string | null;
    availability: string | null;
    productUrl: string | null;
    affiliateUrl: string | null;
    retailer: {
      id: number;
      name: string;
      logo: string | null;
    } | null;
  }>;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  isActive: boolean | null;
  reputation: number | null;
  createdAt: Date | null;
}

export interface AdminAnalyticsOverview {
  totalUsers: number;
  totalTopics: number;
  totalPosts: number;
  totalCategories: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface ForumActivityData {
  date: string;
  count: number;
}

export interface TopCategory {
  categoryName: string;
  topicCount: number;
}

// ============================================================================
// Affiliate Types
// ============================================================================

export interface RetailerWithAffiliateStats extends import("@shared/schema").Retailer {
  affiliateConfigParsed: Record<string, unknown> | null;
  stats: {
    totalOffers: number;
    offersWithAffiliateLinks: number;
    totalClicks: number;
  };
}

export interface AffiliateConfig {
  affiliateId?: string | null;
  affiliateProgram?: string | null;
  baseAffiliateUrl?: string | null;
  commissionRate?: string | null;
  affiliateStatus?: string | null;
  affiliateConfig?: Record<string, unknown> | null;
}

export interface AffiliateLinkStats {
  total_offers: number;
  affiliate_offers: number;
  total_clicks: number;
  healthy_links: number;
  broken_links: number;
}

// ============================================================================
// User Types
// ============================================================================

// Safe user type (excludes passwordHash for security)
export interface SafeUser {
  id: number;
  username: string;
  email: string;
  role: string | null;
  trustLevel: number | null;
  isActive: boolean | null;
  isSuspended: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ============================================================================
// Price Analytics Types
// ============================================================================

// Price Aggregation Types
export interface PriceAggregationData {
  productId: number | null;
  retailerId: number | null;
  prices: string;
  recordCount: number;
}

export interface WeeklyAggregateRecord {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  week: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string | null;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  weekOverWeekChange: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface DailyAggregateRecord {
  id: number;
  productId: number;
  retailerId: number;
  date: string;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  dayOverDayChange: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MonthlyAggregateRecord {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  month: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string | null;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  monthOverMonthChange: string | null;
  yearOverYearChange: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface DailyAggregateInsert {
  productId: number;
  retailerId: number;
  date: string;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice?: string;
  volatilityScore?: string;
  recordCount: number;
  dayOverDayChange?: string | null;
  updatedAt?: Date;
}

export interface WeeklyAggregateInsert {
  productId: number;
  retailerId: number;
  year: number;
  week: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice?: string;
  volatilityScore?: string;
  recordCount: number;
  weekOverWeekChange?: string | null;
  updatedAt?: Date;
}

export interface MonthlyAggregateInsert {
  productId: number;
  retailerId: number;
  year: number;
  month: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string;
  medianPrice?: string;
  volatilityScore?: string;
  recordCount: number;
  monthOverMonthChange?: string | null;
  yearOverYearChange?: string | null;
  updatedAt?: Date;
}

// Price History Types
export type InsertPriceHistoryWithRecordedAt = import("@shared/schema").InsertPriceHistory & {
  recordedAt: Date;
};

export interface ProductOfferWithProduct {
  offer: import("@shared/schema").ProductOffer;
  product: import("@shared/schema").Product;
}

export interface PriceHistoryQueryParams {
  productOfferId?: number;
  productId?: number;
  retailerId?: number;
  startDate?: Date;
  endDate?: Date;
  source?: string;
  limit?: number;
}

export interface PriceSnapshotRecord {
  id: number;
  productId: number;
  retailerId: number;
  lowestPrice: string;
  highestPrice: string;
  averagePrice: string;
  offerCount: number | null;
  snapshotDate: Date;
  createdAt: Date | null;
}

export interface PriceSnapshotInsert {
  productId: number;
  retailerId: number;
  lowestPrice: string;
  highestPrice: string;
  averagePrice: string;
  offerCount: number;
  snapshotDate: Date;
}

// Trend Analysis Types
export interface TrendPriceData {
  productId: number | null;
  retailerId: number | null;
  prices: Array<{ price: number; timestamp: string }>;
  recordCount: number;
}

export interface PriceTrendInsert {
  productId: number;
  retailerId: number;
  trendDirection: string;
  trendSlope: string;
  trendStrength: string;
  predictedNextPrice: string;
  confidenceLevel: string;
  analysisPeriodDays: number;
  lastAnalyzedAt: Date;
  updatedAt: Date;
}

export interface PriceTrendWithRetailer {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string | null;
  retailerLogo: string | null;
  trendDirection: string;
  trendSlope: string | null;
  trendStrength: string | null;
  predictedNextPrice: string | null;
  confidenceLevel: string | null;
  analysisPeriodDays: number;
  lastAnalyzedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Existing Interface Types (for pre-existing IStorage methods)
export interface TrendingProduct {
  id: number;
  name: string;
  category: string | null;
  status: string;
  discoveredAt: Date | null;
}

export interface WeeklyAggregate {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  week: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string | null;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  weekOverWeekChange: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MonthlyAggregate {
  id: number;
  productId: number;
  retailerId: number;
  year: number;
  month: number;
  minPrice: string;
  maxPrice: string;
  avgPrice: string | null;
  medianPrice: string | null;
  volatilityScore: string | null;
  recordCount: number;
  monthOverMonthChange: string | null;
  yearOverYearChange: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AnalyticsOverview {
  weeklyAggregates: number;
  monthlyAggregates: number;
  totalTrends: number;
  trendBreakdown: {
    uptrend: number;
    downtrend: number;
    stable: number;
  };
}

// ============================================================================
// Community Service Types
// ============================================================================

export interface CommunityWatchStats {
  productId: number;
  watchCount: number;
  rank: number;
}

export interface CommunityLeaderboardEntry {
  userId: number;
  username: string;
  reputationPoints: number;
  dealsSpotted: number;
  level: number;
  rank: number;
}

export interface CreateDealSpottingData {
  userId: number;
  productId: number;
  priceDropPercent: number;
  priceDropAmount: number;
  forumPostId?: number;
  reputationAwarded: number;
}

export interface WatcherNotificationData {
  type: string;
  title: string;
  content: string;
  relatedProductId?: number;
  relatedTopicId?: number;
  relatedPostId?: number;
}

// ============================================================================
// Monitoring Service Types
// ============================================================================

export interface AgentSessionData {
  id: number;
  agentType: string;
  status: string;
  sessionStart: Date;
  tasksCompleted: number | null;
  successRate: string | null;
  errorsEncountered: number | null;
}

export interface ScrapingJobData {
  id: number;
  jobType: string;
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface JobStatusCount {
  status: string;
  count: number;
}

export interface TrendingProductStatusCount {
  status: string;
  count: number;
}

// ============================================================================
// Price Drop Detection Types
// ============================================================================

export interface ProductOfferForAlert {
  productId: number;
  productName: string | null;
  retailerName: string | null;
  productUrl: string | null;
  price: string;
}

export interface TriggeredPriceAlert {
  id: number;
  userId: number;
  productId: number;
  targetPrice: string;
  isActive: boolean;
  createdAt: Date;
}

// ============================================================================
// Advanced Search Types
// ============================================================================

export interface ProductWithOffersAndRetailers {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  image: string | null;
  similarity?: number; // For semantic search
  offers: Array<{
    id: number;
    price: string;
    availability: string | null;
    productUrl: string | null;
    retailer: {
      id: number;
      name: string;
      websiteUrl: string | null;
    } | null;
  }>;
}

export interface ProductCategoryCount {
  category: string;
  count: number;
}

export interface ProductSuggestion {
  name: string;
  brand: string | null;
  category: string | null;
}

export interface ProductForEmbedding {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
}
