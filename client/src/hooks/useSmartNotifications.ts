import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/hooks/use-toast';

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

export interface SmartNotificationsResponse {
  success: boolean;
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

  return useQuery<SmartNotificationsResponse>({
    queryKey: ['/api/notifications/smart', filters],
    queryFn: async () => {
      const res = await fetch(`/api/notifications/smart?${params}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch smart notifications');
      }

      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });
}

/**
 * Mutation hook to snooze a smart notification
 * Duration is in seconds (e.g., 3600 = 1 hour)
 */
export function useSnoozeNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, duration }: { id: number; duration: number }) => {
      const res = await fetch(`/api/notifications/smart/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ duration }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to snooze notification');
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate smart notifications query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/smart'] });

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
      const res = await fetch(`/api/notifications/smart/${id}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to dismiss notification');
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate smart notifications query to refetch
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/smart'] });

      // Also invalidate general notifications
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
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
 * Connects to Socket.IO server and listens for notification:new events
 * Updates query cache optimistically and shows toasts for high/critical alerts
 */
export function useRealtimeNotifications() {
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Initialize Socket.IO connection
    const socketInstance = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Listen for new notifications
    socketInstance.on('notification:new', (data: { userId: number; notification: SmartNotification }) => {
      const notification = data.notification;

      // Only handle smart_alert notifications
      if (notification.type !== 'smart_alert') {
        return;
      }

      // Update query cache optimistically
      queryClient.setQueryData(
        ['/api/notifications/smart'],
        (old: SmartNotificationsResponse | undefined) => {
          if (!old) {
            return {
              success: true,
              data: [notification],
              count: 1
            };
          }

          return {
            ...old,
            data: [notification, ...old.data],
            count: old.count + 1
          };
        }
      );

      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });

      // Show toast for high or critical urgency
      const urgency = notification.metadata?.urgency;
      if (urgency === 'critical' || urgency === 'high') {
        toast({
          title: notification.title,
          description: notification.content,
          variant: urgency === 'critical' ? 'destructive' : 'default',
        });
      }
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, [queryClient]);

  return {
    isConnected,
    socket
  };
}
