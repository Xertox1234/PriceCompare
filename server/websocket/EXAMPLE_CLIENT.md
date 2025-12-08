# WebSocket Client Example

This document shows how to connect to and use the WebSocket event system from a client.

## Basic Connection

```typescript
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@shared/websocket-types'; // You'll need to export types

// Create typed socket
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io('http://localhost:5000/ws', {
  withCredentials: true, // Include session cookie for authentication
  transports: ['websocket', 'polling'], // Support both transports
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error.message, error.code);
  // Display error to user
  showNotification(error.message, 'error');
});

socket.on('authenticated', (data) => {
  console.log('Authenticated:', data.userId, 'at', data.timestamp);
  // Subscribe to events after authentication
  subscribeToEvents();
});
```

## Watch List Events

### Subscribe to Watch List Updates

```typescript
function subscribeToWatchLists() {
  // Subscribe to watch list updates
  socket.emit('subscribe:watchlists');

  // Listen for subscription confirmation
  socket.on('watchlist:subscribed', (data) => {
    console.log('Subscribed to watch lists:', data.message);
  });

  // Listen for watch list updates
  socket.on('watchlist:update', (data) => {
    console.log('Watch list updated:', {
      id: data.watchListId,
      name: data.name,
      action: data.action,
      productCount: data.productCount,
    });

    // Update UI based on action
    switch (data.action) {
      case 'created':
        addWatchListToUI(data);
        showNotification(`Created watch list: ${data.name}`, 'success');
        break;
      case 'updated':
        updateWatchListInUI(data);
        showNotification(`Updated watch list: ${data.name}`, 'success');
        break;
      case 'deleted':
        removeWatchListFromUI(data.watchListId);
        showNotification(`Deleted watch list: ${data.name}`, 'info');
        break;
    }
  });

  // Listen for product added to watch list
  socket.on('watchlist:product_added', (data) => {
    console.log('Product added to watch list:', {
      watchListId: data.watchListId,
      product: data.product,
    });

    // Update watch list UI
    addProductToWatchListUI(data.watchListId, data.product);
    showNotification(`Added ${data.product.name} to watch list`, 'success');
  });

  // Listen for product removed from watch list
  socket.on('watchlist:product_removed', (data) => {
    console.log('Product removed from watch list:', {
      watchListId: data.watchListId,
      productId: data.productId,
    });

    // Update watch list UI
    removeProductFromWatchListUI(data.watchListId, data.productId);
  });
}

// Unsubscribe when component unmounts
function unsubscribeFromWatchLists() {
  socket.emit('unsubscribe:watchlists');

  socket.on('watchlist:unsubscribed', () => {
    console.log('Unsubscribed from watch lists');
  });
}
```

## Notification Events

### Subscribe to Notifications

```typescript
function subscribeToNotifications() {
  // Subscribe to notifications
  socket.emit('notification:subscribe');

  // Listen for subscription confirmation with current counts
  socket.on('notification:subscribed', (data) => {
    console.log('Subscribed to notifications:', {
      unreadCount: data.unreadCount,
      totalCount: data.totalCount,
    });

    // Update notification badge
    updateNotificationBadge(data.unreadCount);
  });

  // Listen for new notifications
  socket.on('notification:new', (data) => {
    console.log('New notification:', data.notification);

    // Show notification to user
    showNotification(data.notification.title, data.notification.priority);

    // Update notification list
    addNotificationToList(data.notification);

    // Update unread badge
    updateNotificationBadge(data.unreadCount);

    // Play sound for high priority
    if (data.notification.priority === 'high') {
      playNotificationSound();
    }
  });

  // Listen for notification marked as read
  socket.on('notification:read', (data) => {
    console.log('Notification marked as read:', data.notificationId);

    // Update UI
    markNotificationAsReadInUI(data.notificationId);
    updateNotificationBadge(data.unreadCount);
  });

  // Listen for unread count updates (e.g., after bulk mark as read)
  socket.on('notification:count_updated', (data) => {
    console.log('Unread count updated:', data.unreadCount);
    updateNotificationBadge(data.unreadCount);
  });
}

// Mark notification as read
function markNotificationAsRead(notificationId: number) {
  socket.emit('notification:mark-read', { notificationId });
}
```

## Price Update Events

### Subscribe to Price Updates

