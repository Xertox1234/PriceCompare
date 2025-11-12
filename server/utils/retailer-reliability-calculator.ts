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
 * Calculate retailer reliability score based on historical data
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
    priceStability * 0.25 +
    availability * 0.30 +
    competitiveness * 0.25 +
    consistency * 0.20
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
 * Calculate price stability score (less volatility = higher score)
 */
function calculatePriceStability(priceHistory: PriceHistoryEntry[]): number {
  const prices = priceHistory.map(h => parseFloat(h.price));

  if (prices.length < 2) return 0;

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = (stdDev / mean) * 100;

  // Lower CV = more stable = higher score
  // CV of 0% = 100, CV of 20% or more = 0
  const score = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 5)));

  return Math.round(score);
}

/**
 * Calculate availability score
 */
function calculateAvailability(priceHistory: PriceHistoryEntry[]): number {
  const availableCount = priceHistory.filter(
    h => h.availability === 'in_stock'
  ).length;

  const availabilityRate = (availableCount / priceHistory.length) * 100;
  return Math.round(availabilityRate);
}

/**
 * Calculate price competitiveness vs other retailers
 */
function calculateCompetitiveness(
  retailerData: RetailerData,
  allRetailersData: RetailerData[]
): number {
  const { priceHistory } = retailerData;

  if (allRetailersData.length < 2) {
    return 50; // Neutral score if no comparison available
  }

  const avgPrice = priceHistory.reduce((sum, h) => sum + parseFloat(h.price), 0) / priceHistory.length;

  // Calculate market average
  let totalPrices = 0;
  let totalCount = 0;
  allRetailersData.forEach(rd => {
    rd.priceHistory.forEach(h => {
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
  if (priceRatio <= 1.10) return 40; // 10% above market = below average
  return 20; // More than 10% above market = poor
}

/**
 * Calculate consistency score (how often prices change)
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
  const score = Math.max(0, Math.min(100, 100 - (changeRate * 2)));

  return Math.round(score);
}

/**
 * Get rating based on overall score
 */
function getRating(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Analyze strengths and weaknesses
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
 * Generate recommendation based on analysis
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
      weaknesses.length > 0
        ? `Be aware of ${weaknesses.join(' and ').toLowerCase()}.`
        : ''
    } Consider comparing with other retailers before purchasing.`;
  }

  return `Lower reliability rating. ${
    weaknesses.length > 0
      ? `Issues include ${weaknesses.join(' and ').toLowerCase()}.`
      : ''
  } Recommend purchasing from alternative retailers if available.`;
}

/**
 * Calculate reliability scores for all retailers
 */
export function calculateAllRetailerReliability(
  allRetailersData: RetailerData[]
): ReliabilityScore[] {
  return allRetailersData.map(retailerData =>
    calculateRetailerReliability(retailerData, allRetailersData)
  );
}
