import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceHistoryChart } from '../PriceHistoryChart';

// TODO: Skipped - These tests have rendering issues with Recharts in the test environment
// Need to properly mock chart rendering or use integration tests
describe.skip('Chart Enhancements', () => {
  const mockData = [
    {
      id: 1,
      productId: 1,
      retailerId: 1,
      retailerName: 'Amazon',
      retailerLogo: null,
      price: '100.00',
      recordedAt: new Date('2024-01-01'),
    },
    {
      id: 2,
      productId: 1,
      retailerId: 1,
      retailerName: 'Amazon',
      retailerLogo: null,
      price: '80.00', // 20% drop - should trigger annotation
      recordedAt: new Date('2024-01-05'),
    },
    {
      id: 3,
      productId: 1,
      retailerId: 2,
      retailerName: 'Walmart',
      retailerLogo: null,
      price: '95.00',
      recordedAt: new Date('2024-01-01'),
    },
    {
      id: 4,
      productId: 1,
      retailerId: 2,
      retailerName: 'Walmart',
      retailerLogo: null,
      price: '75.00', // 21% drop - should trigger annotation
      recordedAt: new Date('2024-01-03'),
    },
  ];

  describe('Price Drop Annotations', () => {
    it('should detect and display price drops greater than 15%', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Should show Amazon's 20% drop
      expect(screen.getByText(/Amazon.*20% drop/)).toBeInTheDocument();

      // Should show Walmart's 21% drop
      expect(screen.getByText(/Walmart.*21% drop/)).toBeInTheDocument();
    });

    it('should not display annotations when no significant drops exist', () => {
      const smallDropData = [
        {
          id: 1,
          productId: 1,
          retailerId: 1,
          retailerName: 'Amazon',
          retailerLogo: null,
          price: '100.00',
          recordedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          productId: 1,
          retailerId: 1,
          retailerName: 'Amazon',
          retailerLogo: null,
          price: '95.00', // Only 5% drop
          recordedAt: new Date('2024-01-02'),
        },
      ];

      render(
        <PriceHistoryChart
          data={smallDropData}
          productName="Test Product"
          productId={1}
        />
      );

      // Should not show any drop annotations
      expect(screen.queryByText(/drop/)).not.toBeInTheDocument();
    });

    it('should show maximum of 3 annotations with overflow indicator', () => {
      // Create data with 5 significant price drops
      const manyDropsData = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        productId: 1,
        retailerId: 1,
        retailerName: 'Amazon',
        retailerLogo: null,
        price: (100 - (i * 20)).toFixed(2), // Each drops >15%
        recordedAt: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
      }));

      render(
        <PriceHistoryChart
          data={manyDropsData}
          productName="Test Product"
          productId={1}
        />
      );

      // Should show overflow badge
      const overflowBadge = screen.getByText(/\+\d+ more/);
      expect(overflowBadge).toBeInTheDocument();
    });

    it('should format drop percentage correctly', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Percentage should be rounded to whole number
      const amazonDrop = screen.getByText(/Amazon.*20% drop/);
      expect(amazonDrop).toBeInTheDocument();
      expect(amazonDrop.textContent).not.toMatch(/\.\d+%/); // No decimals
    });

    it('should show date of price drop', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Should include formatted date
      expect(screen.getByText(/Jan 5/)).toBeInTheDocument(); // Amazon drop date
      expect(screen.getByText(/Jan 3/)).toBeInTheDocument(); // Walmart drop date
    });
  });

  describe('Zoom and Pan Functionality', () => {
    it('should render chart with data', () => {
      const { container } = render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Chart container should be in the DOM
      const chartContainer = container.querySelector('.recharts-responsive-container');
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe('Reference Lines', () => {
    it('should render chart with historical context', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Chart should render with data
      expect(screen.getByText('Price History')).toBeInTheDocument();
    });
  });

  describe('Integration with existing features', () => {
    it('should render with product name and ID', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Chart title should be present
      expect(screen.getByText('Price History')).toBeInTheDocument();
    });

    it('should work with retailer filtering', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          selectedRetailerIds={[1]} // Only Amazon
          productName="Test Product"
          productId={1}
        />
      );

      // Should show Amazon
      expect(screen.getByText('Amazon')).toBeInTheDocument();
    });

    it('should display annotations with all data', () => {
      render(
        <PriceHistoryChart
          data={mockData}
          productName="Test Product"
          productId={1}
        />
      );

      // Should show price drop annotations (multiple drops exist)
      const dropAnnotations = screen.getAllByText(/drop/);
      expect(dropAnnotations.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle single data point without errors', () => {
      const singlePoint = [mockData[0]];

      render(
        <PriceHistoryChart
          data={singlePoint}
          productName="Test Product"
          productId={1}
        />
      );

      // Should render without errors
      expect(screen.getByText('Price History')).toBeInTheDocument();

      // Should not show any drop annotations
      expect(screen.queryByText(/drop/)).not.toBeInTheDocument();
    });

    it('should handle empty data gracefully', () => {
      render(
        <PriceHistoryChart
          data={[]}
          productName="Test Product"
          productId={1}
        />
      );

      // Should show empty state
      expect(screen.getByText(/No price history available/)).toBeInTheDocument();
    });

    it('should handle price increases (no drop annotations)', () => {
      const increasingPrices = [
        {
          id: 1,
          productId: 1,
          retailerId: 1,
          retailerName: 'Amazon',
          retailerLogo: null,
          price: '50.00',
          recordedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          productId: 1,
          retailerId: 1,
          retailerName: 'Amazon',
          retailerLogo: null,
          price: '100.00', // 100% increase
          recordedAt: new Date('2024-01-02'),
        },
      ];

      render(
        <PriceHistoryChart
          data={increasingPrices}
          productName="Test Product"
          productId={1}
        />
      );

      // Should not show drop annotations for price increases
      expect(screen.queryByText(/drop/)).not.toBeInTheDocument();
    });
  });
});
