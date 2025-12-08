import { render, screen } from '@testing-library/react';
import { AdminDashboard } from '../admin-dashboard';
import type {
  AnalyticsOverview,
  UserGrowthData,
  ProductActivityData,
  TopCategoryData,
} from '@shared/types';

describe('AdminDashboard', () => {
  const mockOverviewData: AnalyticsOverview = {
    totalUsers: '150',
    totalProducts: '45',
    totalRetailers: '12',
    totalAlerts: '320',
  };

  const mockUserGrowthData: UserGrowthData[] = [
    { date: '2024-01-01', count: 10 },
    { date: '2024-01-02', count: 15 },
  ];

  const mockProductActivityData: ProductActivityData[] = [
    { date: '2024-01-01', count: 20 },
    { date: '2024-01-02', count: 25 },
  ];

  const mockTopCategoriesData: TopCategoryData[] = [
    { categoryName: 'Electronics', productCount: 30 },
    { categoryName: 'Home', productCount: 15 },
  ];

  it('should render analytics metrics correctly', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={mockUserGrowthData}
        productActivityData={mockProductActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
  });

  it('should render metric labels', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={mockUserGrowthData}
        productActivityData={mockProductActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Retailers')).toBeInTheDocument();
    expect(screen.getByText('Price Alerts')).toBeInTheDocument();
  });

  it('should handle undefined overview data gracefully', () => {
    render(
      <AdminDashboard
        overviewData={undefined}
        userGrowthData={mockUserGrowthData}
        productActivityData={mockProductActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('should render chart titles', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={mockUserGrowthData}
        productActivityData={mockProductActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('User Growth')).toBeInTheDocument();
    expect(screen.getByText('Product Activity')).toBeInTheDocument();
    expect(screen.getByText('Top Product Categories')).toBeInTheDocument();
  });

  it('should render with empty data arrays', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={[]}
        productActivityData={[]}
        topCategoriesData={[]}
      />
    );

    expect(screen.getByText('User Growth')).toBeInTheDocument();
    expect(screen.getByText('Product Activity')).toBeInTheDocument();
  });
});
