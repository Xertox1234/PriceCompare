import { memo, useState, useCallback } from 'react';
import { Bell, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ============================================================================
// Type Definitions
// ============================================================================

interface NewsletterBannerProps {
  className?: string;
}

type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Main Component
// ============================================================================

/**
 * NewsletterBanner - A CTA section encouraging users to sign up for deal alerts
 *
 * Features:
 * - Full-width banner with gradient background (primary colors)
 * - Headline and subtext promoting deal alerts
 * - Email input field + "Subscribe" button
 * - Form states: idle, loading, success, error
 * - Icons for visual appeal
 * - Centered layout with max-width container
 */
export const NewsletterBanner = memo(({
  className,
}: NewsletterBannerProps) => {
  const [email, setEmail] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Email validation
  const isValidEmail = useCallback((emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  }, []);

  // Handle email input change
  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEmail(e.target.value);
      // Clear error state when user starts typing
      if (submissionState === 'error') {
        setSubmissionState('idle');
        setErrorMessage('');
      }
    },
    [submissionState]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Validate email
      if (!email.trim()) {
        setSubmissionState('error');
        setErrorMessage('Please enter your email address');
        return;
      }

      if (!isValidEmail(email)) {
        setSubmissionState('error');
        setErrorMessage('Please enter a valid email address');
        return;
      }

      // Set loading state
      setSubmissionState('loading');

      // Simulate API call (UI only - no actual submission)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate success
      setSubmissionState('success');
      setEmail('');
    },
    [email, isValidEmail]
  );

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl',
        className
      )}
    >
      {/* Gradient Background */}
      <div
        className={cn(
          'absolute inset-0',
          'bg-gradient-to-r from-primary via-primary/90 to-indigo-600'
        )}
        aria-hidden="true"
      />

      {/* Decorative Pattern Overlay */}
      <div
        className={cn(
          'absolute inset-0 opacity-10',
          'bg-[radial-gradient(circle_at_30%_50%,white_0%,transparent_50%)]'
        )}
        aria-hidden="true"
      />

      {/* Decorative Icons Background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <Bell className="absolute -top-4 -right-4 h-32 w-32 text-white/5 transform rotate-12" />
        <Mail className="absolute -bottom-6 -left-6 h-40 w-40 text-white/5 transform -rotate-12" />
      </div>

      {/* Content Container */}
      <div className="relative px-6 py-12 md:px-12 md:py-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Icon Badge */}
          <div className="flex justify-center mb-6">
            <div
              className={cn(
                'inline-flex items-center justify-center',
                'h-16 w-16 rounded-full',
                'bg-white/20 backdrop-blur-sm'
              )}
            >
              <Bell className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3">
            Never Miss a Deal
          </h2>

          {/* Subtext */}
          <p className="text-base md:text-lg text-white/90 mb-8 max-w-xl mx-auto">
            Join <span className="font-semibold">50,000+</span> smart shoppers
            who save money every day with personalized price drop alerts.
          </p>

          {/* Form */}
          {submissionState === 'success' ? (
            // Success State
            <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-full',
                  'bg-white/20 backdrop-blur-sm'
                )}
              >
                <CheckCircle className="h-5 w-5 text-emerald-300" />
                <span className="text-white font-medium">
                  You're all set! Check your inbox to confirm.
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSubmissionState('idle')}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Subscribe another email
              </Button>
            </div>
          ) : (
            // Form State
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            >
              <div className="flex-1 relative">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={submissionState === 'loading'}
                  className={cn(
                    'h-12 rounded-full bg-white/95 text-foreground',
                    'border-0 px-5',
                    'placeholder:text-muted-foreground',
                    'focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-0',
                    submissionState === 'error' &&
                      'ring-2 ring-red-300 bg-red-50/95'
                  )}
                  aria-label="Email address"
                  aria-describedby={
                    submissionState === 'error' ? 'email-error' : undefined
                  }
                />
                {submissionState === 'error' && (
                  <p
                    id="email-error"
                    className="absolute -bottom-6 left-0 text-xs text-red-200 font-medium"
                  >
                    {errorMessage}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={submissionState === 'loading'}
                className={cn(
                  'h-12 px-8 rounded-full font-semibold',
                  'bg-secondary text-secondary-foreground',
                  'hover:bg-secondary/90',
                  'shadow-lg shadow-black/10',
                  'transition-all duration-200'
                )}
              >
                {submissionState === 'loading' ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Subscribing...</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    <span>Subscribe</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Trust Indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Free forever
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              No spam, ever
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              Unsubscribe anytime
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

NewsletterBanner.displayName = 'NewsletterBanner';

export default NewsletterBanner;
