import { pgTable, serial, varchar, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table for authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Forum categories
export const forumCategories = pgTable('forum_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  color: varchar('color', { length: 7 }).default('#3b82f6'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Forum topics (discussion threads)
export const forumTopics = pgTable('forum_topics', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  categoryId: integer('category_id').references(() => forumCategories.id),
  authorId: integer('author_id').references(() => users.id).notNull(),
  productId: integer('product_id').references(() => products.id), // Link to products
  isPinned: boolean('is_pinned').default(false),
  isLocked: boolean('is_locked').default(false),
  postCount: integer('post_count').default(0),
  lastPostAt: timestamp('last_post_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Forum posts
export const forumPosts = pgTable('forum_posts', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id').references(() => forumTopics.id).notNull(),
  authorId: integer('author_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  isFirstPost: boolean('is_first_post').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Price alerts that can notify the community
export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  targetPrice: varchar('target_price', { length: 20 }).notNull(),
  isActive: boolean('is_active').default(true),
  notifyForum: boolean('notify_forum').default(false), // Whether to post to forum when triggered
  createdAt: timestamp('created_at').defaultNow(),
});

// This file is deprecated - forum schema is now in shared/schema.ts

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ForumCategory = typeof forumCategories.$inferSelect;
export type InsertForumCategory = z.infer<typeof insertForumCategorySchema>;

export type ForumTopic = typeof forumTopics.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;

export type ForumPost = typeof forumPosts.$inferSelect;
export type InsertForumPost = z.infer<typeof insertForumPostSchema>;

export type PriceAlert = typeof priceAlerts.$inferSelect;
export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;

// Extended types with relations
export type ForumTopicWithDetails = ForumTopic & {
  author: User;
  category: ForumCategory;
  lastPost?: ForumPost & { author: User };
  posts?: (ForumPost & { author: User })[];
};

export type ForumPostWithAuthor = ForumPost & {
  author: User;
};