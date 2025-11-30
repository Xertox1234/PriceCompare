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
      <section className={cn("py-8", className)}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
      <section className={cn("py-4 bg-muted border-y border-border", className)}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between overflow-x-auto gap-8 scrollbar-hide">
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
    <section className={cn("py-6 lg:py-8 bg-muted", className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
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
    <div className="flex items-center gap-4 group">
      <div className="flex-shrink-0 w-12 h-12 bg-muted text-primary rounded-xl flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-foreground text-sm lg:text-base truncate">
          {title}
        </p>
        <p className="text-muted-foreground text-xs lg:text-sm truncate">
          {description}
        </p>
      </div>
    </div>
  );
}

function FeatureCompact({ icon: Icon, title, description: _description }: Feature) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <div className="flex-shrink-0 w-8 h-8 bg-muted text-primary rounded-lg flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="font-medium text-foreground text-sm">{title}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: Feature) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 lg:p-6 hover:shadow-lg hover:border-primary transition-all group">
      <div className="w-12 h-12 bg-muted text-primary rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
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
    <section className={cn("py-8 bg-primary text-primary-foreground", className)}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat, index) => (
            <div key={index}>
              <p className="text-3xl lg:text-4xl font-bold mb-1">{stat.value}</p>
              <p className="text-primary-foreground text-sm">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
