import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminUserManagement } from '../admin-user-management';

const mockUsers = [
  {
    id: 1,
    username: 'johndoe',
    email: 'john@example.com',
    role: 'user',
    isActive: true,
    reputation: 150,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    username: 'janedoe',
    email: 'jane@example.com',
    role: 'moderator',
    isActive: false,
    reputation: 250,
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 3,
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    reputation: 500,
    createdAt: '2023-12-01T00:00:00Z',
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('AdminUserManagement', () => {
  it('should render loading state', () => {
    render(
      <AdminUserManagement users={[]} isLoading={true} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('should render users list', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('johndoe')).toBeInTheDocument();
    expect(screen.getByText('janedoe')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('should display user emails', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('should display user reputation and join date', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/Reputation: 150/)).toBeInTheDocument();
    expect(screen.getByText(/Reputation: 250/)).toBeInTheDocument();
    expect(screen.getByText(/Reputation: 500/)).toBeInTheDocument();
  });

  it('should display active/inactive badges', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const activeBadges = screen.getAllByText('Active');
    const inactiveBadges = screen.getAllByText('Inactive');

    expect(activeBadges.length).toBeGreaterThan(0);
    expect(inactiveBadges.length).toBeGreaterThan(0);
  });

  it('should render role selectors for each user', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const roleSelectors = screen.getAllByRole('combobox');
    expect(roleSelectors).toHaveLength(3);
  });

  it('should show empty state when no users', () => {
    render(
      <AdminUserManagement users={[]} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should display user avatars with initials', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    // Two users (johndoe and janedoe) have "J" initial
    const jInitials = screen.getAllByText('J');
    expect(jInitials).toHaveLength(2);
    // One user (admin) has "A" initial
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should display User Management title', () => {
    render(
      <AdminUserManagement users={mockUsers} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage user roles and permissions')).toBeInTheDocument();
  });
});
