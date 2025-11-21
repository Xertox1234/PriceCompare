/**
 * ConnectionStatus Component
 *
 * Visual indicator for WebSocket connection status.
 * Only shown when connection is not established (connecting, reconnecting, disconnected).
 * Hidden when successfully connected to avoid UI clutter.
 *
 * Usage:
 * ```tsx
 * <ConnectionStatus /> // Add to App.tsx or root layout
 * ```
 */

import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/use-websocket';

export function ConnectionStatus() {
  const { connectionState, isConnected } = useWebSocket();

  // Hide when connected - no need to show success state
  if (connectionState === 'connected') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm',
          'transition-all duration-300',
          connectionState === 'connecting' && 'bg-yellow-500/90 text-white',
          connectionState === 'reconnecting' && 'bg-orange-500/90 text-white',
          connectionState === 'disconnected' && 'bg-red-500/90 text-white'
        )}
      >
        {/* Icon based on connection state */}
        {connectionState === 'connecting' && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {connectionState === 'reconnecting' && (
          <RefreshCw className="h-4 w-4 animate-spin" />
        )}
        {connectionState === 'disconnected' && (
          <WifiOff className="h-4 w-4" />
        )}

        {/* Status text */}
        <span className="text-sm font-medium">
          {connectionState === 'connecting' && 'Connecting to live updates...'}
          {connectionState === 'reconnecting' && 'Reconnecting...'}
          {connectionState === 'disconnected' && 'Connection lost'}
        </span>
      </div>
    </div>
  );
}
