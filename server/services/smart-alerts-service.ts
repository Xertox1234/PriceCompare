import { storage } from "../storage";
import {
  type PriceAlert,
  type InsertPriceAlert,
} from "@shared/schema";

/**
 * Smart Alerts Service
 *
 * Provides intelligent alert suggestions, predictive alerts,
 * and analytics for price alert effectiveness.
 */

export interface SmartThresholdSuggestion {
  targetPrice: number;
  reason: string;
  confidence: number;
  savingsPercent: number;
  savingsAmount: number;
  basedOn: 'historical_low' | 'seasonal_pattern' | 'trending_down' | 'below_average';
}

/**
 * Price history entry from database queries.
 * Used for seasonal pattern analysis and price predictions.
 */
export interface PriceHistoryEntry {
  price: string;
  recordedAt: Date | string | null;
  createdAt?: Date | string | null;
}

/**
 * Seasonal price pattern for a specific month.
 * Contains aggregated statistics for price trends.
 */
export interface SeasonalPattern {
  month: string;
  average: number;
  count: number;
}

export interface PredictiveAlert {
  productId: number;
  productName: string;
  prediction: 'price_likely_to_drop' | 'best_deal_soon' | 'seasonal_opportunity';
  confidence: number;
  reason: string;
  estimatedDays: number;
  currentPrice: number;
  predictedPrice?: number;
}

export interface AlertEffectiveness {
  alertId: number;
  productId: number;
  targetPrice: number;
  timesTriggered: number;
  lastTriggeredAt: string | null;
  daysSinceCreated: number;
  daysSinceLastTrigger: number | null;
  effectiveness: 'high' | 'medium' | 'low';
  savingsRealized: number;
}

export interface AlertAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  triggeredAlerts: number;
  averageTimeToTrigger: number;
  totalSavings: number;
  mostEffectiveAlerts: AlertEffectiveness[];
  alertsByProduct: Record<number, number>;
}

/**
 * Generate smart threshold suggestions for a product
 */
export async function generateSmartThresholdSuggestions(
  productId: number,
  currentPrice: number
): Promise<SmartThresholdSuggestion[]> {
  const suggestions: SmartThresholdSuggestion[] = [];

  // Get price history for analysis
  const offerIds = await storage.getProductOfferIds(productId);

  if (offerIds.length === 0) return suggestions;

  // Get historical prices (last 365 days)
  const history = await storage.getPriceHistoryForOfferIds(offerIds, 365);

  if (history.length < 5) return suggestions;

  const prices = history.map(h => parseFloat(h.price));
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Suggestion 1: Historical Low (if current price > lowest)
  if (currentPrice > lowestPrice * 1.05) {
    const targetPrice = lowestPrice;
    suggestions.push({
      targetPrice,
      reason: `Based on all-time low of $${lowestPrice.toFixed(2)}`,
      confidence: 0.9,
      savingsPercent: ((currentPrice - targetPrice) / currentPrice) * 100,
      savingsAmount: currentPrice - targetPrice,
      basedOn: 'historical_low',
    });
  }

  // Suggestion 2: Below Average (good value threshold)
  if (currentPrice > averagePrice * 0.85) {
    const targetPrice = averagePrice * 0.85;
    suggestions.push({
      targetPrice,
      reason: `15% below average price of $${averagePrice.toFixed(2)}`,
      confidence: 0.8,
      savingsPercent: ((currentPrice - targetPrice) / currentPrice) * 100,
      savingsAmount: currentPrice - targetPrice,
      basedOn: 'below_average',
    });
  }

  // Suggestion 3: Trending Down Pattern
  const recentPrices = prices.slice(0, 7);
  if (recentPrices.length >= 3) {
    const isDowntrend = recentPrices.every((price, i) =>
      i === 0 || price <= recentPrices[i - 1] * 1.02
    );

    if (isDowntrend) {
      const trendRate = (recentPrices[0] - recentPrices[recentPrices.length - 1]) / recentPrices.length;
      const targetPrice = Math.max(lowestPrice, currentPrice - trendRate * 7);
      suggestions.push({
        targetPrice,
        reason: 'Price is trending down - catch the bottom',
        confidence: 0.7,
        savingsPercent: ((currentPrice - targetPrice) / currentPrice) * 100,
        savingsAmount: currentPrice - targetPrice,
        basedOn: 'trending_down',
      });
    }
  }

  // Suggestion 4: Seasonal Pattern
  const monthlyPrices = analyzeSeasonalPatterns(history);
  if (monthlyPrices.length > 0) {
    const lowestMonthAvg = Math.min(...monthlyPrices.map(m => m.average));
    if (currentPrice > lowestMonthAvg * 1.1) {
      suggestions.push({
        targetPrice: lowestMonthAvg,
        reason: `Seasonal low based on ${monthlyPrices.find(m => m.average === lowestMonthAvg)?.month || 'historical'} prices`,
        confidence: 0.75,
        savingsPercent: ((currentPrice - lowestMonthAvg) / currentPrice) * 100,
        savingsAmount: currentPrice - lowestMonthAvg,
        basedOn: 'seasonal_pattern',
      });
    }
  }

  // Sort by potential savings (descending)
  return suggestions.sort((a, b) => b.savingsAmount - a.savingsAmount).slice(0, 3);
}

