import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import type { ProductWatch, WatchList, UserReputation, DealSpotting } from '@shared/schema';

const log = createLogger('Community');

/**
 * Community Service
 *
 * Handles product watches, user reputation, deal spotting,
 * and community features.
 *
 * Phase 4: Migrated to use storage layer abstraction.
 */

export interface WatchStats {
  productId: number;
  watchCount: number;
  rank: number;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  reputationPoints: number;
  dealsSpotted: number;
  level: number;
  rank: number;
}

export interface DealPost {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
  dropAmount: number;
  retailer: string;
}

/**
 * Add a product to user's watch list
 */
export async function addProductWatch(userId: number, productId: number): Promise<ProductWatch> {
  const created = await storage.addProductWatchRecord(userId, productId);
  if (!created) {
    throw new Error('Failed to create product watch');
  }
  return created;
}

/**
 * Remove a product from user's watch list
 */
export async function removeProductWatch(userId: number, productId: number): Promise<boolean> {
  return storage.removeProductWatchRecord(userId, productId);
}

/**
 * Get user's watched products
 */
export async function getUserWatchedProducts(userId: number): Promise<number[]> {
  return storage.getUserProductWatchIds(userId);
}

/**
 * Get watch count for a product
 */
export async function getProductWatchCount(productId: number): Promise<number> {
  return storage.getProductWatchCountByProduct(productId);
}

/**
 * Get most watched products
 */
export async function getMostWatchedProducts(limit = 10): Promise<WatchStats[]> {
  return storage.getMostWatchedProductStats(limit);
}

/**
 * Check if user is watching a product
 */
export async function isUserWatchingProduct(userId: number, productId: number): Promise<boolean> {
  return storage.isUserWatchingProductCheck(userId, productId);
}

/**
 * Get user's reputation
 */
export async function getUserReputation(userId: number): Promise<UserReputation> {
  return storage.getOrCreateUserReputation(userId);
}

/**
 * Award reputation points to a user
 *
 * Uses atomic SQL operations within a SERIALIZABLE transaction to prevent
 * race conditions where concurrent awards could cause lost updates.
 * (e.g., two +10 awards on 100 points both writing 110 instead of 120)
 */
export async function awardReputation(
  userId: number,
  points: number,
  reason: 'deal_spotted' | 'accurate_prediction' | 'community_contribution'
): Promise<UserReputation> {
  // Storage layer handles atomic update with SERIALIZABLE transaction
  const result = await storage.updateUserReputationAtomic(userId, points, reason);

  // Check for badge achievements (outside transaction - has its own transaction)
  await checkAndAwardBadges(userId, result);

  return result;
}

/**
 * Check and award badges based on achievements (N+1 optimized)
 */
