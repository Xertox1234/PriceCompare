import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceVolatilityScore } from '../PriceVolatilityScore';

describe('PriceVolatilityScore', () => {
  const mockLowVolatility = {
    score: 15,
    level: 'low' as const,
    standardDeviation: 2.5,
    averagePrice: 100,
    priceRange: {
      min: 95,
      max: 105,
    },
    recommendation: "Prices are very stable.",
  };

  const mockModerateVolatility = {
    score: 35,
    level: 'moderate' as const,
    standardDeviation: 10,
    averagePrice: 100,
    priceRange: {
      min: 85,
      max: 115,
    },
    recommendation: "Prices show moderate fluctuation.",
  };

  const mockHighVolatility = {
    score: 60,
    level: 'high' as const,
    standardDeviation: 20,
    averagePrice: 100,
    priceRange: {
      min: 70,
      max: 130,
    },
    recommendation: "Prices fluctuate significantly.",
  };

  const mockVeryHighVolatility = {
    score: 85,
    level: 'very-high' as const,
    standardDeviation: 35,
    averagePrice: 100,
    priceRange: {
      min: 50,
      max: 150,
    },
    recommendation: "Extreme price volatility detected.",
  };

  describe('Rendering', () => {
    it('should render loading state', () => {
      render(<PriceVolatilityScore data={null} isLoading={true} />);
      expect(document.querySelector('.h-32')).toBeInTheDocument(); // Skeleton
    });

    it('should render no data state', () => {
      render(<PriceVolatilityScore data={null} isLoading={false} />);
      expect(screen.getByText('No volatility data available')).toBeInTheDocument();
    });

    it('should render volatility score', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('15/100')).toBeInTheDocument();
    });

    it('should render volatility level badge', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('should render recommendation', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('Prices are very stable.')).toBeInTheDocument();
    });
  });

  describe('Volatility Levels', () => {
    it('should display LOW level correctly', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
      expect(screen.getByText('15/100')).toBeInTheDocument();
    });

    it('should display MODERATE level correctly', () => {
      render(<PriceVolatilityScore data={mockModerateVolatility} />);
      expect(screen.getByText('MODERATE')).toBeInTheDocument();
      expect(screen.getByText('35/100')).toBeInTheDocument();
    });

    it('should display HIGH level correctly', () => {
      render(<PriceVolatilityScore data={mockHighVolatility} />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('60/100')).toBeInTheDocument();
    });

    it('should display VERY HIGH level correctly', () => {
      render(<PriceVolatilityScore data={mockVeryHighVolatility} />);
      expect(screen.getByText('VERY HIGH')).toBeInTheDocument();
      expect(screen.getByText('85/100')).toBeInTheDocument();
    });
  });

  describe('Price Statistics', () => {
    it('should display minimum price', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('$95.00')).toBeInTheDocument();
    });

    it('should display average price', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('$100.00')).toBeInTheDocument();
    });

    it('should display maximum price', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('$105.00')).toBeInTheDocument();
    });

    it('should display standard deviation', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('$2.50')).toBeInTheDocument();
    });

    it('should format prices with two decimal places', () => {
      const data = {
        ...mockLowVolatility,
        priceRange: { min: 95.555, max: 105.999 },
        averagePrice: 100.123,
        standardDeviation: 2.567,
      };
      render(<PriceVolatilityScore data={data} />);

      expect(screen.getByText('$95.56')).toBeInTheDocument();
      expect(screen.getByText('$106.00')).toBeInTheDocument();
      expect(screen.getByText('$100.12')).toBeInTheDocument();
      expect(screen.getByText('$2.57')).toBeInTheDocument();
    });
  });

  describe('Visual Indicators', () => {
    it('should show appropriate color scheme for low volatility', () => {
      const { container } = render(<PriceVolatilityScore data={mockLowVolatility} />);
      const scoreCard = container.querySelector('.bg-green-50');
      expect(scoreCard).toBeInTheDocument();
    });

    it('should show appropriate color scheme for moderate volatility', () => {
      const { container } = render(<PriceVolatilityScore data={mockModerateVolatility} />);
      const scoreCard = container.querySelector('.bg-blue-50');
      expect(scoreCard).toBeInTheDocument();
    });

    it('should show appropriate color scheme for high volatility', () => {
      const { container } = render(<PriceVolatilityScore data={mockHighVolatility} />);
      const scoreCard = container.querySelector('.bg-orange-50');
      expect(scoreCard).toBeInTheDocument();
    });

    it('should show appropriate color scheme for very high volatility', () => {
      const { container } = render(<PriceVolatilityScore data={mockVeryHighVolatility} />);
      const scoreCard = container.querySelector('.bg-red-50');
      expect(scoreCard).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper headings', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('Price Volatility')).toBeInTheDocument();
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
    });

    it('should have descriptive labels', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      expect(screen.getByText('Min Price')).toBeInTheDocument();
      expect(screen.getByText('Avg Price')).toBeInTheDocument();
      expect(screen.getByText('Max Price')).toBeInTheDocument();
      expect(screen.getByText('Std. Deviation')).toBeInTheDocument();
    });

    it('should have tooltip for additional info', () => {
      render(<PriceVolatilityScore data={mockLowVolatility} />);
      // Tooltip trigger should be present
      const infoIcon = document.querySelector('.lucide-info');
      expect(infoIcon).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle score of 0', () => {
      const data = { ...mockLowVolatility, score: 0 };
      render(<PriceVolatilityScore data={data} />);
      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('should handle score of 100', () => {
      const data = { ...mockVeryHighVolatility, score: 100 };
      render(<PriceVolatilityScore data={data} />);
      expect(screen.getByText('100/100')).toBeInTheDocument();
    });

    it('should handle equal min and max prices', () => {
      const data = {
        ...mockLowVolatility,
        priceRange: { min: 100, max: 100 },
      };
      render(<PriceVolatilityScore data={data} />);
      expect(screen.getAllByText('$100.00').length).toBeGreaterThan(1);
    });

    it('should handle zero standard deviation', () => {
      const data = { ...mockLowVolatility, standardDeviation: 0 };
      render(<PriceVolatilityScore data={data} />);
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });
});
