import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import { PriceHistoryChart } from '../PriceHistoryChart';

const mockPriceHistory = [
  {
    id: 1,
    productId: 1,
    retailerId: 1,
    retailerName: 'Amazon',
    retailerLogo: 'https://example.com/amazon.png',
    price: '99.99',
    recordedAt: new Date('2025-01-01'),
  },
  {
    id: 2,
    productId: 1,
    retailerId: 1,
    retailerName: 'Amazon',
    retailerLogo: 'https://example.com/amazon.png',
    price: '89.99',
    recordedAt: new Date('2025-01-02'),
  },
  {
    id: 3,
    productId: 1,
    retailerId: 2,
    retailerName: 'Best Buy',
    retailerLogo: 'https://example.com/bestbuy.png',
    price: '95.99',
    recordedAt: new Date('2025-01-01'),
  },
];

describe('PriceHistoryChart', () => {
  it('should render loading skeleton when isLoading is true', () => {
    render(<PriceHistoryChart data={[]} isLoading={true} />);

    // Check for skeleton loader (div with specific class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no data is available', () => {
    render(<PriceHistoryChart data={[]} isLoading={false} />);

    expect(screen.getByText(/no price history available yet/i)).toBeInTheDocument();
    expect(screen.getByText(/price tracking will begin shortly/i)).toBeInTheDocument();
  });

  it('should render chart with price history data', () => {
    render(<PriceHistoryChart data={mockPriceHistory} isLoading={false} />);

    // Check for chart title
    expect(screen.getByText('Price History')).toBeInTheDocument();
    expect(screen.getByText(/track price changes over time/i)).toBeInTheDocument();

    // Check for retailer toggles
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('Best Buy')).toBeInTheDocument();
  });

  it('should display unique retailers from price history', () => {
    render(<PriceHistoryChart data={mockPriceHistory} isLoading={false} />);

    const amazonButton = screen.getByRole('button', { name: /amazon/i });
    const bestBuyButton = screen.getByRole('button', { name: /best buy/i });

    expect(amazonButton).toBeInTheDocument();
    expect(bestBuyButton).toBeInTheDocument();
  });

  it('should filter displayed retailer buttons by selected retailer IDs', () => {
    render(
      <PriceHistoryChart data={mockPriceHistory} isLoading={false} selectedRetailerIds={[1]} />
    );

    // Amazon button should be visible
    expect(screen.getByRole('button', { name: /amazon/i })).toBeInTheDocument();
    // Best Buy button should not be visible when filtered out
    expect(screen.queryByRole('button', { name: /best buy/i })).not.toBeInTheDocument();
  });

  // Note: Recharts rendering in test environment requires proper dimensions
  // The above tests verify the component logic without testing the actual chart rendering
});
