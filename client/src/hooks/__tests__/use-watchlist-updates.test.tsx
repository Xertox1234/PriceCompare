/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- Test mocks require flexible typing */
/**
 * useWatchListUpdates Hook Tests
 *
 * Tests real-time watch list update handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useWatchListUpdates } from '../use-watchlist-updates';
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

describe('useWatchListUpdates', () => {
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

  it('should subscribe to watch list events when connected', () => {
    renderHook(() => useWatchListUpdates(), { wrapper });

    expect(websocketClient.emit).toHaveBeenCalledWith('subscribe:watchlists');
    expect(websocketClient.on).toHaveBeenCalledWith('watchlist:update', expect.any(Function));
    expect(websocketClient.on).toHaveBeenCalledWith('watchlist:product_added', expect.any(Function));
    expect(websocketClient.on).toHaveBeenCalledWith('watchlist:product_removed', expect.any(Function));
  });

  it('should not subscribe when disconnected', async () => {
    const { useWebSocket } = await import('../use-websocket');
    // Mock needs to be set before rendering
    vi.mocked(useWebSocket).mockReturnValueOnce({
      isConnected: false,
      connectionState: 'disconnected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    expect(websocketClient.emit).not.toHaveBeenCalled();
  });

  it('should invalidate queries on watch list update', async () => {
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let updateHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:update') {
        updateHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    // Simulate watch list update event
    if (updateHandler) {
      updateHandler({
        watchListId: 1,
        name: 'My List',
        action: 'created',
        productCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
    });
  });

  it('should show toast on watch list created', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let updateHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:update') {
        updateHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    if (updateHandler) {
      updateHandler({
        watchListId: 1,
        name: 'New List',
        action: 'created',
        productCount: 0,
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Watch list created',
        description: '"New List" has been created',
      });
    });
  });

  it('should show toast on watch list updated', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let updateHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:update') {
        updateHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    if (updateHandler) {
      updateHandler({
        watchListId: 1,
        name: 'Updated List',
        action: 'updated',
        productCount: 5,
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Watch list updated',
        description: '"Updated List" has been updated',
      });
    });
  });

  it('should show destructive toast on watch list deleted', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let updateHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:update') {
        updateHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    if (updateHandler) {
      updateHandler({
        watchListId: 1,
        name: 'Deleted List',
        action: 'deleted',
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Watch list deleted',
        description: '"Deleted List" has been deleted',
        variant: 'destructive',
      });
    });
  });

  it('should handle product added event', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let productAddedHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:product_added') {
        productAddedHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    if (productAddedHandler) {
      productAddedHandler({
        watchListId: 1,
        product: {
          id: 123,
          name: 'iPhone 15',
          image: 'https://example.com/iphone.jpg',
          currentPrice: 999.99,
        },
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Product added',
        description: 'iPhone 15 added to watch list',
      });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
    });
  });

  it('should handle product removed event without toast', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handler for test simulation
    let productRemovedHandler: any = null;
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      if (event === 'watchlist:product_removed') {
        productRemovedHandler = handler;
      }
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    if (productRemovedHandler) {
      productRemovedHandler({
        watchListId: 1,
        productId: 123,
        timestamp: new Date().toISOString(),
      });
    }

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['/api/watchlists/1'] });
    });

    // Should NOT show toast for removals
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() => useWatchListUpdates(), { wrapper });

    unmount();

    expect(websocketClient.off).toHaveBeenCalledWith('watchlist:update', expect.any(Function));
    expect(websocketClient.off).toHaveBeenCalledWith('watchlist:product_added', expect.any(Function));
    expect(websocketClient.off).toHaveBeenCalledWith('watchlist:product_removed', expect.any(Function));
    expect(websocketClient.emit).toHaveBeenCalledWith('unsubscribe:watchlists');
  });

  it('should resubscribe when connection state changes', async () => {
    const { useWebSocket } = await import('../use-websocket');
    const mockUseWebSocket = vi.mocked(useWebSocket);

    // Start disconnected
    mockUseWebSocket.mockReturnValueOnce({
      isConnected: false,
      connectionState: 'disconnected',
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    const { rerender } = renderHook(() => useWatchListUpdates(), { wrapper });

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

    expect(websocketClient.emit).toHaveBeenCalledWith('subscribe:watchlists');
  });

  it('should handle multiple events in sequence', async () => {
    const { useToast } = await import('../use-toast');
    const mockToast = vi.fn();
    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
      dismiss: vi.fn(),
      toasts: []
    });

    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Capturing WebSocket event handlers for test simulation
    const handlers: Record<string, any> = {};
    vi.mocked(websocketClient.on).mockImplementation((event, handler) => {
      handlers[event] = handler;
    });

    renderHook(() => useWatchListUpdates(), { wrapper });

    // Simulate multiple events
    handlers['watchlist:update']({
      watchListId: 1,
      name: 'List 1',
      action: 'created',
      productCount: 0,
      timestamp: new Date().toISOString(),
    });

    handlers['watchlist:product_added']({
      watchListId: 1,
      product: { id: 1, name: 'Product 1', currentPrice: 10 },
      timestamp: new Date().toISOString(),
    });

    handlers['watchlist:product_removed']({
      watchListId: 1,
      productId: 1,
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledTimes(2); // created + product_added
      expect(invalidateQueries).toHaveBeenCalled();
    });
  });
});
