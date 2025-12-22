/**
 * E2E Test Helpers: Users
 */
import { db } from '../../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export async function getUserIdByEmail(email: string): Promise<number> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (!user) {
    throw new Error(`User not found for email: ${email}`);
  }
  return user.id;
}