/**
 * Analyze seasonal patterns from price history
 */
function analyzeSeasonalPatterns(history: Array<Record<string, unknown>>): SeasonalPattern[] {
  const monthlyData: Record<string, number[]> = {};

  history.forEach(entry => {
    const recordedAt = entry.recordedAt as string | Date | undefined;
    const createdAt = entry.createdAt as string | Date | undefined;
    const date = new Date(recordedAt || createdAt || new Date());
    const month = date.toLocaleString('default', { month: 'short' });

    if (!monthlyData[month]) {
      monthlyData[month] = [];
    }
    monthlyData[month].push(parseFloat(entry.price as string));
  });

  return Object.entries(monthlyData)
    .filter(([_, prices]) => prices.length >= 3)
    .map(([month, prices]) => ({
      month,
      average: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      count: prices.length,
    }));
}

/**
 * Generate predictive alerts for a user based on their watched products
 */
export async function generatePredictiveAlerts(userId: number): Promise<PredictiveAlert[]> {
  const alerts: PredictiveAlert[] = [];

  // Get user's active price alerts
  const userAlerts = await storage.getUserActiveAlertsWithProducts(userId);

  if (userAlerts.length === 0) return alerts;

  // BATCH QUERY 1: Get all product IDs and fetch lowest-priced offers for all products
  const productIds = userAlerts.map(a => a.productId);
  const allOffers = await storage.getLowestPricedOffersForProducts(productIds);

  // Build a map of productId -> lowest priced offer
  const offersByProduct = new Map<number, { id: number; price: string }>();
  for (const offer of allOffers) {
    // Only keep first (lowest price) offer per product
    if (!offersByProduct.has(offer.productId)) {
      offersByProduct.set(offer.productId, { id: offer.id, price: offer.price });
    }
  }

  // BATCH QUERY 2: Get price history for all relevant offer IDs
  const offerIds = Array.from(offersByProduct.values()).map(o => o.id);
  if (offerIds.length === 0) return alerts;

  const allHistory = await storage.getBatchPriceHistoryForOffers(offerIds);

  // Build a map of offerId -> history entries (limited to 60 per offer)
  const historyByOffer = new Map<number, Array<typeof allHistory[0]>>();
  for (const entry of allHistory) {
    const existing = historyByOffer.get(entry.productOfferId) || [];
    if (existing.length < 60) {
      existing.push(entry);
      historyByOffer.set(entry.productOfferId, existing);
    }
  }

  // Process alerts using pre-fetched data (no more queries in loop)
  for (const alert of userAlerts) {
    const offer = offersByProduct.get(alert.productId);
    if (!offer) continue;

    const currentPrice = parseFloat(offer.price);
    const history = historyByOffer.get(offer.id) || [];

    if (history.length < 10) continue;

    // Analyze for price drop prediction
    const prediction = analyzePriceDropProbability(history, currentPrice, parseFloat(alert.targetPrice));

    if (prediction) {
      alerts.push({
        productId: alert.productId,
        productName: alert.productName || 'Product',
        ...prediction,
        currentPrice,
      });
    }
  }

  return alerts;
}

/**
 * Analyze probability of price dropping to target
 */
