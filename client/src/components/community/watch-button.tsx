import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useIsWatching,
  useWatchCount,
  useAddProductWatch,
  useRemoveProductWatch,
} from '@/hooks/use-community';
import { Eye, EyeOff, Users } from 'lucide-react';
import { useUser } from '@/hooks/use-user';

interface WatchButtonProps {
  productId: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  showCount?: boolean;
  className?: string;
}

export function WatchButton({
  productId,
  variant = 'outline',
  size = 'default',
  showCount = true,
  className = '',
}: WatchButtonProps) {
  const { user } = useUser();
  const { data: isWatchingData, isLoading: isWatchingLoading } = useIsWatching(productId);
  const { data: watchCountData, isLoading: countLoading } = useWatchCount(productId);
  const addWatch = useAddProductWatch();
  const removeWatch = useRemoveProductWatch();
  const { toast } = useToast();

  const isWatching = isWatchingData?.data || false;
  const watchCount = watchCountData?.data || 0;
  const isLoading = isWatchingLoading || countLoading;

  const handleToggleWatch = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to watch products',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isWatching) {
        await removeWatch.mutateAsync(productId);
        toast({
          title: 'Removed from watch list',
          description: "You'll no longer receive alerts for this product",
        });
      } else {
        await addWatch.mutateAsync(productId);
        toast({
          title: 'Added to watch list',
          description: "You'll be notified when the price drops",
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update watch list',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-32" />;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant={isWatching ? 'default' : variant}
        size={size}
        onClick={() => void handleToggleWatch()}
        disabled={addWatch.isPending || removeWatch.isPending}
        className="flex items-center gap-2"
      >
        {isWatching ? (
          <>
            <Eye className="w-4 h-4" />
            Watching
          </>
        ) : (
          <>
            <EyeOff className="w-4 h-4" />
            Watch
          </>
        )}
      </Button>

      {showCount && watchCount > 0 && (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {watchCount} {watchCount === 1 ? 'watcher' : 'watchers'}
        </Badge>
      )}
    </div>
  );
}
