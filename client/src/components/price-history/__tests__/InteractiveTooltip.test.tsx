import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { InteractiveTooltip } from '../InteractiveTooltip';

describe('InteractiveTooltip', () => {
  const mockRetailers = [
    { id: 1, name: 'Amazon', logo: '/amazon.png' },
    { id: 2, name: 'Walmart', logo: '/walmart.png' },
  ];

  const mockPayload = [
    { dataKey: 'retailer_1', value: 99.99, color: '#3b82f6' },
    { dataKey: 'retailer_2', value: 89.99, color: '#10b981' },
  ];

  const mockHistoricalContext = {
    averagePrice: 95.0,
    lowestPrice: 85.0,
    highestPrice: 105.0,
  };

  it('should not render when not active', () => {
    const { container } = render(
      <InteractiveTooltip
        active={false}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should not render when payload is empty', () => {
    const { container } = render(
      <InteractiveTooltip
        active={true}
        payload={[]}
        label="2024-01-01"
        retailers={mockRetailers}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render with basic data', () => {
    // Use ISO timestamp with explicit time to avoid timezone issues
    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2025-01-15T12:00:00.000Z"
        retailers={mockRetailers}
      />
    );

    // Use flexible date pattern to handle timezone differences
    expect(screen.getByText(/Jan 1[45], 2025/i)).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('Walmart')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
    expect(screen.getByText('$89.99')).toBeInTheDocument();
  });

  it('should sort retailers by price (lowest first)', () => {
    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
      />
    );

    const priceElements = screen.getAllByText(/\$\d+\.\d+/);
    // First should be lowest price (Walmart - $89.99)
    expect(priceElements[0]).toHaveTextContent('$89.99');
    // Second should be higher price (Amazon - $99.99)
    expect(priceElements[1]).toHaveTextContent('$99.99');
  });

  it('should toggle expanded view when More button clicked', () => {
    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
        historicalContext={mockHistoricalContext}
      />
    );

    // Historical context should not be visible initially
    expect(screen.queryByText('Historical Context')).not.toBeInTheDocument();

    // Click More button
    const moreButton = screen.getByText('More');
    fireEvent.click(moreButton);

    // Historical context should now be visible
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('$95.00')).toBeInTheDocument(); // Average
  });

  it('should show historical context when expanded', () => {
    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
        historicalContext={mockHistoricalContext}
      />
    );

    // Expand
    fireEvent.click(screen.getByText('More'));

    // Check all historical values
    expect(screen.getByText('$95.00')).toBeInTheDocument(); // Average
    expect(screen.getByText('$85.00')).toBeInTheDocument(); // Low
    expect(screen.getByText('$105.00')).toBeInTheDocument(); // High
  });

  it('should call onSetAlert when Set Alert button clicked', () => {
    const mockSetAlert = vi.fn();

    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
        onSetAlert={mockSetAlert}
      />
    );

    // Expand to show actions
    fireEvent.click(screen.getByText('More'));

    // Click Set Alert button
    const setAlertButton = screen.getByRole('button', { name: /set alert/i });
    fireEvent.click(setAlertButton);

    // Should call with lowest price retailer
    expect(mockSetAlert).toHaveBeenCalledWith(2, 89.99); // Walmart has lowest price
  });

  it('should call onViewRetailer when View Deal button clicked', () => {
    const mockViewRetailer = vi.fn();

    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
        onViewRetailer={mockViewRetailer}
      />
    );

    // Expand to show actions
    fireEvent.click(screen.getByText('More'));

    // Click View Deal button
    const viewDealButton = screen.getByRole('button', { name: /view deal/i });
    fireEvent.click(viewDealButton);

    // Should call with lowest price retailer
    expect(mockViewRetailer).toHaveBeenCalledWith(2); // Walmart has lowest price
  });

  it('should show price insight when expanded with multiple retailers', () => {
    render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
      />
    );

    // Expand
    fireEvent.click(screen.getByText('More'));

    // Check for insight
    expect(screen.getByText(/💡 Price Insight/i)).toBeInTheDocument();
    expect(screen.getByText(/Save \$10\.00/i)).toBeInTheDocument();
  });

  it('should highlight lowest and highest prices', () => {
    const { container } = render(
      <InteractiveTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        retailers={mockRetailers}
      />
    );

    // Check for green background on lowest price (first item)
    const priceRows = container.querySelectorAll('[class*="bg-green-50"]');
    expect(priceRows.length).toBeGreaterThan(0);

    // Check for red background on highest price (last item)
    const highPriceRows = container.querySelectorAll('[class*="bg-red-50"]');
    expect(highPriceRows.length).toBeGreaterThan(0);
  });
});
