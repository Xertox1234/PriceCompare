import { retailers, products, productOffers, priceHistory, watchLists, productWatches, priceAlerts, users, forumTopics, forumPosts, forumCategories, trendingProducts, priceAggregatesWeekly, priceAggregatesMonthly, priceAggregatesDaily, priceSnapshots, priceTrends, jobLocks, notifications, passwordResetTokens, wishlists, wishlistItems, productSpecifications, userReputation, dealSpottings, badges, userBadges, agentSessions, scrapingJobs, type Retailer, type Product, type ProductOffer, type PriceHistory, type WatchList, type ProductWatch, type InsertWatchList, type InsertProductWatch, type InsertRetailer, type InsertProduct, type InsertProductOffer, type InsertPriceHistory, type ProductWithOffers, type SearchFilters, type User, type ForumTopic, type ForumPost, type Wishlist, type WishlistItem, type ProductSpecification, type InsertWishlist, type InsertWishlistItem, type InsertProductSpecification, type WishlistWithItems, type WishlistItemWithProduct, type ProductFull, type SpecificationGroup, type PasswordResetToken, type UserReputation, type DealSpotting, type Badge, type InsertUserReputation, type InsertDealSpotting } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, lt, inArray, sql, desc, asc, isNull, isNotNull, or, like, count } from "drizzle-orm";
import { retryWithBackoff, isTransientDatabaseError } from "./utils/retry-with-backoff";
import { logger } from "./utils/logger";
import { USER_CONSTANTS, PRODUCT_CONSTANTS, JOB_LOCK_CONSTANTS, ALERT_CONSTANTS } from "./utils/constants";

export interface IStorage {
  // Retailers
  getRetailers(): Promise<Retailer[]>;
  getAllRetailers(): Promise<Retailer[]>;
  getRetailerById(id: number): Promise<Retailer | null>;
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
  getWatchedProducts(userId: number, options?: WatchedProductsOptions): Promise<WatchedProductInfo[]>;
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

  // Forum Operations (with transactions)
  createTopicWithFirstPost(topicData: {
    title: string;
    authorId: number;
    categoryId?: number | null;
    productId?: number | null;
  }, content: string): Promise<ForumTopicResult>;

  createForumPost(topicId: number, authorId: number, content: string, rawContent: string): Promise<ForumPostResult>;

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
  getUserGrowthData(): Promise<Array<{ date: string; count: number }>>;
  getForumActivityData(): Promise<Array<{ date: string; count: number }>>;
  getTopCategories(limit?: number): Promise<Array<{ categoryName: string; topicCount: number }>>;

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

