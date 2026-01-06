import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './use-auth';

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
  const { data: user } = useAuth();
  const params = new URLSearchParams();
  if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());
  if (filters?.type) params.append('type', filters.type);
  if (filters?.limit) params.append('limit', filters.limit.toString());

  return useQuery<{ data: Notification[]; count: number }>({
    queryKey: ['/api/notifications', filters],
    queryFn: () =>
      apiRequest<{ data: Notification[]; count: number }>(`/api/notifications?${params}`),
    enabled: !!user, // Only fetch if user is authenticated
  });
}

// Fetch notification stats
export function useNotificationStats() {
  const { data: user } = useAuth();

  return useQuery<NotificationStats>({
    queryKey: ['/api/notifications/stats'],
    queryFn: () => apiRequest<NotificationStats>('/api/notifications/stats'),
    enabled: !!user, // Only fetch if user is authenticated
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch notification preferences
export function useNotificationPreferences() {
  const { data: user } = useAuth();

  return useQuery<NotificationPreferences>({
    queryKey: ['/api/notifications/preferences'],
    queryFn: () => apiRequest<NotificationPreferences>('/api/notifications/preferences'),
    enabled: !!user, // Only fetch if user is authenticated
  });
}

// Mark notification as read
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}/read`, { method: 'POST' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Mark all as read
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiRequest('/api/notifications/read-all', { method: 'POST' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Delete notification
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      return apiRequest(`/api/notifications/${notificationId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/stats'] });
    },
  });
}

// Update notification preferences
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      return apiRequest('/api/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/notifications/preferences'] });
    },
  });
}
