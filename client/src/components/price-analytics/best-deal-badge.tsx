/**
 * Best Deal Badge Component
 *
 * Highlights the lowest-priced offer with a prominent badge.
 * Used in product detail pages and retailer comparisons.
 */
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Award } from 'lucide-react';

interface BestDealBadgeProps {
  className?: string;
  variant?: 'default' | 'secondary' | 'outline';
  showIcon?: boolean;
}

export function BestDealBadge({
  className,
  variant = 'secondary',
  showIcon = true,
}: BestDealBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn('gap-1', className)}
      data-testid="best-deal-badge"
    >
      {showIcon && <Award className="h-3 w-3" />}
      Best Deal
    </Badge>
  );
}
