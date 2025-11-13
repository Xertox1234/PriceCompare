import { render, screen } from '@testing-library/react';
import { AdminDashboard } from '../admin-dashboard';
import type { AnalyticsOverview, UserGrowthData, ForumActivityData, TopCategoryData } from '@shared/types';

describe('AdminDashboard', () => {
  const mockOverviewData: AnalyticsOverview = {
    totalUsers: '150',
    totalTopics: '45',
    totalPosts: '320',
    totalCategories: '8',
  };

  const mockUserGrowthData: UserGrowthData[] = [
    { date: '2024-01-01', count: 10 },
    { date: '2024-01-02', count: 15 },
  ];

  const mockForumActivityData: ForumActivityData[] = [
    { date: '2024-01-01', count: 20 },
    { date: '2024-01-02', count: 25 },
  ];

  const mockTopCategoriesData: TopCategoryData[] = [
    { categoryName: 'General', topicCount: 30 },
    { categoryName: 'Support', topicCount: 15 },
  ];

  it('should render analytics metrics correctly', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={mockUserGrowthData}
        forumActivityData={mockForumActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should render metric labels', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={mockUserGrowthData}
        forumActivityData={mockForumActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Forum Topics')).toBeInTheDocument();
    expect(screen.getByText('Forum Posts')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('should handle undefined overview data gracefully', () => {
    render(
      <AdminDashboard
        overviewData={undefined}
        userGrowthData={mockUserGrowthData}
        forumActivityData={mockForumActivityData}
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
        forumActivityData={mockForumActivityData}
        topCategoriesData={mockTopCategoriesData}
      />
    );

    expect(screen.getByText('User Growth')).toBeInTheDocument();
    expect(screen.getByText('Forum Activity')).toBeInTheDocument();
    expect(screen.getByText('Most Active Categories')).toBeInTheDocument();
  });

  it('should render with empty data arrays', () => {
    render(
      <AdminDashboard
        overviewData={mockOverviewData}
        userGrowthData={[]}
        forumActivityData={[]}
        topCategoriesData={[]}
      />
    );

    expect(screen.getByText('User Growth')).toBeInTheDocument();
    expect(screen.getByText('Forum Activity')).toBeInTheDocument();
  });
});
