import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

type SubmissionState = 'idle' | 'loading' | 'success';

export function NewNewsletter() {
  const [email, setEmail] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!email.trim()) {
        return;
      }

      setSubmissionState('loading');

      // NOTE: Newsletter signup API endpoint pending implementation
      // Currently simulates a successful subscription for UI demonstration
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSubmissionState('success');
      setEmail('');

      // Reset to idle after showing success message
      setTimeout(() => {
        setSubmissionState('idle');
      }, 3000);
    },
    [email]
  );

  return (
    <section className="bg-card flex items-center justify-between rounded-2xl p-10 shadow-lg">
      <div className="w-1/3">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNy9T1FiVA3gmb7KR1D0eJ7Kqx2m5da7q40f4swY3FZejQNeuR--_gec0DVY_VI7blHcQOC8fEkSazQiPOB4IjpJoNkWuqhK2_0kAMipdnDNzX8z6vmyLty93jP9bFP2rbMQE59B_DB8Udh6ht0Umc6jAWHJa6LFyhpM5pnpJmgoBvnFOlKwiWjd440lcabBFiqpCQt_HIMgc-N90QOQphQvbdhwZefIJX7CygbznizhaG5GIMAiXKGOewcbZaJcvawErIJaeB23c"
          alt="Newsletter promotion image"
          className="rounded-lg"
        />
      </div>

      <div className="ml-10 w-2/3">
        <h3 className="text-muted-foreground mb-2 text-3xl font-bold">
          Weekly Newsletter - Great Deals Delivered!
        </h3>
        <p className="text-muted-foreground mb-6">
          See HUGE discounts and GREAT deals on the HOTTEST new items of the season! Become a
          PriceGrabber Insider and get deals delivered right to your inbox.
        </p>

        {submissionState === 'success' ? (
          <div className="flex items-center gap-2 rounded-full border-2 border-emerald-200 bg-emerald-50 px-5 py-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Thanks for subscribing! Check your inbox to confirm.
            </span>
          </div>
        ) : (
          <form className="flex" onSubmit={(e) => void handleSubmit(e)}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submissionState === 'loading'}
              className="border-border w-full rounded-l-full border-2 px-5 py-3 transition duration-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
            <Button
              type="submit"
              disabled={submissionState === 'loading'}
              className="bg-primary hover:bg-primary/90 rounded-r-full px-8 py-3 font-semibold text-white transition duration-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submissionState === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing Up...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
