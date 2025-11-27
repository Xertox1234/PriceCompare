import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  content: string | null;
  relatedPostId: number | null;
  relatedTopicId: number | null;
  relatedUserId: number | null;
  relatedProductId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  id: number;
  userId: number;
  priceDropEnabled: boolean;
  priceDropThresholdPercent: number;
  priceDropThresholdAmount: string;
  priceAlertEnabled: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  maxDailyNotifications: number;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

// Fetch user's notifications
export function useNotifications(filters?: { isRead?: boolean; type?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());
  if (filters?.type) params.append('type', filters.type);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  return useQuery<{ notifications: Notification[]; count: number }>({
    queryKey: ['/api/notifications', filters],
    queryFn: () => apiRequest<{ notifications: Notification[]; count: number }>(`/api/notifications?${params}`),
  });
}

// Fetch notification stats
export function useNotificationStats() {
  return useQuery<NotificationStats>({
    queryKey: ['/api/notifications/stats'],
    queryFn: () => apiRequest<NotificationStats>('/api/notifications/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch notification preferences
export function useNotificationPreferences() {
  return useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
    queryFn: () => apiRequest<NotificationPreferences>('/api/notifications/preferences'),
  });
}

// Mark notification as read
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Mark all as read
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete notification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Update notification preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
    },
  });
}
