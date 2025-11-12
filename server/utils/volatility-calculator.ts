interface PriceData {
  price: string;
  recordedAt: Date | string;
}

interface VolatilityResult {
  score: number;
  level: 'low' | 'moderate' | 'high' | 'very-high';
  standardDeviation: number;
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  recommendation: string;
}

/**
 * Calculate price volatility score from historical price data
 *
 * The score is calculated based on:
 * - Standard deviation of prices
 * - Coefficient of variation (CV = std dev / mean)
 * - Price range as percentage of average
 *
 * Score ranges:
 * - 0-25: Low volatility (stable prices)
 * - 26-50: Moderate volatility (some fluctuation)
 * - 51-75: High volatility (significant fluctuation)
 * - 76-100: Very high volatility (extreme fluctuation)
 */
export function calculateVolatility(priceHistory: PriceData[]): VolatilityResult | null {
  if (!priceHistory || priceHistory.length < 2) {
    return null;
  }

  // Extract prices as numbers
  const prices = priceHistory.map(item => parseFloat(item.price));

  // Calculate basic statistics
  const n = prices.length;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  const mean = sum / n;

  // Calculate standard deviation
  const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / n;
  const standardDeviation = Math.sqrt(variance);

  // Calculate coefficient of variation (normalized volatility)
  const coefficientOfVariation = (standardDeviation / mean) * 100;

  // Calculate price range
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const rangePercent = (priceRange / mean) * 100;

  // Calculate volatility score (0-100)
  // Weighted combination of CV and range percentage
  const cvScore = Math.min(coefficientOfVariation * 2, 50); // Max 50 points
  const rangeScore = Math.min(rangePercent * 1.5, 50); // Max 50 points
  const rawScore = cvScore + rangeScore;
  const score = Math.min(Math.round(rawScore), 100);

  // Determine volatility level
  let level: 'low' | 'moderate' | 'high' | 'very-high';
  if (score <= 25) {
    level = 'low';
  } else if (score <= 50) {
    level = 'moderate';
  } else if (score <= 75) {
    level = 'high';
  } else {
    level = 'very-high';
  }

  // Generate recommendation based on volatility level
  const recommendation = getRecommendation(level, coefficientOfVariation, rangePercent);

  return {
    score,
    level,
    standardDeviation,
    averagePrice: mean,
    priceRange: {
      min: minPrice,
      max: maxPrice,
    },
    recommendation,
  };
}

function getRecommendation(
  level: string,
  cv: number,
  rangePercent: number
): string {
  switch (level) {
    case 'low':
      return "Prices are very stable. This is a good product to buy anytime as prices don't fluctuate much. Consider setting up a price alert for small drops to get the best deal.";

    case 'moderate':
      return "Prices show moderate fluctuation. Monitor prices for a few days before buying. Consider waiting for a dip if you're not in a hurry, as prices may drop by 5-10%.";

    case 'high':
      return `Prices fluctuate significantly (±${rangePercent.toFixed(0)}% from average). Wait for a price drop before purchasing. Set up price alerts to catch deals. Prices can vary by ${rangePercent.toFixed(0)}% or more.`;

    case 'very-high':
      return `Extreme price volatility detected (±${rangePercent.toFixed(0)}% from average). Strongly recommend waiting for a significant price drop. Prices can swing dramatically - patience will likely save you ${rangePercent.toFixed(0)}% or more. Set aggressive price alerts.`;

    default:
      return "Monitor prices before making a purchase decision.";
  }
}

/**
 * Calculate volatility trend over time
 * Compares recent volatility (last 30 days) to overall volatility
 */
export function calculateVolatilityTrend(
  priceHistory: PriceData[],
  recentDays: number = 30
): { trend: 'increasing' | 'decreasing' | 'stable'; change: number } | null {
  if (!priceHistory || priceHistory.length < 4) {
    return null;
  }

  // Sort by date
  const sorted = [...priceHistory].sort((a, b) => {
    const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
    const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
    return dateA.getTime() - dateB.getTime();
  });

  // Calculate cutoff date for recent data
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);

  // Split into recent and older data
  const recentData = sorted.filter(item => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    return date >= cutoffDate;
  });

  const olderData = sorted.filter(item => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    return date < cutoffDate;
  });

  // Need sufficient data in both periods
  if (recentData.length < 2 || olderData.length < 2) {
    return null;
  }

  // Calculate volatility for both periods
  const recentVolatility = calculateVolatility(recentData);
  const olderVolatility = calculateVolatility(olderData);

  if (!recentVolatility || !olderVolatility) {
    return null;
  }

  // Compare volatility scores
  const change = recentVolatility.score - olderVolatility.score;
  const changePercent = Math.abs(change);

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (changePercent < 10) {
    trend = 'stable';
  } else if (change > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  return { trend, change };
}
