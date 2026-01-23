import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrustLevelBadge } from './TrustLevelBadge';
import { MapPin, Link as LinkIcon, Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/**
 * Extended user profile data structure
 * Matches the extended /api/auth/user response
 */
export interface UserProfileData {
  id: number;
  username: string;
  email: string;
  role: string;
  reputation: number;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  trustLevel: number;
  lastSeenAt?: string | null;
  postCount: number;
  topicCount: number;
  likesGiven: number;
  likesReceived: number;
  daysVisited: number;
  createdAt: string;
}

interface ProfileHeaderProps {
  user: UserProfileData | null;
  isLoading?: boolean;
}

/**
 * Profile header component displaying user's avatar, name, bio, and metadata
 *
 * Shows:
 * - Avatar (with first letter fallback)
 * - Username with role badge
 * - Trust level badge
 * - Bio (if set)
 * - Location (if set)
 * - Website (if set)
 * - Member since date
 * - Last seen (if available)
 */
export function ProfileHeader({ user, isLoading }: ProfileHeaderProps) {
  if (isLoading) {
    return <ProfileHeaderSkeleton />;
  }

  if (!user) {
    return null;
  }

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  const lastSeen = user.lastSeenAt
    ? formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true })
    : null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Avatar */}
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={user.username} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* User Info */}
          <div className="flex-1 text-center sm:text-left">
            {/* Name and Badges Row */}
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold">{user.username}</h1>
              {user.role === 'admin' && (
                <Badge variant="destructive">Admin</Badge>
              )}
              {user.role === 'moderator' && (
                <Badge variant="secondary">Moderator</Badge>
              )}
              <TrustLevelBadge trustLevel={user.trustLevel} />
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-muted-foreground mb-3 max-w-2xl">{user.bio}</p>
            )}

            {/* Metadata Row */}
            <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-4 text-sm sm:justify-start">
              {/* Location */}
              {user.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{user.location}</span>
                </div>
              )}

              {/* Website */}
              {user.website && (
                <a
                  href={
                    user.website.startsWith('http')
                      ? user.website
                      : `https://${user.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary flex items-center gap-1 transition-colors"
                >
                  <LinkIcon className="h-4 w-4" />
                  <span>{user.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}

              {/* Member Since */}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Joined {memberSince}</span>
              </div>

              {/* Last Seen */}
              {lastSeen && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Active {lastSeen}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for ProfileHeader
 */
function ProfileHeaderSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Skeleton className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="mx-auto h-4 w-64 sm:mx-0" />
            <div className="flex flex-wrap justify-center gap-4 sm:justify-start">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
