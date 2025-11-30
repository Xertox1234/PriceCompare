import { retailers, products, productOffers, priceHistory, watchLists, productWatches, priceAlerts, users, trendingProducts, priceAggregatesWeekly, priceAggregatesMonthly, priceAggregatesDaily, priceSnapshots, priceTrends, jobLocks, notifications, notificationPreferences, passwordResetTokens, wishlists, wishlistItems, productSpecifications, userReputation, dealSpottings, badges, userBadges, agentSessions, scrapingJobs, type Retailer, type Product, type ProductOffer, type PriceHistory, type WatchList, type ProductWatch, type InsertWatchList, type InsertProductWatch, type InsertRetailer, type InsertProduct, type InsertProductOffer, type InsertPriceHistory, type ProductWithOffers, type SearchFilters, type User, type Wishlist, type WishlistItem, type ProductSpecification, type InsertWishlist, type InsertWishlistItem, type InsertProductSpecification, type WishlistWithItems, type WishlistItemWithProduct, type ProductFull, type SpecificationGroup, type PasswordResetToken, type UserReputation, type DealSpotting, type Badge, type InsertUserReputation, type InsertDealSpotting, type Notification, type NotificationPreferences, type InsertNotification, type InsertNotificationPreferences, type PriceAlert, type InsertPriceAlert } from "@shared/schema";
import type { WatchListImportData, WatchedProductsOptions, WatchedProductsResult, WatchedProductInfo, WatchListStats } from './storage/types';
import { db } from "./db";
import { eq, and, gte, lte, lt, inArray, sql, desc, asc, isNull, isNotNull, or, like, count } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "./utils/retry-with-backoff";
import { logger } from "./utils/logger";
import { USER_CONSTANTS, PRODUCT_CONSTANTS, JOB_LOCK_CONSTANTS, ALERT_CONSTANTS } from "./utils/constants";
import { UserStorage } from "./storage/domains/user-storage";
import { ProductStorage } from "./storage/domains/product-storage";
import { PriceStorage } from "./storage/domains/price-storage";
import { WatchListStorage } from "./storage/domains/watchlist-storage";
import { RetailerStorage } from "./storage/domains/retailer-storage";
import { JobLockStorage } from "./storage/domains/job-lock-storage";
import { NotificationStorage } from "./storage/domains/notification-storage";

export interface IStorage {
  // Retailers
  getRetailers(): Promise<Retailer[]>;
  getAllRetailers(): Promise<Retailer[]>;
  getRetailerById(id: number): Promise<Retailer | null>;
  getRetailersByIds(ids: number[]): Promise<Array<{ id: number; name: string }>>;
  createRetailer(retailer: InsertRetailer): Promise<Retailer>;
  updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null>;
  deleteRetailer(id: number): Promise<Retailer | null>;

  // Products
  getProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | null>;
  deleteProduct(id: number): Promise<Product | null>;
  searchProducts(filters: SearchFilters): Promise<{
    products: ProductWithOffers[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  getProductById(id: number): Promise<ProductWithOffers | null>;
  getProductByIdRaw(id: number): Promise<Product | null>;

  // Product Offers
  getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]>;
  createProductOffer(offer: InsertProductOffer): Promise<ProductOffer>;

  // Affiliate Link Operations
  getProductOfferById(offerId: number): Promise<ProductOffer | null>;
  updateProductOfferAffiliateLink(offerId: number, data: { affiliateUrl: string; linkHealthStatus: 'healthy' | 'broken' | 'unknown'; lastLinkCheck: Date }): Promise<void>;
  incrementProductOfferClickCount(offerId: number): Promise<void>;
  getProductOffersByRetailerId(retailerId: number): Promise<ProductOffer[]>;
  getProductOffersByProductId(productId: number): Promise<ProductOffer[]>;
  getAllOffersWithDetails(): Promise<Array<{
    offerId: number;
    productId: number;
    retailerId: number;
    currentPrice: string;
    productName: string;
    retailerName: string;
  }>>;
  getAffiliateLinkStats(retailerId?: number): Promise<AffiliateLinkStats>;

  // Product URL Search (for browser extension)
  getProductByUrl(productUrl: string): Promise<{
    product: Product;
    offer: ProductOffer;
    retailer: Retailer;
  } | null>;

  // Price History
  getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]>;
  getRetailerPriceHistory(productId: number, retailerId: number, days?: number): Promise<PriceHistory[]>;
  getPriceTrend(productId: number): Promise<PriceTrendAnalysis>;
  getBestTimeToBuy(productId: number): Promise<BestTimeAnalysis>;

  // Watch Lists
  getUserWatchLists(userId: number): Promise<WatchListWithCount[]>;
  getWatchListById(watchListId: number, userId: number): Promise<WatchListWithProducts | null>;
  createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList>;
  updateWatchList(watchListId: number, userId: number, updates: { name?: string; description?: string }): Promise<WatchList>;
  deleteWatchList(watchListId: number, userId: number): Promise<WatchList>;
  addProductToWatchList(watchListId: number, productId: number, userId: number): Promise<ProductWatch>;
  removeProductFromWatchList(watchListId: number, productId: number, userId: number): Promise<ProductWatch>;
  getWatchedProducts(userId: number, options?: WatchedProductsOptions): Promise<WatchedProductsResult>;
  getWatchListStats(userId: number): Promise<WatchListStats>;

  // Users - Basic operations
  getUserCount(): Promise<number>;
  getUserByIdSafe(id: number): Promise<SafeUser | null>;

  // User Registration (with transaction) - SECURITY: passwordHash handled internally, NEVER exposed
  registerUser(userData: { username: string; email: string; passwordHash: string }): Promise<SafeUser>;

  // Password Reset (with transaction) - SECURITY: passwordHash handled internally, NEVER exposed
  resetPassword(userId: number, newPasswordHash: string, token: string): Promise<void>;

  // Health Check
  checkDatabaseHealth(): Promise<boolean>;

  // Trending Products (Scraping)
  getTrendingProducts(status: string, limit: number): Promise<TrendingProduct[]>;

  // Price Analytics
  getWeeklyAggregates(productId: number, options?: { year?: number; week?: number; retailerId?: number; limit?: number }): Promise<WeeklyAggregate[]>;
  getMonthlyAggregates(productId: number, options?: { year?: number; month?: number; retailerId?: number; limit?: number }): Promise<MonthlyAggregate[]>;
  getAnalyticsOverview(): Promise<AnalyticsOverview>;
  getJobLocks(): Promise<JobLock[]>;

  // Job Lock Operations
  acquireJobLock(jobName: string, lockedBy: string, ttlSeconds: number): Promise<{ success: boolean; id?: number }>;
  getJobLockByName(jobName: string): Promise<JobLock | null>;
  updateExpiredJobLock(jobName: string, lockedBy: string, newExpiresAt: Date): Promise<{ success: boolean; id?: number }>;
  releaseJobLock(jobName: string, lockedBy: string): Promise<boolean>;
  extendJobLock(jobName: string, lockedBy: string, additionalSeconds: number): Promise<boolean>;
  isJobLocked(jobName: string): Promise<boolean>;
  cleanupExpiredJobLocks(): Promise<number>;

  // Password Reset Token Operations
  createPasswordResetToken(userId: number, token: string, expiresAt: Date, metadata?: { ipAddress?: string; userAgent?: string }): Promise<void>;
  validatePasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenAsUsed(token: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<number>;
  getPasswordResetAttemptCount(userId: number, sinceDate: Date): Promise<number>;

  // Notification Operations (Phase 8E + Phase 8A)
  getNotificationCountByType(userId: number, type: string, sinceDate: Date): Promise<number>;
  getUserEmailById(userId: number): Promise<{ email: string; username: string } | null>;
  getUserNotifications(userId: number, filters?: { isRead?: boolean; type?: string; limit?: number; offset?: number }): Promise<Notification[]>;
  getNotificationStats(userId: number): Promise<{ total: number; unread: number; byType: Record<string, number> }>;
  markAsRead(userId: number, notificationIds: number | number[]): Promise<number>;
  markAllAsRead(userId: number): Promise<number>;
  deleteNotification(userId: number, notificationId: number): Promise<boolean>;
  deleteAllNotifications(userId: number): Promise<number>;
  createNotification(notification: InsertNotification, preferences: NotificationPreferences): Promise<Notification>;
  getUserPreferences(userId: number): Promise<NotificationPreferences | null>;
  createDefaultPreferences(userId: number): Promise<NotificationPreferences>;
  updateUserPreferences(userId: number, updates: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences>;
  getRecentPriceDrops(userId: number, days?: number): Promise<Notification[]>;
  getRecentPriceAlerts(userId: number, days?: number): Promise<Notification[]>;

  // Admin Product/Retailer Management
  getAdminProducts(): Promise<AdminProduct[]>;
  getAdminProductById(id: number): Promise<AdminProductWithOffers | null>;
  createAdminProduct(data: InsertProduct): Promise<Product>;
  updateAdminProduct(id: number, data: Partial<InsertProduct>): Promise<Product | null>;
  deleteAdminProduct(id: number): Promise<Product | null>;
  getAdminRetailers(): Promise<Retailer[]>;
  createAdminRetailer(data: InsertRetailer): Promise<Retailer>;
  updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null>;
  deleteAdminRetailer(id: number): Promise<Retailer | null>;

  // Affiliate Management
  getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]>;
  updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null>;

  // User Profile Management
  updateUserProfile(userId: number, data: { bio?: string; location?: string; website?: string; avatarUrl?: string }): Promise<void>;
  updateUserTrustLevel(userId: number, trustLevel: number): Promise<void>;
  suspendUser(userId: number, reason: string, moderatorId: number): Promise<void>;

  // Admin Analytics
  getAllUsers(): Promise<AdminUser[]>;
  getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview>;
  getUserGrowthData(): Promise<UserGrowthData[]>;
  getProductActivityData(): Promise<{ date: string; count: number }[]>;
  getTopProductCategories(limit: number): Promise<TopCategory[]>;

  // User Registration (transactional with first-admin logic)
  // SECURITY: passwordHash handled internally, NEVER exposed in return value
  createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<{ user: SafeUser; isFirstUser: boolean }>;

  // Wishlists (simple "I want this" lists - separate from price tracking watchlists)
  getUserWishlists(userId: number): Promise<WishlistWithItems[]>;
  getWishlistById(wishlistId: number, userId: number): Promise<WishlistWithItems | null>;
  createWishlist(userId: number, data: { name: string; description?: string; isPublic?: boolean }): Promise<Wishlist>;
  updateWishlist(wishlistId: number, userId: number, updates: Partial<InsertWishlist>): Promise<Wishlist | null>;
  deleteWishlist(wishlistId: number, userId: number): Promise<boolean>;
  addToWishlist(wishlistId: number, userId: number, productId: number, data?: { notes?: string; priority?: number }): Promise<WishlistItem>;
  removeFromWishlist(wishlistId: number, userId: number, productId: number): Promise<boolean>;
  isInWishlist(userId: number, productId: number): Promise<boolean>;
  getUserWishlistItems(userId: number): Promise<WishlistItemWithProduct[]>;

  // Product Specifications
  getProductSpecifications(productId: number): Promise<ProductSpecification[]>;
  getProductSpecificationsGrouped(productId: number): Promise<SpecificationGroup[]>;
  createProductSpecification(spec: InsertProductSpecification): Promise<ProductSpecification>;
  createProductSpecificationsBatch(specs: InsertProductSpecification[]): Promise<ProductSpecification[]>;
  updateProductSpecification(specId: number, updates: Partial<InsertProductSpecification>): Promise<ProductSpecification | null>;
  deleteProductSpecification(specId: number): Promise<boolean>;
  deleteProductSpecifications(productId: number): Promise<number>;
  getProductFull(productId: number): Promise<ProductFull | null>;

  // ============================================================================
  // Price Analytics Operations (Phase 3 Storage Migration)
  // ============================================================================

  // Price Aggregation Data Access
  getPriceDataForAggregation(startDate: Date, endDate: Date, productId?: number): Promise<PriceAggregationData[]>;
  getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]>;
  getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]>;
  getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]>;
  upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void>;
  upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void>;
  upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void>;
  markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void>;
  deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number>;

  // Price History Data Access
  getProductOfferWithProduct(offerId: number): Promise<ProductOfferWithProduct | null>;
  getLatestPriceForOffer(offerId: number): Promise<PriceHistory | null>;
  insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory>;
  getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]>;
  getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]>;
  insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void>;
  updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void>;

  // Price Snapshot Data Access
  getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]>;
  getPriceHistoryForOffers(offerIds: number[]): Promise<Array<{ productOfferId: number; price: string }>>;
  getPriceHistoryForAnalysis(offerIds: number[]): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>>;

  // Trend Analysis Data Access
  getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]>;
  upsertPriceTrends(values: PriceTrendInsert[]): Promise<void>;
  getPriceTrendWithRetailer(productId: number, retailerId: number): Promise<PriceTrendWithRetailer | null>;
  getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]>;

  // Smart Alerts Data Access (Phase 8D)
  getProductOfferIds(productId: number): Promise<number[]>;
  getPriceHistoryForOfferIds(offerIds: number[], limit?: number): Promise<PriceHistory[]>;
  getUserActiveAlertsWithProducts(userId: number): Promise<Array<{
    productId: number;
    targetPrice: string;
    productName: string | null;
  }>>;
  getLowestPricedOffersForProducts(productIds: number[]): Promise<Array<{
    productId: number;
    id: number;
    price: string;
  }>>;
  getBatchPriceHistoryForOffers(offerIds: number[]): Promise<PriceHistory[]>;
  getUserPriceAlertsForEffectiveness(userId: number): Promise<PriceAlert[]>;
  getUserPriceAlerts(userId: number): Promise<PriceAlert[]>;
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  updatePriceAlert(alertId: number, userId: number, updates: { targetPrice?: string; isActive?: boolean }): Promise<PriceAlert | null>;
  deletePriceAlert(alertId: number, userId: number): Promise<boolean>;

  // Phase 8B: Price History Service Support
  getRawPriceHistoryWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ history: PriceHistory; retailer: Retailer }>>;
  getDailyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: DailyAggregateRecord; retailer: Retailer }>>;
  getWeeklyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: WeeklyAggregateRecord; retailer: Retailer }>>;
  getMonthlyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: MonthlyAggregateRecord; retailer: Retailer }>>;
  getActiveProductOffersGrouped(): Promise<Array<{
    productId: number;
    retailerId: number;
    price: string;
  }>>;
  getPriceSnapshotsByFilters(
    productId: number,
    retailerId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<PriceSnapshotRecord[]>;
  deleteOldPriceHistory(cutoffDate: Date): Promise<number>;
  getRecentPriceChanges(cutoffDate: Date): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>>;

  // ============================================================================
  // Community Service Operations (Phase 4 Storage Migration)
  // ============================================================================

  // Product Watch Operations
  addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null>;
  removeProductWatchRecord(userId: number, productId: number): Promise<boolean>;
  getUserProductWatchIds(userId: number): Promise<number[]>;
  getProductWatchCountByProduct(productId: number): Promise<number>;
  getMostWatchedProductStats(limit: number): Promise<CommunityWatchStats[]>;
  isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean>;

  // Reputation Operations
  getOrCreateUserReputation(userId: number): Promise<UserReputation>;
  updateUserReputationAtomic(userId: number, points: number, reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'): Promise<UserReputation>;
  getCommunityLeaderboard(limit: number): Promise<CommunityLeaderboardEntry[]>;

  // Deal Spotting Operations
  createDealSpottingWithReputation(data: CreateDealSpottingData): Promise<DealSpotting>;

  // Badge Operations
  getBadgeByName(name: string): Promise<Badge | null>;
  getBadgesByNames(names: string[]): Promise<Badge[]>; // Batch query for N+1 prevention
  checkUserHasBadge(userId: number, badgeId: number): Promise<boolean>;
  getUserBadgeIds(userId: number): Promise<number[]>; // Batch query for N+1 prevention
  awardBadgeWithNotification(userId: number, badgeId: number, badgeName: string): Promise<void>;

  // Watch List Operations
  getNextWatchListSortOrder(userId: number): Promise<number>;
  createWatchListRecord(data: CreateWatchListData): Promise<WatchList>;
  getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]>;
  getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null>;
  updateWatchListRecord(userId: number, listId: number, updates: WatchListUpdates): Promise<WatchList | null>;
  deleteWatchListRecord(userId: number, listId: number): Promise<boolean>;
  getWatchListProductsWithDetails(userId: number, listId: number): Promise<WatchListProductWithDetails[]>;
  updateProductWatchRecord(userId: number, watchId: number, updates: ProductWatchUpdates): Promise<ProductWatch | null>;
  moveProductWatchesBulk(userId: number, watchIds: number[], targetListId: number | null): Promise<number>;
  deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number>;
  getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null>;
  exportUserWatchListsData(userId: number): Promise<WatchListExportData>;
  importWatchListsData(userId: number, data: WatchListImportData): Promise<{ created: number; skipped: number }>;

  // Product Watcher Operations
  getWatchersForProduct(productId: number): Promise<number[]>;
  notifyProductWatchers(productId: number, notification: WatcherNotificationData): Promise<void>;

  // ============================================================================
  // Monitoring Service Operations (Phase 6 Storage Migration)
  // ============================================================================

  /**
   * Get recent agent sessions within the specified time window
   * @param hours - Number of hours to look back from now
   * @param limit - Maximum number of sessions to return
   * @returns Array of agent session data ordered by session start (newest first)
   */
  getRecentAgentSessions(hours: number, limit: number): Promise<AgentSessionData[]>;

  /**
   * Get recent scraping jobs ordered by creation date
   * @param limit - Maximum number of jobs to return
   * @returns Array of scraping job data ordered by createdAt (newest first)
   */
  getRecentScrapingJobs(limit: number): Promise<ScrapingJobData[]>;

  /**
   * Get count of scraping jobs grouped by status
   * @returns Array of status counts (e.g., pending: 5, completed: 10, failed: 2)
   */
  getScrapingJobStatusCounts(): Promise<JobStatusCount[]>;

  /**
   * Get count of active (non-expired) job locks
   * @returns Number of active locks where expiresAt > NOW()
   */
  getActiveJobLocksCount(): Promise<number>;

  /**
   * Get total count of product offers in the system
   * @returns Total number of product offers
   */
  getProductOffersCount(): Promise<number>;

  /**
   * Get count of trending products grouped by status
   * @returns Array of status counts (e.g., active: 15, pending: 5)
   */
  getTrendingProductsStatusCounts(): Promise<TrendingProductStatusCount[]>;

  /**
   * Get count of active agent sessions within the specified time window
   * @param minutes - Number of minutes to look back from now
   * @returns Count of active sessions started within the time window
   */
  getActiveAgentSessionsCount(minutes: number): Promise<number>;

  // ============================================================================
  // Price Drop Detection Operations (Phase 6 Storage Migration)
  // ============================================================================

  /**
   * Get price history for a specific product offer (for drop detection)
   * @param productOfferId - ID of the product offer
   * @param limit - Maximum number of history records to return
   * @returns Array of price history ordered by recordedAt (newest first)
   */
  getPriceHistoryByOfferId(productOfferId: number, limit: number): Promise<PriceHistory[]>;

  /**
   * Get product offer details with JOIN to products and retailers (for alerts)
   * @param productOfferId - ID of the product offer
   * @returns Offer details with product name, retailer name, URL, and price (or null if not found)
   */
  getProductOfferDetailsForAlert(productOfferId: number): Promise<ProductOfferForAlert | null>;

  /**
   * Get active price alerts triggered by a new price
   * @param productId - ID of the product
   * @param newPrice - New price to compare against target prices
   * @returns Array of price alerts where targetPrice >= newPrice and isActive = true
   */
  getTriggeredPriceAlerts(productId: number, newPrice: number): Promise<TriggeredPriceAlert[]>;

  /**
   * Get user IDs who have active price alerts for a product
   * @param productId - ID of the product
   * @returns Array of unique user IDs with active alerts for the product
   */
  getUsersWithActiveAlertsForProduct(productId: number): Promise<number[]>;

  // ============================================================================
  // Product Discovery Fallback Operations (Phase 6 Storage Migration)
  // ============================================================================

  /**
   * Search products by multiple search terms using LIKE queries
   * @param searchTerms - Array of search terms to match against name/description/category/brand
   * @param limit - Maximum number of products to return
   * @returns Array of products with offers and retailers (nested structure via Drizzle query builder)
   */
  searchProductsByTerms(searchTerms: string[], limit: number): Promise<ProductWithOffers[]>;

  /**
   * Get trending product categories ranked by product count
   * @param limit - Maximum number of categories to return
   * @returns Array of categories with product counts, ordered by count (descending)
   */
  getTrendingProductCategories(limit: number): Promise<ProductCategoryCount[]>;

  /**
   * Get product search suggestions for autocomplete
   * @param searchTerm - Search term to match against name/brand
   * @param limit - Maximum number of suggestions to return (actual limit may be higher for deduplication)
   * @returns Array of product name/brand/category suggestions
   */
  getProductSearchSuggestions(searchTerm: string, limit: number): Promise<ProductSuggestion[]>;

  // ============================================================================
  // Advanced Search Operations (Phase 6 Storage Migration)
  // ============================================================================

  /**
   * Perform exact search using LOWER() and LIKE patterns on name/brand
   * @param searchPattern - SQL LIKE pattern (e.g., '%iphone%')
   * @param limit - Maximum number of products to return
   * @returns Array of products with nested offers and retailers (via json_agg)
   */
  searchProductsExact(searchPattern: string, limit: number): Promise<ProductWithOffersAndRetailers[]>;

  /**
   * Perform fuzzy search using similarity function (requires pg_trgm extension)
   * @param searchPattern - Search term for fuzzy matching
   * @param threshold - Similarity threshold (0.0 to 1.0, typical: 0.3)
   * @param limit - Maximum number of products to return
   * @returns Array of products with nested offers and retailers, ordered by similarity
   */
  searchProductsFuzzy(searchPattern: string, threshold: number, limit: number): Promise<ProductWithOffersAndRetailers[]>;

  /**
   * Search products by synonym terms (batch OR query)
   * @param searchTerms - Array of synonym terms to match against name/brand/description
   * @param limit - Maximum number of products to return
   * @returns Array of products with nested offers and retailers (via json_agg)
   */
  searchProductsBySynonyms(searchTerms: string[], limit: number): Promise<ProductWithOffersAndRetailers[]>;

  /**
   * Perform semantic search using pgvector embeddings
   * @param embedding - Vector embedding to compare against product embeddings
   * @param limit - Maximum number of products to return
   * @returns Array of products with similarity scores and nested offers, ordered by similarity
   */
  searchProductsSemantic(embedding: number[], limit: number): Promise<ProductWithOffersAndRetailers[]>;

  /**
   * Get autocomplete suggestions for search input
   * @param query - Partial search query
   * @param limit - Maximum number of suggestions to return
   * @returns Array of product name/brand/category suggestions
   */
  getProductAutocompleteSuggestions(query: string, limit: number): Promise<ProductSuggestion[]>;

  /**
   * Get product data for embedding generation (minimal fields)
   * @param productId - ID of the product
   * @returns Product data with id, name, description, category, brand (or null if not found)
   */
  getProductForEmbedding(productId: number): Promise<ProductForEmbedding | null>;

  /**
   * Update product embedding vector
   * @param productId - ID of the product
   * @param embedding - Vector embedding array to store
   */
  updateProductEmbedding(productId: number, embedding: number[]): Promise<void>;
}