function analyzePriceDropProbability(
  history: Array<Record<string, unknown>>,
  currentPrice: number,
  targetPrice: number
): Omit<PredictiveAlert, 'productId' | 'productName' | 'currentPrice'> | null {
  const prices = history.map(h => parseFloat(h.price as string));

  // Calculate trend
  const recentPrices = prices.slice(0, 14);
  const olderPrices = prices.slice(14, 28);

  if (recentPrices.length < 7 || olderPrices.length < 7) return null;

  const recentAvg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
  const olderAvg = olderPrices.reduce((sum, p) => sum + p, 0) / olderPrices.length;

  // Downward trend detected
  if (recentAvg < olderAvg * 0.95) {
    const dropRate = (olderAvg - recentAvg) / 14;
    const daysToTarget = Math.ceil((currentPrice - targetPrice) / dropRate);

    if (daysToTarget > 0 && daysToTarget < 30) {
      return {
        prediction: 'price_likely_to_drop',
        confidence: 0.75,
        reason: `Price has been declining at $${dropRate.toFixed(2)}/day. Target likely in ${daysToTarget} days.`,
        estimatedDays: daysToTarget,
        predictedPrice: targetPrice,
      };
    }
  }

  // Check for seasonal opportunity
  const monthlyPatterns = analyzeSeasonalPatterns(history);
  const currentMonth = new Date().toLocaleString('default', { month: 'short' });
  const currentMonthData = monthlyPatterns.find(m => m.month === currentMonth);

  if (currentMonthData && currentMonthData.average <= targetPrice * 1.1) {
    return {
      prediction: 'seasonal_opportunity',
      confidence: 0.7,
      reason: `${currentMonth} historically has good prices for this product`,
      estimatedDays: 15,
      predictedPrice: currentMonthData.average,
    };
  }

  // Check historical patterns for "best deal soon"
  const hasReachedTarget = prices.some(p => p <= targetPrice);
  if (hasReachedTarget) {
    const avgDaysBetweenDeals = calculateAverageDaysBetweenDeals(history, targetPrice);
    const daysSinceLastDeal = calculateDaysSincePrice(history, targetPrice);

    if (avgDaysBetweenDeals > 0 && daysSinceLastDeal >= avgDaysBetweenDeals * 0.8) {
      return {
        prediction: 'best_deal_soon',
        confidence: 0.65,
        reason: `Deal cycles suggest target price should occur soon (typically every ${avgDaysBetweenDeals} days)`,
        estimatedDays: Math.max(1, avgDaysBetweenDeals - daysSinceLastDeal),
      };
    }
  }

  return null;
}

/**
 * Calculate average days between deals
 */
function calculateAverageDaysBetweenDeals(history: Array<Record<string, unknown>>, targetPrice: number): number {
  const dealDates: Date[] = [];

  history.forEach(entry => {
    if (parseFloat(entry.price as string) <= targetPrice) {
      const recordedAt = entry.recordedAt as string | Date | undefined;
      const createdAt = entry.createdAt as string | Date | undefined;
      dealDates.push(new Date(recordedAt || createdAt || new Date()));
    }
  });

  if (dealDates.length < 2) return 0;

  let totalDays = 0;
  for (let i = 1; i < dealDates.length; i++) {
    const days = (dealDates[i - 1].getTime() - dealDates[i].getTime()) / (1000 * 60 * 60 * 24);
    totalDays += days;
  }

  return Math.round(totalDays / (dealDates.length - 1));
}

/**
 * Calculate days since target price was last seen
 */
function calculateDaysSincePrice(history: Array<Record<string, unknown>>, targetPrice: number): number {
  for (const entry of history) {
    if (parseFloat(entry.price as string) <= targetPrice) {
      const recordedAt = entry.recordedAt as string | Date | undefined;
      const createdAt = entry.createdAt as string | Date | undefined;
      const date = new Date(recordedAt || createdAt || new Date());
      return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
    }
  }
  return Infinity;
}

/**
 * Get alert effectiveness metrics
 */