```typescript
function subscribeToPriceUpdates(productIds: number[]) {
  // Subscribe to price updates for specific products
  socket.emit('price:subscribe', { productIds });

  // Listen for subscription confirmation
  socket.on('price:subscribed', (data) => {
    console.log('Subscribed to price updates for', data.productIds.length, 'products');
  });

  // Listen for price updates
  socket.on('price:updated', (data) => {
    console.log('Price updated:', {
      productId: data.productId,
      productName: data.productName,
      oldPrice: data.oldPrice,
      newPrice: data.newPrice,
      change: data.percentageChange,
    });

    // Update product price in UI
    updateProductPrice(data.productId, data.newPrice);

    // Show notification if significant change
    if (Math.abs(data.percentageChange) >= 5) {
      const changeText = data.percentageChange > 0 ? 'increased' : 'decreased';
      showNotification(
        `${data.productName} price ${changeText} by ${Math.abs(data.percentageChange).toFixed(1)}%`,
        'info'
      );
    }

    // Animate price change
    animatePriceChange(data.productId, data.percentageChange);
  });

  // Listen for price alerts (high priority)
  socket.on('price:alert', (data) => {
    console.log('Price alert triggered:', {
      alertId: data.alertId,
      productName: data.productName,
      currentPrice: data.currentPrice,
      targetPrice: data.targetPrice,
      savings: data.savings,
    });

    // Show prominent alert to user
    showPriceAlert({
      title: `Price Alert: ${data.productName}`,
      message: `Price dropped to $${data.currentPrice} (save $${data.savings.toFixed(2)})!`,
      url: data.retailerUrl,
      priority: 'high',
    });

    // Play alert sound
    playAlertSound();
  });
}

// Unsubscribe from price updates
function unsubscribeFromPriceUpdates(productIds: number[]) {
  socket.emit('price:unsubscribe', { productIds });

  socket.on('price:unsubscribed', (data) => {
    console.log('Unsubscribed from price updates for', data.productIds.length, 'products');
  });
}
```

## React Hook Example

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Create socket connection
    const newSocket = io('http://localhost:5000/ws', {
      withCredentials: true,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('authenticated', () => {
      // Subscribe to all events after authentication
      newSocket.emit('subscribe:watchlists');
      newSocket.emit('notification:subscribe');
    });

    // Notification events
    newSocket.on('notification:new', (data) => {
      setNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount(data.unreadCount);
    });

    newSocket.on('notification:read', (data) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === data.notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(data.unreadCount);
    });

    newSocket.on('notification:subscribed', (data) => {
      setUnreadCount(data.unreadCount);
    });

    // Watch list events
    newSocket.on('watchlist:update', (data) => {
      console.log('Watch list event:', data.action);
      // Trigger React Query refetch
      queryClient.invalidateQueries(['watchlists']);
    });

    newSocket.on('watchlist:product_added', (data) => {
      console.log('Product added to watch list');
      queryClient.invalidateQueries(['watchlist', data.watchListId]);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  // Helper function to mark notification as read
  const markAsRead = (notificationId: number) => {
    socket?.emit('notification:mark-read', { notificationId });
  };

  // Helper function to subscribe to price updates
  const subscribeToPrices = (productIds: number[]) => {
    socket?.emit('price:subscribe', { productIds });
  };

  return {
    socket,
    connected,
    notifications,
    unreadCount,
    markAsRead,
    subscribeToPrices,
  };
}

// Usage in component
function MyComponent() {
  const { connected, notifications, unreadCount, markAsRead } = useWebSocket();

  return (
    <div>
      <div>Connection: {connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
      <div>Unread notifications: {unreadCount}</div>
      <ul>
        {notifications.map((notification) => (
          <li key={notification.id} onClick={() => markAsRead(notification.id)}>
            {notification.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Error Handling

```typescript
socket.on('error', (error) => {
  // Handle different error codes
  switch (error.code) {
    case 'UNAUTHORIZED':
      showNotification('You do not have permission', 'error');
      break;
    case 'NOT_FOUND':
      showNotification('Resource not found', 'error');
      break;
    case 'LIMIT_EXCEEDED':
      showNotification('Rate limit exceeded. Please slow down', 'warning');
      break;
    case 'INVALID_INPUT':
      showNotification('Invalid request data', 'error');
      break;
    default:
      showNotification(error.message, 'error');
  }
});
```

## Reconnection Handling

```typescript
// Socket.io handles reconnection automatically, but you can customize:
const socket = io('http://localhost:5000/ws', {
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.io.on('reconnect_attempt', () => {
  console.log('Attempting to reconnect...');
  showNotification('Reconnecting...', 'info');
});

socket.io.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  showNotification('Reconnected!', 'success');

  // Resubscribe to events
  socket.emit('subscribe:watchlists');
  socket.emit('notification:subscribe');
});

socket.io.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
  showNotification('Connection lost. Please refresh the page', 'error');
});
```

## Testing

```typescript
// Test WebSocket events in Playwright
test('should receive real-time watch list updates', async ({ page, browser }) => {
  // Login and connect WebSocket
  await page.goto('/');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // Wait for WebSocket connection
  await page.waitForFunction(() => window.socketConnected);

  // Create a second tab (simulating multi-device)
  const context = browser.contexts()[0];
  const page2 = await context.newPage();
  await page2.goto('/watch-lists');

  // Create watch list on page 1
  await page.goto('/watch-lists');
  await page.click('button:has-text("New Watch List")');
  await page.fill('[name=name]', 'Test List');
  await page.click('button:has-text("Create")');

  // Verify page 2 receives update via WebSocket
  await expect(page2.locator('text=Test List')).toBeVisible({ timeout: 5000 });
});
```

## Best Practices

1. **Always authenticate before subscribing** to events
2. **Unsubscribe when component unmounts** to prevent memory leaks
3. **Handle errors gracefully** with user-friendly messages
4. **Implement reconnection logic** for poor network conditions
5. **Rate limit client requests** to avoid hitting server limits
6. **Use TypeScript types** for type-safe event handling
7. **Test with multiple clients** to ensure proper room isolation
8. **Monitor connection status** and show to user
9. **Buffer events during disconnection** if needed
10. **Log events for debugging** but sanitize sensitive data
