import passport from 'passport';
import { Strategy as LocalStrategy, IVerifyOptions } from 'passport-local';
import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { sharedUsers } from '../shared/auth-schema';
import { eq, sql } from 'drizzle-orm';
import type { User as DatabaseUser } from '../shared/schema';
import type { SharedUser } from '../shared/auth-schema';
import {
  recordFailedLoginAsync,
  clearFailedLoginsAsync,
  isAccountLockedAsync,
} from './middleware/account-lockout';
import { logSecurityEvent, SecurityEventType } from './utils/security-logger';

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
  namespace Express {
    interface User extends SafeUser {}
  }
}

// Configure Passport Local Strategy
passport.use(new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      // Check if account is locked before attempting authentication (Redis-backed)
      const lockStatus = await isAccountLockedAsync(email);
      if (lockStatus.locked) {
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, {
          message: 'Account temporarily locked',
          locked: true,
          remainingTime: lockStatus.remainingTime
        } as ExtendedVerifyOptions);
      }

      // Case-insensitive email lookup using LOWER() for better UX
      const userResult = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
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
        .where(sql`LOWER(${users.email}) = LOWER(${email})`)
        .limit(1);

      if (!userResult.length) {
        // Record failed attempt (user not found) - Redis-backed
        await recordFailedLoginAsync(email);
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, { message: 'Invalid email or password' });
      }

      const user = userResult[0];
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        // Record failed attempt (wrong password) - Redis-backed
        const lockoutResult = await recordFailedLoginAsync(email);
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, {
          message: 'Invalid email or password',
          remainingAttempts: lockoutResult.remainingAttempts,
          locked: lockoutResult.locked
        } as ExtendedVerifyOptions);
      }

      // Successful login - clear any failed attempts (Redis-backed)
      await clearFailedLoginsAsync(email);
      // Note: Success logging will happen in route handler where we have access to req
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: Express.User, done) => {
  done(null, user.id);
});

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
    done(null, userResult[0] as Express.User || null);
  } catch (error) {
    done(error);
  }
});

// Helper functions
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function createUser(userData: { username: string; email: string; password: string; role?: string }): Promise<SafeUser> {
  const passwordHash = await hashPassword(userData.password);

  const newUserResult = await db.insert(users).values({
    username: userData.username,
    email: userData.email,
    passwordHash,
    role: userData.role || 'user',
  }).returning();

  const user = newUserResult[0];

  // SECURITY: Explicitly extract safe fields, never expose passwordHash
  return {
    id: user.id,
    username: user.username,
    email: user.email,
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
  const userResult = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
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
    .where(eq(users.email, email))
    .limit(1);
  return userResult[0] || null;
}

export async function findUserById(id: number): Promise<SafeUser | null> {
  const userResult = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
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
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

/**
 * Authorization middleware - requires user to be logged in and have admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

export { passport };