export async function getAlertEffectiveness(userId: number): Promise<AlertEffectiveness[]> {
  const alerts = await storage.getUserPriceAlertsForEffectiveness(userId);

  if (alerts.length === 0) return [];

  // BATCH QUERY: Get lowest prices for all products in user's alerts
  const productIds = alerts.map(a => a.productId);
  const allOffers = await storage.getLowestPricedOffersForProducts(productIds);

  // Build map of productId -> lowest price
  const lowestPriceByProduct = new Map<number, number>();
  for (const offer of allOffers) {
    if (!lowestPriceByProduct.has(offer.productId)) {
      lowestPriceByProduct.set(offer.productId, parseFloat(offer.price));
    }
  }

  const effectiveness: AlertEffectiveness[] = [];

  // Process alerts using pre-fetched data (no more queries in loop)
  for (const alert of alerts) {
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(alert.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysSinceLastTrigger = alert.lastTriggeredAt
      ? Math.floor((Date.now() - new Date(alert.lastTriggeredAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const currentPrice = lowestPriceByProduct.get(alert.productId) || 0;
    const targetPrice = parseFloat(alert.targetPrice);
    const savingsRealized = Math.max(0, currentPrice - targetPrice) * (alert.timesTriggered || 0);

    // Calculate effectiveness rating
    let effectivenessRating: 'high' | 'medium' | 'low' = 'low';
    if (alert.timesTriggered && alert.timesTriggered > 0) {
      const triggerRate = (alert.timesTriggered / Math.max(1, daysSinceCreated / 30));
      if (triggerRate >= 1) effectivenessRating = 'high';
      else if (triggerRate >= 0.3) effectivenessRating = 'medium';
    }

    effectiveness.push({
      alertId: alert.id,
      productId: alert.productId,
      targetPrice,
      timesTriggered: alert.timesTriggered || 0,
      lastTriggeredAt: alert.lastTriggeredAt ? alert.lastTriggeredAt.toISOString() : null,
      daysSinceCreated,
      daysSinceLastTrigger,
      effectiveness: effectivenessRating,
      savingsRealized,
    });
  }

  return effectiveness;
}

/**
 * Get comprehensive alert analytics for a user
 */
export async function getAlertAnalytics(userId: number): Promise<AlertAnalytics> {
  const alerts = await storage.getUserPriceAlerts(userId);

  const activeAlerts = alerts.filter(a => a.isActive);
  const triggeredAlerts = alerts.filter(a => a.timesTriggered && a.timesTriggered > 0);

  // Calculate average time to trigger
  let totalDaysToTrigger = 0;
  let triggeredCount = 0;

  triggeredAlerts.forEach(alert => {
    if (alert.lastTriggeredAt && alert.createdAt) {
      const days = (new Date(alert.lastTriggeredAt).getTime() - new Date(alert.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      totalDaysToTrigger += days;
      triggeredCount++;
    }
  });

  const averageTimeToTrigger = triggeredCount > 0 ? totalDaysToTrigger / triggeredCount : 0;

  // Calculate total savings (approximate)
  const effectiveness = await getAlertEffectiveness(userId);
  const totalSavings = effectiveness.reduce((sum, e) => sum + e.savingsRealized, 0);

  // Alerts by product
  const alertsByProduct: Record<number, number> = {};
  alerts.forEach(alert => {
    alertsByProduct[alert.productId] = (alertsByProduct[alert.productId] || 0) + 1;
  });

  return {
    totalAlerts: alerts.length,
    activeAlerts: activeAlerts.length,
    triggeredAlerts: triggeredAlerts.length,
    averageTimeToTrigger: Math.round(averageTimeToTrigger),
    totalSavings,
    mostEffectiveAlerts: effectiveness.filter(e => e.effectiveness === 'high').slice(0, 5),
    alertsByProduct,
  };
}

/**
 * Create suggested alerts based on user's browsing/purchase history
 */
export async function createSuggestedAlert(
  userId: number,
  productId: number,
  suggestion: SmartThresholdSuggestion
): Promise<PriceAlert> {
  const alert: InsertPriceAlert = {
    userId,
    productId,
    targetPrice: suggestion.targetPrice.toFixed(2),
    isActive: true,
    notifyForum: false,
    suggestedBySystem: true,
    suggestionReason: suggestion.reason,
    priceWhenCreated: null,
    timesTriggered: 0,
    lastTriggeredAt: null,
  };

  return await storage.createPriceAlert(alert);
}
