import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert, Crown } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Trust level configuration following Discourse-style trust system
 *
 * Trust levels determine user privileges and community standing:
 * - Level 0: New User - Just joined, limited actions
 * - Level 1: Basic - Has read topics, minimum activity
 * - Level 2: Member - Active participant, can edit own posts
 * - Level 3: Regular - Trusted community member
 * - Level 4: Leader - Highly trusted, can moderate
 *
 * Trust Level Badge Colors
 *
 * NOTE: These colors are intentionally hardcoded rather than using design tokens.
 * Trust levels represent distinct categorical data that requires visual differentiation
 * similar to data visualization charts. This is an acceptable exception per
 * docs/05_FRONTEND_PATTERNS.md (Acceptable Exceptions: Data visualization colors).
 *
 * Each level has carefully chosen colors that:
 * 1. Provide clear visual hierarchy (gray -> blue -> green -> purple -> amber)
 * 2. Support both light and dark modes
 * 3. Maintain WCAG AA contrast ratios
 */
const TRUST_LEVELS = [
  {
    level: 0,
    name: 'New User',
    description: 'Just joined the community',
    icon: Shield,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  {
    level: 1,
    name: 'Basic',
    description: 'Has explored the community basics',
    icon: Shield,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    level: 2,
    name: 'Member',
    description: 'Active community participant',
    icon: ShieldCheck,
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  {
    level: 3,
    name: 'Regular',
    description: 'Trusted and experienced member',
    icon: ShieldAlert,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  {
    level: 4,
    name: 'Leader',
    description: 'Community leader with moderation abilities',
    icon: Crown,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
] as const;

interface TrustLevelBadgeProps {
  /** Trust level (0-4) */
  trustLevel: number;
  /** Show level number alongside name */
  showLevel?: boolean;
  /** Compact mode - icon only */
  compact?: boolean;
}

/**
 * Displays a user's trust level with icon and optional tooltip
 *
 * @example
 * ```tsx
 * <TrustLevelBadge trustLevel={2} />
 * // Renders: [ShieldCheck] Member
 *
 * <TrustLevelBadge trustLevel={4} showLevel />
 * // Renders: [Crown] Leader (4)
 *
 * <TrustLevelBadge trustLevel={3} compact />
 * // Renders: [ShieldAlert] (icon only with tooltip)
 * ```
 */
export function TrustLevelBadge({
  trustLevel,
  showLevel = false,
  compact = false,
}: TrustLevelBadgeProps) {
  // Clamp trust level to valid range
  const level = Math.max(0, Math.min(4, trustLevel));
  const config = TRUST_LEVELS[level];
  const Icon = config.icon;

  const badge = (
    <Badge variant="outline" className={`${config.color} gap-1.5 border-0`}>
      <Icon className="h-3.5 w-3.5" />
      {!compact && (
        <>
          {config.name}
          {showLevel && (
            <span className="text-muted-foreground ml-1 text-xs">({level})</span>
          )}
        </>
      )}
    </Badge>
  );

  // Wrap in tooltip for compact mode or always for extra context
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <div className="font-semibold">
            {config.name} (Level {level})
          </div>
          <div className="text-muted-foreground text-xs">{config.description}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
