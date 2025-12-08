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
    <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] animate-pulse items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
}
