# Smart Notifications Frontend

Real-time intelligent price alert notifications with WebSocket integration.

## Overview

This implementation provides a complete frontend for the Smart Notifications system, featuring:

- **React Query hooks** for data fetching and mutations
- **WebSocket integration** for real-time notification delivery
- **Smart Alert Cards** with urgency-based styling and actions
- **Notification Center** with filtering and sorting
- **Toast notifications** for high/critical alerts

## Architecture

```
├── hooks/
│   └── useSmartNotifications.ts    # React Query hooks + WebSocket
├── components/notifications/
│   ├── SmartAlertCard.tsx          # Individual notification card
│   ├── NotificationCenter.tsx      # Full notification center UI
│   └── index.ts                    # Exports
└── pages/
    └── notifications.tsx            # Dedicated page (/notifications)
```

## Components

### SmartAlertCard

Displays a single smart notification with urgency-based styling.

**Features:**
- Urgency indicators (critical, high, medium, low)
- Reasoning bullets with checkmarks
- Savings calculator display
- Expiry countdown timer
- Snooze dropdown (1hr, 3hr, 1day)
- Dismiss button
- "View Product" CTA

**Props:**
```typescript
interface SmartAlertCardProps {
  notification: SmartNotification;
  onDismiss?: (id: number) => void;
  onSnooze?: (id: number, duration: number) => void;
}
```

**Usage:**
```tsx
import { SmartAlertCard } from '@/components/notifications';

<SmartAlertCard
  notification={notification}
  onDismiss={(id) => dismissMutation.mutate(id)}
  onSnooze={(id, duration) => snoozeMutation.mutate({ id, duration })}
/>
```

### NotificationCenter

Full notification center with tabs for smart alerts and general notifications.

**Features:**
- Tabbed interface (Smart Alerts | General)
- Unread count badges
- Urgency filter dropdown
- Sort options (Recent | Urgent | Expiring Soon)
- Loading states with skeletons
- Empty states
- Responsive design

**Usage:**
```tsx
import { NotificationCenter } from '@/components/notifications';

<NotificationCenter />
```

## Hooks

### useSmartNotifications(filters?)

Query hook to fetch smart notifications with optional filters.

**Filters:**
```typescript
interface SmartNotificationFilters {
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  unread?: boolean;
  limit?: number;
  offset?: number;
}
```

**Returns:**
- `data: SmartNotificationsResponse` - Notification data
- `isLoading: boolean` - Loading state
- `error: Error | null` - Error state
- React Query utilities (refetch, etc.)

**Polling:** Automatically polls every 30 seconds for updates.

**Usage:**
```tsx
const { data, isLoading } = useSmartNotifications({
  urgency: 'high',
  unread: true,
  limit: 20
});
```

### useSnoozeNotification()

Mutation hook to snooze a notification.

**Returns:**
- `mutate: (params: { id: number, duration: number }) => void`
- `isPending: boolean`
- `error: Error | null`

**Usage:**
```tsx
const snooze = useSnoozeNotification();

snooze.mutate({
  id: notificationId,
  duration: 3600 // 1 hour in seconds
});
```

### useDismissNotification()

Mutation hook to dismiss a notification.

**Returns:**
- `mutate: (id: number) => void`
- `isPending: boolean`
- `error: Error | null`

**Usage:**
```tsx
const dismiss = useDismissNotification();

dismiss.mutate(notificationId);
```

### useRealtimeNotifications()

WebSocket hook for real-time notification delivery.

**Features:**
- Auto-connects to Socket.IO server
- Listens for `notification:new` events
- Updates React Query cache optimistically
- Shows toasts for high/critical notifications
- Auto-reconnects on disconnect

**Returns:**
- `isConnected: boolean` - Connection status
- `socket: Socket | null` - Socket instance

**Usage:**
```tsx
// Initialize in App.tsx or root component
function App() {
  useRealtimeNotifications(); // Just call once at root

  return <YourApp />;
}
```

