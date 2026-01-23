import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  FileText,
  Heart,
  ThumbsUp,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';
import type { UserProfileData } from './ProfileHeader';

interface ProfileStatsProps {
  user: UserProfileData | null;
  isLoading?: boolean;
}

/**
 * Profile statistics grid showing user engagement metrics
 *
 * Displays:
 * - Posts written
 * - Topics created
 * - Likes given
 * - Likes received
 * - Days visited
 * - Reputation points
 */
export function ProfileStats({ user, isLoading }: ProfileStatsProps) {
  if (isLoading) {
    return <ProfileStatsSkeleton />;
  }

  if (!user) {
    return null;
  }

  const stats = [
    {
      label: 'Posts',
      value: user.postCount,
      icon: MessageSquare,
      description: 'Forum posts written',
    },
    {
      label: 'Topics',
      value: user.topicCount,
      icon: FileText,
      description: 'Discussions started',
    },
    {
      label: 'Given',
      value: user.likesGiven,
      icon: ThumbsUp,
      description: 'Likes given to others',
    },
    {
      label: 'Received',
      value: user.likesReceived,
      icon: Heart,
      description: 'Likes received from others',
    },
    {
      label: 'Days Visited',
      value: user.daysVisited,
      icon: CalendarDays,
      description: 'Total days active',
    },
    {
      label: 'Reputation',
      value: user.reputation,
      icon: TrendingUp,
      description: 'Community reputation points',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity & Engagement</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <StatItem key={stat.label} {...stat} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatItemProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

function StatItem({ label, value, icon: Icon, description }: StatItemProps) {
  return (
    <div
      className="group flex flex-col items-center rounded-lg p-3 text-center transition-colors hover:bg-muted/50"
      title={description}
    >
      <Icon className="text-muted-foreground group-hover:text-primary mb-2 h-5 w-5 transition-colors" />
      <div className="text-2xl font-bold">{formatNumber(value)}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

const formatNumber = (value: number): string => value.toLocaleString();

/**
 * Loading skeleton for ProfileStats
 */
function ProfileStatsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center p-3">
              <Skeleton className="mb-2 h-5 w-5" />
              <Skeleton className="mb-1 h-8 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