  // Trend Analysis Data Access
  getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]>;
  upsertPriceTrends(values: PriceTrendInsert[]): Promise<void>;
  getPriceTrendWithRetailer(productId: number, retailerId: number): Promise<PriceTrendWithRetailer | null>;
  getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]>;

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

  // Badge Operations
  getBadgeByName(name: string): Promise<Badge | null>;
  getBadgesByNames(names: string[]): Promise<Badge[]>; // Batch query for N+1 prevention
  checkUserHasBadge(userId: number, badgeId: number): Promise<boolean>;
  getUserBadgeIds(userId: number): Promise<number[]>; // Batch query for N+1 prevention
  awardBadgeWithNotification(userId: number, badgeId: number, badgeName: string): Promise<void>;

  // Deal Spotting Operations
  createDealSpottingWithReputation(data: CreateDealSpottingData): Promise<DealSpotting>;
  getRecentDealSpottingsData(limit: number): Promise<DealSpotting[]>;

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

  // Forum Auto-Post Operations
  getRecentTopicForProduct(productId: number, daysAgo: number): Promise<ForumTopic | null>;
  createPriceDropForumPostTransaction(data: PriceDropForumPostData): Promise<number | null>;
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
        .filter(price => price !== null) as number[];
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

  async getProductById(id: number): Promise<ProductWithOffers | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

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

  async getWatchedProducts(_userId: number, _options?: WatchedProductsOptions): Promise<WatchedProductInfo[]> {
    return [];
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

  async getRetailerById(id: number): Promise<Retailer | undefined> {
    return this.retailers.get(id);
  }

  async updateRetailer(_id: number, _updates: Partial<InsertRetailer>): Promise<Retailer | undefined> {
    throw new Error('Not supported in memory storage');
  }

  async deleteRetailer(_id: number): Promise<Retailer | undefined> {
    throw new Error('Not supported in memory storage');
  }

  async updateProduct(_id: number, _updates: Partial<InsertProduct>): Promise<Product | undefined> {
    throw new Error('Not supported in memory storage');
  }

  async deleteProduct(_id: number): Promise<Product | undefined> {
    throw new Error('Not supported in memory storage');
  }

  async getProductByIdRaw(id: number): Promise<Product | undefined> {
    return this.products.get(id);
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
    return { totalUsers: 0, totalTopics: 0, totalPosts: 0, totalCategories: 0 };
  }

  async getUserGrowthData(): Promise<Array<{ date: string; count: number }>> {
    return [];
  }

  async getForumActivityData(): Promise<Array<{ date: string; count: number }>> {
    return [];
  }

  async getTopCategories(_limit?: number): Promise<Array<{ categoryName: string; topicCount: number }>> {
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

  // Forum Operations (stub implementations)
  async createTopicWithFirstPost(_topicData: {
    title: string;
    authorId: number;
    categoryId?: number | null;
    productId?: number | null;
  }, _content: string): Promise<ForumTopicResult> {
    throw new Error('Forum operations not supported in memory storage');
  }

  async createForumPost(_topicId: number, _authorId: number, _content: string, _rawContent: string): Promise<ForumPostResult> {
    throw new Error('Forum operations not supported in memory storage');
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
  async createDealSpottingWithReputation(_data: CreateDealSpottingData): Promise<DealSpotting> {
    throw new Error('Not supported in memory storage');
  }
  async getRecentDealSpottingsData(_limit: number): Promise<DealSpotting[]> {
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
  async getRecentTopicForProduct(_productId: number, _daysAgo: number): Promise<ForumTopic | null> {
    throw new Error('Not supported in memory storage');
  }
  async createPriceDropForumPostTransaction(_data: PriceDropForumPostData): Promise<number | null> {
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
  async getRetailers(): Promise<Retailer[]> {
    const result = await db.select().from(retailers).where(eq(retailers.isActive, true));
    return result;
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    const [result] = await db
      .insert(retailers)
      .values({
        ...retailer,
        logo: retailer.logo || null,
        website: retailer.website || null,
        isActive: retailer.isActive ?? true
      })
      .returning();
    return result;
  }

  async getAllRetailers(): Promise<Retailer[]> {
    const result = await db.select().from(retailers);
    return result;
  }

  async getRetailerById(id: number): Promise<Retailer | null> {
    const [result] = await db.select().from(retailers).where(eq(retailers.id, id)).limit(1);
    return result || null;
  }

  async updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | null> {
    const [result] = await db
      .update(retailers)
      .set(updates)
      .where(eq(retailers.id, id))
      .returning();
    return result || null;
  }

  async deleteRetailer(id: number): Promise<Retailer | null> {
    const [result] = await db
      .delete(retailers)
      .where(eq(retailers.id, id))
      .returning();
    return result || null;
  }

  // ============================================================================
  // Private Product Validation Helpers
  // ============================================================================

  /**
   * Validate product ID is positive integer
   * Used by: getProductById, getProductOffers, and related methods
   * @private
   */
  private validateProductId(productId: number): void {
    if (!productId || productId < PRODUCT_CONSTANTS.VALIDATION.MIN_PRODUCT_ID || !Number.isInteger(productId)) {
      throw new Error(`Invalid productId: ${productId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate offer ID is positive integer
   * @private
   */
  private validateOfferId(offerId: number): void {
    if (!offerId || offerId < 1 || !Number.isInteger(offerId)) {
      throw new Error(`Invalid offerId: ${offerId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate retailer ID is positive integer
   * @private
   */
  private validateRetailerId(retailerId: number): void {
    if (!retailerId || retailerId < PRODUCT_CONSTANTS.VALIDATION.MIN_RETAILER_ID || !Number.isInteger(retailerId)) {
      throw new Error(`Invalid retailerId: ${retailerId}. Must be a positive integer.`);
    }
  }

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
  // Product Methods
  // ============================================================================

  async getProducts(): Promise<Product[]> {
    const result = await db.select().from(products);
    return result;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [result] = await db
      .insert(products)
      .values({
        name: product.name,
        image: product.image || null,
        category: product.category || null,
        brand: product.brand || null,
        description: product.description || null,
        model: product.model || null,
        // Type assertion: Drizzle stores JSON field as unknown, cast to expected vector array format
        embedding: (product.embedding as number[] | null) || null,
        embeddingUpdatedAt: product.embeddingUpdatedAt || null
      })
      .returning();
    return result;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | null> {
    const [result] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();
    return result || null;
  }

  async deleteProduct(id: number): Promise<Product | null> {
    const [result] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning();
    return result || null;
  }

  async getProductByIdRaw(id: number): Promise<Product | null> {
    const [result] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return result || null;
  }

  // SECURITY: passwordHash handled internally, NEVER exposed in SELECT queries
  async registerUser(userData: { username: string; email: string; passwordHash: string }): Promise<SafeUser> { // SECURITY: NEVER expose
    const [user] = await db.insert(users).values(userData).returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      trustLevel: users.trustLevel,
      isActive: users.isActive,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      // SECURITY: Never expose passwordHash
    });
    return user;
  }

  // SECURITY: passwordHash handled internally, NEVER exposed in queries
  async resetPassword(userId: number, newPasswordHash: string, token: string): Promise<void> { // SECURITY: NEVER expose
    await db.transaction(async (tx) => {
      // Update password hash (write operation, not a query)
      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash }) // SECURITY: NEVER expose passwordHash in SELECT queries
        .where(eq(users.id, userId));

      // Mark token as used
      await tx
        .update(passwordResetTokens)
        .set({ isUsed: true, usedAt: new Date() })
        .where(eq(passwordResetTokens.token, token));
    });
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
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100); // Cap at 100 items per page
    const offset = (page - 1) * limit;

    // Build WHERE conditions for both products and offers
    const whereConditions = [eq(retailers.isActive, true)];

    // Product-level filters
    if (filters.query) {
      const searchQuery = filters.query.trim();
      whereConditions.push(
        sql`${products}.search_vector @@ plainto_tsquery('english', ${searchQuery})`
      );
    }

    if (filters.category) {
      whereConditions.push(eq(products.category, filters.category));
    }

    // Offer-level filters (applied in WHERE, not in-memory)
    if (filters.minPrice) {
      whereConditions.push(gte(sql`CAST(${productOffers.price} AS DECIMAL)`, filters.minPrice));
    }

    if (filters.maxPrice) {
      whereConditions.push(lte(sql`CAST(${productOffers.price} AS DECIMAL)`, filters.maxPrice));
    }

    if (filters.retailers && filters.retailers.length > 0) {
      whereConditions.push(inArray(productOffers.retailerId, filters.retailers));
    }

    if (filters.minRating) {
      whereConditions.push(gte(sql`CAST(${productOffers.rating} AS DECIMAL)`, filters.minRating));
    }

    if (filters.availability && filters.availability.length > 0) {
      whereConditions.push(inArray(productOffers.availability, filters.availability));
    }

    // Build aggregation query with database-level calculations
    // This reduces memory usage by aggregating in PostgreSQL instead of JavaScript
    const baseQuery = db
      .select({
        // Product fields
        id: products.id,
        name: products.name,
        description: products.description,
        image: products.image,
        category: products.category,
        brand: products.brand,
        model: products.model,
        embedding: products.embedding,
        embeddingUpdatedAt: products.embeddingUpdatedAt,
        searchVector: products.searchVector,
        createdAt: products.createdAt,

        // Database-level aggregations (not calculated in JavaScript!)
        bestPrice: sql<number>`MIN(CAST(${productOffers.price} AS DECIMAL))`.as('best_price'),
        avgPrice: sql<number>`AVG(CAST(${productOffers.price} AS DECIMAL))`.as('avg_price'),
        offerCount: sql<number>`COUNT(${productOffers.id})`.as('offer_count'),

        // Aggregate original prices for savings calculation
        avgOriginalPrice: sql<number | null>`
          AVG(CAST(${productOffers.originalPrice} AS DECIMAL))
          FILTER (WHERE ${productOffers.originalPrice} IS NOT NULL)
        `.as('avg_original_price'),

        // Only fetch top 3 offers per product at DATABASE LEVEL (not in post-processing!)
        // Uses subquery with LIMIT to reduce network/memory: fetches only 3 offers per product
        topOffers: sql<string>`
          (
            SELECT COALESCE(json_agg(offer_data), '[]'::json)
            FROM (
              SELECT json_build_object(
                'id', po.id,
                'productId', po.product_id,
                'retailerId', po.retailer_id,
                'price', po.price,
                'originalPrice', po.original_price,
                'availability', po.availability,
                'rating', po.rating,
                'reviewCount', po.review_count,
                'productUrl', po.product_url,
                'affiliateUrl', po.affiliate_url,
                'shippingInfo', po.shipping_info,
                'dealType', po.deal_type,
                'lastUpdated', po.last_updated,
                'retailer', (
                  SELECT json_build_object(
                    'id', r.id,
                    'name', r.name,
                    'website', r.website,
                    'logo', r.logo,
                    'isActive', r.is_active
                  )
                  FROM retailers r
                  WHERE r.id = po.retailer_id
                )
              ) AS offer_data
              FROM product_offers po
              WHERE po.product_id = ${products.id}
              ORDER BY CAST(po.price AS DECIMAL) ASC
              LIMIT 3
            ) AS limited_offers
          )
        `.as('top_offers'),
      })
      .from(products)
      .innerJoin(productOffers, eq(products.id, productOffers.productId))
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(and(...whereConditions))
      .groupBy(products.id);

    // Get total count for pagination (before LIMIT/OFFSET)
    const countQuery = db
      .select({
        count: sql<number>`COUNT(DISTINCT ${products.id})`.as('count')
      })
      .from(products)
      .innerJoin(productOffers, eq(products.id, productOffers.productId))
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(and(...whereConditions));

    // Apply sorting in database (not in JavaScript!)
    // Build final query with ordering and pagination
    let finalQuery;
    if (filters.sortBy) {
      switch (filters.sortBy) {
        case "price_low":
          finalQuery = baseQuery.orderBy(asc(sql`best_price`)).limit(limit).offset(offset);
          break;
        case "price_high":
          finalQuery = baseQuery.orderBy(desc(sql`best_price`)).limit(limit).offset(offset);
          break;
        case "rating":
          finalQuery = baseQuery.orderBy(desc(sql`AVG(CAST(${productOffers.rating} AS DECIMAL))`)).limit(limit).offset(offset);
          break;
        case "popularity":
          finalQuery = baseQuery.orderBy(desc(sql`SUM(${productOffers.reviewCount})`)).limit(limit).offset(offset);
          break;
        default:
          finalQuery = baseQuery.limit(limit).offset(offset);
      }
    } else {
      finalQuery = baseQuery.limit(limit).offset(offset);
    }

    // Execute both queries in parallel
    const [results, countResult] = await Promise.all([
      finalQuery,
      countQuery
    ]);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    // Minimal post-processing: just parse JSON and format
    // No filtering, no aggregation, no sorting - all done in database!
    const productsWithOffers: ProductWithOffers[] = results.map(row => {
      const offers = JSON.parse(row.topOffers || '[]');

      // Database subquery already limits to 3 offers; slice is defensive fallback only
      const top3Offers = offers.slice(0, 3);

      // Calculate savings from database aggregates
      const avgOriginal = row.avgOriginalPrice;
      const savings = avgOriginal ? avgOriginal - row.bestPrice : null;
      const savingsPercentage = savings && avgOriginal ?
        Math.round((savings / avgOriginal) * 100) : null;

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        image: row.image,
        category: row.category,
        brand: row.brand,
        model: row.model,
        // Type assertion: JSON field from Drizzle query, cast to vector array type
        embedding: row.embedding as number[] | null,
        embeddingUpdatedAt: row.embeddingUpdatedAt,
        searchVector: row.searchVector,
        createdAt: row.createdAt,
        bestPrice: row.bestPrice,
        savings: savings || undefined,
        savingsPercentage: savingsPercentage || undefined,
        offers: top3Offers,
      };
    });

    return {
      products: productsWithOffers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getProductById(id: number): Promise<ProductWithOffers | null> {
    // Validate input
    this.validateProductId(id);

    const productResult = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (productResult.length === 0) return null;

    const product = productResult[0];
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
    // Validate input
    this.validateProductId(productId);

    const result = await db
      .select({
        offer: productOffers,
        retailer: retailers
      })
      .from(productOffers)
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(eq(productOffers.productId, productId));

    return result.map(row => ({
      ...row.offer,
      retailer: row.retailer
    }));
  }

  async createProductOffer(offer: InsertProductOffer): Promise<ProductOffer> {
    const [result] = await db
      .insert(productOffers)
      .values({
        ...offer,
        availability: offer.availability || null,
        rating: offer.rating || null,
        originalPrice: offer.originalPrice || null,
        reviewCount: offer.reviewCount || null,
        shippingInfo: offer.shippingInfo || null,
        dealType: offer.dealType || null,
        productUrl: offer.productUrl || null
      })
      .returning();
    return result;
  }

  // Affiliate Link Operations
  async getProductOfferById(offerId: number): Promise<ProductOffer | null> {
    const [offer] = await db
      .select()
      .from(productOffers)
      .where(eq(productOffers.id, offerId))
      .limit(1);
    return offer ?? null;
  }

  async updateProductOfferAffiliateLink(
    offerId: number,
    data: { affiliateUrl: string; linkHealthStatus: 'healthy' | 'broken' | 'unknown'; lastLinkCheck: Date }
  ): Promise<void> {
    await db
      .update(productOffers)
      .set({
        affiliateUrl: data.affiliateUrl,
        linkHealthStatus: data.linkHealthStatus,
        lastLinkCheck: data.lastLinkCheck,
      })
      .where(eq(productOffers.id, offerId));
  }

  async incrementProductOfferClickCount(offerId: number): Promise<void> {
    await db
      .update(productOffers)
      .set({
        clickCount: sql`COALESCE(${productOffers.clickCount}, 0) + 1`,
      })
      .where(eq(productOffers.id, offerId));
  }

  async getProductOffersByRetailerId(retailerId: number): Promise<ProductOffer[]> {
    return db
      .select()
      .from(productOffers)
      .where(eq(productOffers.retailerId, retailerId));
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
    // Escape LIKE special characters to prevent unintended pattern matching
    const escapedUrl = productUrl.replace(/[%_]/g, '\\$&');
    const result = await db
      .select({
        offer: productOffers,
        product: products,
        retailer: retailers
      })
      .from(productOffers)
      .innerJoin(products, eq(productOffers.productId, products.id))
      .innerJoin(retailers, eq(productOffers.retailerId, retailers.id))
      .where(like(productOffers.productUrl, `%${escapedUrl}%`))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { product, offer, retailer } = result[0];
    return { product, offer, retailer };
  }

  // Price History Methods
  /**
   * Get price history with smart data source selection
   * Automatically uses aggregated data for longer time ranges
   */
  async getPriceHistory(productId: number, days?: number): Promise<PriceHistoryWithDetails[]> {
    // Use optimized query that selects appropriate data source based on date range
    const { getPriceHistoryOptimized } = await import('./services/price-history-service');
    const optimizedData = await getPriceHistoryOptimized(productId, days || 30);

    // Convert normalized format to legacy format for backward compatibility
    return optimizedData.map(point => ({
      id: 0, // Not available in aggregated data
      productOfferId: 0, // Not available in aggregated data
      productId,
      retailerId: point.retailerId,
      price: point.price.toFixed(2),
      originalPrice: null,
      availability: point.availability || null,
      rating: null,
      reviewCount: null,
      source: point.source,
      confidence: '1.00',
      metadata: null,
      recordedAt: point.date,
      aggregatedAt: null,
      createdAt: point.date,
      retailerName: point.retailerName || '',
      retailerLogo: null,
    }));
  }

  /**
   * Get retailer-specific price history with smart data source selection
   */
  async getRetailerPriceHistory(productId: number, retailerId: number, days?: number): Promise<PriceHistory[]> {
    // Use optimized query with retailer filter
    const { getPriceHistoryOptimized } = await import('./services/price-history-service');
    const optimizedData = await getPriceHistoryOptimized(productId, days || 30, retailerId);

    // Convert normalized format to legacy format
    return optimizedData.map(point => ({
      id: 0,
      productOfferId: 0,
      productId,
      retailerId: point.retailerId,
      price: point.price.toFixed(2),
      originalPrice: null,
      availability: point.availability || null,
      rating: null,
      reviewCount: null,
      source: point.source,
      confidence: '1.00',
      metadata: null,
      recordedAt: point.date,
      aggregatedAt: null,
      createdAt: point.date,
    }));
  }

  async getPriceTrend(productId: number): Promise<PriceTrendAnalysis> {
    // Get price history for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Select only required columns for price calculations (performance optimization)
    const history = await db
      .select({
        price: priceHistory.price,
        recordedAt: priceHistory.recordedAt,
      })
      .from(priceHistory)
      .where(and(
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, thirtyDaysAgo)
      ))
      .orderBy(asc(priceHistory.recordedAt));

    if (history.length === 0) {
      // No history, use current price from offers
      const offers = await this.getProductOffers(productId);
      const currentPrice = offers.length > 0
        ? Math.min(...offers.map(o => parseFloat(o.price)))
        : 0;

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

    const prices = history.map(h => parseFloat(h.price));
    const currentPrice = prices[prices.length - 1];
    const oldestPrice = prices[0];
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);

    // Calculate trend
    const priceChange = currentPrice - oldestPrice;
    const changePercentage = oldestPrice > 0
      ? ((priceChange / oldestPrice) * 100)
      : 0;

    let trend: 'rising' | 'falling' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      trend = changePercentage > 0 ? 'rising' : 'falling';
    }

    return {
      productId,
      currentPrice,
      averagePrice,
      lowestPrice,
      highestPrice,
      trend,
      changePercentage,
      daysAnalyzed: history.length,
    };
  }

  async getBestTimeToBuy(productId: number): Promise<BestTimeAnalysis> {
    // Get price history for the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Select only required columns for price calculations (performance optimization)
    const history = await db
      .select({
        price: priceHistory.price,
        recordedAt: priceHistory.recordedAt,
      })
      .from(priceHistory)
      .where(and(
        eq(priceHistory.productId, productId),
        gte(priceHistory.recordedAt, ninetyDaysAgo)
      ))
      .orderBy(asc(priceHistory.recordedAt));

    // Get current price
    const offers = await this.getProductOffers(productId);
    const currentPrice = offers.length > 0
      ? Math.min(...offers.map(o => parseFloat(o.price)))
      : 0;

    if (history.length === 0) {
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

    const prices = history.map(h => parseFloat(h.price));
    const historicalAverage = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const lowestPriceLast90Days = Math.min(...prices);

    // Find days since lowest price
    const lowestPriceIndex = prices.lastIndexOf(lowestPriceLast90Days);
    const lowestPriceDate = history[lowestPriceIndex].recordedAt;
    const daysSinceLowest = Math.floor(
      (Date.now() - new Date(lowestPriceDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate price change velocity (change per day over last 7 days)
    const sevenDaysOfPrices = prices.slice(-7);
    const priceChangeVelocity = sevenDaysOfPrices.length >= 2
      ? (sevenDaysOfPrices[sevenDaysOfPrices.length - 1] - sevenDaysOfPrices[0]) / sevenDaysOfPrices.length
      : 0;

    // Determine recommendation
    let recommendation: 'buy_now' | 'wait' | 'good_deal' = 'buy_now';
    let confidenceScore = 0.5;

    const percentageBelowAverage = ((historicalAverage - currentPrice) / historicalAverage) * 100;

    if (currentPrice <= lowestPriceLast90Days * 1.05) {
      // Within 5% of historical low
      recommendation = 'good_deal';
      confidenceScore = 0.9;
    } else if (percentageBelowAverage > 10) {
      // More than 10% below average
      recommendation = 'good_deal';
      confidenceScore = 0.8;
    } else if (priceChangeVelocity < 0 && percentageBelowAverage > 0) {
      // Price is falling and below average
      recommendation = 'wait';
      confidenceScore = 0.7;
    } else if (priceChangeVelocity > 0 && percentageBelowAverage < -5) {
      // Price is rising and above average
      recommendation = 'wait';
      confidenceScore = 0.8;
    } else {
      recommendation = 'buy_now';
      confidenceScore = 0.6;
    }

    return {
      productId,
      currentPrice,
      historicalAverage,
      lowestPriceLast90Days,
      daysSinceLowest,
      recommendation,
      confidenceScore,
      priceChangeVelocity,
    };
  }

  // Watch Lists Implementation

  /**
   * Get all watch lists for a user with product counts
   * PERFORMANCE: Single query with LEFT JOIN and GROUP BY to count products
   */
  async getUserWatchLists(userId: number): Promise<WatchListWithCount[]> {
    const results = await db
      .select({
        id: watchLists.id,
        userId: watchLists.userId,
        name: watchLists.name,
        description: watchLists.description,
        color: watchLists.color,
        icon: watchLists.icon,
        isDefault: watchLists.isDefault,
        sortOrder: watchLists.sortOrder,
        createdAt: watchLists.createdAt,
        updatedAt: watchLists.updatedAt,
        productCount: sql<number>`COUNT(${productWatches.id})::int`.as('product_count'),
      })
      .from(watchLists)
      .leftJoin(productWatches, eq(watchLists.id, productWatches.watchListId))
      .where(eq(watchLists.userId, userId))
      .groupBy(watchLists.id)
      .orderBy(asc(watchLists.sortOrder), asc(watchLists.createdAt));

    return results;
  }

  /**
   * Get watch list by ID with full product details
   * PERFORMANCE: Single query with JOINs to get product details and pricing
   * SECURITY: Verifies userId ownership before returning data
   */
  async getWatchListById(watchListId: number, userId: number): Promise<WatchListWithProducts | null> {
    // First verify ownership and get watch list
    const [watchList] = await db
      .select({
        id: watchLists.id,
        name: watchLists.name,
        description: watchLists.description,
        color: watchLists.color,
        icon: watchLists.icon,
        isDefault: watchLists.isDefault,
        sortOrder: watchLists.sortOrder,
        createdAt: watchLists.createdAt,
        updatedAt: watchLists.updatedAt,
      })
      .from(watchLists)
      .where(and(
        eq(watchLists.id, watchListId),
        eq(watchLists.userId, userId) // Ownership verification
      ))
      .limit(1);

    if (!watchList) {
      return null;
    }

    // Get products with enriched data
    // PERFORMANCE: Single query with aggregations for current/historical prices
    const productResults = await db
      .select({
        id: products.id,
        name: products.name,
        image: products.image,
        addedAt: productWatches.createdAt,
        // Current price from lowest active offer
        currentPrice: sql<number | null>`
          MIN(CAST(${productOffers.price} AS DECIMAL))
        `.as('current_price'),
        // Lowest historical price from price history (last 90 days)
        lowestHistoricalPrice: sql<number | null>`
          (
            SELECT MIN(CAST(price AS DECIMAL))
            FROM ${priceHistory}
            WHERE ${priceHistory.productId} = ${products.id}
              AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '90 days'
          )
        `.as('lowest_historical_price'),
      })
      .from(productWatches)
      .innerJoin(products, eq(productWatches.productId, products.id))
      .leftJoin(productOffers, eq(products.id, productOffers.productId))
      .where(eq(productWatches.watchListId, watchListId))
      .groupBy(products.id, productWatches.createdAt)
      .orderBy(desc(productWatches.createdAt));

    // Calculate price drop percentage
    const productsWithCalcs = productResults.map(p => {
      const currentPrice = p.currentPrice || 0;
      const lowestPrice = p.lowestHistoricalPrice || currentPrice;
      const priceDropPercent = lowestPrice > 0
        ? Math.round(((currentPrice - lowestPrice) / lowestPrice) * 100)
        : 0;

      return {
        id: p.id,
        name: p.name,
        imageUrl: p.image || '',
        addedAt: p.addedAt || new Date(),
        currentPrice,
        lowestHistoricalPrice: lowestPrice,
        priceDropPercent,
      };
    });

    return {
      id: watchList.id,
      name: watchList.name,
      description: watchList.description,
      color: watchList.color,
      icon: watchList.icon,
      products: productsWithCalcs,
    };
  }

  /**
   * Create a new watch list for a user
   * VALIDATION: Enforces max 20 lists per user
   */
  async createWatchList(userId: number, data: { name: string; description?: string }): Promise<WatchList> {
    // Check user limit (max 20 lists)
    const [countResult] = await db
      .select({
        count: sql<number>`COUNT(*)::int`
      })
      .from(watchLists)
      .where(eq(watchLists.userId, userId));

    if (countResult.count >= 20) {
      throw new Error('Maximum watch list limit reached (20 lists per user)');
    }

    // Validate name length
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Watch list name is required');
    }
    if (data.name.length > 100) {
      throw new Error('Watch list name must be 100 characters or less');
    }

    const [result] = await db
      .insert(watchLists)
      .values({
        userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
      })
      .returning();

    // Emit WebSocket event for real-time updates
    try {
      const { getSocketIO } = await import('./websocket');
      const { emitWatchListUpdate } = await import('./websocket/handlers/watch-list-handler');
      const io = getSocketIO();
      if (io) {
        emitWatchListUpdate(io, userId, 'created', {
          id: result.id,
          name: result.name,
          description: result.description,
          productCount: 0,
        });
      }
    } catch (error) {
      // Don't fail the operation if WebSocket emit fails
      console.error('Failed to emit watch list created event:', error);
    }

    return result;
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
    // Validate updates
    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        throw new Error('Watch list name cannot be empty');
      }
      if (updates.name.length > 100) {
        throw new Error('Watch list name must be 100 characters or less');
      }
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof watchLists.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description.trim() || null;
    }

    const [result] = await db
      .update(watchLists)
      .set(updateData)
      .where(and(
        eq(watchLists.id, watchListId),
        eq(watchLists.userId, userId) // Ownership verification
      ))
      .returning();

    if (!result) {
      throw new Error('Watch list not found or unauthorized');
    }

    // Emit WebSocket event for real-time updates
    try {
      const { getSocketIO } = await import('./websocket');
      const { emitWatchListUpdate } = await import('./websocket/handlers/watch-list-handler');
      const io = getSocketIO();
      if (io) {
        emitWatchListUpdate(io, userId, 'updated', {
          id: result.id,
          name: result.name,
          description: result.description,
        });
      }
    } catch (error) {
      // Don't fail the operation if WebSocket emit fails
      console.error('Failed to emit watch list updated event:', error);
    }

    return result;
  }

  /**
   * Delete watch list
   * SECURITY: Verifies userId ownership before deletion
   * CASCADE: productWatches entries deleted automatically by FK constraint
   */
  async deleteWatchList(watchListId: number, userId: number): Promise<WatchList> {
    const [result] = await db
      .delete(watchLists)
      .where(and(
        eq(watchLists.id, watchListId),
        eq(watchLists.userId, userId) // Ownership verification
      ))
      .returning();

    if (!result) {
      throw new Error('Watch list not found or unauthorized');
    }

    // Emit WebSocket event for real-time updates
    try {
      const { getSocketIO } = await import('./websocket');
      const { emitWatchListUpdate } = await import('./websocket/handlers/watch-list-handler');
      const io = getSocketIO();
      if (io) {
        emitWatchListUpdate(io, userId, 'deleted', {
          id: result.id,
          name: result.name,
          description: result.description,
        });
      }
    } catch (error) {
      // Don't fail the operation if WebSocket emit fails
      console.error('Failed to emit watch list deleted event:', error);
    }

    return result;
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
    // RETRY: SERIALIZABLE transactions can fail with serialization errors under concurrent load
    const result = await retryWithBackoff(
      async () => db.transaction(async (tx) => {
        // Verify watch list ownership
        const [watchList] = await tx
          .select({ id: watchLists.id })
          .from(watchLists)
          .where(and(
            eq(watchLists.id, watchListId),
            eq(watchLists.userId, userId)
          ))
          .limit(1);

        if (!watchList) {
          throw new Error('Watch list not found or unauthorized');
        }

        // Check product exists and get details for WebSocket event
        const [product] = await tx
          .select({
            id: products.id,
            name: products.name,
            image: products.image,
          })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        if (!product) {
          throw new Error('Product not found');
        }

        // Check if already in watch list
        const [existing] = await tx
          .select({ id: productWatches.id })
          .from(productWatches)
          .where(and(
            eq(productWatches.watchListId, watchListId),
            eq(productWatches.productId, productId)
          ))
          .limit(1);

        if (existing) {
          throw new Error('Product already in watch list');
        }

        // Check product limit per list (max 100 products)
        const [countResult] = await tx
          .select({
            count: sql<number>`COUNT(*)::int`
          })
          .from(productWatches)
          .where(eq(productWatches.watchListId, watchListId));

        if (countResult.count >= 100) {
          throw new Error('Watch list is full (max 100 products per list)');
        }

        // Add product to watch list
        const [result] = await tx
          .insert(productWatches)
          .values({
            userId,
            productId,
            watchListId,
          })
          .returning();

        // Get current price for WebSocket event (optional - outside transaction critical path)
        const offers = await tx
          .select({ price: productOffers.price })
          .from(productOffers)
          .where(eq(productOffers.productId, productId))
          .orderBy(asc(sql`CAST(${productOffers.price} AS DECIMAL)`))
          .limit(1);

        const currentPrice = offers.length > 0 ? parseFloat(offers[0].price) : null;

        return { result, product, currentPrice };
      }, {
        isolationLevel: 'serializable' // Prevent race conditions on concurrent adds
      }),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'addProductToWatchList', watchListId, productId, userId },
        onRetry: (error, attempt, delayMs) => {
          logger.warn('[Storage] Retrying addProductToWatchList after serialization error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            delayMs,
            watchListId,
            productId,
          });
        },
      }
    );

    // Emit WebSocket event after transaction commits
    try {
      const { getSocketIO } = await import('./websocket');
      const { emitProductAdded } = await import('./websocket/handlers/watch-list-handler');
      const io = getSocketIO();
      if (io) {
        emitProductAdded(io, userId, watchListId, {
          id: result.product.id,
          name: result.product.name,
          image: result.product.image,
          currentPrice: result.currentPrice,
        });
      }
    } catch (error) {
      // Don't fail the operation if WebSocket emit fails
      console.error('Failed to emit product added event:', error);
    }

    return result.result;
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
    const [result] = await db
      .delete(productWatches)
      .where(and(
        eq(productWatches.watchListId, watchListId),
        eq(productWatches.productId, productId),
        eq(productWatches.userId, userId) // Ownership verification
      ))
      .returning();

    if (!result) {
      throw new Error('Product watch not found or unauthorized');
    }

    // Emit WebSocket event for real-time updates
    try {
      const { getSocketIO } = await import('./websocket');
      const { emitProductRemoved } = await import('./websocket/handlers/watch-list-handler');
      const io = getSocketIO();
      if (io) {
        emitProductRemoved(io, userId, watchListId, productId);
      }
    } catch (error) {
      // Don't fail the operation if WebSocket emit fails
      console.error('Failed to emit product removed event:', error);
    }

    return result;
  }

  /**
   * Get all watched products across all user's lists with mini-chart data
   * PERFORMANCE: Complex single query with aggregations for sparkline data
   */
  async getWatchedProducts(
    userId: number,
    options?: WatchedProductsOptions
  ): Promise<WatchedProductInfo[]> {
    const sortBy = options?.sortBy || 'priceDropPercent';
    const limit = Math.min(options?.limit || 50, 100);

    // Get 7 days ago for sparkline data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Build complex query with price aggregations
    const results = await db
      .select({
        productId: productWatches.productId,
        watchListId: productWatches.watchListId,
        watchListName: watchLists.name,
        productName: products.name,
        imageUrl: products.image,
        addedAt: productWatches.createdAt,
        // Current price (lowest active offer)
        currentPrice: sql<number | null>`
          (
            SELECT MIN(CAST(price AS DECIMAL))
            FROM ${productOffers}
            WHERE ${productOffers.productId} = ${products.id}
          )
        `.as('current_price'),
        // Lowest price in last 90 days
        lowestPrice: sql<number | null>`
          (
            SELECT MIN(CAST(price AS DECIMAL))
            FROM ${priceHistory}
            WHERE ${priceHistory.productId} = ${products.id}
              AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '90 days'
          )
        `.as('lowest_price'),
        // Average price in last 30 days
        averagePrice: sql<number | null>`
          (
            SELECT AVG(CAST(price AS DECIMAL))
            FROM ${priceHistory}
            WHERE ${priceHistory.productId} = ${products.id}
              AND ${priceHistory.recordedAt} >= NOW() - INTERVAL '30 days'
          )
        `.as('average_price'),
        // Last 7 days price history for sparkline
        last7Days: sql<string>`
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'date', DATE(recorded_at),
                  'price', CAST(price AS DECIMAL)
                )
                ORDER BY recorded_at
              )
              FROM (
                SELECT DISTINCT ON (DATE(recorded_at))
                  recorded_at,
                  price
                FROM ${priceHistory}
                WHERE ${priceHistory.productId} = ${products.id}
                  AND ${priceHistory.recordedAt} >= ${sevenDaysAgo}
                ORDER BY DATE(recorded_at), recorded_at DESC
              ) AS daily_prices
            ),
            '[]'::json
          )
        `.as('last_7_days'),
        // Alert status
        hasActiveAlert: sql<boolean>`
          EXISTS(
            SELECT 1 FROM ${priceAlerts}
            WHERE ${priceAlerts.productId} = ${products.id}
              AND ${priceAlerts.userId} = ${userId}
              AND ${priceAlerts.isActive} = true
          )
        `.as('has_active_alert'),
        hasTriggeredAlert: sql<boolean>`
          EXISTS(
            SELECT 1 FROM ${priceAlerts}
            WHERE ${priceAlerts.productId} = ${products.id}
              AND ${priceAlerts.userId} = ${userId}
              AND ${priceAlerts.lastTriggeredAt} >= NOW() - INTERVAL '7 days'
          )
        `.as('has_triggered_alert'),
      })
      .from(productWatches)
      .innerJoin(products, eq(productWatches.productId, products.id))
      .innerJoin(watchLists, eq(productWatches.watchListId, watchLists.id))
      .where(eq(productWatches.userId, userId))
      .limit(limit);

    // Post-process to calculate derived values and sort
    const enrichedResults = results.map(r => {
      const currentPrice = r.currentPrice || 0;
      const lowestPrice = r.lowestPrice || currentPrice;
      const averagePrice = r.averagePrice || currentPrice;
      const priceDropPercent = lowestPrice > 0
        ? ((currentPrice - lowestPrice) / lowestPrice) * 100
        : 0;
      const savingsPotential = currentPrice > lowestPrice ? currentPrice - lowestPrice : 0;

      // Determine alert status
      let alertStatus: 'active' | 'triggered' | 'none' = 'none';
      if (r.hasTriggeredAlert) {
        alertStatus = 'triggered';
      } else if (r.hasActiveAlert) {
        alertStatus = 'active';
      }

      // Sparkline data is already parsed by Drizzle (json_agg returns JSON object, not string)
      // Double type assertion needed: Drizzle json_agg() returns unknown, cast through unknown to target type
      const last7Days = (r.last7Days as unknown as Array<{ date: string; price: number }>) || [];

      return {
        productId: r.productId,
        watchListId: r.watchListId,
        watchListName: r.watchListName,
        productName: r.productName,
        imageUrl: r.imageUrl || '',
        addedAt: r.addedAt || new Date(),
        currentPrice,
        lowestPrice,
        averagePrice,
        priceDropPercent,
        savingsPotential,
        last7Days,
        alertStatus,
      };
    });

    // Sort based on sortBy option
    enrichedResults.sort((a, b) => {
      switch (sortBy) {
        case 'priceDropPercent':
          return b.priceDropPercent - a.priceDropPercent; // Descending
        case 'savings':
          return b.savingsPotential - a.savingsPotential; // Descending
        case 'dateAdded':
          return b.addedAt.getTime() - a.addedAt.getTime(); // Most recent first
        default:
          return 0;
      }
    });

    return enrichedResults;
  }

  /**
   * Get aggregated statistics for user's watch lists
   * PERFORMANCE: Uses CTEs and database aggregations for efficiency
   */
  async getWatchListStats(userId: number): Promise<WatchListStats> {
    // Get one week ago for weekly stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Complex query with multiple aggregations
    const stats = await db.execute(sql`
      WITH user_products AS (
        SELECT DISTINCT pw.product_id
        FROM ${productWatches} pw
        WHERE pw.user_id = ${userId}
      ),
      price_data AS (
        SELECT
          up.product_id,
          p.name AS product_name,
          (
            SELECT MIN(CAST(price AS DECIMAL))
            FROM ${productOffers}
            WHERE product_id = up.product_id
          ) AS current_price,
          (
            SELECT MIN(CAST(price AS DECIMAL))
            FROM ${priceHistory}
            WHERE product_id = up.product_id
              AND recorded_at >= NOW() - INTERVAL '90 days'
          ) AS lowest_price
        FROM user_products up
        INNER JOIN ${products} p ON up.product_id = p.id
      ),
      best_deals_data AS (
        SELECT
          product_id,
          product_name,
          current_price,
          lowest_price,
          CASE
            WHEN lowest_price > 0 AND current_price IS NOT NULL
            THEN ((current_price - lowest_price) / lowest_price * 100)
            ELSE 0
          END AS discount_percent
        FROM price_data
        WHERE current_price IS NOT NULL
          AND lowest_price IS NOT NULL
          AND lowest_price > 0
        ORDER BY discount_percent DESC
        LIMIT 5
      ),
      weekly_deals AS (
        SELECT COUNT(DISTINCT ph.product_id) AS new_deals
        FROM ${priceHistory} ph
        INNER JOIN user_products up ON ph.product_id = up.product_id
        WHERE ph.recorded_at >= ${oneWeekAgo}
          AND CAST(ph.price AS DECIMAL) < (
            SELECT AVG(CAST(price AS DECIMAL))
            FROM ${priceHistory} ph2
            WHERE ph2.product_id = ph.product_id
              AND ph2.recorded_at >= NOW() - INTERVAL '30 days'
          )
      )
      SELECT
        (SELECT COUNT(*) FROM ${watchLists} WHERE user_id = ${userId})::int AS total_watch_lists,
        (SELECT COUNT(*) FROM user_products)::int AS total_products,
        (
          SELECT COALESCE(SUM(
            CASE WHEN current_price > lowest_price
            THEN current_price - lowest_price
            ELSE 0 END
          ), 0)
          FROM price_data
        )::numeric AS total_potential_savings,
        (
          SELECT COUNT(*)
          FROM ${priceAlerts}
          WHERE user_id = ${userId}
            AND is_active = true
        )::int AS active_alerts,
        (
          SELECT COUNT(*)
          FROM ${priceAlerts}
          WHERE user_id = ${userId}
            AND last_triggered_at >= ${oneWeekAgo}
        )::int AS triggered_alerts,
        (
          SELECT json_agg(
            json_build_object(
              'productId', product_id,
              'productName', product_name,
              'currentPrice', current_price,
              'lowestPrice', lowest_price,
              'discountPercent', ROUND(discount_percent::numeric, 2)
            )
          )
          FROM best_deals_data
        ) AS best_deals,
        (SELECT COALESCE(new_deals, 0) FROM weekly_deals)::int AS weekly_new_deals
    `);

    const row = stats.rows[0] as {
      total_watch_lists: number;
      total_products: number;
      total_potential_savings: string;
      active_alerts: number;
      triggered_alerts: number;
      best_deals: Array<{
        productId: number;
        productName: string;
        currentPrice: string;
        lowestPrice: string;
        discountPercent: number;
      }> | null;
      weekly_new_deals: number;
    };

    // NOTE: db.execute() with json_agg returns already-parsed JSON objects, not strings
    const bestDeals = row.best_deals || [];

    return {
      totalWatchLists: row.total_watch_lists,
      totalProducts: row.total_products,
      totalPotentialSavings: parseFloat(row.total_potential_savings),
      activeAlerts: row.active_alerts,
      triggeredAlerts: row.triggered_alerts,
      bestDeals: bestDeals.map((deal: {
        productId: number;
        productName: string;
        currentPrice: string;
        lowestPrice: string;
        discountPercent: number;
      }) => ({
        productId: deal.productId,
        productName: deal.productName,
        currentPrice: parseFloat(deal.currentPrice),
        lowestPrice: parseFloat(deal.lowestPrice),
        discountPercent: deal.discountPercent,
      })),
      weeklyStats: {
        newDeals: row.weekly_new_deals,
        triggeredAlerts: row.triggered_alerts,
      },
    };
  }

  // Forum Operations (with transactions)
  async createTopicWithFirstPost(topicData: {
    title: string;
    authorId: number;
    categoryId?: number | null;
    productId?: number | null;
  }, content: string): Promise<ForumTopicResult> {
    let topic: ForumTopic;

    await db.transaction(async (tx) => {
      // Generate slug from title
      let slug = topicData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Check for existing slug and append random suffix if needed
      const existing = await tx.select().from(forumTopics).where(eq(forumTopics.slug, slug)).limit(1);
      if (existing.length > 0) {
        const crypto = await import('crypto');
        slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
      }

      const topicResult = await tx.insert(forumTopics).values({
        title: topicData.title,
        authorId: topicData.authorId,
        categoryId: topicData.categoryId || null,
        productId: topicData.productId || null,
        slug,
      }).returning();
      topic = topicResult[0];

      // Create the first post
      await tx.insert(forumPosts).values({
        topicId: topic.id,
        authorId: topicData.authorId,
        content: content || '',
        rawContent: content || '',
        isFirstPost: true,
        postNumber: 1,
      });

      // Update topic post count and last post time
      await tx.update(forumTopics)
        .set({
          postCount: sql`${forumTopics.postCount} + 1`,
          lastPostAt: new Date(),
        })
        .where(eq(forumTopics.id, topic.id));
    });

    return { topic: topic! };
  }

  async createForumPost(topicId: number, authorId: number, content: string, rawContent: string): Promise<ForumPostResult> {
    let post: ForumPost;

    await retryWithBackoff(
      async () => db.transaction(async (tx) => {
        // Get the next post number within transaction to prevent race conditions
        const existingPosts = await tx
          .select()
          .from(forumPosts)
          .where(eq(forumPosts.topicId, topicId));
        const postNumber = existingPosts.length + 1;

        // Create post with calculated postNumber
        const result = await tx.insert(forumPosts).values({
          topicId,
          authorId,
          content,
          rawContent,
          postNumber,
          isFirstPost: false,
        }).returning();
        post = result[0];

        // Update topic stats
        await tx.update(forumTopics)
          .set({
            postCount: sql`${forumTopics.postCount} + 1`,
            lastPostAt: new Date(),
          })
          .where(eq(forumTopics.id, topicId));
      }, {
        isolationLevel: 'serializable',
      }),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'createForumPost', topicId, authorId },
        onRetry: (error, attempt, delayMs) => {
          logger.warn('[Storage] Retrying post creation after serialization error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            delayMs,
            topicId,
          });
        },
      }
    );

    return { post: post! };
  }

  // Admin Product/Retailer Management
  async getAdminProducts(): Promise<AdminProduct[]> {
    return await db.select({
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

  async getAdminRetailers(): Promise<Retailer[]> {
    return await db.select()
      .from(retailers)
      .orderBy(asc(retailers.name));
  }

  async createAdminRetailer(data: InsertRetailer): Promise<Retailer> {
    const [newRetailer] = await db.insert(retailers)
      .values(data)
      .returning();
    return newRetailer;
  }

  async updateAdminRetailer(id: number, data: Partial<InsertRetailer>): Promise<Retailer | null> {
    const [updatedRetailer] = await db.update(retailers)
      .set(data)
      .where(eq(retailers.id, id))
      .returning();
    return updatedRetailer || null;
  }

  async deleteAdminRetailer(id: number): Promise<Retailer | null> {
    const [deletedRetailer] = await db.delete(retailers)
      .where(eq(retailers.id, id))
      .returning();
    return deletedRetailer || null;
  }

  // Affiliate Management
  async getRetailersWithAffiliateStats(): Promise<RetailerWithAffiliateStats[]> {
    const allRetailers = await db.select().from(retailers);

    // Use Promise.allSettled for graceful error handling per retailer
    const results = await Promise.allSettled(
      allRetailers.map(async (retailer) => {
        // Get affiliate stats for each retailer
        const statsResult = await db.select({
          totalOffers: sql<number>`count(*)::int`,
          offersWithAffiliateLinks: sql<number>`count(case when ${productOffers.affiliateUrl} is not null then 1 end)::int`,
          totalClicks: sql<number>`coalesce(sum(${productOffers.clickCount}), 0)::int`
        })
        .from(productOffers)
        .where(eq(productOffers.retailerId, retailer.id));

        const stats = statsResult[0] || { totalOffers: 0, offersWithAffiliateLinks: 0, totalClicks: 0 };

        return {
          ...retailer,
          affiliateConfigParsed: retailer.affiliateConfig ? JSON.parse(retailer.affiliateConfig) : null,
          stats
        };
      })
    );

    // Handle failures gracefully - return retailer with empty stats on error
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      // Log error but don't fail entire operation
      logger.error('Failed to fetch affiliate stats for retailer', {
        retailerId: allRetailers[index].id,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      });
      return {
        ...allRetailers[index],
        affiliateConfigParsed: allRetailers[index].affiliateConfig ? JSON.parse(allRetailers[index].affiliateConfig) : null,
        stats: { totalOffers: 0, offersWithAffiliateLinks: 0, totalClicks: 0 }
      };
    });
  }

  async updateRetailerAffiliateConfig(id: number, config: AffiliateConfig): Promise<Retailer | null> {
    const [updatedRetailer] = await db.update(retailers)
      .set({
        affiliateId: config.affiliateId,
        affiliateProgram: config.affiliateProgram,
        baseAffiliateUrl: config.baseAffiliateUrl,
        commissionRate: config.commissionRate,
        affiliateStatus: config.affiliateStatus as 'active' | 'inactive' | 'pending',
        affiliateConfig: config.affiliateConfig ? JSON.stringify(config.affiliateConfig) : null
      })
      .where(eq(retailers.id, id))
      .returning();
    return updatedRetailer || null;
  }

  // ============================================================================
  // Private User Validation Helpers
  // ============================================================================

  /**
   * Validate user ID is positive integer
   * Used by: getUserByIdSafe, updateUserProfile, updateUserTrustLevel, suspendUser
   * @private
   */
  private validateUserId(userId: number): void {
    if (!userId || userId < 1 || !Number.isInteger(userId)) {
      throw new Error(`Invalid userId: ${userId}. Must be a positive integer.`);
    }
  }

  /**
   * Validate trust level is within allowed range
   * @private
   */
  private validateTrustLevel(level: number): void {
    if (level < USER_CONSTANTS.TRUST_LEVEL.MIN || level > USER_CONSTANTS.TRUST_LEVEL.MAX) {
      throw new Error(
        `Trust level must be between ${USER_CONSTANTS.TRUST_LEVEL.MIN} and ${USER_CONSTANTS.TRUST_LEVEL.MAX}`
      );
    }
  }

  /**
   * Validate profile field length
   * @private
   */
  private validateProfileField(value: string | undefined, fieldName: string, maxLength: number): void {
    if (value && value.length > maxLength) {
      throw new Error(`${fieldName} cannot exceed ${maxLength} characters`);
    }
  }

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
    // Validate inputs
    this.validateUserId(userId);
    this.validateProfileField(data.bio, 'Bio', USER_CONSTANTS.PROFILE.MAX_BIO_LENGTH);
    this.validateProfileField(data.location, 'Location', USER_CONSTANTS.PROFILE.MAX_LOCATION_LENGTH);
    this.validateProfileField(data.website, 'Website', USER_CONSTANTS.PROFILE.MAX_WEBSITE_LENGTH);
    this.validateProfileField(data.avatarUrl, 'Avatar URL', USER_CONSTANTS.PROFILE.MAX_AVATAR_URL_LENGTH);

    await db.update(users)
      .set({
        bio: data.bio,
        location: data.location,
        website: data.website,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserTrustLevel(userId: number, trustLevel: number): Promise<void> {
    // Validate inputs
    this.validateUserId(userId);
    this.validateTrustLevel(trustLevel);

    await db.update(users)
      .set({ trustLevel, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
    // Validate inputs
    this.validateUserId(userId);
    this.validateUserId(moderatorId);

    // UX: Use transaction to ensure suspension and notification are atomic
    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({ isSuspended: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Create notification - must succeed or rollback suspension
      await tx.insert(notifications).values({
        userId,
        type: 'moderation',
        title: 'Account suspended',
        content: reason || 'Your account has been suspended',
        relatedUserId: moderatorId
      });
    });
  }

  // Admin Analytics
  async getAllUsers(): Promise<AdminUser[]> {
    // SECURITY: Never expose passwordHash - explicit field selection
    return await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      reputation: users.reputation,
      createdAt: users.createdAt
    }).from(users);
  }

  async getUserByIdSafe(id: number): Promise<SafeUser | null> {
    // Validate inputs
    this.validateUserId(id);

    // SECURITY: Never expose passwordHash - explicit field selection
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      trustLevel: users.trustLevel,
      isActive: users.isActive,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt
    }).from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async getUserCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    return result?.count ?? 0;
  }

  async getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
    const [userCount, topicCount, postCount, categoryCount] = await Promise.all([
      db.select({ count: sql`count(*)` }).from(users),
      db.select({ count: sql`count(*)` }).from(forumTopics),
      db.select({ count: sql`count(*)` }).from(forumPosts),
      db.select({ count: sql`count(*)` }).from(forumCategories)
    ]);

    return {
      totalUsers: Number(userCount[0]?.count || 0),
      totalTopics: Number(topicCount[0]?.count || 0),
      totalPosts: Number(postCount[0]?.count || 0),
      totalCategories: Number(categoryCount[0]?.count || 0)
    };
  }

  async getUserGrowthData(): Promise<UserGrowthData[]> {
    const result = await db.select({
      date: sql<string>`DATE(${users.createdAt})`.as('date'),
      count: sql<number>`count(*)`.as('count')
    })
    .from(users)
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`);

    return result.map(row => ({ date: String(row.date), count: Number(row.count) }));
  }

  async getForumActivityData(): Promise<ForumActivityData[]> {
    const result = await db.select({
      date: sql<string>`DATE(${forumPosts.createdAt})`.as('date'),
      count: sql<number>`count(*)`.as('count')
    })
    .from(forumPosts)
    .groupBy(sql`DATE(${forumPosts.createdAt})`)
    .orderBy(sql`DATE(${forumPosts.createdAt})`);

    return result.map(row => ({ date: String(row.date), count: Number(row.count) }));
  }

  async getTopCategories(limit: number): Promise<TopCategory[]> {
    const result = await db.select({
      categoryName: forumCategories.name,
      topicCount: sql<number>`count(${forumTopics.id})`.as('topicCount')
    })
    .from(forumCategories)
    .leftJoin(forumTopics, eq(forumCategories.id, forumTopics.categoryId))
    .groupBy(forumCategories.id, forumCategories.name)
    .orderBy(sql`count(${forumTopics.id}) DESC`)
    .limit(limit);

    return result.map(row => ({ categoryName: row.categoryName, topicCount: Number(row.topicCount) }));
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
    const { year, week, retailerId, limit = 12 } = options || {};

    const conditions = [eq(priceAggregatesWeekly.productId, productId)];

    if (year !== undefined) {
      conditions.push(eq(priceAggregatesWeekly.year, year));
    }

    if (week !== undefined) {
      conditions.push(eq(priceAggregatesWeekly.week, week));
    }

    if (retailerId !== undefined) {
      conditions.push(eq(priceAggregatesWeekly.retailerId, retailerId));
    }

    const result = await db
      .select()
      .from(priceAggregatesWeekly)
      .where(and(...conditions))
      .orderBy(desc(priceAggregatesWeekly.year), desc(priceAggregatesWeekly.week))
      .limit(limit);

    return result.map(row => ({
      id: row.id,
      productId: row.productId,
      retailerId: row.retailerId,
      year: row.year,
      week: row.week,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      avgPrice: row.avgPrice,
      medianPrice: row.medianPrice,
      volatilityScore: row.volatilityScore,
      recordCount: row.recordCount,
      weekOverWeekChange: row.weekOverWeekChange,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
  }

  async getMonthlyAggregates(
    productId: number,
    options?: { year?: number; month?: number; retailerId?: number; limit?: number }
  ): Promise<MonthlyAggregate[]> {
    const { year, month, retailerId, limit = 12 } = options || {};

    const conditions = [eq(priceAggregatesMonthly.productId, productId)];

    if (year !== undefined) {
      conditions.push(eq(priceAggregatesMonthly.year, year));
    }

    if (month !== undefined) {
      conditions.push(eq(priceAggregatesMonthly.month, month));
    }

    if (retailerId !== undefined) {
      conditions.push(eq(priceAggregatesMonthly.retailerId, retailerId));
    }

    const result = await db
      .select()
      .from(priceAggregatesMonthly)
      .where(and(...conditions))
      .orderBy(desc(priceAggregatesMonthly.year), desc(priceAggregatesMonthly.month))
      .limit(limit);

    return result.map(row => ({
      id: row.id,
      productId: row.productId,
      retailerId: row.retailerId,
      year: row.year,
      month: row.month,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      avgPrice: row.avgPrice,
      medianPrice: row.medianPrice,
      volatilityScore: row.volatilityScore,
      recordCount: row.recordCount,
      monthOverMonthChange: row.monthOverMonthChange,
      yearOverYearChange: row.yearOverYearChange,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }));
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
    const result = await db
      .select({
        id: jobLocks.id,
        jobName: jobLocks.jobName,
        lockedBy: jobLocks.lockedBy,
        lockedAt: jobLocks.lockedAt,
        expiresAt: jobLocks.expiresAt,
        metadata: jobLocks.metadata,
      })
      .from(jobLocks)
      .orderBy(desc(jobLocks.lockedAt));

    return result;
  }

  // User Registration with transaction (first user becomes admin)
  // SECURITY: passwordHash handled internally, NEVER exposed in return value
  async createUserWithTransaction(
    username: string,
    email: string,
    passwordHash: string
  ): Promise<{ user: SafeUser; isFirstUser: boolean }> {
    let user: SafeUser;
    let isFirstUser: boolean = false;

    await retryWithBackoff(
      async () => db.transaction(async (tx) => {
        // Check if this is the first user (make them admin)
        const userCount = await tx.select({ count: sql`count(*)` }).from(users);
        // Safe integer conversion: SQL count() returns string|number, ensure valid integer
        const count = userCount[0]?.count;
        const userCountNum = typeof count === 'number' ? count : (count ? Number(count) : 0);
        isFirstUser = userCountNum === 0;

        // Create user - must be in same transaction as count check
        // SECURITY: passwordHash stored securely, NEVER exposed in return value
        const newUserResult = await tx.insert(users).values({
          username,
          email,
          passwordHash, // SECURITY: NEVER expose - only used internally
          role: isFirstUser ? 'admin' : 'user',
        }).returning();

        // SECURITY: Explicitly extract safe fields, never expose passwordHash
        user = {
          id: newUserResult[0].id,
          username: newUserResult[0].username,
          email: newUserResult[0].email,
          role: newUserResult[0].role,
          trustLevel: newUserResult[0].trustLevel,
          isActive: newUserResult[0].isActive,
          isSuspended: newUserResult[0].isSuspended,
          createdAt: newUserResult[0].createdAt,
          updatedAt: newUserResult[0].updatedAt,
        };
      }, {
        isolationLevel: 'serializable', // Prevent concurrent first-user race condition
      }),
      {
        maxAttempts: 3,
        initialDelayMs: 100,
        isRetryable: isTransientDatabaseError,
        context: { operation: 'createUserWithTransaction', username, email },
        onRetry: (error, attempt, delayMs) => {
          logger.warn('[Storage] Retrying user registration after serialization error', {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            delayMs,
            username,
          });
        },
      }
    );

    return { user: user!, isFirstUser };
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
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const result = await db
      .insert(jobLocks)
      .values({
        jobName,
        lockedBy,
        expiresAt,
        lockedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: jobLocks.id });

    return result.length > 0 ? { success: true, id: result[0].id } : { success: false };
  }

  async getJobLockByName(jobName: string): Promise<JobLock | null> {
    const [lock] = await db
      .select()
      .from(jobLocks)
      .where(eq(jobLocks.jobName, jobName))
      .limit(1);
    return lock ?? null;
  }

  async updateExpiredJobLock(jobName: string, lockedBy: string, newExpiresAt: Date): Promise<{ success: boolean; id?: number }> {
    const result = await db
      .update(jobLocks)
      .set({
        lockedBy,
        lockedAt: new Date(),
        expiresAt: newExpiresAt,
      })
      .where(
        and(
          eq(jobLocks.jobName, jobName),
          lte(jobLocks.expiresAt, new Date())
        )
      )
      .returning({ id: jobLocks.id });

    return result.length > 0 ? { success: true, id: result[0].id } : { success: false };
  }

  async releaseJobLock(jobName: string, lockedBy: string): Promise<boolean> {
    const result = await db
      .delete(jobLocks)
      .where(
        and(
          eq(jobLocks.jobName, jobName),
          eq(jobLocks.lockedBy, lockedBy)
        )
      )
      .returning({ id: jobLocks.id });

    return result.length > 0;
  }

  async extendJobLock(jobName: string, lockedBy: string, additionalSeconds: number): Promise<boolean> {
    const result = await db
      .update(jobLocks)
      .set({
        expiresAt: sql`${jobLocks.expiresAt} + (${additionalSeconds} * INTERVAL '1 second')`,
      })
      .where(
        and(
          eq(jobLocks.jobName, jobName),
          eq(jobLocks.lockedBy, lockedBy)
        )
      )
      .returning({ id: jobLocks.id });

    return result.length > 0;
  }

  async isJobLocked(jobName: string): Promise<boolean> {
    const locks = await db
      .select({ id: jobLocks.id })
      .from(jobLocks)
      .where(
        and(
          eq(jobLocks.jobName, jobName),
          sql`${jobLocks.expiresAt} > NOW()`
        )
      )
      .limit(1);

    return locks.length > 0;
  }

  async cleanupExpiredJobLocks(): Promise<number> {
    const result = await db
      .delete(jobLocks)
      .where(lte(jobLocks.expiresAt, new Date()))
      .returning({ id: jobLocks.id });

    return result.length;
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
  // Price Analytics Operations (Phase 3 Storage Migration - Database Implementations)
  // ============================================================================

  // Price Aggregation Data Access
  async getPriceDataForAggregation(startDate: Date, endDate: Date, productId?: number): Promise<PriceAggregationData[]> {
    const conditions = [
      gte(priceHistory.recordedAt, startDate),
      lte(priceHistory.recordedAt, endDate)
    ];

    if (productId !== undefined) {
      conditions.push(eq(priceHistory.productId, productId));
    }

    const result = await db
      .select({
        productId: priceHistory.productId,
        retailerId: priceHistory.retailerId,
        prices: sql<string>`array_agg(${priceHistory.price}::numeric ORDER BY ${priceHistory.recordedAt})`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(and(...conditions))
      .groupBy(priceHistory.productId, priceHistory.retailerId);

    return result;
  }

  async getWeeklyAggregatesData(year: number, week: number): Promise<WeeklyAggregateRecord[]> {
    const result = await db
      .select()
      .from(priceAggregatesWeekly)
      .where(and(
        eq(priceAggregatesWeekly.year, year),
        eq(priceAggregatesWeekly.week, week)
      ));
    return result;
  }

  async getDailyAggregatesData(date: string): Promise<DailyAggregateRecord[]> {
    const result = await db
      .select()
      .from(priceAggregatesDaily)
      .where(eq(priceAggregatesDaily.date, date));
    return result;
  }

  async getMonthlyAggregatesData(year: number, month: number): Promise<MonthlyAggregateRecord[]> {
    const result = await db
      .select()
      .from(priceAggregatesMonthly)
      .where(and(
        eq(priceAggregatesMonthly.year, year),
        eq(priceAggregatesMonthly.month, month)
      ));
    return result;
  }

  async upsertDailyAggregates(values: DailyAggregateInsert[]): Promise<void> {
    if (values.length === 0) return;

    await db
      .insert(priceAggregatesDaily)
      .values(values)
      .onConflictDoUpdate({
        target: [
          priceAggregatesDaily.productId,
          priceAggregatesDaily.retailerId,
          priceAggregatesDaily.date,
        ],
        set: {
          minPrice: sql`excluded.min_price`,
          maxPrice: sql`excluded.max_price`,
          avgPrice: sql`excluded.avg_price`,
          medianPrice: sql`excluded.median_price`,
          volatilityScore: sql`excluded.volatility_score`,
          recordCount: sql`excluded.record_count`,
          dayOverDayChange: sql`excluded.day_over_day_change`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async upsertWeeklyAggregates(values: WeeklyAggregateInsert[]): Promise<void> {
    if (values.length === 0) return;

    await db
      .insert(priceAggregatesWeekly)
      .values(values)
      .onConflictDoUpdate({
        target: [
          priceAggregatesWeekly.productId,
          priceAggregatesWeekly.retailerId,
          priceAggregatesWeekly.year,
          priceAggregatesWeekly.week,
        ],
        set: {
          minPrice: sql`excluded.min_price`,
          maxPrice: sql`excluded.max_price`,
          avgPrice: sql`excluded.avg_price`,
          medianPrice: sql`excluded.median_price`,
          volatilityScore: sql`excluded.volatility_score`,
          recordCount: sql`excluded.record_count`,
          weekOverWeekChange: sql`excluded.week_over_week_change`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async upsertMonthlyAggregates(values: MonthlyAggregateInsert[]): Promise<void> {
    if (values.length === 0) return;

    await db
      .insert(priceAggregatesMonthly)
      .values(values)
      .onConflictDoUpdate({
        target: [
          priceAggregatesMonthly.productId,
          priceAggregatesMonthly.retailerId,
          priceAggregatesMonthly.year,
          priceAggregatesMonthly.month,
        ],
        set: {
          minPrice: sql`excluded.min_price`,
          maxPrice: sql`excluded.max_price`,
          avgPrice: sql`excluded.avg_price`,
          medianPrice: sql`excluded.median_price`,
          volatilityScore: sql`excluded.volatility_score`,
          recordCount: sql`excluded.record_count`,
          monthOverMonthChange: sql`excluded.month_over_month_change`,
          yearOverYearChange: sql`excluded.year_over_year_change`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  async markPriceHistoryAsAggregated(startDate: Date, endDate: Date): Promise<void> {
    await db
      .update(priceHistory)
      .set({ aggregatedAt: new Date() })
      .where(and(
        gte(priceHistory.recordedAt, startDate),
        lte(priceHistory.recordedAt, endDate)
      ));
  }

  async deleteOldAggregatedPriceHistory(cutoffDate: Date): Promise<number> {
    const result = await db
      .delete(priceHistory)
      .where(and(
        lte(priceHistory.recordedAt, cutoffDate),
        isNotNull(priceHistory.aggregatedAt)
      ));
    return result.rowCount || 0;
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
    const [result] = await db
      .select()
      .from(priceHistory)
      .where(eq(priceHistory.productOfferId, offerId))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(1);

    return result || null;
  }

  async insertPriceHistory(data: InsertPriceHistoryWithRecordedAt): Promise<PriceHistory> {
    const [result] = await db
      .insert(priceHistory)
      .values(data)
      .returning();
    return result;
  }

  async getPriceHistoryByQuery(query: PriceHistoryQueryParams): Promise<PriceHistory[]> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (query.productOfferId) {
      conditions.push(eq(priceHistory.productOfferId, query.productOfferId));
    }
    if (query.productId) {
      conditions.push(eq(priceHistory.productId, query.productId));
    }
    if (query.retailerId) {
      conditions.push(eq(priceHistory.retailerId, query.retailerId));
    }
    if (query.startDate) {
      conditions.push(gte(priceHistory.recordedAt, query.startDate));
    }
    if (query.endDate) {
      conditions.push(lte(priceHistory.recordedAt, query.endDate));
    }
    if (query.source) {
      conditions.push(eq(priceHistory.source, query.source));
    }

    // Build query with all conditions and limit applied at once to avoid type issues
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    if (whereClause && query.limit) {
      return db
        .select()
        .from(priceHistory)
        .where(whereClause)
        .orderBy(desc(priceHistory.recordedAt))
        .limit(query.limit);
    } else if (whereClause) {
      return db
        .select()
        .from(priceHistory)
        .where(whereClause)
        .orderBy(desc(priceHistory.recordedAt));
    } else if (query.limit) {
      return db
        .select()
        .from(priceHistory)
        .orderBy(desc(priceHistory.recordedAt))
        .limit(query.limit);
    } else {
      return db
        .select()
        .from(priceHistory)
        .orderBy(desc(priceHistory.recordedAt));
    }
  }

  async getExistingSnapshotsForDate(date: Date): Promise<PriceSnapshotRecord[]> {
    const result = await db
      .select()
      .from(priceSnapshots)
      .where(sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${date})`);
    return result;
  }

  async insertPriceSnapshots(snapshots: PriceSnapshotInsert[]): Promise<void> {
    if (snapshots.length === 0) return;
    await db.insert(priceSnapshots).values(snapshots);
  }

  async updatePriceSnapshot(id: number, data: Partial<PriceSnapshotInsert>): Promise<void> {
    await db
      .update(priceSnapshots)
      .set(data)
      .where(eq(priceSnapshots.id, id));
  }

  // Price Snapshot Data Access
  async getProductOffersForSnapshot(batchSize: number, offset: number): Promise<ProductOffer[]> {
    return await db
      .select()
      .from(productOffers)
      .limit(batchSize)
      .offset(offset);
  }

  async getPriceHistoryForOffers(offerIds: number[]): Promise<Array<{ productOfferId: number; price: string }>> {
    if (offerIds.length === 0) return [];

    return await db
      .select({
        productOfferId: priceHistory.productOfferId,
        price: priceHistory.price,
      })
      .from(priceHistory)
      .where(inArray(priceHistory.productOfferId, offerIds))
      .orderBy(priceHistory.productOfferId, desc(priceHistory.recordedAt));
  }

  // Trend Analysis Data Access
  async getPriceDataGroupedForTrend(cutoffDate: Date): Promise<TrendPriceData[]> {
    const result = await db
      .select({
        productId: priceHistory.productId,
        retailerId: priceHistory.retailerId,
        prices: sql<Array<{price: number, timestamp: string}>>`
          json_agg(
            json_build_object(
              'price', ${priceHistory.price}::numeric,
              'timestamp', ${priceHistory.recordedAt}
            ) ORDER BY ${priceHistory.recordedAt}
          )`,
        recordCount: sql<number>`count(*)::int`,
      })
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, cutoffDate))
      .groupBy(priceHistory.productId, priceHistory.retailerId)
      .having(sql`count(*) >= 5`);

    return result;
  }

  async upsertPriceTrends(values: PriceTrendInsert[]): Promise<void> {
    if (values.length === 0) return;

    // Split into smaller chunks if needed (PostgreSQL has param limits)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);

      await db
        .insert(priceTrends)
        .values(chunk)
        .onConflictDoUpdate({
          target: [priceTrends.productId, priceTrends.retailerId],
          set: {
            trendDirection: sql`excluded.trend_direction`,
            trendSlope: sql`excluded.trend_slope`,
            trendStrength: sql`excluded.trend_strength`,
            predictedNextPrice: sql`excluded.predicted_next_price`,
            confidenceLevel: sql`excluded.confidence_level`,
            analysisPeriodDays: sql`excluded.analysis_period_days`,
            lastAnalyzedAt: sql`excluded.last_analyzed_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  }

  async getPriceTrendWithRetailer(productId: number, retailerId: number): Promise<PriceTrendWithRetailer | null> {
    const [result] = await db
      .select({
        id: priceTrends.id,
        productId: priceTrends.productId,
        retailerId: priceTrends.retailerId,
        retailerName: retailers.name,
        retailerLogo: retailers.logo,
        trendDirection: priceTrends.trendDirection,
        trendSlope: priceTrends.trendSlope,
        trendStrength: priceTrends.trendStrength,
        predictedNextPrice: priceTrends.predictedNextPrice,
        confidenceLevel: priceTrends.confidenceLevel,
        analysisPeriodDays: priceTrends.analysisPeriodDays,
        lastAnalyzedAt: priceTrends.lastAnalyzedAt,
        createdAt: priceTrends.createdAt,
        updatedAt: priceTrends.updatedAt,
      })
      .from(priceTrends)
      .leftJoin(retailers, eq(priceTrends.retailerId, retailers.id))
      .where(
        and(
          eq(priceTrends.productId, productId),
          eq(priceTrends.retailerId, retailerId)
        )
      )
      .limit(1);

    return result || null;
  }

  async getPriceTrendsForProduct(productId: number): Promise<PriceTrendWithRetailer[]> {
    return await db
      .select({
        id: priceTrends.id,
        productId: priceTrends.productId,
        retailerId: priceTrends.retailerId,
        retailerName: retailers.name,
        retailerLogo: retailers.logo,
        trendDirection: priceTrends.trendDirection,
        trendSlope: priceTrends.trendSlope,
        trendStrength: priceTrends.trendStrength,
        predictedNextPrice: priceTrends.predictedNextPrice,
        confidenceLevel: priceTrends.confidenceLevel,
        analysisPeriodDays: priceTrends.analysisPeriodDays,
        lastAnalyzedAt: priceTrends.lastAnalyzedAt,
        createdAt: priceTrends.createdAt,
        updatedAt: priceTrends.updatedAt,
      })
      .from(priceTrends)
      .leftJoin(retailers, eq(priceTrends.retailerId, retailers.id))
      .where(eq(priceTrends.productId, productId))
      .orderBy(desc(priceTrends.lastAnalyzedAt));
  }

  // ============================================================================
  // Community Service Operations (Phase 4 Storage Migration)
  // ============================================================================

  /**
   * Add a product to user's watch list
   */
  async addProductWatchRecord(userId: number, productId: number): Promise<ProductWatch | null> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const watch: InsertProductWatch = {
      userId,
      productId,
    };

    const result = await db
      .insert(productWatches)
      .values(watch)
      .onConflictDoNothing()
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Remove a product from user's watch list
   */
  async removeProductWatchRecord(userId: number, productId: number): Promise<boolean> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const result = await db
      .delete(productWatches)
      .where(
        and(
          eq(productWatches.userId, userId),
          eq(productWatches.productId, productId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Get user's watched product IDs
   */
  async getUserProductWatchIds(userId: number): Promise<number[]> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const watches = await db
      .select({ productId: productWatches.productId })
      .from(productWatches)
      .where(eq(productWatches.userId, userId));

    return watches.map(w => w.productId);
  }

  /**
   * Get watch count for a product
   */
  async getProductWatchCountByProduct(productId: number): Promise<number> {
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const result = await db
      .select({ count: count() })
      .from(productWatches)
      .where(eq(productWatches.productId, productId));

    return result[0]?.count || 0;
  }

  /**
   * Get most watched products
   */
  async getMostWatchedProductStats(limit: number = 10): Promise<CommunityWatchStats[]> {
    if (limit <= 0 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }

    const result = await db
      .select({
        productId: productWatches.productId,
        watchCount: sql<number>`count(*)::int`,
      })
      .from(productWatches)
      .groupBy(productWatches.productId)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    return result.map((r, index) => ({
      productId: r.productId,
      watchCount: r.watchCount,
      rank: index + 1,
    }));
  }

  /**
   * Check if user is watching a product
   */
  async isUserWatchingProductCheck(userId: number, productId: number): Promise<boolean> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const result = await db
      .select()
      .from(productWatches)
      .where(
        and(
          eq(productWatches.userId, userId),
          eq(productWatches.productId, productId)
        )
      )
      .limit(1);

    return result.length > 0;
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
  async getCommunityLeaderboard(limit: number = 10): Promise<CommunityLeaderboardEntry[]> {
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

    return await db
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
      forumPostId: data.forumPostId || null,
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
  async getRecentDealSpottingsData(limit: number = 10): Promise<DealSpotting[]> {
    if (limit <= 0 || limit > 100) {
      throw new Error('limit must be between 1 and 100');
    }

    return await db
      .select()
      .from(dealSpottings)
      .orderBy(desc(dealSpottings.createdAt))
      .limit(limit);
  }

  /**
   * Get next sort order for user's watch lists
   */
  async getNextWatchListSortOrder(userId: number): Promise<number> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${watchLists.sortOrder}), 0)` })
      .from(watchLists)
      .where(eq(watchLists.userId, userId));

    return (maxOrderResult[0]?.maxOrder ?? 0) + 1;
  }

  /**
   * Create a new watch list for a user
   */
  async createWatchListRecord(data: CreateWatchListData): Promise<WatchList> {
    if (!data.userId || data.userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!data.name) {
      throw new Error('name is required');
    }

    const watchList: InsertWatchList = {
      userId: data.userId,
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      icon: data.icon || null,
      isDefault: false,
      sortOrder: data.sortOrder,
    };

    const result = await db.insert(watchLists).values(watchList).returning();
    return result[0];
  }

  /**
   * Get all watch lists for a user with stats
   */
  async getWatchListsWithStats(userId: number): Promise<WatchListWithStats[]> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const result = await db
      .select({
        id: watchLists.id,
        userId: watchLists.userId,
        name: watchLists.name,
        description: watchLists.description,
        color: watchLists.color,
        icon: watchLists.icon,
        isDefault: watchLists.isDefault,
        sortOrder: watchLists.sortOrder,
        createdAt: watchLists.createdAt,
        updatedAt: watchLists.updatedAt,
        watchCount: sql<number>`COUNT(${productWatches.id})::int`,
        highPriorityCount: sql<number>`COUNT(CASE WHEN ${productWatches.priority} = 5 THEN 1 END)::int`,
      })
      .from(watchLists)
      .leftJoin(productWatches, eq(productWatches.watchListId, watchLists.id))
      .where(eq(watchLists.userId, userId))
      .groupBy(watchLists.id)
      .orderBy(watchLists.sortOrder);

    return result;
  }

  /**
   * Get a specific watch list with stats
   */
  async getWatchListByIdWithStats(userId: number, listId: number): Promise<WatchListWithStats | null> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!listId || listId <= 0) {
      throw new Error('listId must be a positive number');
    }

    const result = await db
      .select({
        id: watchLists.id,
        userId: watchLists.userId,
        name: watchLists.name,
        description: watchLists.description,
        color: watchLists.color,
        icon: watchLists.icon,
        isDefault: watchLists.isDefault,
        sortOrder: watchLists.sortOrder,
        createdAt: watchLists.createdAt,
        updatedAt: watchLists.updatedAt,
        watchCount: sql<number>`COUNT(${productWatches.id})::int`,
        highPriorityCount: sql<number>`COUNT(CASE WHEN ${productWatches.priority} = 5 THEN 1 END)::int`,
      })
      .from(watchLists)
      .leftJoin(productWatches, eq(productWatches.watchListId, watchLists.id))
      .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
      .groupBy(watchLists.id)
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Update a watch list
   */
  async updateWatchListRecord(
    userId: number,
    listId: number,
    updates: WatchListUpdates
  ): Promise<WatchList | null> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!listId || listId <= 0) {
      throw new Error('listId must be a positive number');
    }

    const result = await db
      .update(watchLists)
      .set(updates)
      .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Delete a watch list (prevents deletion of default list)
   */
  async deleteWatchListRecord(userId: number, listId: number): Promise<boolean> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!listId || listId <= 0) {
      throw new Error('listId must be a positive number');
    }

    // Prevent deletion of default list
    const list = await db
      .select()
      .from(watchLists)
      .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
      .limit(1);

    if (list.length === 0) {
      return false;
    }

    if (list[0].isDefault) {
      throw new Error("Cannot delete default watch list");
    }

    const result = await db
      .delete(watchLists)
      .where(and(eq(watchLists.id, listId), eq(watchLists.userId, userId)))
      .returning();

    return result.length > 0;
  }

  /**
   * Get products in a watch list with details
   */
  async getWatchListProductsWithDetails(
    userId: number,
    listId: number
  ): Promise<WatchListProductWithDetails[]> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!listId || listId <= 0) {
      throw new Error('listId must be a positive number');
    }

    const result = await db
      .select({
        id: productWatches.id,
        userId: productWatches.userId,
        productId: productWatches.productId,
        watchListId: productWatches.watchListId,
        category: productWatches.category,
        notes: productWatches.notes,
        priority: productWatches.priority,
        targetPrice: productWatches.targetPrice,
        createdAt: productWatches.createdAt,
        updatedAt: productWatches.updatedAt,
        productName: products.name,
        productImage: products.image,
      })
      .from(productWatches)
      .innerJoin(products, eq(products.id, productWatches.productId))
      .where(
        and(
          eq(productWatches.userId, userId),
          eq(productWatches.watchListId, listId)
        )
      )
      .orderBy(desc(productWatches.priority), desc(productWatches.updatedAt));

    // Map null to undefined for productImage to match interface
    return result.map(row => ({
      ...row,
      productImage: row.productImage ?? undefined
    }));
  }

  /**
   * Update product watch details
   */
  async updateProductWatchRecord(
    userId: number,
    watchId: number,
    updates: ProductWatchUpdates
  ): Promise<ProductWatch | null> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!watchId || watchId <= 0) {
      throw new Error('watchId must be a positive number');
    }

    const result = await db
      .update(productWatches)
      .set(updates)
      .where(and(eq(productWatches.id, watchId), eq(productWatches.userId, userId)))
      .returning();

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Move products to a different watch list (bulk operation)
   */
  async moveProductWatchesBulk(
    userId: number,
    watchIds: number[],
    targetListId: number | null
  ): Promise<number> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!watchIds || watchIds.length === 0) {
      throw new Error('watchIds array cannot be empty');
    }

    // Verify the target list belongs to the user if specified
    if (targetListId !== null) {
      if (targetListId <= 0) {
        throw new Error('targetListId must be a positive number');
      }

      const targetList = await db
        .select()
        .from(watchLists)
        .where(and(eq(watchLists.id, targetListId), eq(watchLists.userId, userId)))
        .limit(1);

      if (targetList.length === 0) {
        throw new Error("Target watch list not found");
      }
    }

    const result = await db
      .update(productWatches)
      .set({ watchListId: targetListId })
      .where(
        and(
          inArray(productWatches.id, watchIds),
          eq(productWatches.userId, userId)
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Remove multiple products from watch lists (bulk delete)
   */
  async deleteProductWatchesBulk(userId: number, watchIds: number[]): Promise<number> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!watchIds || watchIds.length === 0) {
      throw new Error('watchIds array cannot be empty');
    }

    const result = await db
      .delete(productWatches)
      .where(
        and(
          inArray(productWatches.id, watchIds),
          eq(productWatches.userId, userId)
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Get user's default watch list
   */
  async getUserDefaultWatchListRecord(userId: number): Promise<WatchList | null> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    const result = await db
      .select()
      .from(watchLists)
      .where(and(eq(watchLists.userId, userId), eq(watchLists.isDefault, true)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Export user's watch lists and products as JSON
   * FIXED N+1: Batch query all products for all lists at once
   */
  async exportUserWatchListsData(userId: number): Promise<WatchListExportData> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }

    // Step 1: Get all watch lists
    const lists = await this.getWatchListsWithStats(userId);

    // Step 2: Batch query ALL products for ALL lists at once (prevents N+1)
    const listIds = lists.map(list => list.id);
    const allProducts = listIds.length > 0
      ? await db
          .select({
            watchListId: productWatches.watchListId,
            productId: productWatches.productId,
            productName: products.name,
            category: productWatches.category,
            notes: productWatches.notes,
            priority: productWatches.priority,
            targetPrice: productWatches.targetPrice,
          })
          .from(productWatches)
          .innerJoin(products, eq(products.id, productWatches.productId))
          .where(
            and(
              eq(productWatches.userId, userId),
              inArray(productWatches.watchListId, listIds)
            )
          )
      : [];

    // Step 3: Group products by listId using Map for O(n) lookup
    const productsByListId = new Map<number, typeof allProducts>();
    for (const product of allProducts) {
      if (!productsByListId.has(product.watchListId!)) {
        productsByListId.set(product.watchListId!, []);
      }
      productsByListId.get(product.watchListId!)!.push(product);
    }

    // Step 4: Build export data
    const exportData = lists.map(list => ({
      name: list.name,
      description: list.description,
      color: list.color,
      icon: list.icon,
      products: (productsByListId.get(list.id) || []).map(p => ({
        productId: p.productId,
        productName: p.productName,
        category: p.category,
        notes: p.notes,
        priority: p.priority,
        targetPrice: p.targetPrice,
      })),
    }));

    return {
      exportDate: new Date().toISOString(),
      userId,
      watchLists: exportData,
    };
  }

  /**
   * Import watch lists from JSON export (transactional all-or-nothing)
   */
  async importWatchListsData(
    userId: number,
    data: WatchListImportData
  ): Promise<{ created: number; skipped: number }> {
    if (!userId || userId <= 0) {
      throw new Error('userId must be a positive number');
    }
    if (!data.watchLists || !Array.isArray(data.watchLists)) {
      throw new Error('watchLists must be an array');
    }

    // DATA INTEGRITY: Use transaction to ensure all-or-nothing import
    // If mid-import failure occurs, rollback prevents partial data corruption
    return await db.transaction(async (tx) => {
      let created = 0;
      let skipped = 0;

      for (const listData of data.watchLists) {
        try {
          // Check if list with this name already exists
          const existing = await tx
            .select()
            .from(watchLists)
            .where(
              and(
                eq(watchLists.userId, userId),
                eq(watchLists.name, listData.name)
              )
            )
            .limit(1);

          let listId: number;

          if (existing.length > 0) {
            listId = existing[0].id;
            skipped++;
          } else {
            // Create new list within transaction
            const newListResult = await tx.insert(watchLists).values({
              userId,
              name: listData.name,
              description: listData.description || null,
              color: listData.color || null,
              icon: listData.icon || null,
            }).returning();
            listId = newListResult[0].id;
            created++;
          }

          // Import products into the list
          if (listData.products && Array.isArray(listData.products)) {
            for (const productData of listData.products) {
              try {
                const watch: InsertProductWatch = {
                  userId,
                  productId: productData.productId,
                  watchListId: listId,
                  category: productData.category || null,
                  notes: productData.notes || null,
                  priority: productData.priority || 3,
                  targetPrice: productData.targetPrice || null,
                };

                await tx
                  .insert(productWatches)
                  .values(watch)
                  .onConflictDoNothing();
              } catch (error) {
                logger.error('[Storage] Error importing product watch', { error });
                // Continue with next product
              }
            }
          }
        } catch (error) {
          logger.error('[Storage] Error importing watch list', { error });
          skipped++;
        }
      }

      return { created, skipped };
    });
  }

  /**
   * Get recent forum topic for a product
   */
  async getRecentTopicForProduct(productId: number, daysAgo: number): Promise<ForumTopic | null> {
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }
    if (daysAgo <= 0) {
      throw new Error('daysAgo must be a positive number');
    }

    const result = await db
      .select()
      .from(forumTopics)
      .where(
        and(
          eq(forumTopics.productId, productId),
          gte(forumTopics.createdAt, sql`NOW() - INTERVAL '${sql.raw(daysAgo.toString())} days'`)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Create price drop forum post with notification (transactional)
   * DATA INTEGRITY: Topic, post, and notifications must all succeed or rollback
   */
  async createPriceDropForumPostTransaction(data: PriceDropForumPostData): Promise<number | null> {
    const { dealPost, userId } = data;

    let postId: number | null = null;

    // DATA INTEGRITY: Use transaction for topic+post+notification creation
    // If any step fails, rollback all changes (prevents orphaned topics/posts)
    await db.transaction(async (tx) => {
      // Check if there's already a recent topic for this product
      const recentTopic = await tx
        .select()
        .from(forumTopics)
        .where(
          and(
            eq(forumTopics.productId, dealPost.productId),
            gte(forumTopics.createdAt, sql`NOW() - INTERVAL '7 days'`)
          )
        )
        .limit(1);

      let topicId: number;

      if (recentTopic.length > 0) {
        topicId = recentTopic[0].id;
      } else {
        // Create new topic
        const topicTitle = `🔥 ${dealPost.dropPercent.toFixed(0)}% Price Drop: ${dealPost.productName}`;
        const slug = topicTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        const topicResult = await tx.insert(forumTopics).values({
          categoryId: 1, // FORUM.DEALS_CATEGORY_ID
          title: topicTitle,
          slug,
          authorId: userId || 1, // System user
          productId: dealPost.productId,
          isPinned: dealPost.dropPercent >= 50, // Pin massive drops
        }).returning();

        topicId = topicResult[0].id;
      }

      // Create post in the topic - must succeed or rollback topic
      const postContent = `
## Major Price Drop Alert! 🎉

**Product:** ${dealPost.productName}
**Retailer:** ${dealPost.retailer}

**Price Change:**
- Old Price: $${dealPost.oldPrice.toFixed(2)}
- New Price: $${dealPost.newPrice.toFixed(2)}
- **You Save: $${dealPost.dropAmount.toFixed(2)} (${dealPost.dropPercent.toFixed(1)}%)**

${dealPost.dropPercent >= 50 ? '🔥 **MASSIVE DEAL!** This is an exceptional price drop!' : ''}
${dealPost.dropPercent >= 30 && dealPost.dropPercent < 50 ? '💰 **Great Deal!** Significant savings on this product.' : ''}

_This deal was automatically detected by our price tracking system._
      `.trim();

      const postResult = await tx.insert(forumPosts).values({
        topicId,
        authorId: userId || 1, // System user
        content: postContent,
        rawContent: postContent,
        postNumber: 1,
      }).returning();

      postId = postResult[0].id;

      // Notify all users watching this product - must succeed or rollback all
      const watchers = await tx
        .select({ userId: productWatches.userId })
        .from(productWatches)
        .where(eq(productWatches.productId, dealPost.productId));

      if (watchers.length > 0) {
        const notificationList = watchers.map(w => ({
          userId: w.userId,
          type: 'price_drop',
          title: `${dealPost.dropPercent.toFixed(0)}% Price Drop on ${dealPost.productName}!`,
          content: `The price dropped from $${dealPost.oldPrice.toFixed(2)} to $${dealPost.newPrice.toFixed(2)}`,
          relatedPostId: postId!,
        }));

        await tx.insert(notifications).values(notificationList);
      }
    });

    return postId;
  }

  /**
   * Get users watching a product
   */
  async getWatchersForProduct(productId: number): Promise<number[]> {
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }

    const watchers = await db
      .select({ userId: productWatches.userId })
      .from(productWatches)
      .where(eq(productWatches.productId, productId));

    return watchers.map(w => w.userId);
  }

  /**
   * Notify all product watchers
   */
  async notifyProductWatchers(productId: number, notification: WatcherNotificationData): Promise<void> {
    if (!productId || productId <= 0) {
      throw new Error('productId must be a positive number');
    }
    if (!notification.type || !notification.title || !notification.content) {
      throw new Error('notification must have type, title, and content');
    }

    const watchers = await this.getWatchersForProduct(productId);

    if (watchers.length > 0) {
      const notificationList = watchers.map(userId => ({
        userId,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        relatedProductId: notification.relatedProductId || null,
        relatedTopicId: notification.relatedTopicId || null,
        relatedPostId: notification.relatedPostId || null,
      }));

      await db.insert(notifications).values(notificationList);
    }
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
    const result = await db.select({ count: count() })
      .from(jobLocks)
      .where(sql`${jobLocks.expiresAt} > NOW()`);

    return Number(result[0]?.count ?? 0);
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
    if (productOfferId <= 0) {
      throw new Error('productOfferId must be greater than 0');
    }
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    const history = await db.select()
      .from(priceHistory)
      .where(eq(priceHistory.productOfferId, productOfferId))
      .orderBy(desc(priceHistory.recordedAt))
      .limit(limit);

    return history;
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
    if (limit <= 0) {
      throw new Error('limit must be greater than 0');
    }

    const categoryCounts = await db.select({
      category: products.category,
      count: count(),
    })
      .from(products)
      .where(isNotNull(products.category))
      .groupBy(products.category)
      .orderBy(desc(count()))
      .limit(limit);

    return categoryCounts.map(row => ({
      category: row.category as string,
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

export interface WatchedProductsOptions {
  sortBy?: 'priceDropPercent' | 'savings' | 'dateAdded';
  limit?: number;
}

export interface WatchedProductInfo {
  productId: number;
  watchListId: number | null;
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

// Forum Types
export interface ForumTopicResult {
  topic: ForumTopic;
}

export interface ForumPostResult {
  post: ForumPost;
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

export interface WatcherNotificationData {
  type: string;
  title: string;
  content: string;
  relatedProductId?: number;
  relatedTopicId?: number;
  relatedPostId?: number;
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