async function checkAndAwardBadges(userId: number, reputation: UserReputation): Promise<void> {
  const badgesToCheck: Array<{ name: string; condition: boolean }> = [
    {
      name: 'Deal Spotter',
      condition: (reputation.dealsSpotted ?? 0) >= 1,
    },
    {
      name: 'Deal Hunter',
      condition: (reputation.dealsSpotted ?? 0) >= 10,
    },
    {
      name: 'Deal Master',
      condition: (reputation.dealsSpotted ?? 0) >= 50,
    },
    {
      name: 'Community Contributor',
      condition: (reputation.communityContributions ?? 0) >= 10,
    },
    {
      name: 'Reputation Rookie',
      condition: (reputation.reputationPoints ?? 0) >= 100,
    },
    {
      name: 'Reputation Expert',
      condition: (reputation.reputationPoints ?? 0) >= 1000,
    },
    {
      name: 'Reputation Legend',
      condition: (reputation.reputationPoints ?? 0) >= 10000,
    },
  ];

  // Step 1: Filter eligible badges (conditions met)
  const eligibleBadgeNames = badgesToCheck
    .filter((badge) => badge.condition)
    .map((badge) => badge.name);

  if (eligibleBadgeNames.length === 0) {
    return; // No badges to award
  }

  // Step 2: Batch fetch all eligible badges (N+1 prevention)
  const eligibleBadges = await storage.getBadgesByNames(eligibleBadgeNames);

  if (eligibleBadges.length === 0) {
    return; // No badge records found in database
  }

  // Step 3: Batch fetch all user's existing badge IDs (N+1 prevention)
  const userBadgeIds = await storage.getUserBadgeIds(userId);
  const userBadgeIdSet = new Set(userBadgeIds);

  // Step 4: Award only badges user doesn't have yet
  for (const badgeRecord of eligibleBadges) {
    if (!userBadgeIdSet.has(badgeRecord.id)) {
      try {
        // Award badge with notification (transactional in storage layer)
        await storage.awardBadgeWithNotification(userId, badgeRecord.id, badgeRecord.name);
      } catch (error: unknown) {
        // Log error but continue with remaining badges
        log.error('Failed to award badge', {
          userId,
          badgeId: badgeRecord.id,
          badgeName: badgeRecord.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue to attempt other badges
      }
    }
  }
}

/**
 * Record a deal spotting event
 */
export async function recordDealSpotting(
  userId: number,
  productId: number,
  priceDropPercent: number,
  priceDropAmount: number
): Promise<DealSpotting> {
  // Calculate reputation to award (more significant drops = more points)
  let reputationAwarded = 10; // Base points
  if (priceDropPercent >= 50) reputationAwarded = 100;
  else if (priceDropPercent >= 30) reputationAwarded = 50;
  else if (priceDropPercent >= 20) reputationAwarded = 25;

  // Storage layer handles transactional deal spotting + reputation
  const dealSpotting = await storage.createDealSpottingWithReputation({
    userId,
    productId,
    priceDropPercent,
    priceDropAmount,
    reputationAwarded,
  });

  // Check and award badges after transaction (badge award itself has its own transaction)
  const currentReputation = await getUserReputation(userId);
  await checkAndAwardBadges(userId, currentReputation);

  return dealSpotting;
}

/**
 * Get leaderboard of top users
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  return storage.getCommunityLeaderboard(limit);
}

/**
 * WATCH LIST MANAGEMENT FUNCTIONS
 */

export interface WatchListWithStats extends WatchList {
  watchCount: number;
  highPriorityCount: number;
}

/**
 * Create a new watch list for a user
 */
export async function createWatchList(
  userId: number,
  name: string,
  description?: string,
  color?: string,
  icon?: string
): Promise<WatchList> {
  // Get the current max sort order for the user
  const nextOrder = await storage.getNextWatchListSortOrder(userId);

  return storage.createWatchListRecord({
    userId,
    name,
    description,
    color,
    icon,
    sortOrder: nextOrder,
  });
}

/**
 * Get all watch lists for a user
 */
export async function getUserWatchLists(userId: number): Promise<WatchListWithStats[]> {
  return storage.getWatchListsWithStats(userId);
}

/**
 * Get a specific watch list with details
 */
export async function getWatchListById(
  userId: number,
  listId: number
): Promise<WatchListWithStats | null> {
  return storage.getWatchListByIdWithStats(userId, listId);
}

/**
 * Update a watch list
 */
export async function updateWatchList(
  userId: number,
  listId: number,
  updates: {
    name?: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    sortOrder?: number;
  }
): Promise<WatchList | null> {
  return storage.updateWatchListRecord(userId, listId, updates);
}

/**
 * Delete a watch list (products will be set to null watch_list_id)
 */
export async function deleteWatchList(userId: number, listId: number): Promise<boolean> {
  return storage.deleteWatchListRecord(userId, listId);
}

/**
 * Get products in a watch list with full details
 */
export async function getWatchListProducts(
  userId: number,
  listId: number
): Promise<Array<ProductWatch & { productName?: string; productImage?: string }>> {
  return storage.getWatchListProductsWithDetails(userId, listId);
}

/**
 * Update product watch details (category, notes, priority, target price)
 */
export async function updateProductWatch(
  userId: number,
  watchId: number,
  updates: {
    category?: string | null;
    notes?: string | null;
    priority?: number;
    targetPrice?: string | null;
    watchListId?: number | null;
  }
): Promise<ProductWatch | null> {
  return storage.updateProductWatchRecord(userId, watchId, updates);
}

/**
 * Move products to a different watch list (bulk operation)
 */
export async function moveProductsToWatchList(
  userId: number,
  productWatchIds: number[],
  targetListId: number | null
): Promise<number> {
  return storage.moveProductWatchesBulk(userId, productWatchIds, targetListId);
}

/**
 * Remove multiple products from watch lists (bulk delete)
 */
export async function bulkRemoveProductWatches(
  userId: number,
  productWatchIds: number[]
): Promise<number> {
  return storage.deleteProductWatchesBulk(userId, productWatchIds);
}

/**
 * Get user's default watch list
 */
export async function getUserDefaultWatchList(userId: number): Promise<WatchList | null> {
  return storage.getUserDefaultWatchListRecord(userId);
}

/**
 * Export user's watch lists and products as JSON
 */
export async function exportWatchLists(
  userId: number
): Promise<import('../storage').WatchListExportData> {
  return storage.exportUserWatchListsData(userId);
}

/**
 * Import watch lists from JSON export
 */
export async function importWatchLists(
  userId: number,
  importData: import('../storage').WatchListImportData
): Promise<{ created: number; skipped: number }> {
  return storage.importWatchListsData(userId, importData);
}
