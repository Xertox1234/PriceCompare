import passport from 'passport';
import { Strategy as LocalStrategy, IVerifyOptions } from 'passport-local';
import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { hashEmail } from './utils/encryption';
import type { User as DatabaseUser } from '../shared/schema';
import {
  recordFailedLoginAsync,
  clearFailedLoginsAsync,
  isAccountLockedAsync,
} from './utils/account-lockout-simple';
import { sendError } from './utils/api-response';

// Export the User type for use elsewhere
export type User = DatabaseUser;

// Export a safe user type without passwordHash for API responses and req.user
export type SafeUser = Omit<DatabaseUser, 'passwordHash'>;

// Extended verify options to include lockout information
interface ExtendedVerifyOptions extends IVerifyOptions {
  locked?: boolean;
  remainingTime?: number;
  remainingAttempts?: number;
}

// Extend Express types to include our User type (without passwordHash for security)
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Required for Express type augmentation
  namespace Express {
    interface User extends SafeUser {}
  }
}

// Configure Passport Local Strategy
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Passport supports async verify callbacks
    async (email, password, done) => {
      try {
        const isTestEnv = process.env.NODE_ENV === 'test';

        // Check if account is locked before attempting authentication (Redis-backed)
        // NOTE: Disabled in test env to keep E2E runs deterministic and avoid cross-test interference.
        if (!isTestEnv) {
          const lockStatus = await isAccountLockedAsync(email);
          if (lockStatus.locked) {
            // Note: Logging will happen in route handler where we have access to req
            // TYPE ASSERTION: ExtendedVerifyOptions extends IVerifyOptions with lockout fields
            return done(null, false, {
              message: 'Account temporarily locked',
              locked: true,
              remainingTime: lockStatus.remainingTime,
            } as ExtendedVerifyOptions);
          }
        }

        // Fast indexed lookup by email hash (case-insensitive via lowercase in hash)
        const emailHashValue = hashEmail(email);
        const userResult = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            emailHash: users.emailHash, // Include for SafeUser type compatibility
            passwordHash: users.passwordHash, // SECURITY: Only for internal password verification, never exposed in API
            role: users.role,
            trustLevel: users.trustLevel,
            isActive: users.isActive,
            isSuspended: users.isSuspended,
            reputation: users.reputation,
            avatarUrl: users.avatarUrl,
            bio: users.bio,
            location: users.location,
            website: users.website,
            lastSeenAt: users.lastSeenAt,
            postCount: users.postCount,
            topicCount: users.topicCount,
            likesGiven: users.likesGiven,
            likesReceived: users.likesReceived,
            timeReadPosts: users.timeReadPosts,
            daysVisited: users.daysVisited,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .where(eq(users.emailHash, emailHashValue))
          .limit(1);

        if (!userResult.length) {
          // Record failed attempt (user not found) - Redis-backed
          if (process.env.NODE_ENV !== 'test') {
            await recordFailedLoginAsync(email);
          }
          // Note: Logging will happen in route handler where we have access to req
          return done(null, false, { message: 'Invalid email or password' });
        }

        const user = userResult[0];

        // Verify email matches to prevent hash collisions (extremely rare but possible)
        // NOTE: user.email is already decrypted by Drizzle's encryptedText fromDriver
        if (user.email.toLowerCase() !== email.toLowerCase()) {
          // Hash collision - treat as user not found
          if (process.env.NODE_ENV !== 'test') {
            await recordFailedLoginAsync(email);
          }
          return done(null, false, { message: 'Invalid email or password' });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          // Record failed attempt (wrong password) - Redis-backed
          // NOTE: Disabled in test env to keep E2E runs deterministic and avoid cross-test interference.
          if (!isTestEnv) {
            const lockoutResult = await recordFailedLoginAsync(email);
            // Note: Logging will happen in route handler where we have access to req
            // TYPE ASSERTION: ExtendedVerifyOptions extends IVerifyOptions with lockout fields
            return done(null, false, {
              message: 'Invalid email or password',
              remainingAttempts: lockoutResult.remainingAttempts,
              locked: lockoutResult.locked,
            } as ExtendedVerifyOptions);
          }

          return done(null, false, { message: 'Invalid email or password' });
        }

        // SECURITY: Block login for suspended/inactive accounts
        if (user.isSuspended) {
          return done(null, false, {
            message: 'Account suspended',
          });
        }
        if (user.isActive === false) {
          return done(null, false, {
            message: 'Account inactive',
          });
        }

        // Successful login - clear any failed attempts (Redis-backed)
        await clearFailedLoginsAsync(email);
        // Note: Success logging will happen in route handler where we have access to req
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

// eslint-disable-next-line @typescript-eslint/no-misused-promises -- Passport supports async deserialize callbacks
passport.deserializeUser(async (id: number, done) => {
  try {
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        // SECURITY: Never expose passwordHash in req.user
        role: users.role,
        trustLevel: users.trustLevel,
        isActive: users.isActive,
        isSuspended: users.isSuspended,
        reputation: users.reputation,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        location: users.location,
        website: users.website,
        lastSeenAt: users.lastSeenAt,
        postCount: users.postCount,
        topicCount: users.topicCount,
        likesGiven: users.likesGiven,
        likesReceived: users.likesReceived,
        timeReadPosts: users.timeReadPosts,
        daysVisited: users.daysVisited,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    // TYPE ASSERTION: Database user shape matches Express.User (defined in express.d.ts)
    done(null, (userResult[0] as Express.User) || null);
  } catch (error) {
    done(error);
  }
});

// Helper functions
export async function hashPassword(password: string): Promise<string> {
  const { PASSWORD } = await import('./utils/constants.js');
  return bcrypt.hash(password, PASSWORD.BCRYPT_ROUNDS);
}

export async function createUser(userData: {
  username: string;
  email: string;
  password: string;
  role?: string;
}): Promise<SafeUser> {
  const passwordHash = await hashPassword(userData.password);
  const emailHashValue = hashEmail(userData.email);

  const newUserResult = await db
    .insert(users)
    .values({
      username: userData.username,
      email: userData.email,
      emailHash: emailHashValue, // SHA-256 hash for indexed lookups
      passwordHash,
      role: userData.role || 'user',
    })
    .returning();

  const user = newUserResult[0];

  // SECURITY: Explicitly extract safe fields, never expose passwordHash
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailHash: user.emailHash, // Include for SafeUser type compatibility
    role: user.role,
    trustLevel: user.trustLevel,
    isActive: user.isActive,
    isSuspended: user.isSuspended,
    reputation: user.reputation,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    location: user.location,
    website: user.website,
    lastSeenAt: user.lastSeenAt,
    postCount: user.postCount,
    topicCount: user.topicCount,
    likesGiven: user.likesGiven,
    likesReceived: user.likesReceived,
    timeReadPosts: user.timeReadPosts,
    daysVisited: user.daysVisited,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByEmail(email: string): Promise<SafeUser | null> {
  // Fast indexed lookup by email hash (case-insensitive via lowercase in hash)
  const emailHashValue = hashEmail(email);
  const userResult = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailHash: users.emailHash, // Include for SafeUser type compatibility
      // SECURITY: Never expose passwordHash - this function is used in API routes
      role: users.role,
      trustLevel: users.trustLevel,
      isActive: users.isActive,
      isSuspended: users.isSuspended,
      reputation: users.reputation,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      location: users.location,
      website: users.website,
      lastSeenAt: users.lastSeenAt,
      postCount: users.postCount,
      topicCount: users.topicCount,
      likesGiven: users.likesGiven,
      likesReceived: users.likesReceived,
      timeReadPosts: users.timeReadPosts,
      daysVisited: users.daysVisited,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.emailHash, emailHashValue))
    .limit(1);

  if (!userResult[0]) {
    return null;
  }

  // Verify email matches to prevent hash collisions (extremely rare but possible)
  // NOTE: user.email is already decrypted by Drizzle's encryptedText fromDriver
  if (userResult[0].email.toLowerCase() !== email.toLowerCase()) {
    return null; // Hash collision, not a real match
  }

  return userResult[0];
}

export async function findUserById(id: number): Promise<SafeUser | null> {
  const userResult = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailHash: users.emailHash, // Include for SafeUser type compatibility
      // SECURITY: Never expose passwordHash - this function is used in API routes
      role: users.role,
      trustLevel: users.trustLevel,
      isActive: users.isActive,
      isSuspended: users.isSuspended,
      reputation: users.reputation,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      location: users.location,
      website: users.website,
      lastSeenAt: users.lastSeenAt,
      postCount: users.postCount,
      topicCount: users.topicCount,
      likesGiven: users.likesGiven,
      likesReceived: users.likesReceived,
      timeReadPosts: users.timeReadPosts,
      daysVisited: users.daysVisited,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return userResult[0] || null;
}

/**
 * Authentication middleware - requires user to be logged in
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}

/**
 * Authorization middleware - requires user to be logged in and have admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (req.user.role !== 'admin') {
    sendError(res, 'Admin access required', 403);
    return;
  }

  next();
}

export { passport };
