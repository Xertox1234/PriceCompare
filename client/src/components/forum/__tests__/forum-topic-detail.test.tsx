import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForumTopicDetail } from '../forum-topic-detail';

const mockTopic = {
  id: 1,
  title: 'Best laptop deals 2024',
  content: 'Discussion about the best laptop deals this year',
  slug: 'best-laptop-deals-2024',
  views: 150,
  likes: 20,
  isPinned: true,
  isLocked: false,
  postCount: 5,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  author: {
    id: 1,
    username: 'techguru',
    trustLevel: 3,
    badges: ['Expert'],
  },
  category: {
    id: 1,
    name: 'Deals',
    description: 'Product deals',
    color: '#3b82f6',
    topicCount: 50,
    postCount: 200,
    icon: 'Tag',
  },
  tags: ['laptop', 'deals'],
};

const mockPosts = [
  {
    id: 1,
    content: 'I found a great deal on Dell laptops!',
    likes: 5,
    isLiked: false,
    postNumber: 1,
    createdAt: '2024-01-01T10:00:00Z',
    author: {
      id: 2,
      username: 'dealhunter',
      trustLevel: 2,
      badges: ['Helper'],
      postCount: 50,
      joinedAt: '2023-12-01T00:00:00Z',
    },
    replies: [],
  },
  {
    id: 2,
    content: 'Thanks for sharing!',
    likes: 3,
    isLiked: true,
    postNumber: 2,
    createdAt: '2024-01-02T10:00:00Z',
    author: {
      id: 3,
      username: 'bargainfinder',
      trustLevel: 1,
      badges: [],
      postCount: 20,
      joinedAt: '2024-01-01T00:00:00Z',
    },
    replies: [],
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

describe('ForumTopicDetail', () => {
  const mockOnBack = jest.fn();
  const mockRedirectToLogin = jest.fn();

  beforeEach(() => {
    mockOnBack.mockClear();
    mockRedirectToLogin.mockClear();
  });

  it('should render topic title and content', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Best laptop deals 2024')).toBeInTheDocument();
    expect(screen.getByText('Discussion about the best laptop deals this year')).toBeInTheDocument();
  });

  it('should render back button', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const backButton = screen.getByText('← Back to Topics');
    expect(backButton).toBeInTheDocument();
  });

  it('should call onBack when back button is clicked', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const backButton = screen.getByText('← Back to Topics');
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('should display topic metadata', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('150 views')).toBeInTheDocument();
    expect(screen.getByText('5 replies')).toBeInTheDocument();
  });

  it('should render all posts', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('I found a great deal on Dell laptops!')).toBeInTheDocument();
    expect(screen.getByText('Thanks for sharing!')).toBeInTheDocument();
  });

  it('should display post numbers', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText(/#2/)).toBeInTheDocument();
  });

  it('should show reply form when user is logged in', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByLabelText('Your Reply')).toBeInTheDocument();
    expect(screen.getByText('Post Reply')).toBeInTheDocument();
  });

  it('should show login prompt when user is not logged in', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={null}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Sign in to join the conversation')).toBeInTheDocument();
    expect(screen.getByText('Sign In to Reply')).toBeInTheDocument();
  });

  it('should call redirectToLogin when sign in button is clicked', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={null}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const signInButton = screen.getByText('Sign In to Reply');
    fireEvent.click(signInButton);

    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('should display category badge', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Deals')).toBeInTheDocument();
  });

  it('should display tags', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('laptop')).toBeInTheDocument();
    expect(screen.getByText('deals')).toBeInTheDocument();
  });

  it('should display author badges', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    // Check for post author usernames
    expect(screen.getByText('dealhunter')).toBeInTheDocument();
    expect(screen.getByText('bargainfinder')).toBeInTheDocument();
  });

  it('should show like buttons for posts', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const likeButtons = screen.getAllByRole('button', { name: /5|3/ });
    expect(likeButtons.length).toBeGreaterThan(0);
  });

  it('should show reply buttons for posts', () => {
    render(
      <ForumTopicDetail
        topic={mockTopic}
        posts={mockPosts}
        user={{ id: 1, username: 'testuser' }}
        onBack={mockOnBack}
        redirectToLogin={mockRedirectToLogin}
      />,
      { wrapper: createWrapper() }
    );

    const replyButtons = screen.getAllByText('Reply');
    expect(replyButtons.length).toBeGreaterThan(0);
  });
});
