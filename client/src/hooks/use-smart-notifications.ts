import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import { apiRequest } from '@/lib/queryClient';
import { websocketClient, type ConnectionState } from '@/lib/websocket-client';

const log = createLogger('SmartNotifications');

/**
 * Smart Notification Interface
 * Based on notifications table with smart_alert metadata
 */
export interface SmartNotification {
  id: number;
  userId: number;
  type: 'smart_alert';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  relatedProductId: number | null;
  metadata?: {
    productId: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    savings: number;
    expiresAt: string;
    triggerType: 'price_drop' | 'stock_low' | 'prediction' | 'seasonal';
    confidence: number;
  };
}

export interface SmartNotificationsPayload {
  data: SmartNotification[];
  count: number;
}

export interface SmartNotificationFilters {
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  unread?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Query hook to fetch smart notifications with optional filters
 * Polls every 30 seconds for updates
 */
export function useSmartNotifications(filters?: SmartNotificationFilters) {
  const params = new URLSearchParams();

  if (filters?.urgency) params.append('urgency', filters.urgency);
  if (filters?.unread !== undefined) params.append('unread', filters.unread.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());
  if (filters?.offset) params.append('offset', filters.offset.toString());

  return useQuery<SmartNotificationsPayload>({
    queryKey: ['/api/notifications/smart', filters],
    queryFn: () => apiRequest<SmartNotificationsPayload>(`/api/notifications/smart?${params}`),
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Pause polling when tab is inactive
    staleTime: 10000, // Consider data stale after 10 seconds
    gcTime: 30000, // Keep in cache for 30 seconds (3x staleTime)
  });
}

/**
 * Mutation hook to snooze a smart notification
 * Duration is in seconds (e.g., 3600 = 1 hour)
 */
export function useSnoozeNotification() {
  const queryClient = useQueryClient();

  interface SnoozeResponse {
    message?: string;
  }

  return useMutation({
    mutationFn: async ({
      id,
      duration,
    }: {
      id: number;
      duration: number;
    }): Promise<SnoozeResponse> => {
      return apiRequest<SnoozeResponse>(`/api/notifications/smart/${id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ duration }),
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate smart notifications query to refetch
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/smart'] });

      // Show success toast
      toast({
        title: 'Notification snoozed',
        description: data.message || `Snoozed for ${variables.duration / 3600} hours`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to snooze',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Mutation hook to dismiss a smart notification
 */
export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<{ success: boolean }>(`/api/notifications/smart/${id}/dismiss`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      // Invalidate smart notifications query to refetch
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/smart'] });

      // Also invalidate general notifications
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to dismiss',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * WebSocket hook for real-time notification delivery
 * Uses shared websocketClient singleton to listen for notification:new events
 * Updates query cache optimistically and shows toasts for high/critical alerts
 */
export function useRealtimeNotifications() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    websocketClient.getState()
  );
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribeState = websocketClient.onStateChange((state) => {
      setConnectionState(state);
      if (state === 'connected') {
        log.info('WebSocket connected (via shared client)');
      } else if (state === 'disconnected') {
        log.info('WebSocket disconnected (via shared client)');
      }
    });

    // Ensure websocket client is connected
    if (!websocketClient.isConnected()) {
      websocketClient.connect();
    }

    // Handler for new notifications using typed event from ServerToClientEvents
    const handleNotificationNew = (data: {
      notification: {
        id: number;
        type: 'price_alert' | 'watch_list' | 'system';
        title: string;
        content: string;
        priority: 'low' | 'medium' | 'high';
        read: boolean;
        timestamp: string;
      };
      unreadCount: number;
    }) => {
      // Map the typed notification to SmartNotification format for cache update
      // Since smart alerts may come through with type info, we handle all types
      const notification = data.notification;

      // Update query cache optimistically
      // Note: The typed event uses NotificationEvent which differs from SmartNotification
      // We invalidate queries to fetch fresh data instead of optimistic update
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/smart'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });

      // Show toast for high priority notifications
      if (notification.priority === 'high') {
        toast({
          title: notification.title,
          description: notification.content,
          variant: 'default',
        });
      }
    };

    // Subscribe to notification events using the shared client
    websocketClient.on('notification:new', handleNotificationNew);

    // Cleanup on unmount
    return () => {
      unsubscribeState();
      websocketClient.off('notification:new', handleNotificationNew);
    };
  }, [queryClient]);

  return {
    isConnected: connectionState === 'connected',
    connectionState,
  };
}
