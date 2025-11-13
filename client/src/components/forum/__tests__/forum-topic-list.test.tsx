import { render, screen, fireEvent } from '@testing-library/react';
import { ForumTopicList } from '../forum-topic-list';

const mockTopics = [
  {
    id: 1,
    title: 'Best deals on laptops',
    content: 'Looking for the best laptop deals',
    slug: 'best-deals-on-laptops',
    views: 125,
    likes: 15,
    isPinned: true,
    isLocked: false,
    postCount: 8,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    author: {
      id: 1,
      username: 'techguru',
      trustLevel: 3,
      badges: ['Top Contributor'],
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
    tags: ['laptop', 'deals', 'technology'],
    lastPost: {
      author: 'reviewer',
      createdAt: '2024-01-02T00:00:00Z',
    },
  },
  {
    id: 2,
    title: 'Price comparison tips',
    content: 'Share your price comparison strategies',
    slug: 'price-comparison-tips',
    views: 75,
    likes: 5,
    isPinned: false,
    isLocked: false,
    postCount: 3,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
    author: {
      id: 2,
      username: 'savingsexpert',
      trustLevel: 2,
      badges: [],
    },
    category: {
      id: 2,
      name: 'General',
      description: 'General discussions',
      color: '#10b981',
      topicCount: 30,
      postCount: 100,
      icon: 'MessageSquare',
    },
    tags: ['tips'],
  },
];

describe('ForumTopicList', () => {
  const mockOnTopicClick = jest.fn();

  beforeEach(() => {
    mockOnTopicClick.mockClear();
  });

  it('should render loading state', () => {
    render(
      <ForumTopicList topics={[]} isLoading={true} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('Latest Topics')).toBeInTheDocument();
    // Loading skeleton should be present
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state', () => {
    render(
      <ForumTopicList topics={[]} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('No topics found. Be the first to start a discussion!')).toBeInTheDocument();
  });

  it('should render topics list', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('Best deals on laptops')).toBeInTheDocument();
    expect(screen.getByText('Price comparison tips')).toBeInTheDocument();
  });

  it('should display topic metadata', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('125')).toBeInTheDocument(); // views
    expect(screen.getByText('15')).toBeInTheDocument(); // likes
    expect(screen.getByText('8')).toBeInTheDocument(); // postCount
  });

  it('should show pinned indicator for pinned topics', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    // Check for pinned icon (there should be at least one)
    const pinnedIcons = document.querySelectorAll('svg');
    expect(pinnedIcons.length).toBeGreaterThan(0);
  });

  it('should display category badges', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('should display tags', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('laptop')).toBeInTheDocument();
    expect(screen.getByText('deals')).toBeInTheDocument();
    expect(screen.getByText('technology')).toBeInTheDocument();
    expect(screen.getByText('tips')).toBeInTheDocument();
  });

  it('should call onTopicClick when topic is clicked', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    const topicElement = screen.getByText('Best deals on laptops').closest('div');
    if (topicElement) {
      fireEvent.click(topicElement);
      expect(mockOnTopicClick).toHaveBeenCalledWith(mockTopics[0]);
    }
  });

  it('should display author usernames', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText(/techguru/)).toBeInTheDocument();
    expect(screen.getByText(/savingsexpert/)).toBeInTheDocument();
  });

  it('should show last post information when available', () => {
    render(
      <ForumTopicList topics={mockTopics} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText(/last reply by reviewer/)).toBeInTheDocument();
  });

  it('should limit displayed tags to 3 with overflow indicator', () => {
    const topicWithManyTags = {
      ...mockTopics[0],
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
    };

    render(
      <ForumTopicList topics={[topicWithManyTags]} isLoading={false} onTopicClick={mockOnTopicClick} />
    );

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
