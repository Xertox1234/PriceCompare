import { useState } from 'react';
import { Link } from 'wouter';
import {
  TrendingUp,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  CreditCard,
  Shield,
  Truck,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TemplateFooter() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="bg-foreground text-muted dark:bg-slate-950">
      {/* Newsletter Section */}
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <div className="flex items-center gap-4 text-white">
              <div className="rounded-xl bg-white/10 p-3">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">10% Off Your First Order</h3>
                <p className="text-sm text-white/80">
                  Be the first to know about offers, new products and discounted products
                </p>
              </div>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full lg:w-auto">
              <div className="relative flex-1 lg:flex-auto">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full rounded-l-xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder:text-white/60 focus:ring-2 focus:ring-white/30 focus:outline-none lg:w-80"
                  required
                />
              </div>
              <Button
                type="submit"
                className="text-primary h-auto rounded-r-xl bg-white px-6 py-3 font-semibold transition-colors hover:bg-white/90"
              >
                {subscribed ? 'Subscribed!' : 'Subscribe'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2">
              <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                Price<span className="text-primary">Compare</span>
              </span>
            </Link>
            <p className="mb-6 max-w-sm text-slate-400">
              Your trusted price comparison platform. Track prices, set alerts, and never overpay
              again.
            </p>
            {/* Payment Methods */}
            <div className="mb-6">
              <p className="mb-3 text-sm text-slate-500">We accept:</p>
              <div className="flex items-center gap-3">
                <PaymentBadge icon={CreditCard} label="Visa" />
                <PaymentBadge icon={CreditCard} label="Mastercard" />
                <PaymentBadge icon={CreditCard} label="PayPal" />
                <PaymentBadge icon={CreditCard} label="Discover" />
              </div>
            </div>
          </div>

          {/* Get Help */}
          <div>
            <h4 className="mb-4 font-semibold text-white">Get Help</h4>
            <ul className="space-y-3">
              <FooterLink href="/shipping">Delivery Information</FooterLink>
              <FooterLink href="/terms">Sale Terms & Conditions</FooterLink>
              <FooterLink href="/returns">Returns & Refunds</FooterLink>
              <FooterLink href="/privacy">Privacy Notice</FooterLink>
              <FooterLink href="/faq">Shopping FAQs</FooterLink>
            </ul>
          </div>

          {/* Popular Categories */}
          <div>
            <h4 className="mb-4 font-semibold text-white">Popular Categories</h4>
            <ul className="space-y-3">
              <FooterLink href="/shop?category=laptops">Laptops & Computers</FooterLink>
              <FooterLink href="/shop?category=cameras">Cameras & Photography</FooterLink>
              <FooterLink href="/shop?category=smartphones">Smart Phones & Tablets</FooterLink>
              <FooterLink href="/shop?category=gaming">Video Games & Consoles</FooterLink>
              <FooterLink href="/shop?category=audio">TV & Audio</FooterLink>
              <FooterLink href="/shop?category=smartwatches">Gadgets</FooterLink>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="mb-4 font-semibold text-white">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                <span className="text-sm text-slate-400">
                  123 Price Street, Compare City, PC 12345
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="text-primary h-5 w-5 flex-shrink-0" />
                <a
                  href="tel:+18001234567"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  +1 (800) 123-4567
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="text-primary h-5 w-5 flex-shrink-0" />
                <a
                  href="mailto:support@pricecompare.com"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  support@pricecompare.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Features Bar */}
      <div className="border-t border-slate-800">
        <div className="container mx-auto px-4 py-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <FeatureItem icon={Truck} title="Free Shipping" description="On orders over $99" />
            <FeatureItem icon={Shield} title="Secure Payment" description="100% secure checkout" />
            <FeatureItem icon={Clock} title="Easy Returns" description="30 day return policy" />
            <FeatureItem icon={Mail} title="24/7 Support" description="Dedicated support team" />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-slate-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <SocialLink href="https://facebook.com" icon={Facebook} label="Facebook" />
              <SocialLink href="https://twitter.com" icon={Twitter} label="Twitter" />
              <SocialLink href="https://instagram.com" icon={Instagram} label="Instagram" />
              <SocialLink href="https://linkedin.com" icon={Linkedin} label="LinkedIn" />
              <SocialLink href="https://youtube.com" icon={Youtube} label="YouTube" />
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm lg:gap-6">
              <Link
                href="/shop?sort=newest"
                className="font-medium text-slate-400 transition-colors hover:text-white"
              >
                New arrivals
              </Link>
              <Link
                href="/shop?sort=bestselling"
                className="font-medium text-slate-400 transition-colors hover:text-white"
              >
                Best sale
              </Link>
              <Link
                href="/shop?deals=true"
                className="font-medium text-slate-400 transition-colors hover:text-white"
              >
                Value of the day
              </Link>
              <Link
                href="/shop"
                className="font-medium text-slate-400 transition-colors hover:text-white"
              >
                Top 100 offers
              </Link>
              <Link
                href="/shop?deals=true"
                className="text-primary hover:text-primary/80 flex items-center gap-1 font-bold transition-colors"
              >
                🔥 50% OFF
              </Link>
            </div>

            {/* Copyright */}
            <p className="text-center text-sm text-slate-500">
              <span className="font-semibold text-white">PriceCompare.</span> © {currentYear}. All
              rights reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-slate-400 transition-colors hover:text-white">
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:bg-primary flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 transition-colors"
      aria-label={label}
    >
      <Icon className="h-4 w-4 text-slate-400 hover:text-white" />
    </a>
  );
}

function PaymentBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex h-8 w-12 items-center justify-center rounded bg-slate-800" title={label}>
      <Icon className="h-5 w-5 text-slate-500" />
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-slate-800 p-2">
        <Icon className="text-primary h-5 w-5" />
      </div>
      <div>
        <h5 className="text-sm font-medium text-white">{title}</h5>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

// Compact footer variant
export function CompactFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted border-border border-t py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-6 w-6 items-center justify-center rounded">
              <TrendingUp className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="text-foreground font-semibold">PriceCompare</span>
          </div>
          <p className="text-muted-foreground">
            © {currentYear} PriceCompare. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
