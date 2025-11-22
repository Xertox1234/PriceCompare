import { Link } from 'wouter';
import { ArrowRight, Bell, Zap, Gift, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BannerProps {
  className?: string;
}

// Full-width promotional banner
export function PromotionalBanner({
  title,
  subtitle,
  ctaText,
  ctaLink,
  backgroundImage,
  backgroundColor = 'primary',
  variant = 'default',
  className,
}: {
  title: string;
  subtitle?: string;
  ctaText: string;
  ctaLink: string;
  backgroundImage?: string;
  backgroundColor?: 'primary' | 'secondary' | 'dark' | 'gradient';
  variant?: 'default' | 'compact' | 'split';
} & BannerProps) {
  const bgClasses = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    dark: 'bg-slate-900 text-white',
    gradient: 'bg-gradient-to-r from-primary to-secondary text-white',
  };

  if (variant === 'compact') {
    return (
      <section className={cn("py-4", className)}>
        <div className="container mx-auto px-4">
          <div className={cn(
            "rounded-xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4",
            bgClasses[backgroundColor]
          )}>
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Zap className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">{title}</p>
                {subtitle && <p className="text-sm opacity-90">{subtitle}</p>}
              </div>
            </div>
            <Link href={ctaLink}>
              <Button variant="secondary" className="whitespace-nowrap">
                {ctaText}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("py-8", className)}>
      <div className="container mx-auto px-4">
        <div className={cn(
          "relative overflow-hidden rounded-2xl min-h-[200px] lg:min-h-[280px]",
          !backgroundImage && bgClasses[backgroundColor]
        )}>
          {/* Background Image */}
          {backgroundImage && (
            <>
              <img
                src={backgroundImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/80" />
            </>
          )}

          {/* Content */}
          <div className="relative h-full flex flex-col justify-center p-8 lg:p-12">
            <div className="max-w-xl">
              <h2 className={cn(
                "text-2xl lg:text-4xl font-bold mb-3",
                backgroundImage ? "text-white" : ""
              )}>
                {title}
              </h2>
              {subtitle && (
                <p className={cn(
                  "text-lg mb-6",
                  backgroundImage ? "text-slate-200" : "opacity-90"
                )}>
                  {subtitle}
                </p>
              )}
              <Link href={ctaLink}>
                <Button
                  size="lg"
                  variant={backgroundImage || backgroundColor === 'dark' ? 'secondary' : 'outline'}
                  className={cn(
                    !backgroundImage && backgroundColor !== 'dark' && "border-white text-white hover:bg-white hover:text-primary"
                  )}
                >
                  {ctaText}
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Side-by-side banner grid
export function BannerGrid({ className }: BannerProps) {
  return (
    <section className={cn("py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          {/* Price Alert Banner */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 lg:p-8 min-h-[200px]">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-blue-200 mb-2">
                <Bell className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Price Alerts</span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                Never Miss a Deal
              </h3>
              <p className="text-blue-100 mb-4">
                Set price alerts and get notified instantly when prices drop.
              </p>
              <Link href="/price-watch">
                <Button variant="secondary" size="sm">
                  Set Alert
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            {/* Decorative element */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl" />
          </div>

          {/* Comparison Banner */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 lg:p-8 min-h-[200px]">
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-100 mb-2">
                <Percent className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Compare & Save</span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                Find the Best Price
              </h3>
              <p className="text-amber-50 mb-4">
                Compare prices across 100+ retailers instantly.
              </p>
              <Link href="/comparison">
                <Button variant="secondary" size="sm">
                  Compare Now
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
            {/* Decorative element */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-amber-400 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Newsletter signup banner
export function NewsletterBanner({ className }: BannerProps) {
  return (
    <section className={cn("py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 lg:p-12">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />
          </div>

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 text-primary mb-2">
                <Gift className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Exclusive Deals</span>
              </div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                Get Price Drop Alerts
              </h3>
              <p className="text-slate-300 max-w-md">
                Subscribe to our newsletter and never miss a deal. Get personalized price alerts delivered to your inbox.
              </p>
            </div>

            <form className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email address"
                className="px-5 py-3.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-80"
              />
              <button
                type="submit"
                className="px-6 py-3.5 bg-[#ff6b6b] hover:bg-[#ff5252] text-white font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-2"
              >
                Subscribe
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

// App download banner
export function AppBanner({ className }: BannerProps) {
  return (
    <section className={cn("py-8", className)}>
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-2xl bg-primary p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1 text-center lg:text-left">
              <h3 className="text-2xl lg:text-3xl font-bold text-primary-foreground mb-2">
                Track Prices on the Go
              </h3>
              <p className="text-primary-foreground mb-6 max-w-md">
                Download our browser extension and mobile app to track prices anywhere, anytime.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Button variant="secondary" size="lg">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  App Store
                </Button>
                <Button variant="secondary" size="lg">
                  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 20.5v-17c0-.83.67-1.5 1.5-1.5h15c.83 0 1.5.67 1.5 1.5v17c0 .83-.67 1.5-1.5 1.5h-15c-.83 0-1.5-.67-1.5-1.5zm3.5-11.5l5.5 4-5.5 4v-8zm6.5 0v8l5.5-4-5.5-4z"/>
                  </svg>
                  Chrome Extension
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
