import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRateLimit } from '@/hooks/useRateLimit';
import { useAuth } from '@/hooks/use-auth';

/**
 * Format milliseconds until reset as human-readable time
 */
function formatTimeUntilReset(resetTimestamp: number): string {
  const now = Date.now();
  const diff = resetTimestamp - now;

  if (diff <= 0) {
    return 'now';
  }

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Rate limit warning banner component
 *
 * Displays a warning banner when users are running low on API requests.
 * Only shows when < 50% of requests remain.
 *
 * Features:
 * - Dynamic countdown to reset time
 * - Tier-specific CTAs (sign up for anonymous, upgrade for authenticated)
 * - Dismissible with smooth fade animations
 * - Responsive design for mobile and desktop
 * - Uses design tokens for consistent theming
 * - Accessible with proper ARIA labels
 *
 * @example
 * ```tsx
 * // In App.tsx or layout component
 * <RateLimitBanner />
 * ```
 */
export function RateLimitBanner() {
  const rateLimit = useRateLimit();
  const { data: _user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [countdown, setCountdown] = useState('');

  // Update countdown every second
  useEffect(() => {
    if (rateLimit.percentage >= 50 || isDismissed) {
      return;
    }

    const updateCountdown = () => {
      setCountdown(formatTimeUntilReset(rateLimit.reset));
    };

    // Update immediately
    updateCountdown();

    // Then update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [rateLimit.reset, rateLimit.percentage, isDismissed]);

  // Don't show banner if:
  // - User has >= 50% requests remaining
  // - Banner was dismissed
  // - Tier is unknown (no rate limit data yet)
  if (rateLimit.percentage >= 50 || isDismissed || rateLimit.tier === 'unknown') {
    return null;
  }

  // Determine severity based on percentage
  const severity: 'warning' | 'critical' = rateLimit.percentage < 20 ? 'critical' : 'warning';

  // Determine CTA based on user tier
  const getCTA = () => {
    const tier = rateLimit.tier.toLowerCase();

    if (tier === 'anonymous' || tier === 'free') {
      return {
        text: 'Sign up for more requests',
        href: '/register',
        description: 'Create a free account to get more API requests',
      };
    }

    if (tier === 'user') {
      return {
        text: 'Upgrade to Premium',
        href: '/pricing',
        description: 'Get 5x more requests with a Premium account',
      };
    }

    // Premium, moderator, admin - no CTA, just show status
    return null;
  };

  const cta = getCTA();

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`animate-in slide-in-from-top fixed top-16 right-0 left-0 z-40 duration-300 ${isDismissed ? 'animate-out slide-out-to-top duration-200' : ''} `}
    >
      <div className="container mx-auto px-4 py-2">
        <div
          className={`relative flex items-center justify-between gap-4 rounded-lg border-l-4 p-4 ${
            severity === 'critical'
              ? 'bg-destructive/10 border-destructive text-destructive-foreground'
              : 'bg-secondary/20 border-secondary text-secondary-foreground'
          } `}
        >
          {/* Icon */}
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {/* Message */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="text-sm font-medium">
                  {severity === 'critical' ? (
                    <>
                      Only {rateLimit.remaining} of {rateLimit.limit} requests remaining
                    </>
                  ) : (
                    <>
                      {rateLimit.remaining} of {rateLimit.limit} requests left
                    </>
                  )}
                </p>
                <span className="text-xs opacity-75">Resets in {countdown}</span>
              </div>

              {/* CTA Button (if applicable) */}
              {cta && (
                <Button
                  asChild
                  size="sm"
                  variant={severity === 'critical' ? 'destructive' : 'secondary'}
                  className="flex-shrink-0"
                >
                  <Link href={cta.href}>{cta.text}</Link>
                </Button>
              )}
            </div>

            {/* Description (mobile: below, desktop: inline) */}
            {cta && <p className="mt-1 text-xs opacity-75 sm:mt-0">{cta.description}</p>}
          </div>

          {/* Dismiss Button */}
          <button
            onClick={() => setIsDismissed(true)}
            className="hover:bg-background/50 flex-shrink-0 rounded-md p-1 transition-colors"
            aria-label="Dismiss rate limit warning"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
