import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar, type AnyPgColumn, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Custom vector type for pgvector extension
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)"; // OpenAI text-embedding-3-small produces 1536-dimensional vectors
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const retailers = pgTable("retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  website: text("website"),
  isActive: boolean("is_active").default(true),
  affiliateId: varchar("affiliate_id", { length: 100 }),
  affiliateProgram: varchar("affiliate_program", { length: 50 }),
  baseAffiliateUrl: text("base_affiliate_url"),
  commissionRate: decimal("commission_rate", { precision: 4, scale: 2 }),
  affiliateStatus: varchar("affiliate_status", { length: 20 }).default("inactive"),
  affiliateConfig: text("affiliate_config"), // JSON string for configuration
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  image: text("image"),
  brand: text("brand"),
  model: text("model"),
  embedding: vector("embedding"), // Vector embedding for semantic search
  embeddingUpdatedAt: timestamp("embedding_updated_at"), // Track when embedding was last calculated
  createdAt: timestamp("created_at").defaultNow(),
});

export const productOffers = pgTable("product_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  availability: text("availability").default("in_stock"), // in_stock, out_of_stock, limited_stock
  rating: decimal("rating", { precision: 2, scale: 1 }),
  reviewCount: integer("review_count").default(0),
  shippingInfo: text("shipping_info"),
  dealType: text("deal_type"), // best_price, bundle_deal, limited_time, etc.
  productUrl: text("product_url"),
  affiliateUrl: text("affiliate_url"),
  linkHealthStatus: varchar("link_health_status", { length: 20 }).default("unknown"),
  lastLinkCheck: timestamp("last_link_check"),
  clickCount: integer("click_count").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Users table for authentication with Discourse-like features
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("user"),
  trustLevel: integer("trust_level").default(0), // 0-4 trust levels like Discourse
  isActive: boolean("is_active").default(true),
  isSuspended: boolean("is_suspended").default(false),
  reputation: integer("reputation").default(0),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  bio: text("bio"),
  location: varchar("location", { length: 100 }),
  website: varchar("website", { length: 255 }),
  lastSeenAt: timestamp("last_seen_at"),
  postCount: integer("post_count").default(0),
  topicCount: integer("topic_count").default(0),
  likesGiven: integer("likes_given").default(0),
  likesReceived: integer("likes_received").default(0),
  timeReadPosts: integer("time_read_posts").default(0), // in seconds
  daysVisited: integer("days_visited").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Password reset tokens for secure password recovery
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum categories
export const forumCategories = pgTable("forum_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  icon: varchar("icon", { length: 50 }), // lucide icon name
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  parentId: integer("parent_id").references((): AnyPgColumn => forumCategories.id), // for subcategories
  moderatorIds: integer("moderator_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Forum topics (discussion threads)
export const forumTopics = pgTable("forum_topics", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  content: text("content"), // Initial post content
  categoryId: integer("category_id").references(() => forumCategories.id),
  authorId: integer("author_id").references(() => users.id).notNull(),
  productId: integer("product_id").references(() => products.id), // Link to products
  tags: varchar("tags", { length: 500 }).array(), // Topic tags
  isPinned: boolean("is_pinned").default(false),
  isLocked: boolean("is_locked").default(false),
  isFeatured: boolean("is_featured").default(false),
  viewCount: integer("view_count").default(0),
  postCount: integer("post_count").default(0),
  likeCount: integer("like_count").default(0),
  lastPostAt: timestamp("last_post_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Forum posts with enhanced features
export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => forumTopics.id).notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  rawContent: text("raw_content").notNull(), // Original markdown/text content
  isFirstPost: boolean("is_first_post").default(false),
  postNumber: integer("post_number").notNull(), // Sequential number within topic
  replyToPostId: integer("reply_to_post_id").references((): AnyPgColumn => forumPosts.id),
  likeCount: integer("like_count").default(0),
  replyCount: integer("reply_count").default(0),
  readCount: integer("read_count").default(0),
  isHidden: boolean("is_hidden").default(false),
  hiddenReason: varchar("hidden_reason", { length: 255 }),
  editedAt: timestamp("edited_at"),
  editedById: integer("edited_by_id").references(() => users.id),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price alerts that can notify the community
export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true),
  notifyForum: boolean("notify_forum").default(false), // Whether to post to forum when triggered
  createdAt: timestamp("created_at").defaultNow(),
});

// Post likes/reactions
export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  reactionType: varchar("reaction_type", { length: 20 }).default("like"), // like, love, laugh, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// User notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // mention, reply, like, etc.
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  relatedPostId: integer("related_post_id").references(() => forumPosts.id),
  relatedTopicId: integer("related_topic_id").references(() => forumTopics.id),
  relatedUserId: integer("related_user_id").references(() => users.id),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Topic tags
export const topicTags = pgTable("topic_tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#6b7280"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Many-to-many relationship for topics and tags
export const topicTagRelations = pgTable("topic_tag_relations", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => forumTopics.id).notNull(),
  tagId: integer("tag_id").references(() => topicTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User mentions in posts
export const postMentions = pgTable("post_mentions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  mentionedUserId: integer("mentioned_user_id").references(() => users.id).notNull(),
  mentioningUserId: integer("mentioning_user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Private messages
export const privateMessages = pgTable("private_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// User badges (achievements)
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // lucide icon name
  color: varchar("color", { length: 7 }).default("#3b82f6"),
  type: varchar("type", { length: 20 }).notNull(), // bronze, silver, gold
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User badge assignments
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  badgeId: integer("badge_id").references(() => badges.id).notNull(),
  grantedAt: timestamp("granted_at").defaultNow(),
});

// Post revision history
export const postRevisions = pgTable("post_revisions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => forumPosts.id).notNull(),
  content: text("content").notNull(),
  rawContent: text("raw_content").notNull(),
  editedById: integer("edited_by_id").references(() => users.id).notNull(),
  editReason: varchar("edit_reason", { length: 255 }),
  version: integer("version").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRetailerSchema = createInsertSchema(retailers).omit({
  id: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertProductOfferSchema = createInsertSchema(productOffers).omit({
  id: true,
  lastUpdated: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertForumCategorySchema = createInsertSchema(forumCategories).omit({
  id: true,
  createdAt: true,
});

export const insertForumTopicSchema = createInsertSchema(forumTopics).omit({
  id: true,
  postCount: true,
  lastPostAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertForumPostSchema = createInsertSchema(forumPosts).omit({
  id: true,
  likeCount: true,
  replyCount: true,
  readCount: true,
  version: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
});

// New insert schemas for enhanced features
export const insertPostLikeSchema = createInsertSchema(postLikes).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertTopicTagSchema = createInsertSchema(topicTags).omit({
  id: true,
  usageCount: true,
  createdAt: true,
});

export const insertPrivateMessageSchema = createInsertSchema(privateMessages).omit({
  id: true,
  createdAt: true,
});

export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertPostRevisionSchema = createInsertSchema(postRevisions).omit({
  id: true,
  createdAt: true,
});

// Type definitions
export type Retailer = typeof retailers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductOffer = typeof productOffers.$inferSelect;
export type User = typeof users.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type PriceAlert = typeof priceAlerts.$inferSelect;
export type PostLike = typeof postLikes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type TopicTag = typeof topicTags.$inferSelect;
export type TopicTagRelation = typeof topicTagRelations.$inferSelect;
export type PostMention = typeof postMentions.$inferSelect;
export type PrivateMessage = typeof privateMessages.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type PostRevision = typeof postRevisions.$inferSelect;

export type InsertRetailer = z.infer<typeof insertRetailerSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductOffer = z.infer<typeof insertProductOfferSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertTopicTag = z.infer<typeof insertTopicTagSchema>;
export type InsertPrivateMessage = z.infer<typeof insertPrivateMessageSchema>;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type InsertPostRevision = z.infer<typeof insertPostRevisionSchema>;

// Combined types for API responses
export type ProductWithOffers = Product & {
  offers: (ProductOffer & { retailer: Retailer })[];
  bestPrice?: number;
  savings?: number;
  savingsPercentage?: number;
  discussionCount?: number;
  hasActiveDiscussion?: boolean;
};

// Enhanced forum types with Discourse-like features
export type UserWithProfile = User & {
  badges?: (UserBadge & { badge: Badge })[];
  unreadNotifications?: number;
  trustLevelName?: string;
};

export type ForumTopicWithDetails = ForumTopic & {
  author: UserWithProfile;
  category?: ForumCategory;
  tags?: TopicTag[];
  lastPost?: ForumPost & { author: UserWithProfile };
  posts?: ForumPostWithDetails[];
  isBookmarked?: boolean;
  userCanEdit?: boolean;
  userCanDelete?: boolean;
};

export type ForumPostWithDetails = ForumPost & {
  author: UserWithProfile;
  likes?: (PostLike & { user: User })[];
  replies?: ForumPost[];
  mentions?: (PostMention & { mentionedUser: User })[];
  revisions?: PostRevision[];
  userHasLiked?: boolean;
  userCanEdit?: boolean;
  userCanDelete?: boolean;
};

export type ForumPostWithAuthor = ForumPost & {
  author: User;
};

export type NotificationWithDetails = Notification & {
  relatedUser?: User;
  relatedPost?: ForumPost;
  relatedTopic?: ForumTopic;
};

export type PrivateMessageWithUsers = PrivateMessage & {
  sender: User;
  recipient: User;
};

export type SearchFilters = {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  retailers?: number[];
  minRating?: number;
  availability?: string[];
  sortBy?: "price_low" | "price_high" | "rating" | "popularity";
};

// AI Scraping System Tables

// Trending products discovered by AI agents
export const trendingProducts = pgTable("trending_products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  trendScore: integer("trend_score").default(0),
  searchVolume: integer("search_volume").default(0),
  source: varchar("source", { length: 50 }).notNull(), // google_trends, social_media, news
  sourceData: text("source_data"), // JSON data from source
  discoveryDate: timestamp("discovery_date").defaultNow(),
  status: varchar("status", { length: 20 }).default("discovered"), // discovered, processing, scraped, failed
  productId: integer("product_id").references(() => products.id), // Link to created product
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Search queries generated by AI agents
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  trendingProductId: integer("trending_product_id").references(() => trendingProducts.id),
  productId: integer("product_id").references(() => products.id),
  queryText: varchar("query_text", { length: 500 }).notNull(),
  retailer: varchar("retailer", { length: 50 }),
  queryType: varchar("query_type", { length: 30 }).default("product_search"), // product_search, price_check, availability
  successRate: decimal("success_rate", { precision: 3, scale: 2 }).default("0.00"),
  avgResults: integer("avg_results").default(0),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent performance and session tracking
export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  agentType: varchar("agent_type", { length: 50 }).notNull(), // discovery, search, navigation, extraction, validation, coordinator
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  sessionStart: timestamp("session_start").defaultNow(),
  sessionEnd: timestamp("session_end"),
  tasksCompleted: integer("tasks_completed").default(0),
  successRate: decimal("success_rate", { precision: 3, scale: 2 }).default("0.00"),
  errorsEncountered: integer("errors_encountered").default(0),
  performanceMetrics: text("performance_metrics"), // JSON data
  status: varchar("status", { length: 20 }).default("active"), // active, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Scraping job management and queue
export const scrapingJobs = pgTable("scraping_jobs", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(), // discovery, search, scrape, validate, price_update
  priority: integer("priority").default(5), // 1-10, higher = more priority
  status: varchar("status", { length: 20 }).default("pending"), // pending, running, completed, failed, retrying
  targetData: text("target_data").notNull(), // JSON with job parameters
  resultData: text("result_data"), // JSON with job results
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  agentSessionId: integer("agent_session_id").references(() => agentSessions.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Price predictions and historical analysis
export const pricePredictions = pgTable("price_predictions", {
  id: serial("id").primaryKey(),
  productOfferId: integer("product_offer_id").references(() => productOffers.id).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
  predictedPrice: decimal("predicted_price", { precision: 10, scale: 2 }).notNull(),
  predictionType: varchar("prediction_type", { length: 30 }).notNull(), // daily, weekly, monthly, seasonal
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).notNull(),
  predictionDate: timestamp("prediction_date").notNull(),
  actualPrice: decimal("actual_price", { precision: 10, scale: 2 }), // Filled when prediction period ends
  predictionAccuracy: decimal("prediction_accuracy", { precision: 3, scale: 2 }), // Calculated after validation
  modelVersion: varchar("model_version", { length: 20 }).default("1.0"),
  createdAt: timestamp("created_at").defaultNow(),
  validatedAt: timestamp("validated_at"),
});

// Price history tracking - Granular price change records
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productOfferId: integer("product_offer_id").references(() => productOffers.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }),
  source: varchar("source", { length: 50 }).default("scraper"), // manual, scraper, api, admin
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("1.00"), // 0.00 to 1.00
  metadata: text("metadata"), // JSON - Additional context about price change
  recordedAt: timestamp("recorded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Price snapshots - Daily aggregated price data
export const priceSnapshots = pgTable("price_snapshots", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
  lowestPrice: decimal("lowest_price", { precision: 10, scale: 2 }).notNull(),
  highestPrice: decimal("highest_price", { precision: 10, scale: 2 }).notNull(),
  averagePrice: decimal("average_price", { precision: 10, scale: 2 }).notNull(),
  offerCount: integer("offer_count").default(1),
  snapshotDate: timestamp("snapshot_date").notNull(), // Date of the snapshot
  createdAt: timestamp("created_at").defaultNow(),
});

// Scraping source configuration
export const scrapingSources = pgTable("scraping_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 30 }).notNull(), // retailer, search_engine, social_media, news
  baseUrl: varchar("base_url", { length: 500 }),
  searchUrl: varchar("search_url", { length: 500 }),
  apiKey: varchar("api_key", { length: 200 }), // Encrypted API keys
  rateLimit: integer("rate_limit").default(100), // Requests per hour
  isActive: boolean("is_active").default(true),
  lastUsed: timestamp("last_used"),
  successRate: decimal("success_rate", { precision: 3, scale: 2 }).default("0.00"),
  configuration: text("configuration"), // JSON configuration for scraper
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product URL tracking and validation
export const productUrls = pgTable("product_urls", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id).notNull(),
  retailerId: integer("retailer_id").references(() => retailers.id).notNull(),
  url: text("url").notNull(),
  urlType: varchar("url_type", { length: 30 }).default("product_page"), // product_page, search_result, api_endpoint
  isActive: boolean("is_active").default(true),
  lastChecked: timestamp("last_checked"),
  lastValidated: timestamp("last_validated"),
  validationStatus: varchar("validation_status", { length: 20 }).default("pending"), // pending, valid, invalid, changed
  responseTime: integer("response_time"), // milliseconds
  httpStatus: integer("http_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for scraping tables
export const insertTrendingProductSchema = createInsertSchema(trendingProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSearchQuerySchema = createInsertSchema(searchQueries).omit({
  id: true,
  createdAt: true,
});

export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({
  id: true,
  createdAt: true,
});

export const insertScrapingJobSchema = createInsertSchema(scrapingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricePredictionSchema = createInsertSchema(pricePredictions).omit({
  id: true,
  createdAt: true,
  validatedAt: true,
});

export const insertPriceHistorySchema = createInsertSchema(priceHistory).omit({
  id: true,
  recordedAt: true,
  createdAt: true,
});

export const insertPriceSnapshotSchema = createInsertSchema(priceSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertScrapingSourceSchema = createInsertSchema(scrapingSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductUrlSchema = createInsertSchema(productUrls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions for scraping system
export type TrendingProduct = typeof trendingProducts.$inferSelect;
export type SearchQuery = typeof searchQueries.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type ScrapingJob = typeof scrapingJobs.$inferSelect;
export type PricePrediction = typeof pricePredictions.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type ScrapingSource = typeof scrapingSources.$inferSelect;
export type ProductUrl = typeof productUrls.$inferSelect;

export type InsertTrendingProduct = z.infer<typeof insertTrendingProductSchema>;
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type InsertScrapingJob = z.infer<typeof insertScrapingJobSchema>;
export type InsertPricePrediction = z.infer<typeof insertPricePredictionSchema>;
export type InsertPriceHistory = z.infer<typeof insertPriceHistorySchema>;
export type InsertPriceSnapshot = z.infer<typeof insertPriceSnapshotSchema>;
export type InsertScrapingSource = z.infer<typeof insertScrapingSourceSchema>;
export type InsertProductUrl = z.infer<typeof insertProductUrlSchema>;

// Extended types for agent system
export type TrendingProductWithDetails = TrendingProduct & {
  queries?: SearchQuery[];
  scrapingJobs?: ScrapingJob[];
  product?: Product;
};

export type ScrapingJobWithDetails = ScrapingJob & {
  agentSession?: AgentSession;
  trendingProduct?: TrendingProduct;
};

export type AgentSessionWithJobs = AgentSession & {
  jobs?: ScrapingJob[];
  successfulJobs?: number;
  failedJobs?: number;
};

// Price history related types
export type PriceHistoryWithOffer = PriceHistory & {
  offer?: ProductOffer & {
    product?: Product;
    retailer?: Retailer;
  };
};

export type PriceSnapshotWithDetails = PriceSnapshot & {
  product?: Product;
  retailer?: Retailer;
};

export type ProductWithPriceHistory = Product & {
  priceHistory?: PriceHistory[];
  priceSnapshots?: PriceSnapshot[];
  currentLowestPrice?: number;
  priceChange24h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  allTimeLowest?: number;
  allTimeHighest?: number;
};

// Search-related types
export interface SearchSuggestion {
  query: string;
  type: 'completion' | 'correction' | 'synonym' | 'trending' | 'history' | 'suggestion';
  confidence?: number;
  description?: string;
  intent?: string;
}

export interface QueryAnalysis {
  intent: 'product_search' | 'price_comparison' | 'brand_search' | 'category_browse' | string;
  confidence: number;
  suggestions?: string[];
  category?: string;
}
