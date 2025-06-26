import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const retailers = pgTable("retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo"),
  website: text("website"),
  isActive: boolean("is_active").default(true),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  image: text("image"),
  brand: text("brand"),
  model: text("model"),
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
  parentId: integer("parent_id").references(() => forumCategories.id), // for subcategories
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
  replyToPostId: integer("reply_to_post_id").references(() => forumPosts.id),
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
  postNumber: true,
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
