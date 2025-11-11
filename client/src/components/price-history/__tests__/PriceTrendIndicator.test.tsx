import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import { PriceTrendIndicator } from '../PriceTrendIndicator';

describe('PriceTrendIndicator', () => {
  it('should render loading skeleton when isLoading is true', () => {
    render(<PriceTrendIndicator data={null} isLoading={true} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no data is available', () => {
    render(<PriceTrendIndicator data={null} isLoading={false} />);

    expect(screen.getByText(/no trend data available yet/i)).toBeInTheDocument();
  });

  it('should render empty state when daysAnalyzed is 0', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      averagePrice: 99.99,
      lowestPrice: 99.99,
      highestPrice: 99.99,
      trend: 'stable' as const,
      changePercentage: 0,
      daysAnalyzed: 0,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/no trend data available yet/i)).toBeInTheDocument();
  });

  it('should render falling price trend correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 89.99,
      averagePrice: 95.99,
      lowestPrice: 85.99,
      highestPrice: 105.99,
      trend: 'falling' as const,
      changePercentage: -6.25,
      daysAnalyzed: 30,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/price is falling/i)).toBeInTheDocument();
    // Use regex to handle rounding variations (-6.2% or -6.3%)
    expect(screen.getByText(/-6\.\d%/)).toBeInTheDocument();
    expect(screen.getByText('$89.99')).toBeInTheDocument();
    expect(screen.getByText('$95.99')).toBeInTheDocument();
    expect(screen.getByText('$85.99')).toBeInTheDocument();
    expect(screen.getByText('$105.99')).toBeInTheDocument();
  });

  it('should render rising price trend correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 109.99,
      averagePrice: 99.99,
      lowestPrice: 89.99,
      highestPrice: 109.99,
      trend: 'rising' as const,
      changePercentage: 10.0,
      daysAnalyzed: 30,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/price is rising/i)).toBeInTheDocument();
    expect(screen.getByText('+10.0%')).toBeInTheDocument();
  });

  it('should render stable price trend correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      averagePrice: 99.99,
      lowestPrice: 98.99,
      highestPrice: 100.99,
      trend: 'stable' as const,
      changePercentage: 0,
      daysAnalyzed: 30,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/price is stable/i)).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('should display days analyzed correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      averagePrice: 99.99,
      lowestPrice: 98.99,
      highestPrice: 100.99,
      trend: 'stable' as const,
      changePercentage: 0,
      daysAnalyzed: 30,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/based on 30 days of data/i)).toBeInTheDocument();
  });

  it('should handle singular day correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      averagePrice: 99.99,
      lowestPrice: 99.99,
      highestPrice: 99.99,
      trend: 'stable' as const,
      changePercentage: 0,
      daysAnalyzed: 1,
    };

    render(<PriceTrendIndicator data={mockData} isLoading={false} />);

    expect(screen.getByText(/based on 1 day of data/i)).toBeInTheDocument();
  });
});
