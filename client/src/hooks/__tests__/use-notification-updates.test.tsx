/**
 * useNotificationUpdates Hook Tests
 *
 * Tests real-time notification handling and unread count tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNotificationUpdates } from '../use-notification-updates';
import { websocketClient } from '@/lib/websocket-client';

// Mock dependencies
vi.mock('@/lib/websocket-client', () => ({
  websocketClient: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));

vi.mock('../use-websocket', () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
    connectionState: 'connected',
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('../use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

describe('useNotificationUpdates', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.resetAllMocks();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should subscribe to notifications when connected', () => {
    renderHook(() => useNotificationUpdates(), { wrapper });

    expect(websocketClient.emit).toHaveBeenCalledWith('notification:subscribe');
    expect(websocketClient.on).toHaveBeenCalledWith('notification:subscribed', expect.any(Function));
    expect(websocketClient.on).toHaveBeenCalledWith('notification:new', expect.any(Function));
    expect(websocketClient.on).toHaveBeenCalledWith('notification:read', expect.any(Function));
    expect(websocketClient.on).toHaveBeenCalledWith('notification:count_updated', expect.any(Function));
  });

  it('should not subscribe when disconnected', async () => {
    const { useWebSocket } = await import('../use-websocket');
    vi.mocked(useWebSocket).mockReturnValueOnce({
      isConnected: false,
      connectionState: 'disconnected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    renderHook(() => useNotificationUpdates(), { wrapper });

    expect(websocketClient.emit).not.toHaveBeenCalled();
  });

  it('should initialize unread count from subscription confirmation', async () => {
    let subscribedHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:subscribed') {
        subscribedHandler = handler;
      }
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    // Simulate subscription confirmation
    if (subscribedHandler) {
      subscribedHandler({
        timestamp: new Date().toISOString(),
        unreadCount: 7,
        totalCount: 20,
      });
    }

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(7);
    });
  });

  it('should update unread count on new notification', async () => {
    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    // Simulate new notification
    if (newNotificationHandler) {
      newNotificationHandler({
        notification: {
          id: 1,
          type: 'system',
          title: 'System Update',
          content: 'New features available',
          priority: 'medium',
          read: false,
          timestamp: new Date().toISOString(),
        },
        unreadCount: 3,
      });
    }

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('should show toast for high priority notifications', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });

    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    renderHook(() => useNotificationUpdates(), { wrapper });

    if (newNotificationHandler) {
      newNotificationHandler({
        notification: {
          id: 1,
          type: 'system',
          title: 'Urgent Alert',
          content: 'Action required immediately',
          priority: 'high',
          read: false,
          timestamp: new Date().toISOString(),
        },
        unreadCount: 1,
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Urgent Alert',
        description: 'Action required immediately',
        variant: 'destructive',
      });
    });
  });

  it('should not show toast for low priority notifications', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });

    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    renderHook(() => useNotificationUpdates(), { wrapper });

    if (newNotificationHandler) {
      newNotificationHandler({
        notification: {
          id: 1,
          type: 'system',
          title: 'Info',
          content: 'General information',
          priority: 'low',
          read: false,
          timestamp: new Date().toISOString(),
        },
        unreadCount: 1,
      });
    }

    await waitFor(() => {
      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  it('should show custom toast for price alerts', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });

    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    renderHook(() => useNotificationUpdates(), { wrapper });

    if (newNotificationHandler) {
      newNotificationHandler({
        notification: {
          id: 1,
          type: 'price_alert',
          title: 'Price Drop',
          content: 'iPhone 15 is now $899',
          priority: 'medium',
          read: false,
          timestamp: new Date().toISOString(),
        },
        unreadCount: 1,
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: '💰 Price Alert!',
        description: 'iPhone 15 is now $899',
      });
    });
  });

  it('should update count when notification is marked as read', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    let readHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:read') {
        readHandler = handler;
      }
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    if (readHandler) {
      readHandler({
        notificationId: 1,
        unreadCount: 2,
      });
    }

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/notifications'] });
    });
  });

  it('should handle count update events', async () => {
    let countHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:count_updated') {
        countHandler = handler;
      }
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    if (countHandler) {
      countHandler({
        unreadCount: 10,
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(10);
    });
  });

  it('should invalidate queries on new notification', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    renderHook(() => useNotificationUpdates(), { wrapper });

    if (newNotificationHandler) {
      newNotificationHandler({
        notification: {
          id: 1,
          type: 'system',
          title: 'Test',
          content: 'Test notification',
          priority: 'low',
          read: false,
          timestamp: new Date().toISOString(),
        },
        unreadCount: 1,
      });
    }

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/notifications'] });
    });
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useNotificationUpdates(), { wrapper });

    unmount();

    expect(websocketClient.off).toHaveBeenCalledWith('notification:subscribed', expect.any(Function));
    expect(websocketClient.off).toHaveBeenCalledWith('notification:new', expect.any(Function));
    expect(websocketClient.off).toHaveBeenCalledWith('notification:read', expect.any(Function));
    expect(websocketClient.off).toHaveBeenCalledWith('notification:count_updated', expect.any(Function));
    expect(websocketClient.emit).toHaveBeenCalledWith('notification:unsubscribe');
  });

  it('should track unread count through multiple events', async () => {
    const handlers: Record<string, any> = {};
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      handlers[event] = handler;
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    // Start with subscription confirmation
    handlers['notification:subscribed']({
      timestamp: new Date().toISOString(),
      unreadCount: 5,
      totalCount: 10,
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // New notification
    handlers['notification:new']({
      notification: {
        id: 1,
        type: 'system',
        title: 'New',
        content: 'New notification',
        priority: 'low',
        read: false,
        timestamp: new Date().toISOString(),
      },
      unreadCount: 6,
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(6);
    });

    // Mark as read
    handlers['notification:read']({
      notificationId: 1,
      unreadCount: 5,
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5);
    });

    // Count update
    handlers['notification:count_updated']({
      unreadCount: 3,
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });
  });

  it('should handle concurrent notifications', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });

    let newNotificationHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        newNotificationHandler = handler;
      }
    });

    const { result } = renderHook(() => useNotificationUpdates(), { wrapper });

    // Send multiple notifications
    const notifications = [
      { id: 1, priority: 'high', unreadCount: 1 },
      { id: 2, priority: 'high', unreadCount: 2 },
      { id: 3, priority: 'low', unreadCount: 3 },
    ];

    for (const notif of notifications) {
      if (newNotificationHandler) {
        newNotificationHandler({
          notification: {
            id: notif.id,
            type: 'system',
            title: `Notification ${notif.id}`,
            content: `Content ${notif.id}`,
            priority: notif.priority,
            read: false,
            timestamp: new Date().toISOString(),
          },
          unreadCount: notif.unreadCount,
        });
      }
    }

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
      // Only high priority notifications show toast
      expect(mockToast).toHaveBeenCalledTimes(2);
    });
  });

  it('should resubscribe when reconnecting', async () => {
    const { useWebSocket } = await import('../use-websocket');
    const mockUseWebSocket = vi.mocked(useWebSocket);

    // Start disconnected
    mockUseWebSocket.mockReturnValueOnce({
      isConnected: false,
      connectionState: 'disconnected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const { rerender } = renderHook(() => useNotificationUpdates(), { wrapper });

    expect(websocketClient.emit).not.toHaveBeenCalled();

    // Clear mocks and set reconnected state
    vi.clearAllMocks();
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionState: 'connected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    rerender();

    expect(websocketClient.emit).toHaveBeenCalledWith('notification:subscribe');
  });
});
