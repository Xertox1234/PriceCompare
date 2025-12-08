import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import { BestTimeToBuy } from '../BestTimeToBuy';

describe('BestTimeToBuy', () => {
  it('should render loading skeleton when isLoading is true', () => {
    render(<BestTimeToBuy data={null} isLoading={true} />);

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no data is available', () => {
    render(<BestTimeToBuy data={null} isLoading={false} />);

    expect(screen.getByText(/not enough data for analysis/i)).toBeInTheDocument();
  });

  it('should render "Great Deal" recommendation correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 85.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 84.99,
      daysSinceLowest: 5,
      recommendation: 'good_deal' as const,
      confidenceScore: 0.9,
      priceChangeVelocity: -0.5,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText(/great deal/i)).toBeInTheDocument();
    expect(screen.getByText(/this is an excellent time to buy/i)).toBeInTheDocument();
    expect(screen.getByText('90% confidence')).toBeInTheDocument();
    expect(screen.getByText('$85.99')).toBeInTheDocument();
    expect(screen.getByText('$84.99')).toBeInTheDocument();
  });

  it('should render "Consider Waiting" recommendation correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 109.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 85.99,
      daysSinceLowest: 15,
      recommendation: 'wait' as const,
      confidenceScore: 0.7,
      priceChangeVelocity: 0.3,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText(/consider waiting/i)).toBeInTheDocument();
    expect(screen.getByText(/the price may drop further/i)).toBeInTheDocument();
    expect(screen.getByText('70% confidence')).toBeInTheDocument();
  });

  it('should render "Fair Price" recommendation correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 95.99,
      daysSinceLowest: 10,
      recommendation: 'buy_now' as const,
      confidenceScore: 0.6,
      priceChangeVelocity: 0,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText(/fair price/i)).toBeInTheDocument();
    expect(screen.getByText(/the current price is reasonable/i)).toBeInTheDocument();
    expect(screen.getByText('60% confidence')).toBeInTheDocument();
  });

  it('should display historical average correctly', () => {
    const mockData = {
      productId: 1,
      currentPrice: 89.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 85.99,
      daysSinceLowest: 5,
      recommendation: 'good_deal' as const,
      confidenceScore: 0.9,
      priceChangeVelocity: -0.5,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText(/historical average/i)).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
  });

  it('should display price change velocity when significant', () => {
    const mockData = {
      productId: 1,
      currentPrice: 89.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 85.99,
      daysSinceLowest: 5,
      recommendation: 'good_deal' as const,
      confidenceScore: 0.9,
      priceChangeVelocity: -0.5,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText(/decreasing/i)).toBeInTheDocument();
    expect(screen.getByText('$0.50/day')).toBeInTheDocument();
  });

  it('should not display price change velocity when insignificant', () => {
    const mockData = {
      productId: 1,
      currentPrice: 99.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 98.99,
      daysSinceLowest: 10,
      recommendation: 'buy_now' as const,
      confidenceScore: 0.6,
      priceChangeVelocity: 0.05, // Less than 0.1
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.queryByText(/decreasing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/increasing/i)).not.toBeInTheDocument();
  });

  it('should display days since lowest price', () => {
    const mockData = {
      productId: 1,
      currentPrice: 89.99,
      historicalAverage: 99.99,
      lowestPriceLast90Days: 85.99,
      daysSinceLowest: 15,
      recommendation: 'good_deal' as const,
      confidenceScore: 0.9,
      priceChangeVelocity: -0.5,
    };

    render(<BestTimeToBuy data={mockData} isLoading={false} />);

    expect(screen.getByText('15 days ago')).toBeInTheDocument();
  });
});
