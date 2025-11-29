interface PriceData {
  price: string;
  recordedAt: Date | string;
}

interface MonthlyPattern {
  month: number;
  monthName: string;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

interface DayOfWeekPattern {
  dayOfWeek: number;
  dayName: string;
  averagePrice: number;
  dataPoints: number;
}

interface SeasonalPattern {
  season: 'winter' | 'spring' | 'summer' | 'fall';
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

interface BestTimeRecommendation {
  timeframe: string;
  reason: string;
  expectedSavings: number;
}

export interface SeasonalAnalysis {
  hasSeasonalPattern: boolean;
  monthlyPatterns: MonthlyPattern[];
  seasonalPatterns: SeasonalPattern[];
  dayOfWeekPatterns: DayOfWeekPattern[];
  bestMonthToBuy: MonthlyPattern | null;
  worstMonthToBuy: MonthlyPattern | null;
  bestSeasonToBuy: SeasonalPattern | null;
  recommendation: BestTimeRecommendation | null;
  confidence: 'low' | 'medium' | 'high';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

/**
 * Determine which season a month belongs to
 */
function getSeasonForMonth(month: number): 'winter' | 'spring' | 'summer' | 'fall' {
  if (month === 11 || month === 0 || month === 1) return 'winter';
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  return 'fall'; // months 8-10
}

/**
 * Detect seasonal patterns in price data
 */
export function detectSeasonalPatterns(priceHistory: PriceData[]): SeasonalAnalysis | null {
  if (!priceHistory || priceHistory.length < 10) {
    return null;
  }

  // Convert to Date objects and extract prices
  const dataWithDates = priceHistory.map(item => ({
    date: typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt,
    price: parseFloat(item.price),
  }));

  // Calculate monthly patterns
  const monthlyData: Map<number, number[]> = new Map();
  dataWithDates.forEach(item => {
    const month = item.date.getMonth();
    if (!monthlyData.has(month)) {
      monthlyData.set(month, []);
    }
    monthlyData.get(month)!.push(item.price);
  });

  const monthlyPatterns: MonthlyPattern[] = Array.from(monthlyData.entries())
    .map(([month, prices]) => {
      const sum = prices.reduce((acc, p) => acc + p, 0);
      const avg = sum / prices.length;
      return {
        month,
        monthName: MONTH_NAMES[month],
        averagePrice: avg,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        dataPoints: prices.length,
      };
    })
    .sort((a, b) => a.month - b.month);

  // Calculate seasonal patterns
  const seasonalData: Map<string, number[]> = new Map();
  dataWithDates.forEach(item => {
    const season = getSeasonForMonth(item.date.getMonth());
    if (!seasonalData.has(season)) {
      seasonalData.set(season, []);
    }
    seasonalData.get(season)!.push(item.price);
  });

  const seasonalPatterns: SeasonalPattern[] = Array.from(seasonalData.entries())
    .map(([season, prices]) => {
      const sum = prices.reduce((acc, p) => acc + p, 0);
      const avg = sum / prices.length;
      return {
        season: season as 'winter' | 'spring' | 'summer' | 'fall',
        averagePrice: avg,
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        dataPoints: prices.length,
      };
    });

  // Calculate day of week patterns
  const dayOfWeekData: Map<number, number[]> = new Map();
  dataWithDates.forEach(item => {
    const dayOfWeek = item.date.getDay();
    if (!dayOfWeekData.has(dayOfWeek)) {
      dayOfWeekData.set(dayOfWeek, []);
    }
    dayOfWeekData.get(dayOfWeek)!.push(item.price);
  });

  const dayOfWeekPatterns: DayOfWeekPattern[] = Array.from(dayOfWeekData.entries())
    .map(([dayOfWeek, prices]) => {
      const sum = prices.reduce((acc, p) => acc + p, 0);
      const avg = sum / prices.length;
      return {
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek],
        averagePrice: avg,
        dataPoints: prices.length,
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  // Find best and worst months
  const bestMonth = monthlyPatterns.length > 0
    ? monthlyPatterns.reduce((min, curr) =>
        curr.averagePrice < min.averagePrice ? curr : min
      )
    : null;

  const worstMonth = monthlyPatterns.length > 0
    ? monthlyPatterns.reduce((max, curr) =>
        curr.averagePrice > max.averagePrice ? curr : max
      )
    : null;

  // Find best season
  const bestSeason = seasonalPatterns.length > 0
    ? seasonalPatterns.reduce((min, curr) =>
        curr.averagePrice < min.averagePrice ? curr : min
      )
    : null;

  // Determine if there's a significant seasonal pattern
  const overallAverage = dataWithDates.reduce((sum, item) => sum + item.price, 0) / dataWithDates.length;
  const hasSignificantPattern = monthlyPatterns.some(pattern =>
    Math.abs(pattern.averagePrice - overallAverage) > overallAverage * 0.1 // 10% deviation
  );

  // Calculate confidence based on data distribution
  const confidence = calculateConfidence(monthlyPatterns, dataWithDates.length);

  // Generate recommendation
  const recommendation = generateRecommendation(
    bestMonth,
    worstMonth,
    bestSeason,
    overallAverage,
    hasSignificantPattern
  );

  return {
    hasSeasonalPattern: hasSignificantPattern,
    monthlyPatterns,
    seasonalPatterns,
    dayOfWeekPatterns,
    bestMonthToBuy: bestMonth,
    worstMonthToBuy: worstMonth,
    bestSeasonToBuy: bestSeason,
    recommendation,
    confidence,
  };
}

/**
 * Calculate confidence level based on data quality
 */
function calculateConfidence(
  monthlyPatterns: MonthlyPattern[],
  totalDataPoints: number
): 'low' | 'medium' | 'high' {
  const monthsCovered = monthlyPatterns.length;
  const avgDataPointsPerMonth = totalDataPoints / monthsCovered;

  // High confidence: 6+ months, 5+ data points per month
  if (monthsCovered >= 6 && avgDataPointsPerMonth >= 5) {
    return 'high';
  }

  // Medium confidence: 4+ months, 3+ data points per month
  if (monthsCovered >= 4 && avgDataPointsPerMonth >= 3) {
    return 'medium';
  }

  return 'low';
}

/**
 * Generate buying recommendation based on patterns
 */
function generateRecommendation(
  bestMonth: MonthlyPattern | null,
  worstMonth: MonthlyPattern | null,
  bestSeason: SeasonalPattern | null,
  overallAverage: number,
  hasPattern: boolean
): BestTimeRecommendation | null {
  if (!bestMonth || !worstMonth || !hasPattern) {
    return null;
  }

  const savings = worstMonth.averagePrice - bestMonth.averagePrice;
  const savingsPercent = (savings / worstMonth.averagePrice) * 100;

  // Only recommend if savings are significant (>5%)
  if (savingsPercent < 5) {
    return {
      timeframe: 'No strong pattern',
      reason: 'Prices are relatively stable throughout the year. Buy when you need the product.',
      expectedSavings: 0,
    };
  }

  const currentMonth = new Date().getMonth();
  const monthsUntilBest = (bestMonth.month - currentMonth + 12) % 12;

  const timeframe = bestMonth.monthName;
  let reason = `Historically, prices are lowest in ${bestMonth.monthName}`;

  if (monthsUntilBest === 0) {
    reason += '. Now is a great time to buy!';
  } else if (monthsUntilBest <= 2) {
    reason += '. Consider waiting a bit longer for better prices.';
  } else if (monthsUntilBest >= 10) {
    reason += ' is coming soon. Consider waiting for potential deals.';
  } else {
    reason += `. You may want to wait ${monthsUntilBest} months for better prices.`;
  }

  if (bestSeason) {
    reason += ` Generally, ${bestSeason.season} offers the best prices.`;
  }

  return {
    timeframe,
    reason,
    expectedSavings: savingsPercent,
  };
}

/**
 * Get current seasonal recommendation
 */
export function getCurrentSeasonalAdvice(analysis: SeasonalAnalysis): string {
  if (!analysis.hasSeasonalPattern) {
    return 'No strong seasonal pattern detected. Prices are relatively stable year-round.';
  }

  const currentMonth = new Date().getMonth();
  const currentPattern = analysis.monthlyPatterns.find(p => p.month === currentMonth);

  if (!currentPattern || !analysis.bestMonthToBuy) {
    return 'Insufficient data for current month recommendation.';
  }

  const priceDiff = currentPattern.averagePrice - analysis.bestMonthToBuy.averagePrice;
  const diffPercent = (priceDiff / analysis.bestMonthToBuy.averagePrice) * 100;

  if (diffPercent < 5) {
    return `Current prices are near their historical low. Good time to buy!`;
  } else if (diffPercent < 15) {
    return `Prices are slightly elevated. Consider waiting for ${analysis.bestMonthToBuy.monthName} for better deals.`;
  } else {
    return `Prices are currently ${diffPercent.toFixed(0)}% above the yearly low. Wait for ${analysis.bestMonthToBuy.monthName} if possible.`;
  }
}
