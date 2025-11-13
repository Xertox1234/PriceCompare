import { render, screen } from '@testing-library/react';
import { ForumStats } from '../forum-stats';

describe('ForumStats', () => {
  it('should render topics count', () => {
    render(<ForumStats topicsCount={42} categoriesCount={5} />);

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render categories count', () => {
    render(<ForumStats topicsCount={42} categoriesCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render all stat labels', () => {
    render(<ForumStats topicsCount={42} categoriesCount={5} />);

    expect(screen.getByText('Topics')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Hot Topics')).toBeInTheDocument();
  });

  it('should render static values for active users and hot topics', () => {
    render(<ForumStats topicsCount={42} categoriesCount={5} />);

    expect(screen.getByText('24')).toBeInTheDocument(); // Active Users
    expect(screen.getByText('12')).toBeInTheDocument(); // Hot Topics
  });

  it('should handle zero counts', () => {
    render(<ForumStats topicsCount={0} categoriesCount={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should handle large numbers', () => {
    render(<ForumStats topicsCount={9999} categoriesCount={999} />);

    expect(screen.getByText('9999')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
  });

  it('should render all four stat cards', () => {
    const { container } = render(<ForumStats topicsCount={42} categoriesCount={5} />);

    const cards = container.querySelectorAll('[class*="CardContent"]');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });
});
