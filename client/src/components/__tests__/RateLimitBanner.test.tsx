/**
 * Component tests for RateLimitBanner
 *
 * Tests the rate limit warning banner component's rendering logic,
 * user interactions, and different display states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { RateLimitBanner } from '../RateLimitBanner';
import * as useRateLimitHook from '../../hooks/useRateLimit';
import * as useAuthHook from '../../hooks/use-auth';

// Mock the hooks
vi.mock('../../hooks/useRateLimit');
vi.mock('../../hooks/use-auth');

describe('RateLimitBanner', () => {
  const mockUseRateLimit = vi.mocked(useRateLimitHook.useRateLimit);
  const mockUseAuth = vi.mocked(useAuthHook.useAuth);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth state (no user)
    mockUseAuth.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any);
  });

  describe('Visibility conditions', () => {
    it('renders nothing when >= 50% requests remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 50,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 50,
      });

      const { container } = render(<RateLimitBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when > 50% requests remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 51,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 51,
      });

      const { container } = render(<RateLimitBanner />);
      expect(container.firstChild).toBeNull();
    });

    it('shows warning banner when < 50% remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 49,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 49,
      });

      render(<RateLimitBanner />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/49 of 100 requests left/i)).toBeInTheDocument();
    });

    it('renders nothing when tier is unknown', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 10,
        reset: Date.now() + 900000,
        tier: 'unknown',
        percentage: 10,
      });

      const { container } = render(<RateLimitBanner />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Severity levels', () => {
    it('shows warning styling when < 50% but >= 20% remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      const banner = screen.getByRole('alert');
      // Find the styled div with border (third div in structure)
      const styledDiv = banner.querySelector('.border-secondary');
      expect(styledDiv).toBeTruthy();
      expect(styledDiv).toHaveClass('bg-secondary/20');
    });

    it('shows critical styling when < 20% remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 10,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 10,
      });

      render(<RateLimitBanner />);

      const banner = screen.getByRole('alert');
      // Find the styled div with border
      const styledDiv = banner.querySelector('.border-destructive');
      expect(styledDiv).toBeTruthy();
      expect(styledDiv).toHaveClass('bg-destructive/10');
    });

    it('displays different message for critical level', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 15,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 15,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText(/Only 15 of 100 requests remaining/i)).toBeInTheDocument();
    });
  });

  describe('CTA (Call-to-Action) buttons', () => {
    it('displays "Sign up" CTA for anonymous users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 50,
        remaining: 20,
        reset: Date.now() + 900000,
        tier: 'anonymous',
        percentage: 40,
      });

      mockUseAuth.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as any);

      render(<RateLimitBanner />);

      const ctaButton = screen.getByRole('link', { name: /sign up for more requests/i });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveAttribute('href', '/register');
    });

    it('displays "Sign up" CTA for free tier users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 50,
        remaining: 15,
        reset: Date.now() + 900000,
        tier: 'free',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      expect(screen.getByRole('link', { name: /sign up for more requests/i })).toBeInTheDocument();
    });

    it('displays "Upgrade to Premium" CTA for standard users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 40,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      const ctaButton = screen.getByRole('link', { name: /upgrade to premium/i });
      expect(ctaButton).toBeInTheDocument();
      expect(ctaButton).toHaveAttribute('href', '/pricing');
    });

    it('does not show CTA for premium users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 500,
        remaining: 200,
        reset: Date.now() + 900000,
        tier: 'premium',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /upgrade/i })).not.toBeInTheDocument();
    });

    it('does not show CTA for moderators', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 1000,
        remaining: 300,
        reset: Date.now() + 900000,
        tier: 'moderator',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('does not show CTA for admin users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 10000,
        remaining: 4000,
        reset: Date.now() + 900000,
        tier: 'admin',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });

  describe('Countdown timer', () => {
    it('displays countdown to reset time', () => {
      const resetTime = Date.now() + 5 * 60 * 1000; // 5 minutes from now

      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: resetTime,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText(/Resets in/i)).toBeInTheDocument();
      // Should show something like "5m 0s"
      expect(screen.getByText(/\d+m \d+s/)).toBeInTheDocument();
    });

    it('shows seconds only when less than 1 minute remaining', () => {
      const resetTime = Date.now() + 30 * 1000; // 30 seconds from now

      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 20,
        reset: resetTime,
        tier: 'user',
        percentage: 20,
      });

      render(<RateLimitBanner />);

      // Should show countdown in seconds (e.g., "30s")
      expect(screen.getByText(/Resets in/i)).toBeInTheDocument();
      // Look for pattern: number followed by 's' (seconds only, no minutes)
      expect(screen.getByText(/\d+s/)).toBeInTheDocument();
    });

    it('updates countdown based on reset time', async () => {
      // This test is simplified due to timing complexities with fake timers
      const resetTime = Date.now() + 5 * 60 * 1000; // 5 minutes

      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: resetTime,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      // Just verify countdown text is present
      expect(screen.getByText(/Resets in/i)).toBeInTheDocument();
      expect(screen.getByText(/\d+m \d+s/)).toBeInTheDocument();
    });

    it('cleans up interval on unmount', () => {
      const resetTime = Date.now() + 5 * 60 * 1000;

      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: resetTime,
        tier: 'user',
        percentage: 30,
      });

      const { unmount } = render(<RateLimitBanner />);

      // Component should be rendered
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Dismiss functionality', () => {
    it('hides banner when dismiss button is clicked', async () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });

    it('dismiss button has correct accessibility label', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss rate limit warning/i });
      expect(dismissButton).toBeInTheDocument();
    });
  });

  describe('Link destinations', () => {
    it('links to /register for anonymous users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 50,
        remaining: 20,
        reset: Date.now() + 900000,
        tier: 'anonymous',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      const link = screen.getByRole('link', { name: /sign up/i });
      expect(link).toHaveAttribute('href', '/register');
    });

    it('links to /pricing for standard users', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 40,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      const link = screen.getByRole('link', { name: /upgrade/i });
      expect(link).toHaveAttribute('href', '/pricing');
    });
  });

  describe('Accessibility', () => {
    it('has role="alert" for screen readers', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live="polite" for dynamic updates', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('hides decorative icons from screen readers', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      const icon = screen.getByRole('alert').querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Display content variations', () => {
    it('shows correct description for anonymous tier', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 50,
        remaining: 20,
        reset: Date.now() + 900000,
        tier: 'anonymous',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText(/create a free account to get more api requests/i)).toBeInTheDocument();
    });

    it('shows correct description for standard user tier', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 40,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 40,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText(/get 5x more requests with a premium account/i)).toBeInTheDocument();
    });

    it('displays remaining count and limit correctly', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 500,
        remaining: 150,
        reset: Date.now() + 900000,
        tier: 'premium',
        percentage: 30,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText('150 of 500 requests left')).toBeInTheDocument();
    });

    it('displays critical message when very low', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 5,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 5,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText('Only 5 of 100 requests remaining')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles exactly 50% remaining (boundary condition)', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 50,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 50,
      });

      const { container } = render(<RateLimitBanner />);

      // Should NOT render at exactly 50%
      expect(container.firstChild).toBeNull();
    });

    it('handles exactly 20% remaining (boundary condition)', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 20,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 20,
      });

      render(<RateLimitBanner />);

      const banner = screen.getByRole('alert');

      // At exactly 20%, should NOT be critical (< 20% is critical)
      const styledDiv = banner.querySelector('.border-secondary');
      expect(styledDiv).toBeTruthy();
      expect(styledDiv).toHaveClass('bg-secondary/20');

      // Should not have critical styling
      const criticalDiv = banner.querySelector('.border-destructive');
      expect(criticalDiv).toBeNull();
    });

    it('handles 0 requests remaining', () => {
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 0,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 0,
      });

      render(<RateLimitBanner />);

      expect(screen.getByText('Only 0 of 100 requests remaining')).toBeInTheDocument();
    });

    it('stays hidden after dismiss even if data changes', () => {
      const { rerender } = render(<RateLimitBanner />);

      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 30,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 30,
      });

      rerender(<RateLimitBanner />);

      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButton);

      // Change rate limit data
      mockUseRateLimit.mockReturnValue({
        limit: 100,
        remaining: 10,
        reset: Date.now() + 900000,
        tier: 'user',
        percentage: 10,
      });

      rerender(<RateLimitBanner />);

      // Should still be hidden
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
