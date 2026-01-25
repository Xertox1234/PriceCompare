# Smart Notifications Component Hierarchy

## Visual Structure

```
App.tsx
├── useRealtimeNotifications() [WebSocket Init]
└── Router
    └── Route "/notifications"
        └── NotificationsPage
            └── NotificationCenter
                ├── Tabs
                │   ├── TabsList
                │   │   ├── TabsTrigger "Smart Alerts" [Badge: unreadCount]
                │   │   └── TabsTrigger "General" [Badge: unreadCount]
                │   │
                │   ├── TabsContent "smart"
                │   │   ├── Filters (Select dropdowns)
                │   │   │   ├── Select [Urgency Filter]
                │   │   │   └── Select [Sort Options]
                │   │   │
                │   │   ├── Loading State (Skeletons x3)
                │   │   ├── Empty State (Bell icon + text)
                │   │   └── Notification List
                │   │       └── SmartAlertCard (for each notification)
                │   │           ├── Badge [Urgency + Icon]
                │   │           ├── Header [Title + Timestamp]
                │   │           ├── Badge [Trigger Type]
                │   │           ├── Reasoning List
                │   │           │   └── ListItem x N
                │   │           │       ├── CheckCircle2 Icon
                │   │           │       └── Text
                │   │           ├── Savings Display [$XX.XX]
                │   │           ├── Expiry Countdown [Clock icon]
                │   │           └── Actions
                │   │               ├── Button "View Product"
                │   │               ├── DropdownMenu "Snooze"
                │   │               │   ├── MenuItem "1 hour"
                │   │               │   ├── MenuItem "3 hours"
                │   │               │   └── MenuItem "1 day"
                │   │               └── Button "Dismiss" [X icon]
                │   │
                │   └── TabsContent "general"
                │       ├── Loading State (Skeletons)
                │       ├── Empty State
                │       └── General Notification List
                │           └── Simple Card (for each notification)
                │
                └── Toaster (Toast notifications for high/critical)
```

## Data Flow

```
1. WebSocket Event
   └── useRealtimeNotifications()
       ├── socket.on('notification:new')
       ├── Update React Query cache (optimistic)
       └── Show toast (if urgency: high/critical)

2. User Action (Snooze/Dismiss)
   └── SmartAlertCard
       ├── onClick handler
       └── Mutation hook
           ├── POST /api/notifications/smart/:id/snooze
           ├── Invalidate queries
           └── Show success toast

3. Filtering/Sorting
   └── NotificationCenter
       ├── State: [urgencyFilter, sortBy]
       ├── filterByUrgency()
       ├── sortNotifications()
       └── Re-render SmartAlertCard list
```

## Hook Dependencies

```
useSmartNotifications()
├── useQuery [/api/notifications/smart]
│   ├── refetchInterval: 30000ms
│   └── staleTime: 10000ms
└── Filters: urgency, unread, limit, offset

useSnoozeNotification()
├── useMutation [POST /api/notifications/smart/:id/snooze]
├── onSuccess: invalidateQueries
└── Shows toast

useDismissNotification()
├── useMutation [POST /api/notifications/smart/:id/dismiss]
├── onSuccess: invalidateQueries
└── Shows toast

useRealtimeNotifications()
├── Socket.IO connection
├── Event: 'notification:new'
├── Updates: React Query cache
└── Shows toast (conditional)
```

## State Management

### Global State (React Query)

- `/api/notifications/smart` - Smart notifications list
- `/api/notifications` - General notifications list
- `/api/notifications/stats` - Unread counts

### Local State (NotificationCenter)

- `urgencyFilter: UrgencyFilter` - Current urgency filter
- `sortBy: SortOption` - Current sort option
- `activeTab: 'smart' | 'general'` - Current tab

### WebSocket State (useRealtimeNotifications)

- `isConnected: boolean` - Connection status
- `socket: Socket | null` - Socket instance

## Props Flow

```
NotificationCenter (no props)
├── useSmartNotifications() → notifications[]
├── useSnoozeNotification() → snooze mutation
├── useDismissNotification() → dismiss mutation
└── Maps to SmartAlertCard props:
    ├── notification: SmartNotification
    ├── onSnooze: (id, duration) => void
    └── onDismiss: (id) => void

SmartAlertCard
├── notification: SmartNotification
│   ├── id: number
│   ├── title: string
│   ├── content: string
│   ├── createdAt: string
│   ├── relatedProductId: number | null
│   └── metadata: {
│       ├── urgency: 'critical' | 'high' | 'medium' | 'low'
│       ├── savings: number
│       ├── expiresAt: string
│       ├── triggerType: 'price_drop' | 'stock_low' | 'prediction' | 'seasonal'
│       └── confidence: number
│   }
├── onSnooze?: (id: number, duration: number) => void
└── onDismiss?: (id: number) => void
```

## Styling Hierarchy

```
Urgency Colors (Tailwind)
├── critical
│   ├── border-red-500
│   ├── bg-red-50
│   └── dark:bg-red-950
├── high
│   ├── border-amber-500
│   ├── bg-amber-50
│   └── dark:bg-amber-950
├── medium
│   ├── border-blue-500
│   ├── bg-blue-50
│   └── dark:bg-blue-950
└── low
    ├── border-gray-500
    ├── bg-gray-50
    └── dark:bg-gray-950

Badge Variants
├── critical → 'destructive'
├── high → 'default'
├── medium → 'secondary'
└── low → 'outline'

Icons (lucide-react)
├── CheckCircle2 - Reasoning checkmarks
├── Clock - Snooze button, expiry
├── X - Dismiss button
├── AlertTriangle - Critical urgency
├── TrendingDown - Price drop
├── Bell - Empty state
└── Filter - Filter dropdown
```

## File Organization

```
client/src/
├── hooks/
│   └── useSmartNotifications.ts      [249 lines]
│       ├── useSmartNotifications()
│       ├── useSnoozeNotification()
│       ├── useDismissNotification()
│       └── useRealtimeNotifications()
│
├── components/notifications/
│   ├── SmartAlertCard.tsx            [175 lines]
│   ├── NotificationCenter.tsx        [258 lines]
│   ├── index.ts                      [10 lines]
│   ├── README.md                     [350 lines]
│   └── COMPONENT_HIERARCHY.md        [this file]
│
├── pages/
│   └── notifications.tsx             [23 lines]
│
└── App.tsx [modified]
    └── useRealtimeNotifications() call
```

## Import Paths

```typescript
// Hooks
import {
  useSmartNotifications,
  useSnoozeNotification,
  useDismissNotification,
  useRealtimeNotifications,
} from '@/hooks/use-smart-notifications';

// Components
import { SmartAlertCard } from '@/components/notifications/SmartAlertCard';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

// Or use index exports
import { SmartAlertCard, NotificationCenter } from '@/components/notifications';

// Types
import type { SmartNotification } from '@/hooks/use-smart-notifications';
```

## Key Dependencies

```json
{
  "@tanstack/react-query": "^5.x",
  "socket.io-client": "^4.8.1",
  "date-fns": "^4.1.0",
  "lucide-react": "^0.x",
  "@radix-ui/react-tabs": "^1.x",
  "@radix-ui/react-dropdown-menu": "^2.x",
  "@radix-ui/react-select": "^2.x"
}
```
