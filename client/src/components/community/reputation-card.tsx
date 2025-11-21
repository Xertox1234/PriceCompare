import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUserReputation } from '@/hooks/use-community';
import { Award, TrendingUp, Target, Users, Star, Info } from 'lucide-react';

interface ReputationCardProps {
  compact?: boolean;
  showBadges?: boolean;
}

export function ReputationCard({ compact = false, showBadges = true }: ReputationCardProps) {
  const { data, isLoading } = useUserReputation();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.data) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Start watching products and spotting deals to earn reputation!
        </AlertDescription>
      </Alert>
    );
  }

  const reputation = data.data;
  const nextLevelPoints = (reputation.level ?? 0) * 100;
  const currentLevelProgress =
    (((reputation.reputationPoints ?? 0) % 100) / 100) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-600" />
          Your Reputation
        </CardTitle>
        {!compact && <CardDescription>Track your community contributions</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level and Points */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold text-primary">Level {reputation.level}</div>
            <div className="text-sm text-muted-foreground">
              {reputation.reputationPoints} reputation points
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Next Level</div>
            <div className="text-lg font-semibold">{nextLevelPoints} pts</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={currentLevelProgress} className="h-2" />
          <div className="text-xs text-muted-foreground text-center">
            {Math.round(currentLevelProgress)}% to Level {(reputation.level ?? 0) + 1}
          </div>
        </div>

        {/* Stats Grid */}
        {!compact && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Award className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{reputation.dealsSpotted}</div>
              <div className="text-xs text-muted-foreground">Deals</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Target className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold">{reputation.accuratePredictions}</div>
              <div className="text-xs text-muted-foreground">Accurate</div>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold">{reputation.communityContributions}</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>
          </div>
        )}

        {/* Badges */}
        {showBadges && reputation.badges && reputation.badges.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              Your Badges
            </h4>
            <div className="flex flex-wrap gap-2">
              {reputation.badges.map((badge: string) => (
                <Badge key={badge} variant="default" className="text-xs">
                  {getBadgeEmoji(badge)} {badge}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty Badge State */}
        {showBadges && (!reputation.badges || reputation.badges.length === 0) && (
          <div className="pt-3 border-t">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Earn badges by spotting deals, making accurate predictions, and contributing to the
                community!
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
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
