import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import type { User } from '../shared/schema';

// Configure Passport Local Strategy
passport.use(new LocalStrategy(
  { 
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (!userResult.length) {
        return done(null, false, { message: 'User not found' });
      }
      
      const user = userResult[0];
      const isValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValid) {
        return done(null, false, { message: 'Invalid password' });
      }
      
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user: any, done) => {
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

export async function createUser(userData: { username: string; email: string; password: string }): Promise<User> {
  const passwordHash = await hashPassword(userData.password);
  
  const newUserResult = await db.insert(users).values({
    username: userData.username,
    email: userData.email,
    passwordHash,
  }).returning();
  
  const user = newUserResult[0];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt || new Date(),
    updatedAt: user.updatedAt || new Date(),
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return userResult[0] || null;
}

export async function findUserById(id: number): Promise<User | null> {
  const userResult = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return userResult[0] || null;
}

export { passport };