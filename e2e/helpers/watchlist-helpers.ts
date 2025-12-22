/**
 * E2E Test Helpers: Watchlists
 */
import { db } from '../../server/db';
import { watchLists } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export async function ensureUserHasWatchlist(
  userId: number,
  name: string
): Promise<{ watchListId: number }> {
  const [existing] = await db
    .select({ id: watchLists.id })
    .from(watchLists)
    .where(and(eq(watchLists.userId, userId), eq(watchLists.name, name)));

  if (existing) {
    return { watchListId: existing.id };
  }

  const [created] = await db
    .insert(watchLists)
    .values({
      userId,
      name,
    })
    .returning({ id: watchLists.id });

  return { watchListId: created.id };
}
