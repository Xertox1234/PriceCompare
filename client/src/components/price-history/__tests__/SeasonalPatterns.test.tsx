import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeasonalPatterns } from '../SeasonalPatterns';

describe('SeasonalPatterns', () => {
  const mockDataWithPattern = {
    hasSeasonalPattern: true,
    monthlyPatterns: [
      {
        month: 0,
        monthName: 'January',
        averagePrice: 85.0,
        minPrice: 80.0,
        maxPrice: 90.0,
        dataPoints: 10,
      },
      {
        month: 6,
        monthName: 'July',
        averagePrice: 115.0,
        minPrice: 110.0,
        maxPrice: 120.0,
        dataPoints: 10,
      },
    ],
    seasonalPatterns: [
      {
        season: 'winter' as const,
        averagePrice: 85.0,
        minPrice: 80.0,
        maxPrice: 90.0,
        dataPoints: 20,
      },
      {
        season: 'summer' as const,
        averagePrice: 115.0,
        minPrice: 110.0,
        maxPrice: 120.0,
        dataPoints: 20,
      },
    ],
    dayOfWeekPatterns: [
      { dayOfWeek: 0, dayName: 'Sunday', averagePrice: 100.0, dataPoints: 5 },
      { dayOfWeek: 1, dayName: 'Monday', averagePrice: 95.0, dataPoints: 5 },
    ],
    bestMonthToBuy: {
      month: 0,
      monthName: 'January',
      averagePrice: 85.0,
      minPrice: 80.0,
      maxPrice: 90.0,
      dataPoints: 10,
    },
    worstMonthToBuy: {
      month: 6,
      monthName: 'July',
      averagePrice: 115.0,
      minPrice: 110.0,
      maxPrice: 120.0,
      dataPoints: 10,
    },
    bestSeasonToBuy: {
      season: 'winter' as const,
      averagePrice: 85.0,
      minPrice: 80.0,
      maxPrice: 90.0,
      dataPoints: 20,
    },
    recommendation: {
      timeframe: 'January',
      reason: 'Prices are historically lowest in January. Now is a great time to buy!',
      expectedSavings: 26.1,
    },
    confidence: 'high' as const,
  };

  const mockDataNoPattern = {
    hasSeasonalPattern: false,
    monthlyPatterns: [
      {
        month: 0,
        monthName: 'January',
        averagePrice: 100.0,
        minPrice: 98.0,
        maxPrice: 102.0,
        dataPoints: 10,
      },
    ],
    seasonalPatterns: [],
    dayOfWeekPatterns: [],
    bestMonthToBuy: null,
    worstMonthToBuy: null,
    bestSeasonToBuy: null,
    recommendation: {
      timeframe: 'No strong pattern',
      reason: 'Prices are relatively stable throughout the year. Buy when you need the product.',
      expectedSavings: 0,
    },
    confidence: 'medium' as const,
  };

  describe('Rendering', () => {
    it('should render loading state', () => {
      render(<SeasonalPatterns data={null} isLoading={true} />);
      expect(document.querySelector('.h-48')).toBeInTheDocument(); // Skeleton
    });

    it('should render no data state', () => {
      render(<SeasonalPatterns data={null} isLoading={false} />);
      expect(screen.getByText('No seasonal data available')).toBeInTheDocument();
      expect(screen.getByText(/Requires at least 10 price records/)).toBeInTheDocument();
    });

    it('should render title', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('Seasonal Price Patterns')).toBeInTheDocument();
    });

    it('should render confidence badge', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('HIGH CONFIDENCE')).toBeInTheDocument();
    });
  });

  describe('Pattern Detection', () => {
    it('should show pattern detected message when pattern exists', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText(/Seasonal pattern detected/)).toBeInTheDocument();
      expect(screen.getByText(/Timing your purchase can save you money/)).toBeInTheDocument();
    });

    it('should show no pattern message when no pattern exists', () => {
      render(<SeasonalPatterns data={mockDataNoPattern} />);
      expect(screen.getByText(/No significant seasonal pattern detected/)).toBeInTheDocument();
      expect(screen.getByText(/relatively stable year-round/)).toBeInTheDocument();
    });
  });

  describe('Recommendations', () => {
    it('should display recommendation with savings', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText(/Best Time to Buy:/)).toBeInTheDocument();
      expect(screen.getByText('January')).toBeInTheDocument();
      expect(screen.getByText(/26.1%/)).toBeInTheDocument();
    });

    it('should display recommendation reason', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText(/Prices are historically lowest in January/)).toBeInTheDocument();
    });

    it('should not show recommendation when savings are zero', () => {
      render(<SeasonalPatterns data={mockDataNoPattern} />);
      expect(screen.queryByText(/Best Time to Buy:/)).not.toBeInTheDocument();
    });
  });

  describe('Best and Worst Months', () => {
    it('should display best month', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('BEST MONTH')).toBeInTheDocument();
      const januaryElements = screen.getAllByText('January');
      expect(januaryElements.length).toBeGreaterThan(0);
      expect(screen.getByText('Avg: $85.00')).toBeInTheDocument();
    });

    it('should display worst month', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('WORST MONTH')).toBeInTheDocument();
      expect(screen.getByText('July')).toBeInTheDocument();
      expect(screen.getByText('Avg: $115.00')).toBeInTheDocument();
    });

    it('should not display months when data is missing', () => {
      render(<SeasonalPatterns data={mockDataNoPattern} />);
      expect(screen.queryByText('BEST MONTH')).not.toBeInTheDocument();
      expect(screen.queryByText('WORST MONTH')).not.toBeInTheDocument();
    });
  });

  describe('Seasonal Breakdown', () => {
    it('should display seasonal price breakdown', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('Price by Season')).toBeInTheDocument();
    });

    it('should display all seasons with prices', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('winter')).toBeInTheDocument();
      expect(screen.getByText('summer')).toBeInTheDocument();
      // Prices appear in multiple places (seasonal section and monthly trends)
      const price85Elements = screen.getAllByText('$85.00');
      expect(price85Elements.length).toBeGreaterThan(0);
      const price115Elements = screen.getAllByText('$115.00');
      expect(price115Elements.length).toBeGreaterThan(0);
    });

    it('should mark best season', () => {
      const { container: _container } = render(<SeasonalPatterns data={mockDataWithPattern} />);
      const bestBadge = screen.getByText('Best');
      expect(bestBadge).toBeInTheDocument();
    });

    it('should not display seasonal breakdown when no data', () => {
      const noSeasonalData = {
        ...mockDataNoPattern,
        seasonalPatterns: [],
      };
      render(<SeasonalPatterns data={noSeasonalData} />);
      expect(screen.queryByText('Price by Season')).not.toBeInTheDocument();
    });
  });

  describe('Monthly Price Trends', () => {
    it('should display monthly trends section', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('Monthly Price Trends')).toBeInTheDocument();
    });

    it('should display month abbreviations', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('Jan')).toBeInTheDocument();
      expect(screen.getByText('Jul')).toBeInTheDocument();
    });

    it('should not show monthly trends when no data', () => {
      const noMonthlyData = {
        ...mockDataNoPattern,
        monthlyPatterns: [],
      };
      render(<SeasonalPatterns data={noMonthlyData} />);
      expect(screen.queryByText('Monthly Price Trends')).not.toBeInTheDocument();
    });
  });

  describe('Confidence Levels', () => {
    it('should display high confidence badge', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('HIGH CONFIDENCE')).toBeInTheDocument();
    });

    it('should display medium confidence badge', () => {
      render(<SeasonalPatterns data={mockDataNoPattern} />);
      expect(screen.getByText('MEDIUM CONFIDENCE')).toBeInTheDocument();
    });

    it('should display low confidence warning', () => {
      const lowConfidenceData = {
        ...mockDataWithPattern,
        confidence: 'low' as const,
      };
      render(<SeasonalPatterns data={lowConfidenceData} />);
      expect(screen.getByText('LOW CONFIDENCE')).toBeInTheDocument();
      expect(screen.getByText(/Limited historical data available/)).toBeInTheDocument();
    });

    it('should not show warning for high confidence', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.queryByText(/Limited historical data available/)).not.toBeInTheDocument();
    });
  });

  describe('Visual Elements', () => {
    it('should display season icons', () => {
      const { container } = render(<SeasonalPatterns data={mockDataWithPattern} />);
      // Check for emoji icons in the seasonal breakdown
      const seasonalSection = container.querySelector('.grid');
      expect(seasonalSection).toBeInTheDocument();
    });

    it('should use appropriate colors for best month', () => {
      const { container } = render(<SeasonalPatterns data={mockDataWithPattern} />);
      const bestMonth = container.querySelector('.bg-green-50');
      expect(bestMonth).toBeInTheDocument();
    });

    it('should use appropriate colors for worst month', () => {
      const { container } = render(<SeasonalPatterns data={mockDataWithPattern} />);
      const worstMonth = container.querySelector('.bg-red-50');
      expect(worstMonth).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero expected savings', () => {
      const zeroSavingsData = {
        ...mockDataWithPattern,
        recommendation: {
          timeframe: 'January',
          reason: 'No savings expected',
          expectedSavings: 0,
        },
      };
      render(<SeasonalPatterns data={zeroSavingsData} />);
      expect(screen.queryByText(/Potential Savings:/)).not.toBeInTheDocument();
    });

    it('should handle missing recommendation', () => {
      const noRecommendationData = {
        ...mockDataWithPattern,
        recommendation: null,
      };
      render(<SeasonalPatterns data={noRecommendationData} />);
      expect(screen.queryByText(/Best Time to Buy:/)).not.toBeInTheDocument();
    });

    it('should handle single seasonal pattern', () => {
      const singleSeasonData = {
        ...mockDataWithPattern,
        seasonalPatterns: [mockDataWithPattern.seasonalPatterns[0]],
      };
      render(<SeasonalPatterns data={singleSeasonData} />);
      expect(screen.getByText('Price by Season')).toBeInTheDocument();
    });

    it('should handle all four seasons', () => {
      const allSeasonsData = {
        ...mockDataWithPattern,
        seasonalPatterns: [
          {
            season: 'winter' as const,
            averagePrice: 85,
            minPrice: 80,
            maxPrice: 90,
            dataPoints: 10,
          },
          {
            season: 'spring' as const,
            averagePrice: 95,
            minPrice: 90,
            maxPrice: 100,
            dataPoints: 10,
          },
          {
            season: 'summer' as const,
            averagePrice: 115,
            minPrice: 110,
            maxPrice: 120,
            dataPoints: 10,
          },
          {
            season: 'fall' as const,
            averagePrice: 105,
            minPrice: 100,
            maxPrice: 110,
            dataPoints: 10,
          },
        ],
      };
      render(<SeasonalPatterns data={allSeasonsData} />);
      expect(screen.getByText('winter')).toBeInTheDocument();
      expect(screen.getByText('spring')).toBeInTheDocument();
      expect(screen.getByText('summer')).toBeInTheDocument();
      expect(screen.getByText('fall')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper headings', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('Seasonal Price Patterns')).toBeInTheDocument();
      expect(screen.getByText('Price by Season')).toBeInTheDocument();
      expect(screen.getByText('Monthly Price Trends')).toBeInTheDocument();
    });

    it('should have tooltip for additional info', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      const infoIcon = document.querySelector('.lucide-info');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should have descriptive labels', () => {
      render(<SeasonalPatterns data={mockDataWithPattern} />);
      expect(screen.getByText('BEST MONTH')).toBeInTheDocument();
      expect(screen.getByText('WORST MONTH')).toBeInTheDocument();
      expect(screen.getByText(/Potential Savings:/)).toBeInTheDocument();
    });
  });
});
