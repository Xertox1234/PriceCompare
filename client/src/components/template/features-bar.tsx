import { TrendingDown, Bell, Shield, Headphones, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: TrendingDown,
    title: 'Price Tracking',
    description: 'Monitor prices across 100+ retailers',
  },
  {
    icon: Bell,
    title: 'Price Alerts',
    description: 'Get notified when prices drop',
  },
  {
    icon: Shield,
    title: 'Verified Prices',
    description: 'Real prices from real retailers',
  },
  {
    icon: RefreshCw,
    title: 'Live Updates',
    description: 'Prices updated every hour',
  },
  {
    icon: Headphones,
    title: '24/7 Support',
    description: 'Help when you need it',
  },
];

interface FeaturesBarProps {
  className?: string;
  variant?: 'default' | 'compact' | 'card';
}

export function FeaturesBar({ className, variant = 'default' }: FeaturesBarProps) {
  if (variant === 'card') {
    return (
      <section className={cn('py-8', className)}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'compact') {
    return (
      <section className={cn('bg-muted border-border border-y py-4', className)}>
        <div className="container mx-auto px-4">
          <div className="scrollbar-hide flex items-center justify-between gap-8 overflow-x-auto">
            {features.map((feature, index) => (
              <FeatureCompact key={index} {...feature} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default variant
  return (
    <section className={cn('bg-muted py-6 lg:py-8', className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {features.map((feature, index) => (
            <FeatureItem key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ icon: Icon, title, description }: Feature) {
  return (
    <div className="group flex items-center gap-4">
      <div className="bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold lg:text-base">{title}</p>
        <p className="text-muted-foreground truncate text-xs lg:text-sm">{description}</p>
      </div>
    </div>
  );
}

function FeatureCompact({ icon: Icon, title, description: _description }: Feature) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <div className="bg-muted text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-foreground text-sm font-medium">{title}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <div className="bg-card border-border hover:border-primary group rounded-xl border p-4 transition-all hover:shadow-lg lg:p-6">
      <div className="bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-foreground mb-1 font-semibold">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}

// Stats bar variant for showing site statistics
interface Stat {
  value: string;
  label: string;
}

const stats: Stat[] = [
  { value: '10M+', label: 'Products Tracked' },
  { value: '500K+', label: 'Active Users' },
  { value: '100+', label: 'Retailers' },
  { value: '$2.5M', label: 'Savings Found' },
];

export function StatsBar({ className }: { className?: string }) {
  return (
    <section className={cn('bg-primary text-primary-foreground py-8', className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index}>
              <p className="mb-1 text-3xl font-bold lg:text-4xl">{stat.value}</p>
              <p className="text-primary-foreground text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