export class MemStorage implements IStorage {
  private retailers: Map<number, Retailer>;
  private products: Map<number, Product>;
  private productOffers: Map<number, ProductOffer>;
  private currentRetailerId: number;
  private currentProductId: number;
  private currentOfferId: number;

  constructor() {
    this.retailers = new Map();
    this.products = new Map();
    this.productOffers = new Map();
    this.currentRetailerId = 1;
    this.currentProductId = 1;
    this.currentOfferId = 1;
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
    // Sample retailers
    const sampleRetailers = [
      { name: "Amazon", logo: "https://logo.clearbit.com/amazon.com", website: "https://amazon.com", isActive: true },
      { name: "Best Buy", logo: "https://logo.clearbit.com/bestbuy.com", website: "https://bestbuy.com", isActive: true },
      { name: "Walmart", logo: "https://logo.clearbit.com/walmart.com", website: "https://walmart.com", isActive: true },
      { name: "Target", logo: "https://logo.clearbit.com/target.com", website: "https://target.com", isActive: true },
      { name: "B&H Photo", logo: "https://logo.clearbit.com/bhphotovideo.com", website: "https://bhphotovideo.com", isActive: true },
      { name: "Apple Store", logo: "https://logo.clearbit.com/apple.com", website: "https://apple.com", isActive: true },
    ];

    sampleRetailers.forEach(retailer => {
      const id = this.currentRetailerId++;
      this.retailers.set(id, { 
        ...retailer, 
        id,
        affiliateId: null,
        affiliateProgram: null,
        baseAffiliateUrl: null,
        commissionRate: null,
        affiliateStatus: 'inactive',
        affiliateConfig: null
      });
    });

    // Sample products
    const sampleProducts = [
      {
        name: "iPhone 15 Pro 128GB",
        description: "Latest iPhone with titanium design and advanced camera system",
        category: "Smartphones",
        image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "iPhone 15 Pro",
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        description: "Premium Android smartphone with S Pen and advanced AI features",
        category: "Smartphones",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Samsung",
        model: "Galaxy S24 Ultra",
      },
      {
        name: "MacBook Pro 14-inch M3",
        description: "Professional laptop with M3 chip and Liquid Retina XDR display",
        category: "Laptops",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "MacBook Pro 14",
      },
      {
        name: "AirPods Pro (3rd Gen)",
        description: "Active noise cancelling wireless earbuds with spatial audio",
        category: "Audio",
        image: "https://images.unsplash.com/photo-1606041008023-472dfb5e530f?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        brand: "Apple",
        model: "AirPods Pro",
      },
    ];

    sampleProducts.forEach(product => {
      const id = this.currentProductId++;
      this.products.set(id, { ...product, id, createdAt: new Date(), embedding: null, embeddingUpdatedAt: null, searchVector: null });
    });

    // Sample product offers
    const sampleOffers = [
      // iPhone 15 Pro offers
      { productId: 1, retailerId: 1, price: "999.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.5", reviewCount: 2431, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/iphone" },
      { productId: 1, retailerId: 2, price: "1049.99", originalPrice: "1199.99", availability: "in_stock", rating: "4.3", reviewCount: 1892, shippingInfo: "Store pickup available", dealType: null, productUrl: "https://bestbuy.com/iphone" },
      { productId: 1, retailerId: 3, price: "1079.99", originalPrice: "1199.99", availability: "limited_stock", rating: "4.1", reviewCount: 967, shippingInfo: "2-day shipping", dealType: null, productUrl: "https://walmart.com/iphone" },
      
      // Samsung Galaxy S24 Ultra offers
      { productId: 2, retailerId: 1, price: "1199.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.4", reviewCount: 1567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/galaxy" },
      { productId: 2, retailerId: 2, price: "1249.99", originalPrice: "1299.99", availability: "in_stock", rating: "4.2", reviewCount: 1234, shippingInfo: "Same day pickup", dealType: null, productUrl: "https://bestbuy.com/galaxy" },
      
      // MacBook Pro offers
      { productId: 3, retailerId: 6, price: "1999.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.8", reviewCount: 892, shippingInfo: "Free shipping", dealType: "limited_time", productUrl: "https://apple.com/macbook" },
      { productId: 3, retailerId: 1, price: "2049.99", originalPrice: "2199.99", availability: "in_stock", rating: "4.6", reviewCount: 567, shippingInfo: "Free shipping", dealType: null, productUrl: "https://amazon.com/macbook" },
      
      // AirPods Pro offers
      { productId: 4, retailerId: 6, price: "249.99", originalPrice: "279.99", availability: "in_stock", rating: "4.7", reviewCount: 3421, shippingInfo: "Free shipping", dealType: null, productUrl: "https://apple.com/airpods" },
      { productId: 4, retailerId: 1, price: "229.99", originalPrice: "279.99", availability: "in_stock", rating: "4.5", reviewCount: 2876, shippingInfo: "Free shipping", dealType: "best_price", productUrl: "https://amazon.com/airpods" },
    ];

    sampleOffers.forEach(offer => {
      const id = this.currentOfferId++;
      this.productOffers.set(id, { 
        ...offer, 
        id, 
        lastUpdated: new Date(),
        affiliateUrl: null,
        linkHealthStatus: 'unknown',
        lastLinkCheck: null,
        clickCount: 0
      });
    });
  }

  async getRetailers(): Promise<Retailer[]> {
    return Array.from(this.retailers.values());
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    const id = this.currentRetailerId++;
    const newRetailer: Retailer = { 
      ...retailer, 
      id,
      logo: retailer.logo ?? null,
      website: retailer.website ?? null,
      isActive: retailer.isActive ?? true,
      affiliateId: retailer.affiliateId ?? null,
      affiliateProgram: retailer.affiliateProgram ?? null,
      baseAffiliateUrl: retailer.baseAffiliateUrl ?? null,
      commissionRate: retailer.commissionRate ?? null,
      affiliateStatus: retailer.affiliateStatus ?? 'inactive',
      affiliateConfig: retailer.affiliateConfig ?? null
    };
    this.retailers.set(id, newRetailer);
    return newRetailer;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = {
      ...product,
      id,
      createdAt: new Date(),
      image: product.image || null,
      category: product.category || null,
      brand: product.brand || null,
      description: product.description || null,
      model: product.model || null,
      // Type assertion: Drizzle stores JSON field as unknown, cast to expected vector array format
      embedding: (product.embedding as number[] | null) || null,
      embeddingUpdatedAt: product.embeddingUpdatedAt || null,
      searchVector: null
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async searchProducts(filters: SearchFilters): Promise<{
    products: ProductWithOffers[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    let filteredProducts = Array.from(this.products.values());

    // Apply search query filter
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filteredProducts = filteredProducts.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.brand?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.category) {
      filteredProducts = filteredProducts.filter(product =>
        product.category?.toLowerCase() === filters.category?.toLowerCase()
      );
    }

    // Performance fix: Batch fetch all offers instead of N+1 queries
    const productIds = filteredProducts.map(p => p.id);
    const allOffers = Array.from(this.productOffers.values())
      .filter(offer => productIds.includes(offer.productId));

    // Group offers by product ID
    const offersByProduct = new Map<number, Array<ProductOffer & { retailer: Retailer }>>();

    for (const offer of allOffers) {
      const retailer = this.retailers.get(offer.retailerId);
      if (!retailer) continue;

      if (!offersByProduct.has(offer.productId)) {
        offersByProduct.set(offer.productId, []);
      }
      offersByProduct.get(offer.productId)!.push({ ...offer, retailer });
    }

    // Build products with offers
    const productsWithOffers = filteredProducts.map(product => {
      let offers = offersByProduct.get(product.id) || [];

      // Apply price filters
      if (filters.minPrice) {
        offers = offers.filter(offer => parseFloat(offer.price) >= filters.minPrice!);
      }
      if (filters.maxPrice) {
        offers = offers.filter(offer => parseFloat(offer.price) <= filters.maxPrice!);
      }

      // Apply retailer filter
      if (filters.retailers && filters.retailers.length > 0) {
        offers = offers.filter(offer => filters.retailers!.includes(offer.retailerId));
      }

      // Apply rating filter
      if (filters.minRating) {
        offers = offers.filter(offer =>
          offer.rating && parseFloat(offer.rating) >= filters.minRating!
        );
      }

      // Apply availability filter
      if (filters.availability && filters.availability.length > 0) {
        offers = offers.filter(offer =>
          filters.availability!.includes(offer.availability || "in_stock")
        );
      }

      if (offers.length === 0) return null;

      const prices = offers.map(offer => parseFloat(offer.price));
      const bestPrice = Math.min(...prices);
      // Type assertion: filter() removes nulls, TypeScript needs explicit cast to number[]
      const originalPrices = offers
        .map(offer => offer.originalPrice ? parseFloat(offer.originalPrice) : null)
        .filter(price => price !== null);
      const avgOriginalPrice = originalPrices.length > 0 ?
        originalPrices.reduce((sum, price) => sum + price, 0) / originalPrices.length : null;

      const savings = avgOriginalPrice ? avgOriginalPrice - bestPrice : null;
      const savingsPercentage = savings && avgOriginalPrice ?
        Math.round((savings / avgOriginalPrice) * 100) : null;

      return {
        ...product,
        offers,
        bestPrice,
        savings: savings || undefined,
        savingsPercentage: savingsPercentage || undefined,
      };
    });

    // Filter out products with no matching offers
    // Type assertion: filter() removes nulls, TypeScript needs explicit cast
    const validProducts = productsWithOffers.filter(product => product !== null) as ProductWithOffers[];

    // Apply sorting
    if (filters.sortBy) {
      validProducts.sort((a, b) => {
        switch (filters.sortBy) {
          case "price_low":
            return (a.bestPrice || 0) - (b.bestPrice || 0);
          case "price_high":
            return (b.bestPrice || 0) - (a.bestPrice || 0);
          case "rating":
            const aRating = Math.max(...a.offers.map(offer => parseFloat(offer.rating || "0")));
            const bRating = Math.max(...b.offers.map(offer => parseFloat(offer.rating || "0")));
            return bRating - aRating;
          case "popularity":
            const aReviews = Math.max(...a.offers.map(offer => offer.reviewCount || 0));
            const bReviews = Math.max(...b.offers.map(offer => offer.reviewCount || 0));
            return bReviews - aReviews;
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const total = validProducts.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = validProducts.slice(startIndex, endIndex);

    return {
      products: paginatedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getProductById(id: number): Promise<ProductWithOffers | null> {
    const product = this.products.get(id);
    if (!product) return null;

    const offers = await this.getProductOffers(id);
    const prices = offers.map(offer => parseFloat(offer.price));
    const bestPrice = prices.length > 0 ? Math.min(...prices) : undefined;

    return {
      ...product,
      offers,
      bestPrice,
    };
  }

  async getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]> {
    const offers = Array.from(this.productOffers.values())
      .filter(offer => offer.productId === productId);

    return offers.map(offer => ({
      ...offer,
      retailer: this.retailers.get(offer.retailerId)!,
    }));
  }

  async createProductOffer(offer: InsertProductOffer): Promise<ProductOffer> {
    const id = this.currentOfferId++;
    const newOffer: ProductOffer = {
      ...offer,
      id,
      lastUpdated: new Date(),
      availability: offer.availability ?? null,
      rating: offer.rating ?? null,
      originalPrice: offer.originalPrice ?? null,
      reviewCount: offer.reviewCount ?? null,
      shippingInfo: offer.shippingInfo ?? null,
      dealType: offer.dealType ?? null,
      productUrl: offer.productUrl ?? null,
      affiliateUrl: offer.affiliateUrl ?? null,
      linkHealthStatus: offer.linkHealthStatus ?? 'unknown',
      lastLinkCheck: offer.lastLinkCheck ?? null,
      clickCount: offer.clickCount ?? 0
    };
    this.productOffers.set(id, newOffer);
    return newOffer;
  }

  // Affiliate Link Operations (MemStorage stubs)
  async getProductOfferById(offerId: number): Promise<ProductOffer | null> {
    return this.productOffers.get(offerId) ?? null;
  }

  async updateProductOfferAffiliateLink(
    offerId: number,
    data: { affiliateUrl: string; linkHealthStatus: 'healthy' | 'broken' | 'unknown'; lastLinkCheck: Date }
  ): Promise<void> {
    const offer = this.productOffers.get(offerId);
    if (offer) {
      this.productOffers.set(offerId, {
        ...offer,
        affiliateUrl: data.affiliateUrl,
        linkHealthStatus: data.linkHealthStatus,
        lastLinkCheck: data.lastLinkCheck
      });
    }
  }

  async incrementProductOfferClickCount(offerId: number): Promise<void> {
    const offer = this.productOffers.get(offerId);
    if (offer) {
      this.productOffers.set(offerId, {
        ...offer,
        clickCount: (offer.clickCount ?? 0) + 1
      });
    }
  }

  async getProductOffersByRetailerId(retailerId: number): Promise<ProductOffer[]> {
    return Array.from(this.productOffers.values()).filter(
      offer => offer.retailerId === retailerId
    );
  }

  async getAffiliateLinkStats(_retailerId?: number): Promise<AffiliateLinkStats> {
    // Basic in-memory implementation
    const offers = _retailerId
      ? Array.from(this.productOffers.values()).filter(o => o.retailerId === _retailerId)
      : Array.from(this.productOffers.values());

    return {
      total_offers: offers.length,
      affiliate_offers: offers.filter(o => o.affiliateUrl).length,
      total_clicks: offers.reduce((sum, o) => sum + (o.clickCount ?? 0), 0),
      healthy_links: offers.filter(o => o.linkHealthStatus === 'healthy').length,
      broken_links: offers.filter(o => o.linkHealthStatus === 'broken').length
    };
  }

  async getProductByUrl(productUrl: string): Promise<{
    product: Product;
    offer: ProductOffer;
    retailer: Retailer;
  } | null> {
    // Search for matching offer by URL
    for (const offer of Array.from(this.productOffers.values())) {
      if (offer.productUrl && offer.productUrl.includes(productUrl)) {
        const product = this.products.get(offer.productId);
        const retailer = this.retailers.get(offer.retailerId);
        if (product && retailer) {
          return { product, offer, retailer };
        }
      }
    }
    return null;
  }

  // Price History Methods (stub implementations for in-memory storage)
  async getPriceHistory(_productId: number, _days?: number): Promise<PriceHistoryWithDetails[]> {
    return [];
  }

  async getRetailerPriceHistory(_productId: number, _retailerId: number, _days?: number): Promise<PriceHistory[]> {
    return [];
  }

  async getPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
    const product = await this.getProductById(productId);
    const currentPrice = product?.bestPrice || 0;

    return {
      productId,
      currentPrice,
      averagePrice: currentPrice,
      lowestPrice: currentPrice,
      highestPrice: currentPrice,
      trend: 'stable',
      changePercentage: 0,
      daysAnalyzed: 0,
    };
  }

  async getBestTimeToBuy(productId: number): Promise<BestTimeAnalysis> {
    const product = await this.getProductById(productId);
    const currentPrice = product?.bestPrice || 0;

    return {
      productId,
      currentPrice,
      historicalAverage: currentPrice,
      lowestPriceLast90Days: currentPrice,
      daysSinceLowest: 0,
      recommendation: 'buy_now',
      confidenceScore: 0.5,
      priceChangeVelocity: 0,
    };
  }

  // Watch Lists (stub implementations for in-memory storage)
  async getUserWatchLists(_userId: number): Promise<WatchListWithCount[]> {
    return [];
  }

  async getWatchListById(_watchListId: number, _userId: number): Promise<WatchListWithProducts | null> {
    return null;
  }

  async createWatchList(_userId: number, _data: { name: string; description?: string }): Promise<WatchList> {
    throw new Error('Watch lists not supported in memory storage');
  }

  async updateWatchList(_watchListId: number, _userId: number, _updates: { name?: string; description?: string }): Promise<WatchList> {
    throw new Error('Watch lists not supported in memory storage');
  }

  async deleteWatchList(_watchListId: number, _userId: number): Promise<WatchList> {
    throw new Error('Watch lists not supported in memory storage');
  }

  async addProductToWatchList(_watchListId: number, _productId: number, _userId: number): Promise<ProductWatch> {
    throw new Error('Watch lists not supported in memory storage');
  }

  async removeProductFromWatchList(_watchListId: number, _productId: number, _userId: number): Promise<ProductWatch> {
    throw new Error('Watch lists not supported in memory storage');
  }

  async getWatchedProducts(_userId: number, _options?: WatchedProductsOptions): Promise<WatchedProductsResult> {
    return { products: [], hasMore: false, nextCursor: null };
  }

  async getWatchListStats(_userId: number): Promise<WatchListStats> {
    return {
      totalWatchLists: 0,
      totalProducts: 0,
      totalPotentialSavings: 0,
      activeAlerts: 0,
      triggeredAlerts: 0,
      bestDeals: [],
      weeklyStats: {
        newDeals: 0,
        triggeredAlerts: 0,
      },
    };
  }

  // Additional stub implementations for MemStorage
  async getAllRetailers(): Promise<Retailer[]> {
    return Array.from(this.retailers.values());
  }

  async getRetailerById(id: number): Promise<Retailer | null> {
    return this.retailers.get(id) ?? null;
  }

  async updateRetailer(_id: number, _updates: Partial<InsertRetailer>): Promise<Retailer | null> {
    throw new Error('Not supported in memory storage');
  }

  async deleteRetailer(_id: number): Promise<Retailer | null> {
    throw new Error('Not supported in memory storage');
  }

  async updateProduct(_id: number, _updates: Partial<InsertProduct>): Promise<Product | null> {
    throw new Error('Not supported in memory storage');
  }

  async deleteProduct(_id: number): Promise<Product | null> {
    throw new Error('Not supported in memory storage');
  }

  async getProductByIdRaw(id: number): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async getAllUsers(): Promise<AdminUser[]> {
    return [];
  }

  async getUserCount(): Promise<number> {
    return 0;
  }

  async getUserByIdSafe(_id: number): Promise<SafeUser | null> {
    return null;
  }

  async updateUserProfile(_userId: number, _updates: { bio?: string; location?: string; website?: string; avatarUrl?: string }): Promise<void> {
    throw new Error('Not supported in memory storage');
  }

  async updateUserTrustLevel(_userId: number, _trustLevel: number): Promise<void> {
    throw new Error('Not supported in memory storage');
  }

  async suspendUser(_userId: number, _reason: string, _suspendedBy: number): Promise<void> {
    throw new Error('Not supported in memory storage');
  }

  // SECURITY: passwordHash handled internally, NEVER exposed
  async registerUser(_userData: { username: string; email: string; passwordHash: string }): Promise<SafeUser> {
    throw new Error('Not supported in memory storage');
  }

  // SECURITY: passwordHash handled internally, NEVER exposed
  async resetPassword(_userId: number, _newPasswordHash: string, _token: string): Promise<void> {
    throw new Error('Not supported in memory storage');
  }

  async getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
    return { totalUsers: 0, totalProducts: 0, totalRetailers: 0, totalAlerts: 0 };
  }

  async getUserGrowthData(): Promise<UserGrowthData[]> {
    return [];
  }

  async getProductActivityData(): Promise<{ date: string; count: number }[]> {
    return [];
  }

  async getTopProductCategories(_limit: number): Promise<TopCategory[]> {
    return [];
  }

  async checkDatabaseHealth(): Promise<boolean> {
    return true; // Memory storage is always "healthy"
  }

  async getTrendingProducts(_status: string, _limit: number): Promise<TrendingProduct[]> {
    return [];
  }

  async getWeeklyAggregates(_productId: number, _options?: { year?: number; week?: number; retailerId?: number; limit?: number }): Promise<WeeklyAggregate[]> {
    return [];
  }

  async getMonthlyAggregates(_productId: number, _options?: { year?: number; month?: number; retailerId?: number; limit?: number }): Promise<MonthlyAggregate[]> {
    return [];
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return { weeklyAggregates: 0, monthlyAggregates: 0, totalTrends: 0, trendBreakdown: { uptrend: 0, downtrend: 0, stable: 0 } };
  }

  async getJobLocks(): Promise<JobLock[]> {
    return [];
  }

  // Job Lock Operations (stub implementations - job locking not supported in memory storage)
  async acquireJobLock(_jobName: string, _lockedBy: string, _ttlSeconds: number): Promise<{ success: boolean; id?: number }> {
    return { success: false };
  }

  async getJobLockByName(_jobName: string): Promise<JobLock | null> {
    return null;
  }

  async updateExpiredJobLock(_jobName: string, _lockedBy: string, _newExpiresAt: Date): Promise<{ success: boolean; id?: number }> {
    return { success: false };
  }

  async releaseJobLock(_jobName: string, _lockedBy: string): Promise<boolean> {
    return false;
  }

  async extendJobLock(_jobName: string, _lockedBy: string, _additionalSeconds: number): Promise<boolean> {
    return false;
  }

  async isJobLocked(_jobName: string): Promise<boolean> {
    return false;
  }

  async cleanupExpiredJobLocks(): Promise<number> {
    return 0;
  }

  // Password Reset Token Operations (stub implementations)
  async createPasswordResetToken(_userId: number, _token: string, _expiresAt: Date, _metadata?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    // Not supported in memory storage
  }

  async validatePasswordResetToken(_token: string): Promise<PasswordResetToken | null> {
    return null;
  }

  async markPasswordResetTokenAsUsed(_token: string): Promise<void> {
    // Not supported in memory storage
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    return 0;
  }

  async getPasswordResetAttemptCount(_userId: number, _sinceDate: Date): Promise<number> {
    return 0;
  }

  // Admin Product/Retailer Management (stub implementations)
  async getAdminProducts(): Promise<AdminProduct[]> {
    return [];
  }

  async getAdminProductById(_id: number): Promise<AdminProductWithOffers | null> {
    return null;
  }

  async createAdminProduct(_data: InsertProduct): Promise<Product> {
    throw new Error('Admin product operations not supported in memory storage');
  }

  async updateAdminProduct(_id: number, _data: Partial<InsertProduct>): Promise<Product | null> {
    throw new Error('Admin product operations not supported in memory storage');
  }

  async deleteAdminProduct(_id: number): Promise<Product | null> {
    throw new Error('Admin product operations not supported in memory storage');
  }

  async getAdminRetailers(): Promise<Retailer[]> {
    return Array.from(this.retailers.values());
  }

  async createAdminRetailer(_data: InsertRetailer): Promise<Retailer> {
    throw new Error('Admin retailer operations not supported in memory storage');
  }

  async updateAdminRetailer(_id: number, _data: Partial<InsertRetailer>): Promise<Retailer | null> {
    throw new Error('Admin retailer operations not supported in memory storage');
  }

  async deleteAdminRetailer(_id: number): Promise<Retailer | null> {
    throw new Error('Admin retailer operations not supported in memory storage');
  }

  // Affiliate Management (stub implementations)
  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    return [];
  }

  async updateRetailerAffiliateConfig(_id: number, _config: AffiliateConfig): Promise<Retailer | null> {
    throw new Error('Affiliate operations not supported in memory storage');
  }

  // SECURITY: passwordHash handled internally, NEVER exposed
  async createUserWithTransaction(
    _username: string,
    _email: string,
    _passwordHash: string
  ): Promise<{ user: SafeUser; isFirstUser: boolean }> {
    throw new Error('User registration not supported in memory storage');
  }

  // Wishlist stubs for MemStorage
  async getUserWishlists(_userId: number): Promise<WishlistWithItems[]> { return []; }
  async getWishlistById(_wishlistId: number, _userId: number): Promise<WishlistWithItems | null> { return null; }
  async createWishlist(_userId: number, _data: { name: string; description?: string; isPublic?: boolean }): Promise<Wishlist> {
    throw new Error('Wishlists not supported in memory storage');
  }
  async updateWishlist(_wishlistId: number, _userId: number, _updates: Partial<InsertWishlist>): Promise<Wishlist | null> { return null; }
  async deleteWishlist(_wishlistId: number, _userId: number): Promise<boolean> { return false; }
  async addToWishlist(_wishlistId: number, _userId: number, _productId: number, _data?: { notes?: string; priority?: number }): Promise<WishlistItem> {
    throw new Error('Wishlists not supported in memory storage');
  }
  async removeFromWishlist(_wishlistId: number, _userId: number, _productId: number): Promise<boolean> { return false; }
  async isInWishlist(_userId: number, _productId: number): Promise<boolean> { return false; }
  async getUserWishlistItems(_userId: number): Promise<WishlistItemWithProduct[]> { return []; }

  // Product specification stubs for MemStorage
  async getProductSpecifications(_productId: number): Promise<ProductSpecification[]> { return []; }
  async getProductSpecificationsGrouped(_productId: number): Promise<SpecificationGroup[]> { return []; }
  async createProductSpecification(_spec: InsertProductSpecification): Promise<ProductSpecification> {
    throw new Error('Product specifications not supported in memory storage');
  }
  async createProductSpecificationsBatch(_specs: InsertProductSpecification[]): Promise<ProductSpecification[]> { return []; }
  async updateProductSpecification(_specId: number, _updates: Partial<InsertProductSpecification>): Promise<ProductSpecification | null> { return null; }
  async deleteProductSpecification(_specId: number): Promise<boolean> { return false; }
  async deleteProductSpecifications(_productId: number): Promise<number> { return 0; }
  async getProductFull(_productId: number): Promise<ProductFull | null> { return null; }

  // ============================================================================
  // Price Analytics Operations (Phase 3 Storage Migration - Stub Implementations)
  // ============================================================================

  // Price Aggregation stubs
  async getPriceDataForAggregation(_startDate: Date, _endDate: Date, _productId?: number): Promise<PriceAggregationData[]> { return []; }
  async getWeeklyAggregatesData(_year: number, _week: number): Promise<WeeklyAggregateRecord[]> { return []; }
  async getDailyAggregatesData(_date: string): Promise<DailyAggregateRecord[]> { return []; }
  async getMonthlyAggregatesData(_year: number, _month: number): Promise<MonthlyAggregateRecord[]> { return []; }
  async upsertDailyAggregates(_values: DailyAggregateInsert[]): Promise<void> { /* Not supported in memory storage */ }
  async upsertWeeklyAggregates(_values: WeeklyAggregateInsert[]): Promise<void> { /* Not supported in memory storage */ }
  async upsertMonthlyAggregates(_values: MonthlyAggregateInsert[]): Promise<void> { /* Not supported in memory storage */ }
  async markPriceHistoryAsAggregated(_startDate: Date, _endDate: Date): Promise<void> { /* Not supported in memory storage */ }
  async deleteOldAggregatedPriceHistory(_cutoffDate: Date): Promise<number> { return 0; }

  // Price History stubs
  async getProductOfferWithProduct(_offerId: number): Promise<ProductOfferWithProduct | null> { return null; }
  async getLatestPriceForOffer(_offerId: number): Promise<PriceHistory | null> { return null; }
  async insertPriceHistory(_data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory> {
    throw new Error('Price history operations not supported in memory storage');
  }
  async getPriceHistoryByQuery(_query: PriceHistoryQueryParams): Promise<PriceHistory[]> { return []; }
  async getExistingSnapshotsForDate(_date: Date): Promise<PriceSnapshotRecord[]> { return []; }
  async insertPriceSnapshots(_snapshots: PriceSnapshotInsert[]): Promise<void> { /* Not supported in memory storage */ }
  async updatePriceSnapshot(_id: number, _data: Partial<PriceSnapshotInsert>): Promise<void> { /* Not supported in memory storage */ }

  // Price Snapshot stubs
  async getProductOffersForSnapshot(_batchSize: number, _offset: number): Promise<ProductOffer[]> { return []; }
  async getPriceHistoryForOffers(_offerIds: number[]): Promise<Array<{ productOfferId: number; price: string }>> { return []; }

  // Trend Analysis stubs
  async getPriceDataGroupedForTrend(_cutoffDate: Date): Promise<TrendPriceData[]> { return []; }
  async upsertPriceTrends(_values: PriceTrendInsert[]): Promise<void> { /* Not supported in memory storage */ }
  async getPriceTrendWithRetailer(_productId: number, _retailerId: number): Promise<PriceTrendWithRetailer | null> { return null; }
  async getPriceTrendsForProduct(_productId: number): Promise<PriceTrendWithRetailer[]> { return []; }

  // Smart Alerts stubs (Phase 8D)
  async getProductOfferIds(_productId: number): Promise<number[]> { return []; }
  async getPriceHistoryForOfferIds(_offerIds: number[], _limit?: number): Promise<PriceHistory[]> { return []; }
  async getUserActiveAlertsWithProducts(_userId: number): Promise<Array<{
    productId: number;
    targetPrice: string;
    productName: string | null;
  }>> { return []; }
  async getLowestPricedOffersForProducts(_productIds: number[]): Promise<Array<{
    productId: number;
    id: number;
    price: string;
  }>> { return []; }
  async getBatchPriceHistoryForOffers(_offerIds: number[]): Promise<PriceHistory[]> { return []; }
  async getUserPriceAlertsForEffectiveness(_userId: number): Promise<PriceAlert[]> { return []; }
  async getUserPriceAlerts(_userId: number): Promise<PriceAlert[]> { return []; }
  async createPriceAlert(_alert: InsertPriceAlert): Promise<PriceAlert> {
    throw new Error('Not supported in memory storage');
  }
  async updatePriceAlert(_alertId: number, _userId: number, _updates: { targetPrice?: string; isActive?: boolean }): Promise<PriceAlert | null> {
    return null;
  }
  async deletePriceAlert(_alertId: number, _userId: number): Promise<boolean> {
    return false;
  }

  // Phase 8B: Price History Service Support - STUBS
  async getRawPriceHistoryWithRetailers(
    _productId: number,
    _startDate: Date,
    _endDate: Date,
    _retailerId?: number
  ): Promise<Array<{ history: PriceHistory; retailer: Retailer }>> {
    throw new Error('Not supported in memory storage');
  }

  async getDailyAggregatesWithRetailers(
    _productId: number,
    _startDate: Date,
    _endDate: Date,
    _retailerId?: number
  ): Promise<Array<{ agg: DailyAggregateRecord; retailer: Retailer }>> {
    throw new Error('Not supported in memory storage');
  }

  async getWeeklyAggregatesWithRetailers(
    _productId: number,
    _startDate: Date,
    _endDate: Date,
    _retailerId?: number
  ): Promise<Array<{ agg: WeeklyAggregateRecord; retailer: Retailer }>> {
    throw new Error('Not supported in memory storage');
  }

  async getMonthlyAggregatesWithRetailers(
    _productId: number,
    _startDate: Date,
    _endDate: Date,
    _retailerId?: number
  ): Promise<Array<{ agg: MonthlyAggregateRecord; retailer: Retailer }>> {
    throw new Error('Not supported in memory storage');
  }

  async getActiveProductOffersGrouped(): Promise<Array<{
    productId: number;
    retailerId: number;
    price: string;
  }>> {
    throw new Error('Not supported in memory storage');
  }

  async getPriceSnapshotsByFilters(
    _productId: number,
    _retailerId?: number,
    _startDate?: Date,
    _endDate?: Date
  ): Promise<PriceSnapshotRecord[]> {
    throw new Error('Not supported in memory storage');
  }

  async deleteOldPriceHistory(_cutoffDate: Date): Promise<number> {
    throw new Error('Not supported in memory storage');
  }

  async getRecentPriceChanges(_cutoffDate: Date): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    throw new Error('Not supported in memory storage');
  }

  // ============================================================================
  // Community Service Operations (Phase 4 Storage Migration) - STUBS
  // ============================================================================
  async addProductWatchRecord(_userId: number, _productId: number): Promise<ProductWatch | null> {
    throw new Error('Not supported in memory storage');
  }
  async removeProductWatchRecord(_userId: number, _productId: number): Promise<boolean> {
    throw new Error('Not supported in memory storage');
  }
  async getUserProductWatchIds(_userId: number): Promise<number[]> {
    throw new Error('Not supported in memory storage');
  }
  async getProductWatchCountByProduct(_productId: number): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async getMostWatchedProductStats(_limit: number): Promise<CommunityWatchStats[]> {
    throw new Error('Not supported in memory storage');
  }
  async isUserWatchingProductCheck(_userId: number, _productId: number): Promise<boolean> {
    throw new Error('Not supported in memory storage');
  }
  async getOrCreateUserReputation(_userId: number): Promise<UserReputation> {
    throw new Error('Not supported in memory storage');
  }
  async updateUserReputationAtomic(_userId: number, _points: number, _reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'): Promise<UserReputation> {
    throw new Error('Not supported in memory storage');
  }
  async getCommunityLeaderboard(_limit: number): Promise<CommunityLeaderboardEntry[]> {
    throw new Error('Not supported in memory storage');
  }
  async createDealSpottingWithReputation(_data: CreateDealSpottingData): Promise<DealSpotting> {
    throw new Error('Not supported in memory storage');
  }
  async getBadgeByName(_name: string): Promise<Badge | null> {
    throw new Error('Not supported in memory storage');
  }
  async getBadgesByNames(_names: string[]): Promise<Badge[]> {
    throw new Error('Not supported in memory storage');
  }
  async checkUserHasBadge(_userId: number, _badgeId: number): Promise<boolean> {
    throw new Error('Not supported in memory storage');
  }
  async getUserBadgeIds(_userId: number): Promise<number[]> {
    throw new Error('Not supported in memory storage');
  }
  async awardBadgeWithNotification(_userId: number, _badgeId: number, _badgeName: string): Promise<void> {
    throw new Error('Not supported in memory storage');
  }
  async getNextWatchListSortOrder(_userId: number): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async createWatchListRecord(_data: CreateWatchListData): Promise<WatchList> {
    throw new Error('Not supported in memory storage');
  }
  async getWatchListsWithStats(_userId: number): Promise<WatchListWithStats[]> {
    throw new Error('Not supported in memory storage');
  }
  async getWatchListByIdWithStats(_userId: number, _listId: number): Promise<WatchListWithStats | null> {
    throw new Error('Not supported in memory storage');
  }
  async updateWatchListRecord(_userId: number, _listId: number, _updates: WatchListUpdates): Promise<WatchList | null> {
    throw new Error('Not supported in memory storage');
  }
  async deleteWatchListRecord(_userId: number, _listId: number): Promise<boolean> {
    throw new Error('Not supported in memory storage');
  }
  async getWatchListProductsWithDetails(_userId: number, _listId: number): Promise<WatchListProductWithDetails[]> {
    throw new Error('Not supported in memory storage');
  }
  async updateProductWatchRecord(_userId: number, _watchId: number, _updates: ProductWatchUpdates): Promise<ProductWatch | null> {
    throw new Error('Not supported in memory storage');
  }
  async moveProductWatchesBulk(_userId: number, _watchIds: number[], _targetListId: number | null): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async deleteProductWatchesBulk(_userId: number, _watchIds: number[]): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async getUserDefaultWatchListRecord(_userId: number): Promise<WatchList | null> {
    throw new Error('Not supported in memory storage');
  }
  async exportUserWatchListsData(_userId: number): Promise<WatchListExportData> {
    throw new Error('Not supported in memory storage');
  }
  async importWatchListsData(_userId: number, _data: WatchListImportData): Promise<{ created: number; skipped: number }> {
    throw new Error('Not supported in memory storage');
  }
  async getWatchersForProduct(_productId: number): Promise<number[]> {
    throw new Error('Not supported in memory storage');
  }
  async notifyProductWatchers(_productId: number, _notification: WatcherNotificationData): Promise<void> {
    throw new Error('Not supported in memory storage');
  }

  // ============================================================================
  // Phase 6: Monitoring, Price Drop, Search Methods
  // ============================================================================

  // Monitoring Service (7 methods)
  async getRecentAgentSessions(_hours: number, _limit: number): Promise<AgentSessionData[]> {
    throw new Error('Not supported in memory storage');
  }
  async getRecentScrapingJobs(_limit: number): Promise<ScrapingJobData[]> {
    throw new Error('Not supported in memory storage');
  }
  async getScrapingJobStatusCounts(): Promise<JobStatusCount[]> {
    throw new Error('Not supported in memory storage');
  }
  async getActiveJobLocksCount(): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async getProductOffersCount(): Promise<number> {
    throw new Error('Not supported in memory storage');
  }
  async getTrendingProductsStatusCounts(): Promise<TrendingProductStatusCount[]> {
    throw new Error('Not supported in memory storage');
  }
  async getActiveAgentSessionsCount(_minutes: number): Promise<number> {
    throw new Error('Not supported in memory storage');
  }

  // Price Drop Detection (4 methods)
  async getPriceHistoryByOfferId(_productOfferId: number, _limit: number): Promise<PriceHistory[]> {
    throw new Error('Not supported in memory storage');
  }
  async getProductOfferDetailsForAlert(_productOfferId: number): Promise<ProductOfferForAlert | null> {
    throw new Error('Not supported in memory storage');
  }
  async getTriggeredPriceAlerts(_productId: number, _newPrice: number): Promise<TriggeredPriceAlert[]> {
    throw new Error('Not supported in memory storage');
  }
  async getUsersWithActiveAlertsForProduct(_productId: number): Promise<number[]> {
    throw new Error('Not supported in memory storage');
  }

  // Product Discovery (3 methods)
  async searchProductsByTerms(_searchTerms: string[], _limit: number): Promise<ProductWithOffers[]> {
    throw new Error('Not supported in memory storage');
  }
  async getTrendingProductCategories(_limit: number): Promise<ProductCategoryCount[]> {
    throw new Error('Not supported in memory storage');
  }
  async getProductSearchSuggestions(_searchTerm: string, _limit: number): Promise<ProductSuggestion[]> {
    throw new Error('Not supported in memory storage');
  }

  // Advanced Search (7 methods)
  async searchProductsExact(_searchPattern: string, _limit: number): Promise<ProductWithOffersAndRetailers[]> {
    throw new Error('Not supported in memory storage');
  }
  async searchProductsFuzzy(_searchPattern: string, _threshold: number, _limit: number): Promise<ProductWithOffersAndRetailers[]> {
    throw new Error('Not supported in memory storage');
  }
  async searchProductsBySynonyms(_searchTerms: string[], _limit: number): Promise<ProductWithOffersAndRetailers[]> {
    throw new Error('Not supported in memory storage');
  }
  async searchProductsSemantic(_embedding: number[], _limit: number): Promise<ProductWithOffersAndRetailers[]> {
    throw new Error('Not supported in memory storage');
  }
  async getProductAutocompleteSuggestions(_query: string, _limit: number): Promise<ProductSuggestion[]> {
    throw new Error('Not supported in memory storage');
  }
  async getProductForEmbedding(_productId: number): Promise<ProductForEmbedding | null> {
    throw new Error('Not supported in memory storage');
  }
  async updateProductEmbedding(_productId: number, _embedding: number[]): Promise<void> {
    throw new Error('Not supported in memory storage');
  }
  async getNotificationCountByType(_userId: number, _type: string, _sinceDate: Date): Promise<number> {
    return 0; // Stub implementation for testing
  }
  async getUserEmailById(_userId: number): Promise<{ email: string; username: string } | null> {
    return null; // Stub implementation for testing
  }
  async getUserNotifications(_userId: number, _filters?: { isRead?: boolean; type?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    return []; // Stub implementation for testing
  }
  async getNotificationStats(_userId: number): Promise<{ total: number; unread: number; byType: Record<string, number> }> {
    return { total: 0, unread: 0, byType: {} }; // Stub implementation for testing
  }
  async markAsRead(_userId: number, _notificationIds: number | number[]): Promise<number> {
    return 0; // Stub implementation for testing
  }
  async markAllAsRead(_userId: number): Promise<number> {
    return 0; // Stub implementation for testing
  }
  async deleteNotification(_userId: number, _notificationId: number): Promise<boolean> {
    return false; // Stub implementation for testing
  }
  async deleteAllNotifications(_userId: number): Promise<number> {
    return 0; // Stub implementation for testing
  }
  async createNotification(_notification: InsertNotification, _preferences: NotificationPreferences): Promise<Notification> {
    throw new Error('Not supported in memory storage'); // Stub implementation for testing
  }
  async getUserPreferences(_userId: number): Promise<NotificationPreferences | null> {
    return null; // Stub implementation for testing
  }
  async createDefaultPreferences(_userId: number): Promise<NotificationPreferences> {
    throw new Error('Not supported in memory storage'); // Stub implementation for testing
  }
  async updateUserPreferences(_userId: number, _updates: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    throw new Error('Not supported in memory storage'); // Stub implementation for testing
  }
  async getRecentPriceDrops(_userId: number, _days?: number): Promise<Notification[]> {
    return []; // Stub implementation for testing
  }
  async getRecentPriceAlerts(_userId: number, _days?: number): Promise<Notification[]> {
    return []; // Stub implementation for testing
  }
  async getProductOffersByProductId(_productId: number): Promise<ProductOffer[]> {
    return []; // Stub implementation for testing
  }
  async getAllOffersWithDetails(): Promise<Array<{
    offerId: number;
    productId: number;
    retailerId: number;
    currentPrice: string;
    productName: string;
    retailerName: string;
  }>> {
    return []; // Stub implementation for testing
  }
  async getRetailersByIds(_ids: number[]): Promise<Array<{ id: number; name: string }>> {
    return []; // Stub implementation for testing
  }
  async getPriceHistoryForAnalysis(_offerIds: number[]): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    return []; // Stub implementation for testing
  }
}

/**
 * Database Storage Implementation
 *
 * Main storage layer implementation using PostgreSQL via Drizzle ORM.
 * All database access should flow through this class to maintain consistency.
 *
 * **Caching Strategy:**
 *
 * This storage layer is designed to work with Redis caching at the middleware/service layer.
 * Below are recommended caching strategies for high-traffic read operations:
 *
 * ## Retailer Storage
 *
 * **1. `getAllRetailers()`:**
 *    - **Cache key**: `retailer:all`
 *    - **TTL**: 60 minutes (1 hour)
 *    - **Invalidate on**: createRetailer, updateRetailer, deleteRetailer
 *    - **Rationale**: Retailer list changes infrequently, long TTL reduces database load
 *
 * **2. `getRetailerById(id)`:**
 *    - **Cache key**: `retailer:id:${id}`
 *    - **TTL**: 60 minutes (1 hour)
 *    - **Invalidate on**: updateRetailer, deleteRetailer for specific retailer
 *    - **Rationale**: Individual retailer data rarely changes, safe for long caching
 *
 * ## Product Storage
 *
 * **3. `getProductById(id)`:**
 *    - **Cache key**: `product:full:${id}`
 *    - **TTL**: 5 minutes
 *    - **Invalidate on**: updateProduct, deleteProduct, createProductOffer
 *    - **Rationale**: Prices change frequently, shorter TTL balances freshness vs performance
 *
 * **4. `searchProducts(filters)`:**
 *    - **Cache key**: `product:search:${JSON.stringify(filters)}`
 *    - **TTL**: 1-2 minutes
 *    - **Invalidate on**: Product updates (can use pattern-based invalidation)
 *    - **Rationale**: Search results change with new products/prices, short TTL ensures relevance
 *
 * ## User Storage
 *
 * **5. `getUserByIdSafe(id)`:**
 *    - **Cache key**: `user:safe:${id}`
 *    - **TTL**: 5 minutes
 *    - **Invalidate on**: updateUserProfile, updateUserTrustLevel, suspendUser
 *    - **Rationale**: User profiles change occasionally, moderate TTL balances consistency
 *
 * **6. `getAllUsers()`:**
 *    - **Cache key**: `user:all`
 *    - **TTL**: 2 minutes
 *    - **Invalidate on**: registerUser, suspendUser (impacts admin panel list)
 *    - **Rationale**: Admin panel usage, shorter TTL for moderation responsiveness
 *
 * ## Alert Storage
 *
 * **7. `getUserPriceAlerts(userId)`:**
 *    - **Cache key**: `alert:user:${userId}`
 *    - **TTL**: 2 minutes
 *    - **Invalidate on**: createPriceAlert, deletePriceAlert for user
 *    - **Rationale**: Users check alerts frequently, moderate TTL reduces redundant queries
 *
 * **8. `getTriggeredPriceAlerts()`:**
 *    - **Cache key**: `alert:triggered`
 *    - **TTL**: 30 seconds
 *    - **Invalidate on**: Alert processing (marks as triggered)
 *    - **Rationale**: Critical for notifications, very short TTL ensures timely delivery
 *
 * ## Job Lock Storage
 *
 * **9. `getJobLockByName(jobName)`:**
 *    - **Cache key**: `joblock:name:${jobName}`
 *    - **TTL**: 30 seconds
 *    - **Invalidate on**: acquireJobLock, releaseJobLock
 *    - **Rationale**: Job coordination requires near-real-time data, very short TTL
 *
 * **10. `isJobLocked(jobName)`:**
 *    - **Cache key**: `joblock:status:${jobName}`
 *    - **TTL**: 30 seconds
 *    - **Invalidate on**: Job lock state changes
 *    - **Rationale**: Distributed locking needs fresh status, short TTL prevents stale locks
 *
 * ## WatchList Storage
 *
 * **11. `getUserWatchLists(userId)`:**
 *    - **Cache key**: `watchlist:user:${userId}`
 *    - **TTL**: 3 minutes
 *    - **Invalidate on**: createWatchList, deleteWatchList, updateWatchList
 *    - **Rationale**: Users view lists frequently, moderate TTL improves UX
 *
 * **12. `getWatchListById(watchListId, userId)`:**
 *    - **Cache key**: `watchlist:detail:${watchListId}`
 *    - **TTL**: 2 minutes
 *    - **Invalidate on**: addProductToWatchList, removeProductFromWatchList
 *    - **Rationale**: Products added/removed frequently, shorter TTL ensures accuracy
 *
 * ---
 *
 * **Example Cache Implementation Pattern:**
 *
 * ```typescript
 * import { getRedisClient } from '../config/redis';
 *
 * // Wrapper function for cached storage access
 * async function getProductByIdCached(productId: number): Promise<ProductWithOffers | undefined> {
 *   const redisClient = getRedisClient();
 *   if (!redisClient) {
 *     // Redis unavailable - fallback to direct storage
 *     return await storage.getProductById(productId);
 *   }
 *
 *   const cacheKey = `product:full:${productId}`;
 *
 *   // Try cache first
 *   const cached = await redisClient.get(cacheKey);
 *   if (cached) {
 *     return JSON.parse(cached);
 *   }
 *
 *   // Cache miss - fetch from storage
 *   const result = await storage.getProductById(productId);
 *   if (result) {
 *     // Cache for 5 minutes (300 seconds)
 *     await redisClient.set(cacheKey, JSON.stringify(result), 'EX', 300);
 *   }
 *
 *   return result;
 * }
 * ```
 *
 * **Cache Invalidation Pattern:**
 *
 * ```typescript
 * // After update operations
 * async function updateProductWithInvalidation(id: number, updates: Partial<InsertProduct>) {
 *   const result = await storage.updateProduct(id, updates);
 *
 *   // Invalidate caches
 *   const redisClient = getRedisClient();
 *   if (redisClient && result) {
 *     await redisClient.del(`product:full:${id}`);
 *     // Also invalidate search results (pattern-based)
 *     const keys = await redisClient.keys('product:search:*');
 *     if (keys.length > 0) {
 *       await redisClient.del(...keys);
 *     }
 *   }
 *
 *   return result;
 * }
 * ```
 *
 * **When NOT to Cache:**
 * - Write operations (creates, updates, deletes) - always go to database
 * - Security-sensitive operations (password resets, token validation)
 * - Real-time data requiring absolute freshness (websocket events)
 * - Low-traffic endpoints where cache overhead exceeds benefit
 * - Data with complex invalidation requirements
 *
 * **Cache Performance Notes:**
 * - Redis latency: 1-2ms typical (vs 10-50ms for database queries)
 * - Serialization overhead: JSON.stringify/parse adds ~0.1-0.5ms
 * - Cache hit rates >80% indicate good TTL selection
 * - Monitor cache memory usage - evict old keys if memory constrained
 * - Use Redis pipelining for bulk operations
 *
 * See `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` for complete implementation guide.
 */
export class DatabaseStorage implements IStorage {
  private userStorage: UserStorage;
  private productStorage: ProductStorage;
  private priceStorage: PriceStorage;
  private watchListStorage: WatchListStorage;
  private retailerStorage: RetailerStorage;
  private jobLockStorage: JobLockStorage;
  private notificationStorage: NotificationStorage;

  constructor() {
    this.userStorage = new UserStorage(db);
    this.productStorage = new ProductStorage(db);
    this.priceStorage = new PriceStorage(db);
    this.watchListStorage = new WatchListStorage(db);
    this.retailerStorage = new RetailerStorage(db);
    this.jobLockStorage = new JobLockStorage(db);
    this.notificationStorage = new NotificationStorage(db);
  }

  // ============================================================================
  // Retailer Methods (delegated to RetailerStorage)
  // ============================================================================

  async getRetailers(): Promise<Retailer[]> {
    return this.retailerStorage.getRetailers();
  }

  async getAllRetailers(): Promise<Retailer[]> {
    return this.retailerStorage.getAllRetailers();
  }

  async getRetailerById(id: number): Promise<Retailer | null> {
    return this.retailerStorage.getRetailerById(id);
  }

  async getRetailersByIds(ids: number[]): Promise<Array<{ id: number; name: string }>> {
    return this.retailerStorage.getRetailersByIds(ids);
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    return this.retailerStorage.createRetailer(retailer);
  }

  async updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null> {
    return this.retailerStorage.updateRetailer(id, updates);
  }

  async deleteRetailer(id: number): Promise<Retailer | null> {
    return this.retailerStorage.deleteRetailer(id);
  }

  // ============================================================================
  // Private Non-Product Validation Helpers (Retailer validation moved to RetailerStorage)
  // ============================================================================

  /**
   * Validate and normalize limit parameter
   * @private
   */
  private validateSearchLimit(limit: number | undefined): number {
    const actualLimit = limit ?? PRODUCT_CONSTANTS.SEARCH.DEFAULT_LIMIT;
    if (actualLimit < 1 || actualLimit > PRODUCT_CONSTANTS.SEARCH.MAX_LIMIT) {
      throw new Error(
        `Limit must be between 1 and ${PRODUCT_CONSTANTS.SEARCH.MAX_LIMIT}`
      );
    }
    return actualLimit;
  }

  /**
   * Validate days parameter
   * @private
   */
  private validateProductDays(days: number | undefined): number {
    const actualDays = days ?? 30;
    if (actualDays < 1 || actualDays > 365) {
      throw new Error('Days must be between 1 and 365');
    }
    return actualDays;
  }

  /**
   * Validate fuzzy search threshold
   * @private
   */
  private validateFuzzyThreshold(threshold: number): void {
    if (threshold < PRODUCT_CONSTANTS.FUZZY_SEARCH.MIN_THRESHOLD ||
        threshold > PRODUCT_CONSTANTS.FUZZY_SEARCH.MAX_THRESHOLD) {
      throw new Error(
        `Fuzzy threshold must be between ${PRODUCT_CONSTANTS.FUZZY_SEARCH.MIN_THRESHOLD} and ${PRODUCT_CONSTANTS.FUZZY_SEARCH.MAX_THRESHOLD}`
      );
    }
  }

  // ============================================================================
  // Product Methods (delegated to ProductStorage)
  // ============================================================================

  async getProducts(): Promise<Product[]> {
    return this.productStorage.getProducts();
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    return this.productStorage.createProduct(product);
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | null> {
    return this.productStorage.updateProduct(id, updates);
  }

  async deleteProduct(id: number): Promise<Product | null> {
    return this.productStorage.deleteProduct(id);
  }

  async getProductByIdRaw(id: number): Promise<Product | null> {
    return this.productStorage.getProductByIdRaw(id);
  }

  // SECURITY: passwordHash handled internally, NEVER exposed in SELECT queries
  async registerUser(userData: { username: string; email: string; passwordHash: string }): Promise<SafeUser> { // SECURITY: NEVER expose
    return this.userStorage.registerUser(userData); // SECURITY: NEVER expose
  }

  // SECURITY: passwordHash handled internally, NEVER exposed in queries
  async resetPassword(userId: number, newPasswordHash: string, token: string): Promise<void> { // SECURITY: NEVER expose
    return this.userStorage.resetPassword(userId, newPasswordHash, token); // SECURITY: NEVER expose
  }

  /**
   * PERFORMANCE OPTIMIZED: Database-level aggregation for product search
   *
   * Memory Optimization:
   * - Before: Loaded ALL offers into memory (1000+ offers), filtered/aggregated in JS
   * - After: Database aggregates, returns only top 3 offers per product (60 offers)
   * - Memory savings: ~94% reduction (2MB → 200KB per request)
   * - Response time: 200ms → <100ms
   *
   * Key improvements:
   * 1. Filtering done in SQL WHERE clauses (not in-memory)
   * 2. Aggregation done in SQL (MIN/AVG/COUNT, not JavaScript)
   * 3. Sorting done in SQL ORDER BY (not Array.sort)
   * 4. Pagination done in SQL LIMIT/OFFSET (not Array.slice)
   * 5. Only top 3 offers per product fetched (not all offers)
   *
   * See: todos/014-ready-p1-optimize-product-search-memory.md
   */
  async searchProducts(filters: SearchFilters): Promise<{
    products: ProductWithOffers[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.productStorage.searchProducts(filters);
  }

  async getProductById(id: number): Promise<ProductWithOffers | null> {
    return this.productStorage.getProductById(id);
  }

  async getProductOffers(productId: number): Promise<(ProductOffer & { retailer: Retailer })[]> {
    return this.productStorage.getProductOffers(productId);
  }

  async createProductOffer(offer: InsertProductOffer): Promise<ProductOffer> {
    return this.productStorage.createProductOffer(offer);
  }

  // Affiliate Link Operations
  async getProductOfferById(offerId: number): Promise<ProductOffer | null> {
    return this.productStorage.getProductOfferById(offerId);
  }

  async updateProductOfferAffiliateLink(
    offerId: number,
    data: { affiliateUrl: string; linkHealthStatus: 'healthy' | 'broken' | 'unknown'; lastLinkCheck: Date }
  ): Promise<void> {
    return this.productStorage.updateProductOfferAffiliateLink(offerId, data);
  }

  async incrementProductOfferClickCount(offerId: number): Promise<void> {
    return this.productStorage.incrementProductOfferClickCount(offerId);
  }

  async getProductOffersByRetailerId(retailerId: number): Promise<ProductOffer[]> {
    return this.productStorage.getProductOffersByRetailerId(retailerId);
  }

  async getProductOffersByProductId(productId: number): Promise<ProductOffer[]> {
    return this.productStorage.getProductOffersByProductId(productId);
  }

  async getAllOffersWithDetails(): Promise<Array<{
    offerId: number;
    productId: number;
    retailerId: number;
    currentPrice: string;
    productName: string;
    retailerName: string;
  }>> {
    return this.productStorage.getAllOffersWithDetails();
  }

  async getAffiliateLinkStats(retailerId?: number): Promise<AffiliateLinkStats> {
    const baseQuery = db
      .select({
        total_offers: count(),
        affiliate_offers: sql<number>`COUNT(${productOffers.affiliateUrl})`,
        total_clicks: sql<number>`COALESCE(SUM(${productOffers.clickCount}), 0)`,
        healthy_links: sql<number>`COUNT(CASE WHEN ${productOffers.linkHealthStatus} = 'healthy' THEN 1 END)`,
        broken_links: sql<number>`COUNT(CASE WHEN ${productOffers.linkHealthStatus} = 'broken' THEN 1 END)`,
      })
      .from(productOffers);

    const result = retailerId
      ? await baseQuery.where(eq(productOffers.retailerId, retailerId))
      : await baseQuery;

    return result[0] || {
      total_offers: 0,
      affiliate_offers: 0,
      total_clicks: 0,
      healthy_links: 0,
      broken_links: 0
    };
  }

  /**
   * Search for a product by URL (used by browser extension)
   * Searches product offers for matching URLs using LIKE pattern
   */
  async getProductByUrl(productUrl: string): Promise<{
    product: Product;
    offer: ProductOffer;
    retailer: Retailer;
  } | null> {
    return this.productStorage.getProductByUrl(productUrl);
  }

  // Price History Methods
  /**
   * Get price history with smart data source selection
   * Automatically uses aggregated data for longer time ranges
   */
  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]> {
    return this.priceStorage.getPriceHistory(productId, days);
  }

  /**
   * Get retailer-specific price history with smart data source selection
   */
  async getRetailerPriceHistory(productId: number, retailerId: number, days?: number): Promise<PriceHistory[]> {
    return this.priceStorage.getRetailerPriceHistory(productId, retailerId, days);
  }

  async getPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
    return this.priceStorage.getPriceTrend(productId);
  }

  async getBestTimeToBuy(productId: number): Promise<BestTimeAnalysis> {
    return this.priceStorage.getBestTimeToBuy(productId);
  }

  // Watch Lists Implementation

  /**
   * Get all watch lists for a user with product counts
   * PERFORMANCE: Single query with LEFT JOIN and GROUP BY to count products
   */
  async getUserWatchLists(userId: number): Promise<WatchListWithCount[]> {
    return this.watchListStorage.getUserWatchLists(userId);
  }

  /**
   * Get watch list by ID with full product details
   * PERFORMANCE: Single query with JOINs to get product details and pricing
   * SECURITY: Verifies userId ownership before returning data
   */
  async getWatchListById(watchListId: number, userId: number): Promise<WatchListWithProducts | null> {
    return this.watchListStorage.getWatchListById(watchListId, userId);
  }

  /**
   * Create a new watch list for a user
   * VALIDATION: Enforces max 20 lists per user
   */
  async createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList> {
    return this.watchListStorage.createWatchList(userId, data);
  }

  /**
   * Update watch list name/description
   * SECURITY: Verifies userId ownership before update
   */
  async updateWatchList(
    watchListId: number,
    userId: number,
    updates: { name?: string; description?: string }
  ): Promise<WatchList> {
    return this.watchListStorage.updateWatchList(watchListId, userId, updates);
  }

  /**
   * Delete watch list
   * SECURITY: Verifies userId ownership before deletion
   * CASCADE: productWatches entries deleted automatically by FK constraint
   */
  async deleteWatchList(watchListId: number, userId: number): Promise<WatchList> {
    return this.watchListStorage.deleteWatchList(watchListId, userId);
  }

  /**
   * Add product to watch list
   * TRANSACTION: Atomic check and insert
   * VALIDATION: Checks product exists, not already in list, and list limit
   */
  async addProductToWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    return this.watchListStorage.addProductToWatchList(watchListId, productId, userId);
  }

  /**
   * Remove product from watch list
   * SECURITY: Verifies userId ownership
   */
  async removeProductFromWatchList(
    watchListId: number,
    productId: number,
    userId: number
  ): Promise<ProductWatch> {
    return this.watchListStorage.removeProductFromWatchList(watchListId, productId, userId);
  }

  /**
   * Get all watched products across all user's lists with mini-chart data
   * PERFORMANCE: Complex single query with aggregations for sparkline data
   */
  async getWatchedProducts(
    userId: number,
    options?: WatchedProductsOptions
  ): Promise<WatchedProductsResult> {
    return this.watchListStorage.getWatchedProducts(userId, options);
  }

  /**
   * Get aggregated statistics for user's watch lists
   * PERFORMANCE: Uses CTEs and database aggregations for efficiency
   */
  async getWatchListStats(userId: number): Promise<WatchListStats> {
    return this.watchListStorage.getWatchListStats(userId);
  }

  // Admin Product/Retailer Management
  async getAdminProducts(): Promise<AdminProduct[]> {
    return db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      brand: products.brand,
      model: products.model,
      image: products.image,
      createdAt: products.createdAt
    })
    .from(products)
    .orderBy(desc(products.createdAt));
  }

  async getAdminProductById(id: number): Promise<AdminProductWithOffers | null> {
    const [product] = await db.select()
      .from(products)
      .where(eq(products.id, id));

    if (!product) {
      return null;
    }

    // Get product offers for this product
    const offers = await db.select({
      id: productOffers.id,
      price: productOffers.price,
      originalPrice: productOffers.originalPrice,
      availability: productOffers.availability,
      productUrl: productOffers.productUrl,
      affiliateUrl: productOffers.affiliateUrl,
      retailer: {
        id: retailers.id,
        name: retailers.name,
        logo: retailers.logo
      }
    })
    .from(productOffers)
    .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
    .where(eq(productOffers.productId, id));

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      brand: product.brand,
      model: product.model,
      image: product.image,
      createdAt: product.createdAt,
      offers
    };
  }

  async createAdminProduct(data: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products)
      .values(data)
      .returning();
    return newProduct;
  }

  async updateAdminProduct(id: number, data: Partial<InsertProduct>): Promise<Product | null> {
    const [updatedProduct] = await db.update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct || null;
  }

  async deleteAdminProduct(id: number): Promise<Product | null> {
    const [deletedProduct] = await db.delete(products)
      .where(eq(products.id, id))
      .returning();
    return deletedProduct || null;
  }

  // ============================================================================
  // Admin Retailer Methods (delegated to RetailerStorage)
  // ============================================================================

  async getAdminRetailers(): Promise<Retailer[]> {
    return this.retailerStorage.getAdminRetailers();
  }

  async createAdminRetailer(data: InsertRetailer): Promise<Retailer> {
    return this.retailerStorage.createAdminRetailer(data);
  }

  async updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null> {
    return this.retailerStorage.updateAdminRetailer(id, data);
  }

  async deleteAdminRetailer(id: number): Promise<Retailer | null> {
    return this.retailerStorage.deleteAdminRetailer(id);
  }

  // ============================================================================
  // Affiliate Management Methods (delegated to RetailerStorage)
  // ============================================================================

  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    return this.retailerStorage.getRetailersWithAffiliateStats();
  }

