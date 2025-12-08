import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function NewFooter() {
  const [footerEmail, setFooterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFooterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!footerEmail) return;

    setIsSubmitting(true);

    // Note: Newsletter subscription API endpoint is pending implementation.
    // For now, we show a success message as a placeholder.
    // When the API is ready, replace this with:
    // const response = await fetch('/api/newsletter/subscribe', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email: footerEmail }),
    // });

    // Simulate brief delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    toast({
      title: 'Thanks for subscribing!',
      description: 'You will receive our latest updates and deals.',
    });

    setFooterEmail('');
    setIsSubmitting(false);
  };

  return (
    <footer className="bg-card text-card-foreground border-border mt-12 border-t">
      <div className="container mx-auto px-6 py-10">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-4 text-lg font-bold">Be in touch</h4>
            <form className="flex" onSubmit={(e) => void handleFooterSubmit(e)}>
              <input
                type="email"
                placeholder="Your Email"
                value={footerEmail}
                onChange={(e) => setFooterEmail(e.target.value)}
                className="bg-muted text-foreground w-full rounded-l-md px-3 py-2 focus:outline-none disabled:opacity-50"
                required
                disabled={isSubmitting}
              />
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-r-md px-4 py-2 font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing up...' : 'Sign Up'}
              </Button>
            </form>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-bold">PriceGrabber</h4>
            <ul>
              <li className="mb-2">
                <Link href="/about">
                  <span className="hover:text-primary cursor-pointer">About</span>
                </Link>
              </li>
              <li className="mb-2">
                <Link href="/forum">
                  <span className="hover:text-primary cursor-pointer">Community</span>
                </Link>
              </li>
              <li className="mb-2">
                <Link href="/press">
                  <span className="hover:text-primary cursor-pointer">Press</span>
                </Link>
              </li>
              <li>
                <Link href="/sitemap">
                  <span className="hover:text-primary cursor-pointer">Sitemap</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-bold">Support</h4>
            <ul>
              <li className="mb-2">
                <Link href="/merchant-login">
                  <span className="hover:text-primary cursor-pointer">Merchant Login</span>
                </Link>
              </li>
              <li>
                <Link href="/help">
                  <span className="hover:text-primary cursor-pointer">Help</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-bold">Legal</h4>
            <ul>
              <li className="mb-2">
                <Link href="/ad-choices">
                  <span className="hover:text-primary cursor-pointer">Ad Choices</span>
                </Link>
              </li>
              <li className="mb-2">
                <Link href="/user-agreement">
                  <span className="hover:text-primary cursor-pointer">User Agreement</span>
                </Link>
              </li>
              <li className="mb-2">
                <Link href="/privacy">
                  <span className="hover:text-primary cursor-pointer">Privacy Statement</span>
                </Link>
              </li>
              <li>
                <Link href="/california-privacy">
                  <span className="hover:text-primary cursor-pointer">
                    California Privacy Notice
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-muted-foreground border-border mt-10 border-t pt-6 text-center">
          <p>&copy; 2023 PriceGrabber. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
}
