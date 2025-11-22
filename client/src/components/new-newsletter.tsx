import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';

type SubmissionState = 'idle' | 'loading' | 'success';

export function NewNewsletter() {
  const [email, setEmail] = useState('');
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
  }, [email]);

  return (
    <section className="bg-card rounded-2xl shadow-lg p-10 flex items-center justify-between">
      <div className="w-1/3">
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNy9T1FiVA3gmb7KR1D0eJ7Kqx2m5da7q40f4swY3FZejQNeuR--_gec0DVY_VI7blHcQOC8fEkSazQiPOB4IjpJoNkWuqhK2_0kAMipdnDNzX8z6vmyLty93jP9bFP2rbMQE59B_DB8Udh6ht0Umc6jAWHJa6LFyhpM5pnpJmgoBvnFOlKwiWjd440lcabBFiqpCQt_HIMgc-N90QOQphQvbdhwZefIJX7CygbznizhaG5GIMAiXKGOewcbZaJcvawErIJaeB23c"
          alt="Newsletter promotion image"
          className="rounded-lg"
        />
      </div>
      
      <div className="w-2/3 ml-10">
        <h3 className="text-3xl font-bold text-muted-foreground mb-2">
          Weekly Newsletter - Great Deals Delivered!
        </h3>
        <p className="text-muted-foreground mb-6">
          See HUGE discounts and GREAT deals on the HOTTEST new items of the season! 
          Become a PriceGrabber Insider and get deals delivered right to your inbox.
        </p>
        
        {submissionState === 'success' ? (
          <div className="flex items-center gap-2 py-3 px-5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full border-2 border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Thanks for subscribing! Check your inbox to confirm.</span>
          </div>
        ) : (
          <form className="flex" onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submissionState === 'loading'}
              className="w-full py-3 px-5 rounded-l-full border-2 border-border focus:outline-none focus:ring-2 focus:ring-indigo-400 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              required
            />
            <Button
              type="submit"
              disabled={submissionState === 'loading'}
              className="bg-primary text-white font-semibold py-3 px-8 rounded-r-full hover:bg-primary/90 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submissionState === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
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