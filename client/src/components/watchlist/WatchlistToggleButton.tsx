import { useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useIsWatching, useAddProductWatch, useRemoveProductWatch } from '@/hooks/use-community';
import { AuthModal } from '@/components/auth/auth-modal';
import { useToast } from '@/hooks/use-toast';

interface WatchlistToggleButtonProps {
  productId: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showText?: boolean; // Show "Add to Watchlist" / "Remove from Watchlist" text
}

/**
 * Unified watchlist toggle button component
 *
 * Features:
 * - Authentication guard (shows login modal if not authenticated)
 * - Toggle behavior (add/remove from watchlist)
 * - Optimistic updates for instant feedback
 * - Loading states during API calls
 * - Toast notifications for success/error
 * - Visual state changes (outline → filled)
 *
 * @remarks
 * This component consolidates the "Add to Watchlist" and "Remove from Watchlist"
 * functionality into a single, reusable component. It handles authentication,
 * state management, and user feedback automatically.
 *
 * **Authentication Flow**:
 * 1. If user is not authenticated → Show login modal on click
 * 2. If user is authenticated → Toggle watchlist status
 *
 * **Visual States**:
 * - Not in watchlist: Outline button + BookmarkIcon
 * - In watchlist: Filled button + BookmarkCheck icon
 * - Loading: Spinner icon
 * - Disabled: Grayed out (during mutation)
 *
 * @example
 * ```tsx
 * // On product cards (compact icon-only)
 * <WatchlistToggleButton
 *   productId={product.id}
 *   variant="outline"
 *   size="sm"
 *   showText={false}
 * />
 *
 * // On product detail page (full text button)
 * <WatchlistToggleButton
 *   productId={product.id}
 *   variant="default"
 *   size="default"
 *   showText={true}
 * />
 * ```
 */
export function WatchlistToggleButton({
  productId,
  variant = 'outline',
  size = 'default',
  className,
  showText = true,
}: WatchlistToggleButtonProps) {
  const { data: user, isLoading: isAuthLoading } = useAuth();
  const { data: isWatchingResponse, isLoading: isWatchingLoading } = useIsWatching(productId);
  const addWatch = useAddProductWatch();
  const removeWatch = useRemoveProductWatch();
  const { toast } = useToast();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Extract boolean from API response
  const isWatching = isWatchingResponse?.data ?? false;

  // Loading state during data fetch or mutation
  const isLoading = isAuthLoading || isWatchingLoading || addWatch.isPending || removeWatch.isPending;

  const handleClick = () => {
    // AUTH GUARD: Require authentication before action
    if (!user) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }

    // TOGGLE: Add or remove from watchlist
    const performToggle = async () => {
      try {
        if (isWatching) {
          // Remove from watchlist
          await removeWatch.mutateAsync(productId);
          toast({
            title: 'Removed from watchlist',
            description: 'Product has been removed from your watchlist.',
          });
        } else {
          // Add to watchlist
          await addWatch.mutateAsync(productId);
          toast({
            title: 'Added to watchlist',
            description: 'Product has been added to your watchlist.',
          });
        }
      } catch (error) {
        // Error handling with user feedback
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to update watchlist',
          variant: 'destructive',
        });
      }
    };

    void performToggle();
  };

  // Determine button variant based on state
  const buttonVariant = isWatching ? 'default' : variant;

  // Button icon based on state
  const ButtonIcon = isLoading ? Loader2 : isWatching ? BookmarkCheck : Bookmark;

  return (
    <>
      <Button
        variant={buttonVariant}
        size={size}
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          // Smooth transitions
          'transition-all duration-200',
          // Filled state styling
          isWatching && 'bg-primary text-primary-foreground hover:bg-primary/90',
          // Custom className override
          className
        )}
        data-testid="add-to-watchlist"
        aria-label={isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
      >
        <ButtonIcon
          className={cn(
            'h-4 w-4',
            isLoading && 'animate-spin'
          )}
        />
        {showText && (
          <span>
            {isLoading
              ? 'Loading...'
              : isWatching
                ? 'Remove from Watchlist'
                : 'Add to Watchlist'}
          </span>
        )}
      </Button>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode={authMode}
      />
    </>
  );
}
