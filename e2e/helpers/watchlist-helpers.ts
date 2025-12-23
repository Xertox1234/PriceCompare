/**
 * E2E Test Helpers: Watchlists
 */
import { db } from '../../server/db';
import { watchLists, productWatches } from '@shared/schema';
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

/**
 * Bulk add products to watchlist via direct database insertion (fast)
 *
 * Use this for tests that need watchlist setup without testing the addition flow itself.
 * Bypasses UI and API layers for speed.
 *
 * @param userId - User ID who owns the watchlist
 * @param watchListId - Watchlist ID to add products to
 * @param productIds - Array of product IDs to add
 *
 * @example
 * const { watchListId } = await ensureUserHasWatchlist(1, 'My List');
 * await bulkAddProductsToWatchlist(1, watchListId, [123, 124, 125]);
 */
export async function bulkAddProductsToWatchlist(
  userId: number,
  watchListId: number,
  productIds: number[]
): Promise<void> {
  const productWatchesToCreate = productIds.map((productId) => ({
    userId,
    productId,
    watchListId,
    // Priority defaults to 3 (matches schema default and UI behavior)
    priority: 3,
  }));

  // Insert all product watches in a single transaction for speed
  await db.insert(productWatches).values(productWatchesToCreate).returning();
}
