/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { useState } from 'react';
import { Bell, Filter } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SmartAlertCard } from './SmartAlertCard';
import {
  useSmartNotifications,
  useSnoozeNotification,
  useDismissNotification,
  type SmartNotification,
} from '@/hooks/useSmartNotifications';
import { useNotifications, useNotificationStats } from '@/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';

type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type SortOption = 'recent' | 'urgent' | 'expiring';

/**
 * Sort notifications based on selected option
 */
function sortNotifications(
  notifications: SmartNotification[],
  sortBy: SortOption
): SmartNotification[] {
  const sorted = [...notifications];

  switch (sortBy) {
    case 'urgent':
      // Sort by urgency: critical > high > medium > low
      return sorted.sort((a, b) => {
        const urgencyWeight = { critical: 4, high: 3, medium: 2, low: 1 };
        const aWeight = urgencyWeight[a.metadata?.urgency || 'low'];
        const bWeight = urgencyWeight[b.metadata?.urgency || 'low'];
        return bWeight - aWeight;
      });

    case 'expiring':
      // Sort by expiration date (soonest first)
      return sorted.sort((a, b) => {
        const aExpires = a.metadata?.expiresAt ? new Date(a.metadata.expiresAt).getTime() : Infinity;
        const bExpires = b.metadata?.expiresAt ? new Date(b.metadata.expiresAt).getTime() : Infinity;
        return aExpires - bExpires;
      });

    case 'recent':
    default:
      // Sort by creation date (newest first)
      return sorted.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }
}

/**
 * Filter notifications by urgency
 */
function filterByUrgency(
  notifications: SmartNotification[],
  urgencyFilter: UrgencyFilter
): SmartNotification[] {
  if (urgencyFilter === 'all') return notifications;

  return notifications.filter(n => {
    const urgency = n.metadata?.urgency || 'low';

    switch (urgencyFilter) {
      case 'critical':
        return urgency === 'critical';
      case 'high':
        return urgency === 'critical' || urgency === 'high';
      default:
        return urgency === urgencyFilter;
    }
  });
}

export function NotificationCenter() {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [activeTab, setActiveTab] = useState<'smart' | 'general'>('smart');

  // Fetch smart notifications
  const { data: smartData, isLoading: isLoadingSmartNotifications } = useSmartNotifications({
    limit: 50,
  });

  // Fetch general notifications
  const { data: generalData, isLoading: isLoadingGeneral } = useNotifications({ limit: 10 });

  // Fetch notification stats for unread counts
  const { data: stats } = useNotificationStats();

  // Mutations
  const snoozeNotification = useSnoozeNotification();
  const dismissNotification = useDismissNotification();

  // Process smart notifications
  const smartNotifications = smartData?.data || [];
  const filteredNotifications = filterByUrgency(smartNotifications, urgencyFilter);
  const sortedNotifications = sortNotifications(filteredNotifications, sortBy);

  // Count unread smart notifications
  const unreadSmartCount = smartNotifications.filter(n => !n.isRead).length;
  const unreadGeneralCount = stats?.unread || 0;

  const handleSnooze = (id: number, duration: number) => {
    snoozeNotification.mutate({ id, duration });
  };

  const handleDismiss = (id: number) => {
    dismissNotification.mutate(id);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'smart' | 'general')}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="smart" className="relative">
            Smart Alerts
            {unreadSmartCount > 0 && (
              <Badge className="ml-2" variant="destructive">
                {unreadSmartCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="general" className="relative">
            General
            {unreadGeneralCount > 0 && (
              <Badge className="ml-2" variant="default">
                {unreadGeneralCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Smart Alerts Tab */}
        <TabsContent value="smart" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" aria-hidden="true" />
              <span>Filters:</span>
            </div>

            <Select
              value={urgencyFilter}
              onValueChange={(value) => setUrgencyFilter(value as UrgencyFilter)}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by urgency">
                <SelectValue placeholder="All Urgencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgencies</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
                <SelectItem value="high">High & Above</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="w-full sm:w-40" aria-label="Sort notifications">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="urgent">Most Urgent</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notification List */}
          {isLoadingSmartNotifications ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : sortedNotifications.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
              <p className="text-lg font-medium text-muted-foreground">No smart alerts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add products to your watchlist to receive intelligent notifications
              </p>
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Smart notifications">
              {sortedNotifications.map(notification => (
                <SmartAlertCard
                  key={notification.id}
                  notification={notification}
                  onDismiss={handleDismiss}
                  onSnooze={handleSnooze}
                />
              ))}
            </div>
          )}

          {/* Results Count */}
          {!isLoadingSmartNotifications && sortedNotifications.length > 0 && (
            <p className="text-sm text-muted-foreground text-center">
              Showing {sortedNotifications.length} of {smartNotifications.length} notifications
            </p>
          )}
        </TabsContent>

        {/* General Notifications Tab */}
        <TabsContent value="general" className="space-y-4">
          {isLoadingGeneral ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : generalData?.notifications.length === 0 ? (
            <div className="text-center py-12 bg-muted/20 rounded-lg">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
              <p className="text-lg font-medium text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-2" role="list" aria-label="General notifications">
              {generalData?.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border ${
                    !notification.isRead ? 'bg-primary/5 border-primary/20' : 'bg-background'
                  }`}
                  role="listitem"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-1 line-clamp-2">
                        {notification.title}
                      </p>
                      {notification.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {notification.content}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div
                        className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2"
                        aria-label="Unread indicator"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
