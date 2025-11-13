import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminCategoryManagement } from '../admin-category-management';

const mockCategories = [
  {
    id: 1,
    name: 'General Discussion',
    slug: 'general-discussion',
    description: 'General topics',
    color: '#3b82f6',
    icon: 'MessageSquare',
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 2,
    name: 'Support',
    slug: 'support',
    description: 'Help and support',
    color: '#ef4444',
    icon: 'HelpCircle',
    isActive: false,
    sortOrder: 2,
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

describe('AdminCategoryManagement', () => {
  it('should render loading state', () => {
    render(
      <AdminCategoryManagement categories={[]} isLoading={true} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('should render categories list', () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('General Discussion')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('General topics')).toBeInTheDocument();
    expect(screen.getByText('Help and support')).toBeInTheDocument();
  });

  it('should display active/inactive badges', () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const badges = screen.getAllByText(/Active|Inactive/);
    expect(badges).toHaveLength(2);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should render create category form', () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Create New Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Color')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('should show edit and delete buttons for each category', () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const editButtons = screen.getAllByLabelText(/Edit/);
    const deleteButtons = screen.getAllByLabelText(/Delete/);

    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });

  it('should open edit dialog when edit button is clicked', async () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const editButton = screen.getByLabelText('Edit General Discussion');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Category')).toBeInTheDocument();
    });
  });

  it('should open delete dialog when delete button is clicked', async () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const deleteButton = screen.getByLabelText('Delete General Discussion');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });
  });

  it('should show empty state when no categories', () => {
    render(
      <AdminCategoryManagement categories={[]} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('No categories found')).toBeInTheDocument();
  });

  it('should update form inputs', () => {
    render(
      <AdminCategoryManagement categories={mockCategories} isLoading={false} />,
      { wrapper: createWrapper() }
    );

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const descriptionInput = screen.getByLabelText('Description') as HTMLTextAreaElement;

    fireEvent.change(nameInput, { target: { value: 'New Category' } });
    fireEvent.change(descriptionInput, { target: { value: 'A new category description' } });

    expect(nameInput.value).toBe('New Category');
    expect(descriptionInput.value).toBe('A new category description');
  });
});
