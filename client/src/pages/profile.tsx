import { Helmet } from 'react-helmet-async';
import { useUserProfile } from '@/hooks/use-user-profile';
import { ProfileHeader, ProfileStats } from '@/components/profile';
import { ReputationCard } from '@/components/community/reputation-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  Settings,
  Bell,
  Eye,
  Shield,
  LogIn,
  ChevronRight,
} from 'lucide-react';

/**
 * User Profile Page
 *
 * Displays the authenticated user's complete profile including:
 * - Profile header (avatar, name, bio, metadata)
 * - Activity statistics
 * - Reputation and badges
 * - Quick links to settings
 *
 * Requires authentication - shows login prompt for unauthenticated users.
 */
export default function ProfilePage() {
  const { data: profile, isLoading, error } = useUserProfile();

  return (
    <>
      <Helmet>
        <title>Your Profile | PriceCompare</title>
        <meta
          name="description"
          content="View and manage your PriceCompare profile, reputation, and activity"
        />
      </Helmet>

      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Profile</h1>
            <p className="text-muted-foreground">
              View your activity and manage your account
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error loading profile</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Something went wrong'}
            </AlertDescription>
          </Alert>
        )}

        {/* Unauthenticated State */}
        {!isLoading && !profile && !error && <UnauthenticatedState />}

        {/* Profile Content */}
        {(isLoading || profile) && (
          <div className="space-y-6">
            {/* Profile Header */}
            <ProfileHeader user={profile ?? null} isLoading={isLoading} />

            {/* Stats and Reputation Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Activity Stats - takes 2 columns on large screens */}
              <div className="lg:col-span-2">
                <ProfileStats user={profile ?? null} isLoading={isLoading} />
              </div>

              {/* Reputation Card */}
              <div>
                {isLoading ? (
                  <Card>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <ReputationCard showBadges />
                )}
              </div>
            </div>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <SettingsLink
                  href="/settings/notifications"
                  icon={Bell}
                  label="Notification Settings"
                  description="Manage alerts and emails"
                />
                <SettingsLink
                  href="/watchlists"
                  icon={Eye}
                  label="Watch Lists"
                  description="Products you're tracking"
                />
                <SettingsLink
                  href="/alerts"
                  icon={Shield}
                  label="Price Alerts"
                  description="Your active price alerts"
                />
                <SettingsLink
                  href="/notifications"
                  icon={Settings}
                  label="Notifications"
                  description="View all notifications"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Settings quick link component
 */
interface SettingsLinkProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function SettingsLink({ href, icon: Icon, label, description }: SettingsLinkProps) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        className="h-auto w-full justify-start gap-3 p-4 text-left"
      >
        <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
        <div className="flex-1 space-y-0.5">
          <div className="font-medium">{label}</div>
          <div className="text-muted-foreground text-xs">{description}</div>
        </div>
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      </Button>
    </Link>
  );
}

/**
 * Prompt for unauthenticated users
 */
function UnauthenticatedState() {
  return (
    <Card className="text-center">
      <CardContent className="py-12">
        <LogIn className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">Sign in to view your profile</h2>
        <p className="text-muted-foreground mb-6">
          Create an account or sign in to track prices, earn reputation, and join
          the community.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild>
            <Link href="/">Sign In</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
