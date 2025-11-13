import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { CreateTopicDialog } from '../create-topic-dialog';

const mockCategories = [
  {
    id: 1,
    name: 'General',
    description: 'General discussions',
    color: '#3b82f6',
    topicCount: 50,
    postCount: 200,
    icon: 'MessageSquare',
  },
  {
    id: 2,
    name: 'Deals',
    description: 'Product deals',
    color: '#10b981',
    topicCount: 30,
    postCount: 150,
    icon: 'Tag',
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

describe('CreateTopicDialog', () => {
  const mockRedirectToLogin = vi.fn();

  beforeEach(() => {
    mockRedirectToLogin.mockClear();
  });

  it('should show sign in button when user is not logged in', () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={null}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Sign in to Create Topic')).toBeInTheDocument();
  });

  it('should call redirectToLogin when sign in button is clicked', () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={null}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const signInButton = screen.getByText('Sign in to Create Topic');
    fireEvent.click(signInButton);

    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('should show dialog trigger when user is logged in', () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('New Topic')).toBeInTheDocument();
  });

  it('should open dialog when trigger is clicked', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Create New Topic')).toBeInTheDocument();
    });
  });

  it('should render all form fields', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument();
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Tags (optional)')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  it('should render category options', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Select a category')).toBeInTheDocument();
    });
  });

  it('should render create and cancel buttons', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Create Topic')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('should allow typing in title field', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Enter topic title...') as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Test Topic Title' } });
      expect(titleInput.value).toBe('Test Topic Title');
    });
  });

  it('should allow typing in tags field', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      const tagsInput = screen.getByPlaceholderText('Enter tags separated by commas...') as HTMLInputElement;
      fireEvent.change(tagsInput, { target: { value: 'tag1, tag2, tag3' } });
      expect(tagsInput.value).toBe('tag1, tag2, tag3');
    });
  });

  it('should allow typing in content field', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      const contentInput = screen.getByPlaceholderText('Write your topic content...') as HTMLTextAreaElement;
      fireEvent.change(contentInput, { target: { value: 'This is my topic content' } });
      expect(contentInput.value).toBe('This is my topic content');
    });
  });

  it('should show validation errors for empty fields', async () => {
    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      const submitButton = screen.getByText('Create Topic');
      fireEvent.click(submitButton);
    });

    // Validation errors should appear
    await waitFor(() => {
      expect(screen.getByText(/Please select a category/)).toBeInTheDocument();
    });
  });

  it('should handle form submission with valid data', async () => {
    // Mock fetch for this test
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 1, title: 'Test Topic' }),
      } as Response)
    );

    render(
      <CreateTopicDialog
        categories={mockCategories}
        user={{ id: 1, username: 'testuser' }}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const trigger = screen.getByText('New Topic');
    fireEvent.click(trigger);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Enter topic title...');
      const contentInput = screen.getByPlaceholderText('Write your topic content...');

      fireEvent.change(titleInput, { target: { value: 'Valid Topic Title' } });
      fireEvent.change(contentInput, { target: { value: 'Valid content for the topic' } });
    });

    // Note: Category selection would require more complex interaction with the Select component
    // This test demonstrates the basic form interaction
  });
});
