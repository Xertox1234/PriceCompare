import { pgTable, serial, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Shared users table for SSO integration
export const sharedUsers = pgTable('shared_users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  discourseUserId: integer('discourse_user_id'),
  role: varchar('role', { length: 50 }).default('user'),
  bio: text('bio'),
  location: varchar('location', { length: 255 }),
  website: varchar('website', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Shared sessions table for cross-application authentication
export const sharedSessions = pgTable('shared_sessions', {
  sid: varchar('sid', { length: 255 }).primaryKey(),
  sessionData: text('session_data'),
  expires: timestamp('expires'),
  userId: integer('user_id').references(() => sharedUsers.id, { onDelete: 'cascade' }),
});

// SSO tokens for secure authentication flow
export const ssoTokens = pgTable('sso_tokens', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  userId: integer('user_id').references(() => sharedUsers.id, { onDelete: 'cascade' }),
  nonce: varchar('nonce', { length: 255 }).notNull(),
  returnUrl: varchar('return_url', { length: 1000 }),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

// Discourse user mapping for synchronization
export const discourseUserMapping = pgTable('discourse_user_mapping', {
  id: serial('id').primaryKey(),
  priceAppUserId: integer('price_app_user_id')
    .references(() => sharedUsers.id, { onDelete: 'cascade' })
    .unique(),
  discourseUserId: integer('discourse_user_id').notNull().unique(),
  discourseUsername: varchar('discourse_username', { length: 255 }).notNull(),
  lastSyncAt: timestamp('last_sync_at').defaultNow(),
});

// Zod schemas for validation
export const insertSharedUserSchema = createInsertSchema(sharedUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSSOTokenSchema = createInsertSchema(ssoTokens).omit({
  id: true,
  createdAt: true,
});

export const insertDiscourseUserMappingSchema = createInsertSchema(discourseUserMapping).omit({
  id: true,
  lastSyncAt: true,
});

// Types
export type SharedUser = typeof sharedUsers.$inferSelect;
export type InsertSharedUser = z.infer<typeof insertSharedUserSchema>;
export type SharedSession = typeof sharedSessions.$inferSelect;
export type SSOToken = typeof ssoTokens.$inferSelect;
export type InsertSSOToken = z.infer<typeof insertSSOTokenSchema>;
export type DiscourseUserMapping = typeof discourseUserMapping.$inferSelect;
export type InsertDiscourseUserMapping = z.infer<typeof insertDiscourseUserMappingSchema>;

// Extended user type with discourse information
export type SharedUserWithDiscourse = SharedUser & {
  discourseMapping?: DiscourseUserMapping;
};

// ============================================
// Client-side Validation Schemas
// ============================================

/**
 * Forgot password form validation schema
 * Used for client-side and server-side validation
 */
export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

/**
 * Reset password form validation schema
 * Includes password strength requirements and confirmation matching
 */
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Client-side validation types
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
