import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RetailerReliability } from '../RetailerReliability';

describe('RetailerReliability', () => {
  const mockExcellentRetailer = {
    retailerId: 1,
    retailerName: 'ReliableStore',
    overallScore: 92,
    rating: 'excellent' as const,
    metrics: {
      priceStability: 95,
      availability: 98,
      competitiveness: 85,
      consistency: 90,
    },
    strengths: ['Stable pricing', 'Excellent stock availability', 'Competitive prices'],
    weaknesses: [],
    recommendation:
      'Highly reliable retailer with stable pricing, excellent stock availability, competitive prices. Excellent choice for purchasing this product.',
  };

  const mockGoodRetailer = {
    retailerId: 2,
    retailerName: 'DecentStore',
    overallScore: 72,
    rating: 'good' as const,
    metrics: {
      priceStability: 75,
      availability: 80,
      competitiveness: 70,
      consistency: 65,
    },
    strengths: ['Good stock availability', 'Fair pricing'],
    weaknesses: [],
    recommendation:
      'Reliable retailer with good stock availability, fair pricing. Good choice for purchasing.',
  };

  const mockFairRetailer = {
    retailerId: 3,
    retailerName: 'AverageStore',
    overallScore: 58,
    rating: 'fair' as const,
    metrics: {
      priceStability: 55,
      availability: 65,
      competitiveness: 60,
      consistency: 52,
    },
    strengths: [],
    weaknesses: ['Volatile pricing'],
    recommendation:
      'Moderate reliability. Be aware of volatile pricing. Consider comparing with other retailers before purchasing.',
  };

  const mockPoorRetailer = {
    retailerId: 4,
    retailerName: 'UnreliableStore',
    overallScore: 35,
    rating: 'poor' as const,
    metrics: {
      priceStability: 30,
      availability: 40,
      competitiveness: 35,
      consistency: 35,
    },
    strengths: [],
    weaknesses: ['Volatile pricing', 'Frequent stock issues', 'Higher prices than competitors'],
    recommendation:
      'Lower reliability rating. Issues include volatile pricing and frequent stock issues and higher prices than competitors. Recommend purchasing from alternative retailers if available.',
  };

  describe('Rendering', () => {
    it('should render loading state', () => {
      render(<RetailerReliability data={null} isLoading={true} />);
      expect(document.querySelector('.h-64')).toBeInTheDocument(); // Skeleton
    });

    it('should render no data state', () => {
      render(<RetailerReliability data={null} isLoading={false} />);
      expect(screen.getByText('No retailer reliability data available')).toBeInTheDocument();
      expect(
        screen.getByText(/Requires price history from multiple retailers/)
      ).toBeInTheDocument();
    });

    it('should render empty array as no data', () => {
      render(<RetailerReliability data={[]} isLoading={false} />);
      expect(screen.getByText('No retailer reliability data available')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('Retailer Reliability')).toBeInTheDocument();
    });
  });

  describe('Retailer Display', () => {
    it('should display retailer name and score', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('ReliableStore')).toBeInTheDocument();
      expect(screen.getByText('92')).toBeInTheDocument();
      expect(screen.getByText('/100')).toBeInTheDocument();
    });

    it('should display rating badge', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('EXCELLENT')).toBeInTheDocument();
    });

    it('should display all metrics', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('Price Stability')).toBeInTheDocument();
      expect(screen.getByText('Availability')).toBeInTheDocument();
      expect(screen.getByText('Competitiveness')).toBeInTheDocument();
      expect(screen.getByText('Consistency')).toBeInTheDocument();
    });

    it('should display metric values', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('98%')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();
    });

    it('should display recommendation', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText(/Highly reliable retailer/)).toBeInTheDocument();
    });
  });

  describe('Multiple Retailers', () => {
    it('should render multiple retailers', () => {
      const data = [mockExcellentRetailer, mockGoodRetailer, mockFairRetailer];
      render(<RetailerReliability data={data} />);

      expect(screen.getByText('ReliableStore')).toBeInTheDocument();
      expect(screen.getByText('DecentStore')).toBeInTheDocument();
      expect(screen.getByText('AverageStore')).toBeInTheDocument();
    });

    it('should sort retailers by score (highest first)', () => {
      const data = [mockFairRetailer, mockExcellentRetailer, mockGoodRetailer];
      const { container } = render(<RetailerReliability data={data} />);

      const retailerCards = container.querySelectorAll('h4');
      expect(retailerCards[0].textContent).toBe('ReliableStore'); // 92 score
      expect(retailerCards[1].textContent).toBe('DecentStore'); // 72 score
      expect(retailerCards[2].textContent).toBe('AverageStore'); // 58 score
    });

    it('should show star for top excellent retailer', () => {
      const data = [mockExcellentRetailer, mockGoodRetailer];
      const { container } = render(<RetailerReliability data={data} />);

      const starIcon = container.querySelector('.lucide-star');
      expect(starIcon).toBeInTheDocument();
    });
  });

  describe('Rating Colors', () => {
    it('should use green color scheme for excellent rating', () => {
      const { container } = render(<RetailerReliability data={[mockExcellentRetailer]} />);
      const card = container.querySelector('[class*="bg-success"]');
      expect(card).toBeInTheDocument();
    });

    it('should use blue color scheme for good rating', () => {
      const { container } = render(<RetailerReliability data={[mockGoodRetailer]} />);
      const card = container.querySelector('[class*="bg-info"]');
      expect(card).toBeInTheDocument();
    });

    it('should use yellow color scheme for fair rating', () => {
      const { container } = render(<RetailerReliability data={[mockFairRetailer]} />);
      const card = container.querySelector('[class*="bg-warning"]');
      expect(card).toBeInTheDocument();
    });

    it('should use red color scheme for poor rating', () => {
      const { container } = render(<RetailerReliability data={[mockPoorRetailer]} />);
      const card = container.querySelector('[class*="bg-destructive"]');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Strengths and Weaknesses', () => {
    it('should display strengths when present', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('Strengths')).toBeInTheDocument();
      expect(screen.getByText('Stable pricing')).toBeInTheDocument();
      expect(screen.getByText('Excellent stock availability')).toBeInTheDocument();
      expect(screen.getByText('Competitive prices')).toBeInTheDocument();
    });

    it('should display weaknesses when present', () => {
      render(<RetailerReliability data={[mockPoorRetailer]} />);
      expect(screen.getByText('Weaknesses')).toBeInTheDocument();
      expect(screen.getByText('Volatile pricing')).toBeInTheDocument();
      expect(screen.getByText('Frequent stock issues')).toBeInTheDocument();
      expect(screen.getByText('Higher prices than competitors')).toBeInTheDocument();
    });

    it('should not display strengths section when none exist', () => {
      render(<RetailerReliability data={[mockPoorRetailer]} />);
      expect(screen.queryByText('Strengths')).not.toBeInTheDocument();
    });

    it('should not display weaknesses section when none exist', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.queryByText('Weaknesses')).not.toBeInTheDocument();
    });
  });

  describe('Progress Indicators', () => {
    it('should render progress bars for metrics', () => {
      const { container } = render(<RetailerReliability data={[mockExcellentRetailer]} />);
      const progressBars = container.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBe(4); // Four metrics
    });
  });

  describe('Accessibility', () => {
    it('should have proper headings', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('Retailer Reliability')).toBeInTheDocument();
      expect(screen.getByText('ReliableStore')).toBeInTheDocument();
    });

    it('should have tooltip for additional info', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      const infoIcon = document.querySelector('.lucide-info');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should have descriptive metric labels', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('Price Stability')).toBeInTheDocument();
      expect(screen.getByText('Availability')).toBeInTheDocument();
      expect(screen.getByText('Competitiveness')).toBeInTheDocument();
      expect(screen.getByText('Consistency')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single retailer', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText('ReliableStore')).toBeInTheDocument();
    });

    it('should handle retailer with zero strengths and weaknesses', () => {
      const neutralRetailer = {
        ...mockGoodRetailer,
        strengths: [],
        weaknesses: [],
      };
      render(<RetailerReliability data={[neutralRetailer]} />);
      expect(screen.queryByText('Strengths')).not.toBeInTheDocument();
      expect(screen.queryByText('Weaknesses')).not.toBeInTheDocument();
    });

    it('should handle very long retailer names', () => {
      const longNameRetailer = {
        ...mockExcellentRetailer,
        retailerName: 'Very Long Retailer Name That Goes On And On',
      };
      render(<RetailerReliability data={[longNameRetailer]} />);
      expect(screen.getByText('Very Long Retailer Name That Goes On And On')).toBeInTheDocument();
    });

    it('should handle zero scores', () => {
      const zeroScoreRetailer = {
        ...mockPoorRetailer,
        overallScore: 0,
        metrics: {
          priceStability: 0,
          availability: 0,
          competitiveness: 0,
          consistency: 0,
        },
      };
      render(<RetailerReliability data={[zeroScoreRetailer]} />);
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('should handle perfect scores', () => {
      const perfectRetailer = {
        ...mockExcellentRetailer,
        overallScore: 100,
        metrics: {
          priceStability: 100,
          availability: 100,
          competitiveness: 100,
          consistency: 100,
        },
      };
      render(<RetailerReliability data={[perfectRetailer]} />);
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('should display legend text', () => {
      render(<RetailerReliability data={[mockExcellentRetailer]} />);
      expect(screen.getByText(/Scores are calculated based on historical/)).toBeInTheDocument();
    });
  });
});