**Note:** This hook is already integrated in `App.tsx` - no need to call it elsewhere.

## Design System Compliance

### Colors (Tailwind Classes)

**Urgency-based styling:**
```typescript
const urgencyColors = {
  critical: 'border-red-500 bg-red-50 dark:bg-red-950',
  high: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
  medium: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  low: 'border-gray-500 bg-gray-50 dark:bg-gray-950'
};
```

**Badge variants:**
```typescript
const urgencyVariant = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline'
};
```

### Icons (lucide-react)

- `CheckCircle2` - Reasoning checkmarks
- `Clock` - Snooze button, expiry timer
- `X` - Dismiss button
- `Bell` - Empty state icon
- `AlertTriangle` - Critical urgency
- `TrendingDown` - Price drop indicator
- `Filter` - Filter dropdown

## API Integration

### Endpoints

**GET /api/notifications/smart**
- Fetches smart notifications with filters
- Query params: `urgency`, `unread`, `limit`, `offset`

**POST /api/notifications/smart/:id/snooze**
- Snoozes a notification
- Body: `{ duration: number }` (seconds)

**POST /api/notifications/smart/:id/dismiss**
- Dismisses a notification
- No body required

### WebSocket Events

**Event: `notification:new`**
```typescript
{
  userId: number;
  notification: {
    id: number;
    type: 'smart_alert';
    title: string;
    content: string;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    productId: number;
    savings: number;
    createdAt: string;
  }
}
```

## Accessibility

All components follow WCAG AA standards:

- ✅ Keyboard navigation support
- ✅ ARIA labels on interactive elements
- ✅ Screen reader announcements
- ✅ Focus states visible
- ✅ Color contrast ratios meet AA

## Testing Checklist

- [ ] Smart notifications display correctly
- [ ] Urgency colors render properly (all 4 levels)
- [ ] WebSocket connects on app load
- [ ] Real-time notifications appear instantly
- [ ] Toast shows for high/critical notifications
- [ ] Snooze functionality works (all 3 durations)
- [ ] Dismiss functionality works
- [ ] Filters work (urgency dropdown)
- [ ] Sort options work (Recent, Urgent, Expiring)
- [ ] Empty states display correctly
- [ ] Loading states show skeletons
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Dark mode styling correct
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

## Performance Considerations

- **Polling:** 30-second interval (configurable in hook)
- **WebSocket:** Connection pooling, auto-reconnect
- **Query cache:** 10-second stale time
- **Optimistic updates:** Cache updated before server response
- **Lazy loading:** Notification center not loaded until visited

## Future Enhancements

Potential improvements for future iterations:

1. **Sound notifications** for critical alerts
2. **Browser push notifications** (requires service worker)
3. **Notification history** view (dismissed notifications)
4. **Batch actions** (mark all as read, dismiss all)
5. **Custom snooze durations** (user input)
6. **Notification preferences** inline editor
7. **Product image thumbnails** in cards
8. **Price chart preview** in tooltip

## Troubleshooting

### WebSocket not connecting

Check browser console for errors. Common issues:
- Server not running
- Incorrect Socket.IO path (`/socket.io`)
- CORS issues (check server config)
- Firewall blocking WebSocket connections

### Notifications not appearing

1. Check API response in Network tab
2. Verify authentication (logged in)
3. Check Redis connection (backend requirement)
4. Ensure smart notifications exist in database

### Toasts not showing

1. Verify `<Toaster />` in App.tsx
2. Check urgency level (only high/critical show toasts)
3. Check toast hook import path

## Related Files

**Backend:**
- `server/notification-routes.ts` - API endpoints
- `server/services/smart-notification-service.ts` - Business logic
- `server/services/websocket-service.ts` - WebSocket server

**Frontend:**
- `client/src/App.tsx` - WebSocket initialization
- `client/src/hooks/use-notifications.ts` - General notifications
- `client/src/components/ui/toast.tsx` - Toast component
- `client/src/components/ui/tabs.tsx` - Tabs component

## License

Part of the PriceCompare platform.
