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
          <Skeleton className="mt-2 h-4 w-48" />
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
  const currentLevelProgress = (((reputation.reputationPoints ?? 0) % 100) / 100) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-600" />
          Your Reputation
        </CardTitle>
        {!compact && <CardDescription>Track your community contributions</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level and Points */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-primary text-3xl font-bold">Level {reputation.level}</div>
            <div className="text-muted-foreground text-sm">
              {reputation.reputationPoints} reputation points
            </div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-sm">Next Level</div>
            <div className="text-lg font-semibold">{nextLevelPoints} pts</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={currentLevelProgress} className="h-2" />
          <div className="text-muted-foreground text-center text-xs">
            {Math.round(currentLevelProgress)}% to Level {(reputation.level ?? 0) + 1}
          </div>
        </div>

        {/* Stats Grid */}
        {!compact && (
          <div className="grid grid-cols-3 gap-3 border-t pt-2">
            <div className="text-center">
              <div className="mb-1 flex items-center justify-center">
                <Award className="text-primary h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{reputation.dealsSpotted}</div>
              <div className="text-muted-foreground text-xs">Deals</div>
            </div>

            <div className="text-center">
              <div className="mb-1 flex items-center justify-center">
                <Target className="h-4 w-4 text-green-600" />
              </div>
              <div className="text-2xl font-bold">{reputation.accuratePredictions}</div>
              <div className="text-muted-foreground text-xs">Accurate</div>
            </div>

            <div className="text-center">
              <div className="mb-1 flex items-center justify-center">
                <Users className="text-primary h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{reputation.communityContributions}</div>
              <div className="text-muted-foreground text-xs">Posts</div>
            </div>
          </div>
        )}

        {/* Badges */}
        {showBadges && reputation.badges && reputation.badges.length > 0 && (
          <div className="border-t pt-3">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" />
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
          <div className="border-t pt-3">
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