  async updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null> {
    return this.retailerStorage.updateRetailerAffiliateConfig(id, config);
  }

  // ============================================================================
  // Private User Validation Helpers (Migrated to UserStorage)
  // ============================================================================
  // User validation methods (validateUserId, validateTrustLevel, validateProfileField)
  // have been migrated to server/storage/domains/user-storage.ts

  /**
   * Validate days parameter for analytics
   * @private
   */
  private validateDays(days: number | undefined): number {
    const actualDays = days ?? USER_CONSTANTS.GROWTH_DATA.DEFAULT_DAYS;
    if (actualDays < 1 || actualDays > USER_CONSTANTS.GROWTH_DATA.MAX_DAYS) {
      throw new Error(
        `Days must be between 1 and ${USER_CONSTANTS.GROWTH_DATA.MAX_DAYS}`
      );
    }
    return actualDays;
  }

  // ============================================================================
  // User Profile Management
  // ============================================================================

  async updateUserProfile(userId: number, data: { bio?: string; location?: string; website?: string; avatarUrl?: string }): Promise<void> {
    return this.userStorage.updateUserProfile(userId, data);
  }

  async updateUserTrustLevel(userId: number, trustLevel: number): Promise<void> {
    return this.userStorage.updateUserTrustLevel(userId, trustLevel);
  }

