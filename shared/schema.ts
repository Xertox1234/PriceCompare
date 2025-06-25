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

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("user"),
  reputation: integer("reputation").default(0),
  isActive: boolean("is_active").default(true),
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

// Forum posts
export const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").references(() => forumTopics.id).notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isFirstPost: boolean("is_first_post").default(false),
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
  createdAt: true,
  updatedAt: true,
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
});

export type Retailer = typeof retailers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductOffer = typeof productOffers.$inferSelect;
export type User = typeof users.$inferSelect;
export type ForumCategory = typeof forumCategories.$inferSelect;
export type ForumTopic = typeof forumTopics.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type PriceAlert = typeof priceAlerts.$inferSelect;

export type InsertRetailer = z.infer<typeof insertRetailerSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertProductOffer = z.infer<typeof insertProductOfferSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

// Combined types for API responses
export type ProductWithOffers = Product & {
  offers: (ProductOffer & { retailer: Retailer })[];
  bestPrice?: number;
  savings?: number;
  savingsPercentage?: number;
  discussionCount?: number;
  hasActiveDiscussion?: boolean;
};

// Extended types with relations
export type ForumTopicWithDetails = ForumTopic & {
  author: User;
  category?: ForumCategory;
  lastPost?: ForumPost & { author: User };
  posts?: (ForumPost & { author: User })[];
};

export type ForumPostWithAuthor = ForumPost & {
  author: User;
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
