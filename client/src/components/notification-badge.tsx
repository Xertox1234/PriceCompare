/**
 * NotificationBadge Component
 *
 * Real-time notification badge that displays unread count.
 * Updates instantly via WebSocket without page refresh.
 *
 * Usage:
 * ```tsx
 * <div className="relative">
 *   <BellIcon />
 *   <NotificationBadge />
 * </div>
 * ```
 */

import { useNotificationUpdates } from '@/hooks/use-notification-updates';

export function NotificationBadge() {
  const { unreadCount } = useNotificationUpdates();

  // Hide badge when no unread notifications
  if (unreadCount === 0) {
    return null;
  }

  return (
    <span className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-red-500 flex items-center justify-center text-xs font-bold text-white animate-pulse">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
}