  async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
    return this.userStorage.suspendUser(userId, reason, moderatorId);
  }

  // Admin Analytics
  async getAllUsers(): Promise<AdminUser[]> {
    return this.userStorage.getAllUsers();
  }

  async getUserByIdSafe(id: number): Promise<SafeUser | null> {
    return this.userStorage.getUserByIdSafe(id);
  }

  async getUserCount(): Promise<number> {
    return this.userStorage.getUserCount();
  }

  async getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
    return this.userStorage.getAdminAnalyticsOverview();
  }

  async getUserGrowthData(): Promise<UserGrowthData[]> {
    return this.userStorage.getUserGrowthData();
  }

  async getProductActivityData(): Promise<{ date: string; count: number }[]> {
    // Return product creation activity by day
    const result = await db
      .select({
        date: sql<string>`DATE(${products.createdAt})`.as('date'),
        count: sql<number>`count(*)`.as('count'),
      })
      .from(products)
      .where(sql`${products.createdAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${products.createdAt})`)
      .orderBy(sql`DATE(${products.createdAt})`);
    return result.map(r => ({ date: String(r.date), count: Number(r.count) }));
  }

  async getTopProductCategories(limit: number): Promise<TopCategory[]> {
    // Return top product categories by count
    const result = await db
      .select({
        categoryName: products.category,
        productCount: sql<number>`count(*)`.as('productCount'),
      })
      .from(products)
      .where(sql`${products.category} IS NOT NULL`)
      .groupBy(products.category)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);
    return result.map(r => ({ categoryName: r.categoryName || 'Uncategorized', productCount: Number(r.productCount) }));
  }

  async checkDatabaseHealth(): Promise<boolean> {
    try {
      await db.select({ count: sql`1` }).from(users).limit(1);
      return true;
    } catch (error) {
      logger.error('Database health check failed:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async getTrendingProducts(status: string, limit: number): Promise<TrendingProduct[]> {
    const result = await db
      .select({
        id: trendingProducts.id,
        name: trendingProducts.name,
        category: trendingProducts.category,
        status: trendingProducts.status,
        discoveredAt: trendingProducts.discoveryDate,
      })
      .from(trendingProducts)
      .where(eq(trendingProducts.status, status))
      .orderBy(desc(trendingProducts.createdAt))
      .limit(limit);

    // Map to ensure status is never null (filtered by WHERE clause above)
    return result.map(row => ({
      ...row,
      status: row.status || 'unknown'
    }));
  }

  async getWeeklyAggregates(
    productId: number,
    options?: { year?: number; week?: number; retailerId?: number; limit?: number }
  ): Promise<WeeklyAggregate[]> {
    return this.priceStorage.getWeeklyAggregates(productId, options);
  }

  async getMonthlyAggregates(
    productId: number,
    options?: { year?: number; month?: number; retailerId?: number; limit?: number }
  ): Promise<MonthlyAggregate[]> {
    return this.priceStorage.getMonthlyAggregates(productId, options);
  }

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    // OPTIMIZATION: Use SQL COUNT(*) and GROUP BY instead of fetching all records
    const [weeklyCountResult, monthlyCountResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(priceAggregatesWeekly),
      db.select({ count: sql<number>`count(*)::int` }).from(priceAggregatesMonthly)
    ]);

    // Use GROUP BY to count trends by direction in a single query
    const trendStatsResult = await db
      .select({
        direction: priceTrends.trendDirection,
        count: sql<number>`count(*)::int`
      })
      .from(priceTrends)
      .groupBy(priceTrends.trendDirection);

    // Convert grouped results to breakdown object
    const trendCounts = {
      uptrend: 0,
      downtrend: 0,
      stable: 0
    };

    let totalTrends = 0;
    for (const stat of trendStatsResult) {
      totalTrends += stat.count;
      if (stat.direction === 'uptrend') trendCounts.uptrend = stat.count;
      else if (stat.direction === 'downtrend') trendCounts.downtrend = stat.count;
      else if (stat.direction === 'stable') trendCounts.stable = stat.count;
    }

    return {
      weeklyAggregates: weeklyCountResult[0]?.count || 0,
      monthlyAggregates: monthlyCountResult[0]?.count || 0,
      totalTrends,
      trendBreakdown: trendCounts
    };
  }

  async getJobLocks(): Promise<JobLock[]> {
    return this.jobLockStorage.getJobLocks();
  }

  // User Registration with transaction (first user becomes admin)
  // SECURITY: passwordHash handled internally, NEVER exposed in return value
  async createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string // SECURITY: NEVER expose
  ): Promise<{ user: SafeUser; isFirstUser: boolean }> {
    return this.userStorage.createUserWithTransaction(username, email, passwordHash); // SECURITY: NEVER expose
  }

  // =====================================================
  // WISHLIST METHODS
  // =====================================================

  async getUserWishlists(userId: number): Promise<WishlistWithItems[]> {
    // 1. Get all wishlists for user (1 query)
    const userWishlists = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.userId, userId))
      .orderBy(desc(wishlists.createdAt));

    if (userWishlists.length === 0) {
      return [];
    }

    // 2. Batch fetch all items for all wishlists (1 query instead of N)
    const wishlistIds = userWishlists.map(w => w.id);
    const allItems = await db
      .select({
        item: wishlistItems,
        product: products,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(inArray(wishlistItems.wishlistId, wishlistIds))
      .orderBy(desc(wishlistItems.priority), desc(wishlistItems.addedAt));

    // 3. Group items by wishlist ID
    const itemsByWishlist = new Map<number, typeof allItems>();
    for (const item of allItems) {
      const wishlistId = item.item.wishlistId;
      if (!itemsByWishlist.has(wishlistId)) {
        itemsByWishlist.set(wishlistId, []);
      }
      itemsByWishlist.get(wishlistId)!.push(item);
    }

    // 4. Build result with grouped items
    return userWishlists.map(wishlist => {
      const items = itemsByWishlist.get(wishlist.id) || [];
      return {
        ...wishlist,
        items: items.map(({ item, product }) => ({ ...item, product })),
        itemCount: items.length,
      };
    });
  }

  async getWishlistById(wishlistId: number, userId: number): Promise<WishlistWithItems | null> {
    const [wishlist] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)));

    if (!wishlist) return null;

    const items = await db
      .select({
        item: wishlistItems,
        product: products,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .where(eq(wishlistItems.wishlistId, wishlistId))
      .orderBy(desc(wishlistItems.priority), desc(wishlistItems.addedAt));

    return {
      ...wishlist,
      items: items.map(({ item, product }) => ({ ...item, product })),
      itemCount: items.length,
    };
  }

  async createWishlist(userId: number, data: { name: string; description?: string; isPublic?: boolean }): Promise<Wishlist> {
    const [wishlist] = await db
      .insert(wishlists)
      .values({
        userId,
        name: data.name,
        description: data.description ?? null,
        isPublic: data.isPublic ?? false,
      })
      .returning();

    return wishlist;
  }

  async updateWishlist(wishlistId: number, userId: number, updates: Partial<InsertWishlist>): Promise<Wishlist | null> {
    const [wishlist] = await db
      .update(wishlists)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)))
      .returning();

    return wishlist ?? null;
  }

  async deleteWishlist(wishlistId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)))
      .returning();

    return result.length > 0;
  }

  async addToWishlist(wishlistId: number, userId: number, productId: number, data?: { notes?: string; priority?: number }): Promise<WishlistItem> {
    // Verify wishlist belongs to user
    const [wishlist] = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.id, wishlistId), eq(wishlists.userId, userId)));

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    const [item] = await db
      .insert(wishlistItems)
      .values({
        wishlistId,
        userId,
        productId,
        notes: data?.notes ?? null,
        priority: data?.priority ?? 3,
      })
      .returning();

    return item;
  }

  async removeFromWishlist(wishlistId: number, userId: number, productId: number): Promise<boolean> {
    const result = await db
      .delete(wishlistItems)
      .where(
        and(
          eq(wishlistItems.wishlistId, wishlistId),
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.productId, productId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async isInWishlist(userId: number, productId: number): Promise<boolean> {
    const [item] = await db
      .select({ id: wishlistItems.id })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.productId, productId)
        )
      )
      .limit(1);

    return !!item;
  }

  async getUserWishlistItems(userId: number): Promise<WishlistItemWithProduct[]> {
    const items = await db
      .select({
        item: wishlistItems,
        product: products,
        wishlist: wishlists,
      })
      .from(wishlistItems)
      .innerJoin(products, eq(wishlistItems.productId, products.id))
      .innerJoin(wishlists, eq(wishlistItems.wishlistId, wishlists.id))
      .where(eq(wishlistItems.userId, userId))
      .orderBy(desc(wishlistItems.addedAt));

    if (items.length === 0) {
      return [];
    }

    // BATCH QUERY: Fetch all offers in ONE query (fixes N+1 pattern)
    const productIds = items.map(({ product }) => product.id);
    const allOffers = await db
      .select({
        productId: productOffers.productId,
        offer: productOffers,
        retailer: retailers,
      })
      .from(productOffers)
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(inArray(productOffers.productId, productIds));

    // Build map for O(1) lookup
    const offersByProduct = new Map<number, Array<ProductOffer & { retailer: Retailer }>>();
    for (const item of allOffers) {
      if (!offersByProduct.has(item.productId)) {
        offersByProduct.set(item.productId, []);
      }
      offersByProduct.get(item.productId)!.push({
        ...item.offer,
        retailer: item.retailer,
      });
    }

    // Populate results using map lookup (O(1) per item, no additional queries)
    const result: WishlistItemWithProduct[] = [];
    for (const { item, product, wishlist } of items) {
      const offers = offersByProduct.get(product.id) || [];
      const bestPrice = offers.length > 0
        ? Math.min(...offers.map(o => parseFloat(o.price)))
        : undefined;

      result.push({
        ...item,
        product: {
          ...product,
          offers,
          bestPrice,
        },
        wishlist,
      });
    }

    return result;
  }

  // =====================================================
  // PRODUCT SPECIFICATION METHODS
  // =====================================================

  async getProductSpecifications(productId: number): Promise<ProductSpecification[]> {
    return db
      .select()
      .from(productSpecifications)
      .where(eq(productSpecifications.productId, productId))
      .orderBy(productSpecifications.specGroup, productSpecifications.sortOrder);
  }

  async getProductSpecificationsGrouped(productId: number): Promise<SpecificationGroup[]> {
    const specs = await this.getProductSpecifications(productId);

    const grouped = specs.reduce((acc, spec) => {
      const groupName = spec.specGroup ?? 'General';
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(spec);
      return acc;
    }, {} as Record<string, ProductSpecification[]>);

    return Object.entries(grouped).map(([groupName, specs]) => ({
      groupName,
      specs,
    }));
  }

  async createProductSpecification(spec: InsertProductSpecification): Promise<ProductSpecification> {
    const [created] = await db
      .insert(productSpecifications)
      .values(spec)
      .returning();

    return created;
  }

  async createProductSpecificationsBatch(specs: InsertProductSpecification[]): Promise<ProductSpecification[]> {
    if (specs.length === 0) return [];

    return db
      .insert(productSpecifications)
      .values(specs)
      .returning();
  }

  async updateProductSpecification(specId: number, updates: Partial<InsertProductSpecification>): Promise<ProductSpecification | null> {
    const [spec] = await db
      .update(productSpecifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(productSpecifications.id, specId))
      .returning();

    return spec ?? null;
  }

  async deleteProductSpecification(specId: number): Promise<boolean> {
    const result = await db
      .delete(productSpecifications)
      .where(eq(productSpecifications.id, specId))
      .returning();

    return result.length > 0;
  }

  async deleteProductSpecifications(productId: number): Promise<number> {
    const result = await db
      .delete(productSpecifications)
      .where(eq(productSpecifications.productId, productId))
      .returning();

    return result.length;
  }

  async getProductFull(productId: number): Promise<ProductFull | null> {
    const product = await this.getProductById(productId);
    if (!product) return null;

    const specGroups = await this.getProductSpecificationsGrouped(productId);
    const specifications = await this.getProductSpecifications(productId);

    return {
      ...product,
      specifications,
      specGroups,
    };
  }

  // Job Lock Operations
  async acquireJobLock(jobName: string, lockedBy: string, ttlSeconds: number): Promise<{ success: boolean; id?: number }> {
    return this.jobLockStorage.acquireJobLock(jobName, lockedBy, ttlSeconds);
  }

  async getJobLockByName(jobName: string): Promise<JobLock | null> {
    return this.jobLockStorage.getJobLockByName(jobName);
  }

  async updateExpiredJobLock(jobName: string, lockedBy: string, newExpiresAt: Date): Promise<{ success: boolean; id?: number }> {
    return this.jobLockStorage.updateExpiredJobLock(jobName, lockedBy, newExpiresAt);
  }

  async releaseJobLock(jobName: string, lockedBy: string): Promise<boolean> {
    return this.jobLockStorage.releaseJobLock(jobName, lockedBy);
  }

  async extendJobLock(jobName: string, lockedBy: string, additionalSeconds: number): Promise<boolean> {
    return this.jobLockStorage.extendJobLock(jobName, lockedBy, additionalSeconds);
  }

  async isJobLocked(jobName: string): Promise<boolean> {
    return this.jobLockStorage.isJobLocked(jobName);
  }

  async cleanupExpiredJobLocks(): Promise<number> {
    return this.jobLockStorage.cleanupExpiredJobLocks();
  }

  // Password Reset Token Operations
  async createPasswordResetToken(
    userId: number,
    token: string,
    expiresAt: Date,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Invalidate any existing unused tokens for this user
      await tx
        .delete(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            eq(passwordResetTokens.isUsed, false)
          )
        );

      // Create the new token
      await tx.insert(passwordResetTokens).values({
        userId,
        token,
        expiresAt,
        isUsed: false,
        ipAddress: metadata?.ipAddress?.substring(0, 45),
        userAgent: metadata?.userAgent?.substring(0, 500),
      });
    });
  }

  async validatePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const tokenRecord = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        eq(passwordResetTokens.isUsed, false),
        sql`${passwordResetTokens.expiresAt} > NOW()`
      ),
    });
    return tokenRecord || null;
  }

  async markPasswordResetTokenAsUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
      })
      .where(eq(passwordResetTokens.token, token));
  }

  async cleanupExpiredPasswordResetTokens(): Promise<number> {
    const result = await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
    return result.rowCount || 0;
  }

  async getPasswordResetAttemptCount(userId: number, sinceDate: Date): Promise<number> {
    // Use COUNT instead of fetching all records for better performance
    const [result] = await db.select({
      count: sql<number>`COUNT(*)::int`
    }).from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          sql`${passwordResetTokens.createdAt} > ${sinceDate}`
        )
      );

    return result?.count ?? 0;
  }

  // ============================================================================
  // Notification Operations (Phase 8E + Phase 8A: Notification Service Migration)
  // ============================================================================

  async getNotificationCountByType(userId: number, type: string, sinceDate: Date): Promise<number> {
    return this.notificationStorage.getNotificationCountByType(userId, type, sinceDate);
  }

  async getUserEmailById(userId: number): Promise<{ email: string; username: string } | null> {
    return this.notificationStorage.getUserEmailById(userId);
  }

  async getUserNotifications(userId: number, filters?: { isRead?: boolean; type?: string; limit?: number; offset?: number }): Promise<Notification[]> {
    return this.notificationStorage.getUserNotifications(userId, filters);
  }

  async getNotificationStats(userId: number): Promise<{ total: number; unread: number; byType: Record<string, number> }> {
    return this.notificationStorage.getNotificationStats(userId);
  }

  async markAsRead(userId: number, notificationIds: number | number[]): Promise<number> {
    return this.notificationStorage.markAsRead(userId, notificationIds);
  }

  async markAllAsRead(userId: number): Promise<number> {
    return this.notificationStorage.markAllAsRead(userId);
  }

  async deleteNotification(userId: number, notificationId: number): Promise<boolean> {
    return this.notificationStorage.deleteNotification(userId, notificationId);
  }

  async deleteAllNotifications(userId: number): Promise<number> {
    return this.notificationStorage.deleteAllNotifications(userId);
  }

  async createNotification(notification: InsertNotification, preferences: NotificationPreferences): Promise<Notification> {
    return this.notificationStorage.createNotification(notification, preferences);
  }

  async getUserPreferences(userId: number): Promise<NotificationPreferences | null> {
    return this.notificationStorage.getUserPreferences(userId);
  }

  async createDefaultPreferences(userId: number): Promise<NotificationPreferences> {
    return this.notificationStorage.createDefaultPreferences(userId);
  }

  async updateUserPreferences(userId: number, updates: Partial<InsertNotificationPreferences>): Promise<NotificationPreferences> {
    return this.notificationStorage.updateUserPreferences(userId, updates);
  }

  async getRecentPriceDrops(userId: number, days?: number): Promise<Notification[]> {
    return this.notificationStorage.getRecentPriceDrops(userId, days);
  }

  async getRecentPriceAlerts(userId: number, days?: number): Promise<Notification[]> {
    return this.notificationStorage.getRecentPriceAlerts(userId, days);
  }

  // ============================================================================
  // Price Analytics Operations (Phase 3 Storage Migration - Database Implementations)
  // ============================================================================

  // Price Aggregation Data Access
  async getPriceDataForAggregation(startDate: Date, endDate: Date, productId?: number): Promise<PriceAggregationData[]> {
    return this.priceStorage.getPriceDataForAggregation(startDate, endDate, productId);
  }

  async getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]> {
    return this.priceStorage.getWeeklyAggregatesData(year, week);
  }

  async getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]> {
    return this.priceStorage.getDailyAggregatesData(date);
  }

  async getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]> {
    return this.priceStorage.getMonthlyAggregatesData(year, month);
  }

  async upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void> {
    return this.priceStorage.upsertDailyAggregates(values);
  }

  async upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void> {
    return this.priceStorage.upsertWeeklyAggregates(values);
  }

  async upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void> {
    return this.priceStorage.upsertMonthlyAggregates(values);
  }

  async markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void> {
    return this.priceStorage.markPriceHistoryAsAggregated(startDate, endDate);
  }

  async deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number> {
    return this.priceStorage.deleteOldAggregatedPriceHistory(cutoffDate);
  }

  // Price History Data Access
  async getProductOfferWithProduct(offerId: number): Promise<ProductOfferWithProduct | null> {
    const [result] = await db
      .select({
        offer: productOffers,
        product: products,
      })
      .from(productOffers)
      .innerJoin(products, eq(productOffers.productId, products.id))
      .where(eq(productOffers.id, offerId))
      .limit(1);

    return result || null;
  }

  async getLatestPriceForOffer(offerId: number): Promise<PriceHistory | null> {
    return this.priceStorage.getLatestPriceForOffer(offerId);
  }

  async insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory> {
    return this.priceStorage.insertPriceHistory(data);
  }

  async getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]> {
    return this.priceStorage.getPriceHistoryByQuery(query);
  }

  async getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]> {
    return this.priceStorage.getExistingSnapshotsForDate(date);
  }

  async insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void> {
    return this.priceStorage.insertPriceSnapshots(snapshots);
  }

  async updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void> {
    return this.priceStorage.updatePriceSnapshot(id, data);
  }

  // Price Snapshot Data Access
  async getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]> {
    return this.priceStorage.getProductOffersForSnapshot(batchSize, offset);
  }

  async getPriceHistoryForOffers(offerIds: number[]): Promise<Array<{ productOfferId: number; price: string }>> {
    return this.priceStorage.getPriceHistoryForOffers(offerIds);
  }

  async getPriceHistoryForAnalysis(offerIds: number[]): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    return this.priceStorage.getPriceHistoryForAnalysis(offerIds);
  }

  // Trend Analysis Data Access
  async getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]> {
    return this.priceStorage.getPriceDataGroupedForTrend(cutoffDate);
  }

  async upsertPriceTrends(values: PriceTrendInsert[]): Promise<void> {
    return this.priceStorage.upsertPriceTrends(values);
  }

  async getPriceTrendWithRetailer(productId: number, retailerId: number): Promise<PriceTrendWithRetailer | null> {
    return this.priceStorage.getPriceTrendWithRetailer(productId, retailerId);
  }

  async getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]> {
    return this.priceStorage.getPriceTrendsForProduct(productId);
  }

  // Smart Alerts Methods (Phase 8D)
  async getProductOfferIds(productId: number): Promise<number[]> {
    return this.priceStorage.getProductOfferIds(productId);
  }

  async getPriceHistoryForOfferIds(offerIds: number[], limit?: number): Promise<PriceHistory[]> {
    return this.priceStorage.getPriceHistoryForOfferIds(offerIds, limit);
  }

  async getUserActiveAlertsWithProducts(userId: number): Promise<Array<{
    productId: number;
    targetPrice: string;
    productName: string | null;
  }>> {
    return this.priceStorage.getUserActiveAlertsWithProducts(userId);
  }

  async getLowestPricedOffersForProducts(productIds: number[]): Promise<Array<{
    productId: number;
    id: number;
    price: string;
  }>> {
    return this.priceStorage.getLowestPricedOffersForProducts(productIds);
  }

  async getBatchPriceHistoryForOffers(offerIds: number[]): Promise<PriceHistory[]> {
    return this.priceStorage.getBatchPriceHistoryForOffers(offerIds);
  }

  async getUserPriceAlertsForEffectiveness(userId: number): Promise<PriceAlert[]> {
    return this.priceStorage.getUserPriceAlertsForEffectiveness(userId);
  }

  async getUserPriceAlerts(userId: number): Promise<PriceAlert[]> {
    return this.priceStorage.getUserPriceAlerts(userId);
  }

  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    return this.priceStorage.createPriceAlert(alert);
  }

  async updatePriceAlert(alertId: number, userId: number, updates: { targetPrice?: string; isActive?: boolean }): Promise<PriceAlert | null> {
    const [updated] = await db.update(priceAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning();
    return updated || null;
  }

  async deletePriceAlert(alertId: number, userId: number): Promise<boolean> {
    const [deleted] = await db.delete(priceAlerts)
      .where(and(eq(priceAlerts.id, alertId), eq(priceAlerts.userId, userId)))
      .returning();
    return !!deleted;
  }

  // Phase 8B: Price History Service Support
  async getRawPriceHistoryWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ history: PriceHistory; retailer: Retailer }>> {
    return this.priceStorage.getRawPriceHistoryWithRetailers(productId, startDate, endDate, retailerId);
  }

  async getDailyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: DailyAggregateRecord; retailer: Retailer }>> {
    return this.priceStorage.getDailyAggregatesWithRetailers(productId, startDate, endDate, retailerId);
  }

  async getWeeklyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: WeeklyAggregateRecord; retailer: Retailer }>> {
    return this.priceStorage.getWeeklyAggregatesWithRetailers(productId, startDate, endDate, retailerId);
  }

  async getMonthlyAggregatesWithRetailers(
    productId: number,
    startDate: Date,
    endDate: Date,
    retailerId?: number
  ): Promise<Array<{ agg: MonthlyAggregateRecord; retailer: Retailer }>> {
    return this.priceStorage.getMonthlyAggregatesWithRetailers(productId, startDate, endDate, retailerId);
  }

  async getActiveProductOffersGrouped(): Promise<Array<{
    productId: number;
    retailerId: number;
    price: string;
  }>> {
    return this.priceStorage.getActiveProductOffersGrouped();
  }

  async getPriceSnapshotsByFilters(
    productId: number,
    retailerId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<PriceSnapshotRecord[]> {
    return this.priceStorage.getPriceSnapshotsByFilters(productId, retailerId, startDate, endDate);
  }

  async deleteOldPriceHistory(cutoffDate: Date): Promise<number> {
    return this.priceStorage.deleteOldPriceHistory(cutoffDate);
  }

  async getRecentPriceChanges(cutoffDate: Date): Promise<Array<{
    productOfferId: number;
    price: string;
    recordedAt: Date | null;
  }>> {
    return this.priceStorage.getRecentPriceChanges(cutoffDate);
  }

  // ============================================================================
  // Community Service Operations (Phase 4 Storage Migration)
  // ============================================================================

  /**
   * Add a product to user's watch list
   */
  async addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null> {
    return this.watchListStorage.addProductWatchRecord(userId, productId);
  }

  /**
   * Remove a product from user's watch list
   */
  async removeProductWatchRecord(userId: number, productId: number): Promise<boolean> {
    return this.watchListStorage.removeProductWatchRecord(userId, productId);
  }

  /**
   * Get user's watched product IDs
   */
  async getUserProductWatchIds(userId: number): Promise<number[]> {
    return this.watchListStorage.getUserProductWatchIds(userId);
  }

  /**
   * Get watch count for a product
   */
  async getProductWatchCountByProduct(productId: number): Promise<number> {
    return this.watchListStorage.getProductWatchCountByProduct(productId);
  }

  /**
   * Get most watched products
   */
  async getMostWatchedProductStats(limit = 10): Promise<CommunityWatchStats[]> {
    return this.watchListStorage.getMostWatchedProductStats(limit);
  }

  /**
   * Check if user is watching a product
   */
  async isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean> {
    return this.watchListStorage.isUserWatchingProductCheck(userId, productId);
  }

  /**
   * Get or create user reputation record
   */
  async getOrCreateUserReputation(userId: number): Promise<UserReputation> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const result = await db
      .select()
      .from(userReputation)
      .where(eq(userReputation.userId, userId))
      .limit(1);

    if (result.length === 0) {
      // Create default reputation
      const newRep: InsertUserReputation = {
        userId,
        reputationPoints: 0,
        dealsSpotted: 0,
        accuratePredictions: 0,
        communityContributions: 0,
        level: 1,
      };

      const created = await db.insert(userReputation).values(newRep).returning();
      return created[0];
    }

    return result[0];
  }

  /**
   * Award reputation points atomically with SERIALIZABLE transaction
   * Uses SQL arithmetic to prevent read-modify-write race conditions
   */
  async updateUserReputationAtomic(
    userId: number,
    points: number,
    reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
  ): Promise<UserReputation> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    // Ensure user has a reputation record before updating
    await this.getOrCreateUserReputation(userId);

    // DATA INTEGRITY: Use SERIALIZABLE isolation to prevent concurrent update race conditions
    // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
    const result = await retryWithBackoff(
      async () => db.transaction(async (tx) => {
        // Build atomic update with SQL arithmetic to prevent read-modify-write race condition
        const updateResult = await tx
          .update(userReputation)
          .set({
            reputationPoints: sql`${userReputation.reputationPoints} + ${points}`,
            dealsSpotted: reason === 'deal_spotted'
              ? sql`${userReputation.dealsSpotted} + 1`
              : userReputation.dealsSpotted,
            accuratePredictions: reason === 'accurate_prediction'
              ? sql`${userReputation.accuratePredictions} + 1`
              : userReputation.accuratePredictions,
            communityContributions: reason === 'community_contribution'
              ? sql`${userReputation.communityContributions} + 1`
              : userReputation.communityContributions,
          })
          .where(eq(userReputation.userId, userId))
          .returning();

        return updateResult[0];
      }, { isolationLevel: 'serializable' }),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'updateUserReputationAtomic', userId, reason },
        onRetry: (error, attempt, delayMs) => {
          logger.warn('[Storage] Retrying updateUserReputationAtomic after serialization error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            delayMs,
            userId,
          });
        },
      }
    );

    return result;
  }

  /**
   * Get community leaderboard of top users
   */
  async getCommunityLeaderboard(limit = 10): Promise<CommunityLeaderboardEntry[]> {
    if (limit <= 0 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }

    const result = await db
      .select({
        userId: userReputation.userId,
        username: users.username,
        reputationPoints: userReputation.reputationPoints,
        dealsSpotted: userReputation.dealsSpotted,
        level: userReputation.level,
      })
      .from(userReputation)
      .innerJoin(users, eq(users.id, userReputation.userId))
      .orderBy(desc(userReputation.reputationPoints))
      .limit(limit);

    return result.map((r, index) => ({
      userId: r.userId,
      username: r.username,
      reputationPoints: r.reputationPoints ?? 0,
      dealsSpotted: r.dealsSpotted ?? 0,
      level: r.level ?? 0,
      rank: index + 1,
    }));
  }

  /**
   * Get badge by name
   */
  async getBadgeByName(name: string): Promise<Badge | null> {
    if (!name) {
      throw new Error('name is required');
    }

    const result = await db
      .select()
      .from(badges)
      .where(eq(badges.name, name))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Batch query for badges by names (N+1 prevention)
   */
  async getBadgesByNames(names: string[]): Promise<Badge[]> {
    if (!names || names.length === 0) {
      return [];
    }

    return db
      .select()
      .from(badges)
      .where(inArray(badges.name, names));
  }

  /**
   * Check if user has a specific badge
   */
  async checkUserHasBadge(userId: number, badgeId: number): Promise<boolean> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!badgeId || badgeId <= 0) {
      throw new Error('badgeId must be a positive number');
    }

    const result = await db
      .select()
      .from(userBadges)
      .where(
        and(
          eq(userBadges.userId, userId),
          eq(userBadges.badgeId, badgeId)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Get all badge IDs for a user (N+1 prevention)
   */
  async getUserBadgeIds(userId: number): Promise<number[]> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const result = await db
      .select({ badgeId: userBadges.badgeId })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));

    return result.map(r => r.badgeId);
  }

  /**
   * Award badge to user with notification (transactional)
   * UX: Transaction ensures badge award and notification are atomic
   */
  async awardBadgeWithNotification(userId: number, badgeId: number, badgeName: string): Promise<void> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!badgeId || badgeId <= 0) {
      throw new Error('badgeId must be a positive number');
    }
    if (!badgeName) {
      throw new Error('badgeName is required');
    }

    // UX: Use transaction to ensure badge award and notification are atomic
    // If notification fails, user gets badge but never knows about it (poor UX)
    await db.transaction(async (tx) => {
      // Award badge
      await tx.insert(userBadges).values({
        userId,
        badgeId,
      });

      // Send notification - must succeed or rollback badge award
      await tx.insert(notifications).values({
        userId,
        type: 'badge_earned',
        title: `Badge Earned: ${badgeName}!`,
        content: `Congratulations! You've earned the "${badgeName}" badge!`,
      });
    });
  }

  /**
   * Create deal spotting record with reputation entry (transactional)
   * DATA INTEGRITY: Deal spotting and reputation must be recorded together
   */
  async createDealSpottingWithReputation(data: CreateDealSpottingData): Promise<DealSpotting> {
    if (!data.userId || data.userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!data.productId || data.productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const spotting: InsertDealSpotting = {
      userId: data.userId,
      productId: data.productId,
      priceDropPercent: data.priceDropPercent.toFixed(2),
      priceDropAmount: data.priceDropAmount.toFixed(2),
      reputationAwarded: data.reputationAwarded,
    };

    // DATA INTEGRITY: Use transaction to ensure deal spotting and reputation award are atomic
    // If reputation award fails, deal should not be recorded (inconsistent data)
    let dealSpotting: DealSpotting;
    await db.transaction(async (tx) => {
      const result = await tx.insert(dealSpottings).values(spotting).returning();
      dealSpotting = result[0];

      // Award reputation - must succeed or rollback deal spotting
      // UPSERT: Create reputation record if it doesn't exist, or update existing one
      await tx
        .insert(userReputation)
        .values({
          userId: data.userId,
          reputationPoints: data.reputationAwarded,
          dealsSpotted: 1,
        })
        .onConflictDoUpdate({
          target: userReputation.userId,
          set: {
            reputationPoints: sql`${userReputation.reputationPoints} + ${data.reputationAwarded}`,
            dealsSpotted: sql`${userReputation.dealsSpotted} + 1`,
            updatedAt: new Date(),
          },
        });
    });

    return dealSpotting!;
  }

  /**
   * Get recent deal spottings
   */
  async getRecentDealSpottingsData(limit = 10): Promise<DealSpotting[]> {
    if (limit <= 0 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }

    return db
      .select()
      .from(dealSpottings)
      .orderBy(desc(dealSpottings.createdAt))
      .limit(limit);
  }

  /**
   * Get next sort order for user's watch lists
   */
  async getNextWatchListSortOrder(userId: number): Promise<number> {
    return this.watchListStorage.getNextWatchListSortOrder(userId);
  }

  /**
   * Create a new watch list for a user
   */
  async createWatchListRecord(data: CreateWatchListData): Promise<WatchList> {
    return this.watchListStorage.createWatchListRecord(data);
  }

  /**
   * Get all watch lists for a user with stats
   */
  async getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]> {
    return this.watchListStorage.getWatchListsWithStats(userId);
  }

  /**
   * Get a specific watch list with stats
   */
  async getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null> {
    return this.watchListStorage.getWatchListByIdWithStats(userId, listId);
  }

  /**
   * Update a watch list
   */
  async updateWatchListRecord(
    userId: number,
    listId: number,
    updates: WatchListUpdates
  ): Promise<WatchList | null> {
    return this.watchListStorage.updateWatchListRecord(userId, listId, updates);
  }

  /**
   * Delete a watch list (prevents deletion of default list)
   */
  async deleteWatchListRecord(userId: number, listId: number): Promise<boolean> {
    return this.watchListStorage.deleteWatchListRecord(userId, listId);
  }

  /**
   * Get products in a watch list with details
   */
  async getWatchListProductsWithDetails(
    userId: number,
    listId: number
  ): Promise<WatchListProductWithDetails[]> {
    return this.watchListStorage.getWatchListProductsWithDetails(userId, listId);
  }

  /**
   * Update product watch details
   */
  async updateProductWatchRecord(
    userId: number,
    watchId: number,
    updates: ProductWatchUpdates
  ): Promise<ProductWatch | null> {
    return this.watchListStorage.updateProductWatchRecord(userId, watchId, updates);
  }

  /**
   * Move products to a different watch list (bulk operation)
   */
  async moveProductWatchesBulk(
    userId: number,
    watchIds: number[],
    targetListId: number | null
  ): Promise<number> {
    return this.watchListStorage.moveProductWatchesBulk(userId, watchIds, targetListId);
  }

  /**
   * Remove multiple products from watch lists (bulk delete)
   */
  async deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number> {
    return this.watchListStorage.deleteProductWatchesBulk(userId, watchIds);
  }

  /**
   * Get user's default watch list
   */
  async getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null> {
    return this.watchListStorage.getUserDefaultWatchListRecord(userId);
  }

  /**
   * Export user's watch lists and products as JSON
   * FIXED N+1: Batch query all products for all lists at once
   */
  async exportUserWatchListsData(userId: number): Promise<WatchListExportData> {
    return this.watchListStorage.exportUserWatchListsData(userId);
  }

  /**
   * Import watch lists from JSON export (transactional all-or-nothing)
   */
  async importWatchListsData(
    userId: number,
    data: WatchListImportData
  ): Promise<{ created: number; skipped: number }> {
    return this.watchListStorage.importWatchListsData(userId, data);
  }

  /**
   * Get users watching a product
   */
  async getWatchersForProduct(productId: number): Promise<number[]> {
    return this.watchListStorage.getWatchersForProduct(productId);
  }

  /**
   * Notify all product watchers
   */
  async notifyProductWatchers(productId: number, notification: WatcherNotificationData): Promise<void> {
    return this.watchListStorage.notifyProductWatchers(productId, notification);
  }

  // ============================================================================
  // Phase 6: Monitoring Service Methods
  // ============================================================================

  async getRecentAgentSessions(hours: number, limit: number): Promise<AgentSessionData[]> {
    if (hours <= 0) {
      throw new Error('hours must be greater than 0');
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    const sessions = await db.select({
      id: agentSessions.id,
      agentType: agentSessions.agentType,
      status: agentSessions.status,
      sessionStart: agentSessions.sessionStart,
      tasksCompleted: agentSessions.tasksCompleted,
      successRate: agentSessions.successRate,
      errorsEncountered: agentSessions.errorsEncountered,
    })
      .from(agentSessions)
      .where(gte(agentSessions.sessionStart, timeThreshold))
      .orderBy(desc(agentSessions.sessionStart))
      .limit(limit);

    // Type assertion: database schema guarantees non-null for required fields
    return sessions as AgentSessionData[];
  }

  async getRecentScrapingJobs(limit: number): Promise<ScrapingJobData[]> {
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    const jobs = await db.select({
      id: scrapingJobs.id,
      jobType: scrapingJobs.jobType,
      status: scrapingJobs.status,
      createdAt: scrapingJobs.createdAt,
      startedAt: scrapingJobs.startedAt,
      completedAt: scrapingJobs.completedAt,
      errorMessage: scrapingJobs.errorMessage,
    })
      .from(scrapingJobs)
      .orderBy(desc(scrapingJobs.createdAt))
      .limit(limit);

    // Type assertion: database schema guarantees non-null for required fields
    return jobs as ScrapingJobData[];
  }

  async getScrapingJobStatusCounts(): Promise<JobStatusCount[]> {
    const statusCounts = await db.select({
      status: scrapingJobs.status,
      count: count(),
    })
      .from(scrapingJobs)
      .groupBy(scrapingJobs.status);

    // Type assertion: status is non-null in database schema
    return statusCounts.map(row => ({
      status: row.status as string,
      count: Number(row.count),
    }));
  }

  async getActiveJobLocksCount(): Promise<number> {
    return this.jobLockStorage.getActiveJobLocksCount();
  }

  async getProductOffersCount(): Promise<number> {
    const result = await db.select({ count: count() })
      .from(productOffers);

    return Number(result[0]?.count ?? 0);
  }

  async getTrendingProductsStatusCounts(): Promise<TrendingProductStatusCount[]> {
    const statusCounts = await db.select({
      status: trendingProducts.status,
      count: count(),
    })
      .from(trendingProducts)
      .groupBy(trendingProducts.status);

    // Type assertion: status is non-null in database schema
    return statusCounts.map(row => ({
      status: row.status as string,
      count: Number(row.count),
    }));
  }

  async getActiveAgentSessionsCount(minutes: number): Promise<number> {
    if (minutes <= 0) {
      throw new Error('minutes must be greater than 0');
    }

    const timeThreshold = new Date(Date.now() - minutes * 60 * 1000);

    const result = await db.select({ count: count() })
      .from(agentSessions)
      .where(and(
        eq(agentSessions.status, 'active'),
        gte(agentSessions.sessionStart, timeThreshold)
      ));

    return Number(result[0]?.count ?? 0);
  }

  // ============================================================================
  // Phase 6: Price Drop Detection Methods
  // ============================================================================

  async getPriceHistoryByOfferId(productOfferId: number, limit: number): Promise<PriceHistory[]> {
    return this.priceStorage.getPriceHistoryByOfferId(productOfferId, limit);
  }

  async getProductOfferDetailsForAlert(productOfferId: number): Promise<ProductOfferForAlert | null> {
    if (productOfferId <= 0) {
      throw new Error('productOfferId must be greater than 0');
    }

    const result = await db.select({
      productId: productOffers.productId,
      productName: products.name,
      retailerName: retailers.name,
      productUrl: productOffers.productUrl,
      price: productOffers.price,
    })
      .from(productOffers)
      .leftJoin(products, eq(productOffers.productId, products.id))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(eq(productOffers.id, productOfferId))
      .limit(1);

    return result[0] || null;
  }

  async getTriggeredPriceAlerts(productId: number, newPrice: number): Promise<TriggeredPriceAlert[]> {
    if (productId <= 0) {
      throw new Error('productId must be greater than 0');
    }
    if (newPrice < 0) {
      throw new Error('newPrice must be non-negative');
    }

    const alerts = await db.select({
      id: priceAlerts.id,
      userId: priceAlerts.userId,
      productId: priceAlerts.productId,
      targetPrice: priceAlerts.targetPrice,
      isActive: priceAlerts.isActive,
      createdAt: priceAlerts.createdAt,
    })
      .from(priceAlerts)
      .where(and(
        eq(priceAlerts.productId, productId),
        eq(priceAlerts.isActive, true),
        sql`${priceAlerts.targetPrice}::numeric >= ${newPrice}`
      ));

    // Type assertion: database schema guarantees non-null for required fields
    return alerts as TriggeredPriceAlert[];
  }

  async getUsersWithActiveAlertsForProduct(productId: number): Promise<number[]> {
    if (productId <= 0) {
      throw new Error('productId must be greater than 0');
    }

    const result = await db.select({ userId: priceAlerts.userId })
      .from(priceAlerts)
      .where(and(
        eq(priceAlerts.productId, productId),
        eq(priceAlerts.isActive, true)
      ));

    return result.map(row => row.userId);
  }

  // ============================================================================
  // Phase 6: Product Discovery Fallback Methods
  // ============================================================================

  async searchProductsByTerms(searchTerms: string[], limit: number): Promise<ProductWithOffers[]> {
    if (!searchTerms || searchTerms.length === 0) {
      return [];
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Use Drizzle query builder with nested relations
    const productsResult = await db.query.products.findMany({
      where: or(
        ...searchTerms.map(term => or(
          like(products.name, `%${term}%`),
          like(products.description, `%${term}%`),
          like(products.category, `%${term}%`),
          like(products.brand, `%${term}%`)
        ))
      ),
      with: {
        offers: {
          with: {
            retailer: true
          }
        }
      },
      limit
    });

    return productsResult as ProductWithOffers[];
  }

  async getTrendingProductCategories(limit: number): Promise<ProductCategoryCount[]> {
    // Query trending products grouped by category
    const result = await db
      .select({
        category: trendingProducts.category,
        count: count(),
      })
      .from(trendingProducts)
      .where(isNotNull(trendingProducts.category))
      .groupBy(trendingProducts.category)
      .orderBy(desc(count()))
      .limit(limit);

    return result.map(row => ({
      category: row.category || 'Unknown',
      count: Number(row.count),
    }));
  }

  async getProductSearchSuggestions(searchTerm: string, limit: number): Promise<ProductSuggestion[]> {
    if (!searchTerm) {
      return [];
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Use Drizzle query builder for simple column selection
    const suggestions = await db.query.products.findMany({
      where: or(
        like(products.name, `%${searchTerm}%`),
        like(products.brand, `%${searchTerm}%`),
        like(products.category, `%${searchTerm}%`)
      ),
      columns: {
        name: true,
        brand: true,
        category: true,
      },
      limit: limit * 2, // Fetch more for deduplication
    });

    return suggestions;
  }

  // ============================================================================
  // Phase 6: Advanced Search Methods
  // ============================================================================

  async searchProductsExact(searchPattern: string, limit: number): Promise<ProductWithOffersAndRetailers[]> {
    if (!searchPattern) {
      return [];
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Complex query with json_agg for nested offers+retailers structure
    const results = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      brand: products.brand,
      image: products.image,
      offers: sql<Array<{
        id: number;
        price: string;
        availability: string | null;
        productUrl: string | null;
        retailer: {
          id: number;
          name: string;
          websiteUrl: string | null;
        } | null;
      }>>`
        json_agg(json_build_object(
          'id', ${productOffers.id},
          'price', ${productOffers.price}::text,
          'availability', ${productOffers.availability},
          'productUrl', ${productOffers.productUrl},
          'retailer', json_build_object(
            'id', ${retailers.id},
            'name', ${retailers.name},
            'websiteUrl', ${retailers.website}
          )
        )) FILTER (WHERE ${productOffers.id} IS NOT NULL)
      `
    })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(or(
        sql`LOWER(${products.name}) LIKE LOWER(${searchPattern})`,
        sql`LOWER(${products.brand}) LIKE LOWER(${searchPattern})`
      ))
      .groupBy(products.id, products.name, products.description, products.category, products.brand, products.image)
      .limit(limit);

    return results.map(row => ({
      ...row,
      offers: row.offers || []
    }));
  }

  async searchProductsFuzzy(searchPattern: string, threshold: number, limit: number): Promise<ProductWithOffersAndRetailers[]> {
    if (!searchPattern) {
      return [];
    }
    if (threshold < 0 || threshold > 1) {
      throw new Error('threshold must be between 0 and 1');
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Fuzzy search using similarity function (requires pg_trgm extension)
    const results = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      brand: products.brand,
      image: products.image,
      offers: sql<Array<{
        id: number;
        price: string;
        availability: string | null;
        productUrl: string | null;
        retailer: {
          id: number;
          name: string;
          websiteUrl: string | null;
        } | null;
      }>>`
        json_agg(json_build_object(
          'id', ${productOffers.id},
          'price', ${productOffers.price}::text,
          'availability', ${productOffers.availability},
          'productUrl', ${productOffers.productUrl},
          'retailer', json_build_object(
            'id', ${retailers.id},
            'name', ${retailers.name},
            'websiteUrl', ${retailers.website}
          )
        )) FILTER (WHERE ${productOffers.id} IS NOT NULL)
      `
    })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(sql`similarity(${products.name}, ${searchPattern}) > ${threshold}`)
      .groupBy(products.id, products.name, products.description, products.category, products.brand, products.image)
      .orderBy(sql`similarity(${products.name}, ${searchPattern}) DESC`)
      .limit(limit);

    return results.map(row => ({
      ...row,
      offers: row.offers || []
    }));
  }

  async searchProductsBySynonyms(searchTerms: string[], limit: number): Promise<ProductWithOffersAndRetailers[]> {
    if (!searchTerms || searchTerms.length === 0) {
      return [];
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Batch query with multiple OR conditions for synonym matching
    const results = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      brand: products.brand,
      image: products.image,
      offers: sql<Array<{
        id: number;
        price: string;
        availability: string | null;
        productUrl: string | null;
        retailer: {
          id: number;
          name: string;
          websiteUrl: string | null;
        } | null;
      }>>`
        json_agg(json_build_object(
          'id', ${productOffers.id},
          'price', ${productOffers.price}::text,
          'availability', ${productOffers.availability},
          'productUrl', ${productOffers.productUrl},
          'retailer', json_build_object(
            'id', ${retailers.id},
            'name', ${retailers.name},
            'websiteUrl', ${retailers.website}
          )
        )) FILTER (WHERE ${productOffers.id} IS NOT NULL)
      `
    })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(or(
        ...searchTerms.map(term => or(
          sql`LOWER(${products.name}) LIKE LOWER('%' || ${term} || '%')`,
          sql`LOWER(${products.brand}) LIKE LOWER('%' || ${term} || '%')`,
          sql`LOWER(${products.description}) LIKE LOWER('%' || ${term} || '%')`
        ))
      ))
      .groupBy(products.id, products.name, products.description, products.category, products.brand, products.image)
      .limit(limit);

    return results.map(row => ({
      ...row,
      offers: row.offers || []
    }));
  }

  async searchProductsSemantic(embedding: number[], limit: number): Promise<ProductWithOffersAndRetailers[]> {
    if (!embedding || embedding.length === 0) {
      throw new Error('embedding must be a non-empty array');
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    // Convert embedding array to PostgreSQL vector string format
    const embeddingString = `[${embedding.join(',')}]`;

    // Semantic search using pgvector cosine distance operator (<=>)
    const results = await db.select({
      id: products.id,
      name: products.name,
      description: products.description,
      category: products.category,
      brand: products.brand,
      image: products.image,
      similarity: sql<number>`1 - (${products.embedding} <=> ${embeddingString}::vector)`,
      offers: sql<Array<{
        id: number;
        price: string;
        availability: string | null;
        productUrl: string | null;
        retailer: {
          id: number;
          name: string;
          websiteUrl: string | null;
        } | null;
      }>>`
        json_agg(json_build_object(
          'id', ${productOffers.id},
          'price', ${productOffers.price}::text,
          'availability', ${productOffers.availability},
          'productUrl', ${productOffers.productUrl},
          'retailer', json_build_object(
            'id', ${retailers.id},
            'name', ${retailers.name},
            'websiteUrl', ${retailers.website}
          )
        )) FILTER (WHERE ${productOffers.id} IS NOT NULL)
      `
    })
      .from(products)
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .leftJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(sql`${products.embedding} IS NOT NULL`)
      .groupBy(products.id, products.name, products.description, products.category, products.brand, products.image, products.embedding)
      .orderBy(sql`${products.embedding} <=> ${embeddingString}::vector`)
      .limit(limit);

    return results.map(row => ({
      ...row,
      offers: row.offers || []
    }));
  }

  async getProductAutocompleteSuggestions(query: string, limit: number): Promise<ProductSuggestion[]> {
    if (!query) {
      return [];
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    const suggestions = await db.select({
      name: products.name,
      brand: products.brand,
      category: products.category,
    })
      .from(products)
      .where(or(
        sql`LOWER(${products.name}) LIKE LOWER(${`%${query}%`})`,
        sql`LOWER(${products.brand}) LIKE LOWER(${`%${query}%`})`,
        sql`LOWER(${products.category}) LIKE LOWER(${`%${query}%`})`
      ))
      .limit(limit);

    return suggestions;
  }

  async getProductForEmbedding(productId: number): Promise<ProductForEmbedding | null> {
    if (productId <= 0) {
      throw new Error('productId must be greater than 0');
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        id: true,
        name: true,
        description: true,
        category: true,
        brand: true,
      }
    });

    return product || null;
  }

  async updateProductEmbedding(productId: number, embedding: number[]): Promise<void> {
    if (productId <= 0) {
      throw new Error('productId must be greater than 0');
    }
    if (!embedding || embedding.length === 0) {
      throw new Error('embedding must be a non-empty array');
    }

    // Convert embedding array to PostgreSQL vector format
    const embeddingString = `[${embedding.join(',')}]`;

    await db.update(products)
      .set({ embedding: sql`${embeddingString}::vector` })
      .where(eq(products.id, productId));
  }
}

