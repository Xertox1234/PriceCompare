import { useState } from 'react';
import { Link } from 'wouter';
import { TrendingUp, Mail, Phone, MapPin, Facebook, Twitter, Instagram, Youtube, Linkedin, Send, CreditCard, Shield, Truck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-white">
              <div className="p-3 bg-white/10 rounded-xl">
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
                  className="w-full lg:w-80 px-4 py-3 pr-12 rounded-l-xl bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/30"
                  required
                />
              </div>
              <Button
                type="submit"
                className="px-6 py-3 h-auto bg-white text-primary font-semibold rounded-r-xl hover:bg-white/90 transition-colors"
              >
                {subscribed ? 'Subscribed!' : 'Subscribe'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">
                Price<span className="text-primary">Compare</span>
              </span>
            </Link>
            <p className="text-slate-400 mb-6 max-w-sm">
              Your trusted price comparison platform. Track prices, set alerts, and never overpay again.
            </p>
            {/* Payment Methods */}
            <div className="mb-6">
              <p className="text-sm text-slate-500 mb-3">We accept:</p>
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
            <h4 className="text-white font-semibold mb-4">Get Help</h4>
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
            <h4 className="text-white font-semibold mb-4">Popular Categories</h4>
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
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-400">
                  123 Price Street, Compare City, PC 12345
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                <a href="tel:+18001234567" className="text-sm text-primary font-medium hover:underline">
                  +1 (800) 123-4567
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary flex-shrink-0" />
                <a href="mailto:support@pricecompare.com" className="text-sm text-primary font-medium hover:underline">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <SocialLink href="https://facebook.com" icon={Facebook} label="Facebook" />
              <SocialLink href="https://twitter.com" icon={Twitter} label="Twitter" />
              <SocialLink href="https://instagram.com" icon={Instagram} label="Instagram" />
              <SocialLink href="https://linkedin.com" icon={Linkedin} label="LinkedIn" />
              <SocialLink href="https://youtube.com" icon={Youtube} label="YouTube" />
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-6 text-sm">
              <Link href="/shop?sort=newest" className="text-slate-400 hover:text-white font-medium transition-colors">
                New arrivals
              </Link>
              <Link href="/shop?sort=bestselling" className="text-slate-400 hover:text-white font-medium transition-colors">
                Best sale
              </Link>
              <Link href="/shop?deals=true" className="text-slate-400 hover:text-white font-medium transition-colors">
                Value of the day
              </Link>
              <Link href="/shop" className="text-slate-400 hover:text-white font-medium transition-colors">
                Top 100 offers
              </Link>
              <Link href="/shop?deals=true" className="text-primary font-bold hover:text-primary/80 transition-colors flex items-center gap-1">
                🔥 50% OFF
              </Link>
            </div>

            {/* Copyright */}
            <p className="text-slate-500 text-sm text-center">
              <span className="font-semibold text-white">PriceCompare.</span> © {currentYear}. All rights reserved
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
      <Link href={href} className="text-sm text-slate-400 hover:text-white transition-colors">
        {children}
      </Link>
    </li>
  );
}

function SocialLink({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 bg-slate-800 hover:bg-primary rounded-lg flex items-center justify-center transition-colors"
      aria-label={label}
    >
      <Icon className="h-4 w-4 text-slate-400 hover:text-white" />
    </a>
  );
}

function PaymentBadge({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="h-8 w-12 bg-slate-800 rounded flex items-center justify-center" title={label}>
      <Icon className="h-5 w-5 text-slate-500" />
    </div>
  );
}

function FeatureItem({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 bg-slate-800 rounded-lg">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h5 className="text-white text-sm font-medium">{title}</h5>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}

// Compact footer variant
export function CompactFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted border-t border-border py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">PriceCompare</span>
          </div>
          <p className="text-muted-foreground">
            © {currentYear} PriceCompare. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
