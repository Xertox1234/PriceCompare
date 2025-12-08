interface PriceHistoryEntry {
  price: string;
  recordedAt: Date | string;
  availability: string;
}

interface RetailerData {
  retailerId: number;
  retailerName: string;
  priceHistory: PriceHistoryEntry[];
}

interface ReliabilityScore {
  retailerId: number;
  retailerName: string;
  overallScore: number; // 0-100
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: {
    priceStability: number; // 0-100
    availability: number; // 0-100
    competitiveness: number; // 0-100
    consistency: number; // 0-100
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

/**
 * Calculate comprehensive retailer reliability score based on historical performance
 *
 * Evaluates retailers across 4 key dimensions to help users choose trustworthy sellers:
 * - **Price Stability** (25%): How consistent are prices over time? (less volatility = better)
 * - **Availability** (30%): How often is the product in stock? (higher = better)
 * - **Competitiveness** (25%): How do prices compare to market average? (lower = better)
 * - **Consistency** (20%): How often do prices change? (fewer changes = better)
 *
 * **Scoring Algorithm**:
 * 1. Calculate individual metric scores (0-100 for each)
 * 2. Apply weighted average: availability×0.30 + stability×0.25 + competitive×0.25 + consistency×0.20
 * 3. Determine overall rating: Excellent (80+), Good (65-79), Fair (50-64), Poor (<50)
 * 4. Identify strengths and weaknesses (metrics scoring >75 or <50)
 * 5. Generate personalized recommendation
 *
 * **Use Cases**:
 * - "Which retailer should I trust for this product?"
 * - "Is this retailer's price likely to change tomorrow?"
 * - "Does this seller keep items in stock?"
 *
 * **Example Ratings**:
 * - Excellent (80+): Reliable, competitive prices, consistent availability
 * - Good (65-79): Generally reliable with minor issues
 * - Fair (50-64): Moderate reliability, compare with others
 * - Poor (<50): Frequent issues, consider alternatives
 *
 * @param retailerData - Historical data for the retailer being evaluated
 * @param allRetailersData - Historical data for all retailers (for competitiveness comparison)
 * @returns Comprehensive reliability score with metrics, rating, and recommendation
 *
 * @example
 * ```typescript
 * const score = calculateRetailerReliability(retailer, allRetailers);
 * console.log(`${retailer.name}: ${score.rating} (${score.overallScore}/100)`);
 * console.log(`Strengths: ${score.strengths.join(', ')}`);
 * console.log(`Recommendation: ${score.recommendation}`);
 * ```
 */
export function calculateRetailerReliability(
  retailerData: RetailerData,
  allRetailersData: RetailerData[]
): ReliabilityScore {
  const { retailerId, retailerName, priceHistory } = retailerData;

  if (!priceHistory || priceHistory.length < 2) {
    return {
      retailerId,
      retailerName,
      overallScore: 0,
      rating: 'poor',
      metrics: {
        priceStability: 0,
        availability: 0,
        competitiveness: 0,
        consistency: 0,
      },
      strengths: [],
      weaknesses: ['Insufficient data for analysis'],
      recommendation: 'Limited historical data available for this retailer.',
    };
  }

  // Calculate individual metrics
  const priceStability = calculatePriceStability(priceHistory);
  const availability = calculateAvailability(priceHistory);
  const competitiveness = calculateCompetitiveness(retailerData, allRetailersData);
  const consistency = calculateConsistency(priceHistory);

  // Calculate weighted overall score
  const overallScore = Math.round(
    priceStability * 0.25 + availability * 0.3 + competitiveness * 0.25 + consistency * 0.2
  );

  // Determine rating
  const rating = getRating(overallScore);

  // Identify strengths and weaknesses
  const { strengths, weaknesses } = analyzeStrengthsWeaknesses({
    priceStability,
    availability,
    competitiveness,
    consistency,
  });

  // Generate recommendation
  const recommendation = generateRecommendation(overallScore, rating, strengths, weaknesses);

  return {
    retailerId,
    retailerName,
    overallScore,
    rating,
    metrics: {
      priceStability,
      availability,
      competitiveness,
      consistency,
    },
    strengths,
    weaknesses,
    recommendation,
  };
}

/**
 * Calculate price stability score using coefficient of variation
 *
 * Measures how consistent prices are over time. Lower price volatility indicates
 * a more reliable retailer that doesn't frequently change prices.
 *
 * **Scoring Formula**:
 * - CV (Coefficient of Variation) = (Standard Deviation / Mean) × 100
 * - Score = max(0, min(100, 100 - (CV × 5)))
 *
 * **Score Interpretation**:
 * - 100: Perfect stability (CV = 0%, prices never change)
 * - 75-99: Very stable (CV < 5%, minimal price fluctuation)
 * - 50-74: Moderately stable (CV 5-10%, some price changes)
 * - 0-49: Volatile (CV > 10%, frequent price changes)
 *
 * @param priceHistory - Array of price records with prices and dates
 * @returns Score 0-100 (100 = perfectly stable prices, 0 = highly volatile with CV ≥20%)
 */
function calculatePriceStability(priceHistory: PriceHistoryEntry[]): number {
  const prices = priceHistory.map((h) => parseFloat(h.price));

  if (prices.length < 2) return 0;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;

  // Lower CV = more stable = higher score
  // CV of 0% = 100, CV of 20% or more = 0
  const score = Math.max(0, Math.min(100, 100 - coefficientOfVariation * 5));

  return Math.round(score);
}

/**
 * Calculate stock availability score based on in-stock frequency
 *
 * Measures how often the product is available for purchase from this retailer.
 * Higher scores indicate better inventory management and product availability.
 *
 * **Scoring Formula**:
 * - Score = (Number of "in_stock" records / Total records) × 100
 *
 * **Score Interpretation**:
 * - 90-100: Excellent availability (rarely out of stock)
 * - 75-89: Good availability (occasional stockouts)
 * - 60-74: Fair availability (frequent stockouts)
 * - 0-59: Poor availability (often out of stock)
 *
 * @param priceHistory - Array of price records with availability status
 * @returns Score 0-100 (100 = always in stock, 0 = never in stock)
 */
function calculateAvailability(priceHistory: PriceHistoryEntry[]): number {
  const availableCount = priceHistory.filter((h) => h.availability === 'in_stock').length;

  const availabilityRate = (availableCount / priceHistory.length) * 100;
  return Math.round(availabilityRate);
}

/**
 * Calculate price competitiveness compared to market average
 *
 * Measures how this retailer's average price compares to all retailers for this product.
 * Lower prices relative to market average result in higher competitiveness scores.
 *
 * **Scoring Formula**:
 * - Calculate retailer's average price
 * - Calculate market average across all retailers
 * - Score based on price ratio (retailer avg / market avg)
 *
 * **Score Interpretation**:
 * - 100: 10%+ below market average (excellent deal)
 * - 90: 5-10% below market (very competitive)
 * - 80: At or slightly below market (competitive)
 * - 60: 0-5% above market (fair pricing)
 * - 40: 5-10% above market (above average)
 * - 20: 10%+ above market (expensive)
 * - 50: Neutral (only 1 retailer exists, no comparison possible)
 *
 * @param retailerData - Price history for the retailer being evaluated
 * @param allRetailersData - Price history for all retailers (for market average calculation)
 * @returns Score 0-100 (100 = significantly below market, 50 = neutral/no comparison, 20 = significantly above market)
 */
function calculateCompetitiveness(
  retailerData: RetailerData,
  allRetailersData: RetailerData[]
): number {
  const { priceHistory } = retailerData;

  if (allRetailersData.length < 2) {
    return 50; // Neutral score if no comparison available
  }

  const avgPrice =
    priceHistory.reduce((sum, h) => sum + parseFloat(h.price), 0) / priceHistory.length;

  // Calculate market average
  let totalPrices = 0;
  let totalCount = 0;
  allRetailersData.forEach((rd) => {
    rd.priceHistory.forEach((h) => {
      totalPrices += parseFloat(h.price);
      totalCount++;
    });
  });
  const marketAvg = totalPrices / totalCount;

  // Lower price relative to market = more competitive = higher score
  const priceRatio = avgPrice / marketAvg;

  if (priceRatio <= 0.9) return 100; // 10% below market = excellent
  if (priceRatio <= 0.95) return 90; // 5% below market = very good
  if (priceRatio <= 1.0) return 80; // At or slightly below market = good
  if (priceRatio <= 1.05) return 60; // 5% above market = fair
  if (priceRatio <= 1.1) return 40; // 10% above market = below average
  return 20; // More than 10% above market = poor
}

/**
 * Calculate pricing consistency score based on price change frequency
 *
 * Measures how often a retailer changes their prices. Fewer price changes indicate
 * more predictable, consistent pricing that users can rely on.
 *
 * **Scoring Formula**:
 * - Count price changes >1% from previous price
 * - Change rate = (Number of changes / Total comparisons) × 100
 * - Score = max(0, min(100, 100 - (Change rate × 2)))
 *
 * **Score Interpretation**:
 * - 100: Perfect consistency (0% change rate, prices never change)
 * - 80-99: Very consistent (0-10% change rate, rare price updates)
 * - 60-79: Moderately consistent (10-20% change rate, occasional changes)
 * - 40-59: Inconsistent (20-30% change rate, frequent changes)
 * - 0-39: Highly inconsistent (30%+ change rate, constantly changing)
 *
 * @param priceHistory - Array of price records sorted by date
 * @returns Score 0-100 (100 = prices never change, 0 = prices change 50%+ of the time)
 */
function calculateConsistency(priceHistory: PriceHistoryEntry[]): number {
  if (priceHistory.length < 2) return 100;

  // Sort by date
  const sorted = [...priceHistory].sort((a, b) => {
    const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
    const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
    return dateA.getTime() - dateB.getTime();
  });

  let priceChanges = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = parseFloat(sorted[i - 1].price);
    const currPrice = parseFloat(sorted[i].price);
    const change = Math.abs((currPrice - prevPrice) / prevPrice);

    // Count as a change if difference is more than 1%
    if (change > 0.01) {
      priceChanges++;
    }
  }

  const changeRate = (priceChanges / (sorted.length - 1)) * 100;

  // Fewer changes = more consistent = higher score
  // 0% changes = 100, 50% or more changes = 0
  const score = Math.max(0, Math.min(100, 100 - changeRate * 2));

  return Math.round(score);
}

/**
 * Convert numeric reliability score to categorical rating
 *
 * Translates the 0-100 overall reliability score into a human-readable
 * rating category for easier interpretation.
 *
 * **Rating Thresholds**:
 * - Excellent (80-100): Highly reliable, top-tier retailer
 * - Good (65-79): Reliable with minor issues
 * - Fair (50-64): Moderate reliability, compare with others
 * - Poor (<50): Significant reliability issues
 *
 * @param score - Overall reliability score (0-100)
 * @returns Rating category: 'excellent', 'good', 'fair', or 'poor'
 */
function getRating(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Identify retailer strengths and weaknesses based on metric thresholds
 *
 * Analyzes the 4 reliability metrics to extract qualitative strengths and weaknesses.
 * This helps users quickly understand where a retailer excels or has issues.
 *
 * **Strength Thresholds**:
 * - Metric score ≥75: Added as a strength
 * - Multiple tiers for availability (90+ = excellent, 75+ = good)
 * - Multiple tiers for competitiveness (80+ = competitive, 70+ = fair)
 *
 * **Weakness Thresholds**:
 * - Metric score <50: Added as a weakness
 * - Describes the specific problem (volatile pricing, stock issues, etc.)
 *
 * @param metrics - The 4 calculated reliability metrics (0-100 each)
 * @returns Object with arrays of strength and weakness descriptions
 */
function analyzeStrengthsWeaknesses(metrics: {
  priceStability: number;
  availability: number;
  competitiveness: number;
  consistency: number;
}): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Check each metric
  if (metrics.priceStability >= 75) {
    strengths.push('Stable pricing');
  } else if (metrics.priceStability < 50) {
    weaknesses.push('Volatile pricing');
  }

  if (metrics.availability >= 90) {
    strengths.push('Excellent stock availability');
  } else if (metrics.availability >= 75) {
    strengths.push('Good stock availability');
  } else if (metrics.availability < 60) {
    weaknesses.push('Frequent stock issues');
  }

  if (metrics.competitiveness >= 80) {
    strengths.push('Competitive prices');
  } else if (metrics.competitiveness >= 70) {
    strengths.push('Fair pricing');
  } else if (metrics.competitiveness < 50) {
    weaknesses.push('Higher prices than competitors');
  }

  if (metrics.consistency >= 80) {
    strengths.push('Consistent pricing');
  } else if (metrics.consistency < 50) {
    weaknesses.push('Frequent price changes');
  }

  return { strengths, weaknesses };
}

/**
 * Generate personalized buying recommendation based on reliability analysis
 *
 * Creates a human-readable recommendation that summarizes the retailer's
 * reliability and provides actionable guidance for purchasing decisions.
 *
 * **Recommendation Logic**:
 * - Excellent (80+): Emphasizes strengths, encourages purchase
 * - Good (65-79): Highlights strengths, mentions weaknesses to monitor
 * - Fair (50-64): Suggests comparison shopping, lists concerns
 * - Poor (<50): Warns of issues, recommends alternative retailers
 *
 * @param score - Overall reliability score (0-100)
 * @param rating - Categorical rating ('excellent' | 'good' | 'fair' | 'poor')
 * @param strengths - Array of identified strength descriptions
 * @param weaknesses - Array of identified weakness descriptions
 * @returns Personalized recommendation message for the user
 */
function generateRecommendation(
  score: number,
  rating: string,
  strengths: string[],
  weaknesses: string[]
): string {
  if (rating === 'excellent') {
    return `Highly reliable retailer with ${strengths.join(', ').toLowerCase()}. Excellent choice for purchasing this product.`;
  }

  if (rating === 'good') {
    return `Reliable retailer with ${strengths.join(', ').toLowerCase()}. ${
      weaknesses.length > 0
        ? `Consider monitoring ${weaknesses.join(' and ').toLowerCase()}.`
        : 'Good choice for purchasing.'
    }`;
  }

  if (rating === 'fair') {
    return `Moderate reliability. ${
      weaknesses.length > 0 ? `Be aware of ${weaknesses.join(' and ').toLowerCase()}.` : ''
    } Consider comparing with other retailers before purchasing.`;
  }

  return `Lower reliability rating. ${
    weaknesses.length > 0 ? `Issues include ${weaknesses.join(' and ').toLowerCase()}.` : ''
  } Recommend purchasing from alternative retailers if available.`;
}

/**
 * Calculate reliability scores for all retailers
 */
export function calculateAllRetailerReliability(
  allRetailersData: RetailerData[]
): ReliabilityScore[] {
  return allRetailersData.map((retailerData) =>
    calculateRetailerReliability(retailerData, allRetailersData)
  );
}
