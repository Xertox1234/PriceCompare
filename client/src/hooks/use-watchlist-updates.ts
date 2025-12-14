/**
 * useWatchListUpdates Hook
 *
 * Subscribes to real-time watch list updates via WebSocket.
 * Automatically invalidates React Query cache and shows toast notifications.
 *
 * Usage:
 * ```tsx
 * function WatchListPage() {
 *   useWatchListUpdates(); // Just call it, it handles everything
 *
 *   return <WatchListComponent />;
 * }
 * ```
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { websocketClient } from '@/lib/websocket-client';
import { useToast } from './use-toast';
import { useWebSocket } from './use-websocket';

export function useWatchListUpdates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isConnected } = useWebSocket();

  useEffect(() => {
    // Only subscribe if WebSocket is connected
    if (!isConnected) {
      return;
    }

    // Subscribe to watch list updates
    websocketClient.emit('subscribe:watchlists');

    // Handle watch list created/updated/deleted
    const handleWatchListUpdate = (data: {
      watchListId: number;
      name: string;
      action: 'created' | 'updated' | 'deleted' | 'product_added' | 'product_removed';
      productCount?: number;
      timestamp: string;
    }) => {
      // NOTE: For 'created' action, the mutation already calls refetchQueries()
      // so we skip invalidating the list to avoid race conditions.
      // For other actions (updated/deleted from other clients), invalidate the list.
      if (data.action !== 'created') {
        void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      }
      // Always invalidate the specific watchlist query
      void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.watchListId}`] });

      // Show toast notification based on action
      switch (data.action) {
        case 'created':
          toast({
            title: 'Watch list created',
            description: `"${data.name}" has been created`,
          });
          break;
        case 'updated':
          toast({
            title: 'Watch list updated',
            description: `"${data.name}" has been updated`,
          });
          break;
        case 'deleted':
          toast({
            title: 'Watch list deleted',
            description: `"${data.name}" has been deleted`,
            variant: 'destructive',
          });
          break;
      }
    };

    // Handle product added to watch list
    const handleProductAdded = (data: {
      watchListId: number;
      product: {
        id: number;
        name: string;
        image?: string | null;
        currentPrice?: number | null;
      };
      timestamp: string;
    }) => {
      // Invalidate queries (fire-and-forget)
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.watchListId}`] });

      // Show toast
      toast({
        title: 'Product added',
        description: `${data.product.name} added to watch list`,
      });
    };

    // Handle product removed from watch list
    const handleProductRemoved = (data: {
      watchListId: number;
      productId: number;
      timestamp: string;
    }) => {
      // Invalidate queries (fire-and-forget)
      void queryClient.invalidateQueries({ queryKey: ['/api/watchlists'] });
      void queryClient.invalidateQueries({ queryKey: [`/api/watchlists/${data.watchListId}`] });

      // Don't show toast for removals - less intrusive
    };

    // Subscribe to events
    websocketClient.on('watchlist:update', handleWatchListUpdate);
    websocketClient.on('watchlist:product_added', handleProductAdded);
    websocketClient.on('watchlist:product_removed', handleProductRemoved);

    // Cleanup: unsubscribe from events
    return () => {
      websocketClient.off('watchlist:update', handleWatchListUpdate);
      websocketClient.off('watchlist:product_added', handleProductAdded);
      websocketClient.off('watchlist:product_removed', handleProductRemoved);
      websocketClient.emit('unsubscribe:watchlists');
    };
  }, [isConnected, queryClient, toast]);
}