// Initialize storage - use database when DATABASE_URL is available
export const storage = process.env.DATABASE_URL
  ? new DatabaseStorage()
  : new MemStorage();

// Job Lock Type
export interface JobLock {
  id: number;
  jobName: string;
  lockedBy: string;
  lockedAt: Date;
  expiresAt: Date;
  metadata: string | null;
}

// Price History Types
export interface PriceHistoryWithDetails extends PriceHistory {
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

// Watch List Types
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

// Admin Types
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

// Affiliate Types
export interface RetailerWithAffiliateStats extends Retailer {
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

// Admin User Types
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
  totalProducts: number;
  totalRetailers: number;
  totalAlerts: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface TopCategory {
  categoryName: string;
  productCount: number;
}

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
// Price Analytics Types (Phase 3 Storage Migration)
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
export type InsertPriceHistoryWithRecordedAt = InsertPriceHistory & {
  recordedAt: Date;
};

export interface ProductOfferWithProduct {
  offer: ProductOffer;
  product: Product;
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
// Community Service Types (Phase 4 Storage Migration)
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

export interface WatchListWithStats extends WatchList {
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

export interface WatchListProductWithDetails extends ProductWatch {
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

// WatchListImportData type is now imported from storage/types.ts to avoid duplication
export type { WatchListImportData } from './storage/types';

export interface WatcherNotificationData {
  type: string;
  title: string;
  content: string;
  relatedProductId?: number;
}

// ============================================================================
// Phase 6 Storage Layer Types - Monitoring, Price Drops, Discovery, Advanced Search
// ============================================================================

// Monitoring Service Types
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

// Price Drop Detection Types
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

// Advanced Search Types
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
