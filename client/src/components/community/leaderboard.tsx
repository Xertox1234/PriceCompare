import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLeaderboard } from '@/hooks/use-community';
import { Trophy, Medal, Award, TrendingUp, Info } from 'lucide-react';

interface LeaderboardProps {
  limit?: number;
  showBadges?: boolean;
  compact?: boolean;
}

export function Leaderboard({ limit = 10, showBadges = true, compact = false }: LeaderboardProps) {
  const { data, isLoading } = useLeaderboard(limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.data || data.data.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No community members on the leaderboard yet.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-600" />
          Community Leaderboard
        </CardTitle>
        {!compact && (
          <CardDescription>Top deal spotters and community contributors</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.data.map((entry, index) => (
            <LeaderboardEntry
              key={entry.userId}
              entry={entry}
              rank={index + 1}
              showBadges={showBadges}
              compact={compact}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface LeaderboardEntryData {
  userId: number;
  username: string;
  reputationPoints: number;
  level: number;
  dealsSpotted: number;
  badges?: string[];
}

// Leaderboard Entry Component
function LeaderboardEntry({
  entry,
  rank,
  showBadges,
  compact,
}: {
  entry: LeaderboardEntryData;
  rank: number;
  showBadges: boolean;
  compact: boolean;
}) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-700" />;
      default:
        return (
          <div className="w-5 h-5 flex items-center justify-center text-sm font-semibold text-muted-foreground">
            {rank}
          </div>
        );
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-amber-50 border-amber-200';
      case 2:
        return 'bg-gray-50 border-gray-200';
      case 3:
        return 'bg-orange-50 border-orange-200';
      default:
        return 'bg-card border-border';
    }
  };

  return (
    <div className={`p-3 rounded-lg border-2 ${getRankColor(rank)}`}>
      <div className="flex items-center gap-3">
        {/* Rank Icon */}
        <div className="flex-shrink-0">{getRankIcon(rank)}</div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold truncate">{entry.username}</h4>
            <Badge variant="outline" className="text-xs">
              Level {entry.level}
            </Badge>
          </div>

          {!compact && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>{entry.reputationPoints} pts</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="w-3 h-3" />
                <span>{entry.dealsSpotted} deals</span>
              </div>
            </div>
          )}

          {/* Badges */}
          {showBadges && entry.badges && entry.badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {entry.badges.map((badge: string) => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {getBadgeEmoji(badge)} {badge}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Reputation Points */}
        {compact && (
          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-bold text-primary">{entry.reputationPoints}</div>
            <div className="text-xs text-muted-foreground">points</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Badge emoji helper
function getBadgeEmoji(badge: string): string {
  const emojiMap: Record<string, string> = {
    'Deal Spotter': '🔍',
    'Deal Hunter': '🎯',
    'Deal Master': '👑',
    'Community Hero': '🌟',
    'Super Contributor': '💫',
    'Price Prophet': '🔮',
    'Elite Member': '💎',
  };
  return emojiMap[badge] || '🏆';
}
