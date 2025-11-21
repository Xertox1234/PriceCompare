/**
 * useWebSocket Hook Tests
 *
 * Tests the core WebSocket connection management hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWebSocket } from '../use-websocket';
import { websocketClient } from '@/lib/websocket-client';
import type { ConnectionState } from '@/lib/websocket-client';

// Mock dependencies
vi.mock('@/lib/websocket-client', () => ({
  websocketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getState: vi.fn(() => 'disconnected' as ConnectionState),
    onStateChange: vi.fn((callback) => {
      // Immediately call with current state
      callback('disconnected' as ConnectionState);
      // Return unsubscribe function
      return vi.fn();
    }),
  },
}));

vi.mock('../use-user', () => ({
  useUser: vi.fn(() => ({
    user: null,
    isLoading: false,
  })),
}));

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);
  });

  it('should connect when user is authenticated', async () => {
    const { useUser } = await import('../use-user');

    // Mock authenticated user
    vi.mocked(useUser).mockReturnValue({
      user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' } as any,
      isLoading: false,
    });

    renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(websocketClient.connect).toHaveBeenCalled();
    });
  });

  it('should disconnect when user logs out', async () => {
    const { useUser } = await import('../use-user');

    // Start with authenticated user
    const mockUseUser = vi.mocked(useUser);
    mockUseUser.mockReturnValue({
      user: { id: 1, username: 'testuser', email: 'test@example.com', role: 'user' } as any,
      isLoading: false,
    });

    const { rerender } = renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(websocketClient.connect).toHaveBeenCalled();
    });

    // Simulate logout
    mockUseUser.mockReturnValue({
      user: null,
      isLoading: false,
    });

    rerender();

    await waitFor(() => {
      expect(websocketClient.disconnect).toHaveBeenCalled();
    });
  });

  it('should not connect when user is not authenticated', () => {
    renderHook(() => useWebSocket());

    expect(websocketClient.connect).not.toHaveBeenCalled();
  });

  it('should update connection state when WebSocket state changes', async () => {
    let stateCallback: ((state: ConnectionState) => void) | null = null;

    vi.mocked(websocketClient.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      callback('disconnected');
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.isConnected).toBe(false);

    // Simulate state change to connected
    if (stateCallback) {
      stateCallback('connected');
    }

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should transition through reconnecting state', async () => {
    let stateCallback: ((state: ConnectionState) => void) | null = null;

    vi.mocked(websocketClient.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      callback('disconnected');
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    // Simulate reconnecting
    if (stateCallback) {
      stateCallback('reconnecting');
    }

    await waitFor(() => {
      expect(result.current.connectionState).toBe('reconnecting');
      expect(result.current.isConnected).toBe(false);
    });

    // Then connected
    if (stateCallback) {
      stateCallback('connected');
    }

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should provide connect and disconnect functions', () => {
    const { result } = renderHook(() => useWebSocket());

    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');

    // Call the functions
    result.current.connect();
    expect(websocketClient.connect).toHaveBeenCalled();

    result.current.disconnect();
    expect(websocketClient.disconnect).toHaveBeenCalled();
  });

  it('should cleanup subscription on unmount', () => {
    const unsubscribe = vi.fn();

    vi.mocked(websocketClient.onStateChange).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useWebSocket());

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should reconnect when user changes', async () => {
    const { useUser } = await import('../use-user');
    const mockUseUser = vi.mocked(useUser);

    // Start with user A
    mockUseUser.mockReturnValue({
      user: { id: 1, username: 'user1', email: 'user1@example.com', role: 'user' } as any,
      isLoading: false,
    });

    const { rerender } = renderHook(() => useWebSocket());

    await waitFor(() => {
      expect(websocketClient.connect).toHaveBeenCalledTimes(1);
    });

    // Change to user B (both are truthy, so it just connects again)
    mockUseUser.mockReturnValue({
      user: { id: 2, username: 'user2', email: 'user2@example.com', role: 'user' } as any,
      isLoading: false,
    });

    rerender();

    await waitFor(() => {
      // Should connect again (useEffect runs on user change)
      // Note: Disconnect not called because user was still truthy
      expect(websocketClient.connect).toHaveBeenCalledTimes(2);
    });
  });

  it('should handle loading state during authentication', async () => {
    const { useUser } = await import('../use-user');

    vi.mocked(useUser).mockReturnValue({
      user: null,
      isLoading: true,
    });

    renderHook(() => useWebSocket());

    // Should not connect while loading
    expect(websocketClient.connect).not.toHaveBeenCalled();
  });

  it('should be isConnected=false for non-connected states', async () => {
    const states: ConnectionState[] = ['disconnected', 'connecting', 'reconnecting'];
    let stateCallback: ((state: ConnectionState) => void) | null = null;

    vi.mocked(websocketClient.onStateChange).mockImplementation((callback) => {
      stateCallback = callback;
      callback('disconnected');
      return vi.fn();
    });

    const { result } = renderHook(() => useWebSocket());

    for (const state of states) {
      if (stateCallback) {
        stateCallback(state);
      }

      await waitFor(() => {
        expect(result.current.connectionState).toBe(state);
        expect(result.current.isConnected).toBe(false);
      });
    }

    // Only 'connected' should be true
    if (stateCallback) {
      stateCallback('connected');
    }

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });
});
