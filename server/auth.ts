import passport from 'passport';
import { Strategy as LocalStrategy, IVerifyOptions } from 'passport-local';
import bcrypt from 'bcrypt';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { sharedUsers } from '../shared/auth-schema';
import { eq } from 'drizzle-orm';
import type { User as DatabaseUser } from '../shared/schema';
import type { SharedUser } from '../shared/auth-schema';
import { recordFailedLogin, clearFailedLogins, isAccountLocked } from './middleware/account-lockout';
import { logSecurityEvent, SecurityEventType } from './utils/security-logger';

// Export the User type for use elsewhere
export type User = DatabaseUser;

// Extended verify options to include lockout information
interface ExtendedVerifyOptions extends IVerifyOptions {
  locked?: boolean;
  remainingTime?: number;
  remainingAttempts?: number;
}

// Extend Express types to include our User type
declare global {
  namespace Express {
    interface User extends DatabaseUser {}
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
      // Check if account is locked before attempting authentication
      const lockStatus = isAccountLocked(email);
      if (lockStatus.locked) {
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, {
          message: 'Account temporarily locked',
          locked: true,
          remainingTime: lockStatus.remainingTime
        } as ExtendedVerifyOptions);
      }

      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (!userResult.length) {
        // Record failed attempt (user not found)
        recordFailedLogin(email);
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, { message: 'Invalid email or password' });
      }

      const user = userResult[0];
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        // Record failed attempt (wrong password)
        const lockoutResult = recordFailedLogin(email);
        // Note: Logging will happen in route handler where we have access to req
        return done(null, false, {
          message: 'Invalid email or password',
          remainingAttempts: lockoutResult.remainingAttempts,
          locked: lockoutResult.locked
        } as ExtendedVerifyOptions);
      }

      // Successful login - clear any failed attempts
      clearFailedLogins(email);
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
    const userResult = await db.select().from(users).where(eq(users.id, id)).limit(1);
    done(null, userResult[0] || null);
  } catch (error) {
    done(error);
  }
});

// Helper functions
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function createUser(userData: { username: string; email: string; password: string; role?: string }): Promise<User> {
  const passwordHash = await hashPassword(userData.password);
  
  const newUserResult = await db.insert(users).values({
    username: userData.username,
    email: userData.email,
    passwordHash,
    role: userData.role || 'user',
  }).returning();
  
  return newUserResult[0];
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return userResult[0] || null;
}

export async function findUserById(id: number): Promise<User | null> {
  const userResult = await db.select().from(users).where(eq(users.id, id)).limit(1);
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