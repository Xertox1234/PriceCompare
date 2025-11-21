import { CheckCircle2, Clock, X, AlertTriangle, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { SmartNotification } from '@/hooks/useSmartNotifications';
import { formatDistanceToNow } from 'date-fns';

export interface SmartAlertCardProps {
  notification: SmartNotification;
  onDismiss?: (id: number) => void;
  onSnooze?: (id: number, duration: number) => void;
}

// Urgency-based styling using design system colors
const urgencyColors = {
  critical: 'border-red-500 bg-red-50 dark:bg-red-950',
  high: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
  medium: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  low: 'border-gray-500 bg-gray-50 dark:bg-gray-950'
};

// Badge variants for urgency levels
const urgencyVariant = {
  critical: 'destructive' as const,
  high: 'default' as const,
  medium: 'secondary' as const,
  low: 'outline' as const
};

// Urgency icons
const urgencyIcons = {
  critical: AlertTriangle,
  high: TrendingDown,
  medium: TrendingDown,
  low: TrendingDown
};

// Snooze duration options
const snoozeOptions = [
  { label: '1 hour', duration: 3600 },
  { label: '3 hours', duration: 10800 },
  { label: '1 day', duration: 86400 }
];

/**
 * Format expiry countdown
 */
function formatExpiry(expiresAt: string): string {
  try {
    return formatDistanceToNow(new Date(expiresAt), { addSuffix: false });
  } catch {
    return 'soon';
  }
}

/**
 * Parse reasoning from notification content
 * Content is a period-separated string of reasoning points
 */
function parseReasoning(content: string | null): string[] {
  if (!content) return [];
  return content.split('. ').filter(Boolean);
}

export function SmartAlertCard({ notification, onDismiss, onSnooze }: SmartAlertCardProps) {
  const { metadata, relatedProductId } = notification;

  // Fallback to default values if metadata is missing
  const urgency = metadata?.urgency || 'low';
  const savings = metadata?.savings || 0;
  const expiresAt = metadata?.expiresAt;
  const triggerType = metadata?.triggerType || 'price_drop';

  const reasoning = parseReasoning(notification.content);
  const UrgencyIcon = urgencyIcons[urgency];

  const handleBuyNow = () => {
    if (relatedProductId) {
      window.open(`/products/${relatedProductId}`, '_blank');
    }
  };

  const handleSnooze = (duration: number) => {
    onSnooze?.(notification.id, duration);
  };

  const handleDismiss = () => {
    onDismiss?.(notification.id);
  };

  return (
    <div
      className={cn(
        'relative border-l-4 rounded-lg p-4 shadow-sm transition-all hover:shadow-md',
        urgencyColors[urgency]
      )}
      role="article"
      aria-label={`${urgency} urgency notification: ${notification.title}`}
    >
      {/* Urgency Badge */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <Badge variant={urgencyVariant[urgency]} className="flex items-center gap-1">
          <UrgencyIcon className="w-3 h-3" />
          {urgency.toUpperCase()}
        </Badge>
      </div>

      {/* Notification Header */}
      <div className="pr-24 mb-3">
        <h3 className="font-semibold text-base line-clamp-2">{notification.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>

      {/* Trigger Type Badge */}
      {triggerType && (
        <div className="mb-3">
          <Badge variant="outline" className="text-xs">
            {triggerType.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      )}

      {/* Reasoning List */}
      {reasoning.length > 0 && (
        <ul className="space-y-1.5 mb-3" aria-label="Notification reasons">
          {reasoning.map((reason, i) => (
            <li key={i} className="text-sm flex items-start gap-2">
              <CheckCircle2
                className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Savings Display */}
      {savings > 0 && (
        <div className="bg-green-100 dark:bg-green-900 rounded p-2 mb-3">
          <span className="text-sm font-semibold text-green-700 dark:text-green-300">
            💰 Save ${savings.toFixed(2)}
          </span>
        </div>
      )}

      {/* Expiry Countdown */}
      {expiresAt && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>Expires in {formatExpiry(expiresAt)}</span>
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {relatedProductId && (
          <Button
            size="sm"
            className="flex-1 min-w-[100px]"
            onClick={handleBuyNow}
            aria-label="View product details"
          >
            View Product
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              aria-label="Snooze notification"
            >
              <Clock className="w-4 h-4 mr-1" aria-hidden="true" />
              Snooze
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {snoozeOptions.map(option => (
              <DropdownMenuItem
                key={option.duration}
                onClick={() => handleSnooze(option.duration)}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
