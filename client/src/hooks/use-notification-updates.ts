/**
 * useNotificationUpdates Hook
 *
 * Subscribes to real-time notification updates via WebSocket.
 * Tracks unread count and shows toast notifications for high-priority alerts.
 *
 * Usage:
 * ```tsx
 * function NotificationBell() {
 *   const { unreadCount } = useNotificationUpdates();
 *
 *   return <Badge>{unreadCount}</Badge>;
 * }
 * ```
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocketClient } from '@/lib/websocket-client';
import { useToast } from './use-toast';
import { useWebSocket } from './use-websocket';
import type { NotificationEvent } from '../../../server/websocket/types';

/**
 * Play notification sound (optional)
 * Only plays if user has interacted with the page (browser autoplay policy)
 */
function playNotificationSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz frequency
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime); // Volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    // Silent fail - notification sounds are nice-to-have
    console.debug('Could not play notification sound:', error);
  }
}

export function useNotificationUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected } = useWebSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Only subscribe if WebSocket is connected
    if (!isConnected) {
      return;
    }

    // Subscribe to notifications
    websocketClient.emit('notification:subscribe');

    // Handle subscription confirmation (includes initial unread count)
    const handleSubscribed = (data: {
      timestamp: string;
      unreadCount: number;
      totalCount: number;
    }) => {
      setUnreadCount(data.unreadCount);
    };

    // Handle new notification
    const handleNewNotification = (data: {
      notification: NotificationEvent;
      unreadCount: number;
    }) => {
      setUnreadCount(data.unreadCount);

      // Update notification cache
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });

      // Show toast for high priority notifications
      if (data.notification.priority === 'high') {
        toast({
          title: data.notification.title,
          description: data.notification.content,
          variant: 'destructive',
        });
        playNotificationSound();
      }

      // For price alerts, show custom toast with pricing info
      if (data.notification.type === 'price_alert') {
        toast({
          title: '💰 Price Alert!',
          description: data.notification.content,
        });
        playNotificationSound();
      }
    };

    // Handle notification marked as read
    const handleNotificationRead = (data: {
      notificationId: number;
      unreadCount: number;
    }) => {
      setUnreadCount(data.unreadCount);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    };

    // Handle unread count update
    const handleCountUpdated = (data: {
      unreadCount: number;
      timestamp: string;
    }) => {
      setUnreadCount(data.unreadCount);
    };

    // Subscribe to events
    websocketClient.on('notification:subscribed', handleSubscribed);
    websocketClient.on('notification:new', handleNewNotification);
    websocketClient.on('notification:read', handleNotificationRead);
    websocketClient.on('notification:count_updated', handleCountUpdated);

    // Cleanup: unsubscribe from events
    return () => {
      websocketClient.off('notification:subscribed', handleSubscribed);
      websocketClient.off('notification:new', handleNewNotification);
      websocketClient.off('notification:read', handleNotificationRead);
      websocketClient.off('notification:count_updated', handleCountUpdated);
      websocketClient.emit('notification:unsubscribe');
    };
  }, [isConnected, queryClient, toast]);

  return { unreadCount };
}
