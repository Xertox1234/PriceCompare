import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDeleteWatchList, type WatchListWithStats } from '@/hooks/use-community';
import { MoreVertical, Edit, Trash2, AlertCircle } from 'lucide-react';
import { EditWatchListDialog } from './edit-watch-list-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WatchListCardProps {
  watchList: WatchListWithStats;
  compact?: boolean;
  showActions?: boolean;
}

export function WatchListCard({
  watchList,
  compact = false,
  showActions = false,
}: WatchListCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteList = useDeleteWatchList();
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await deleteList.mutateAsync(watchList.id);
      toast({
        title: 'Watch list deleted',
        description: `"${watchList.name}" has been removed`,
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete watch list',
        variant: 'destructive',
      });
    }
  };

  if (compact) {
    return (
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {watchList.color && (
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: watchList.color }}
            />
          )}
          {watchList.icon && <span className="shrink-0 text-base">{watchList.icon}</span>}
          <span className="truncate font-medium">{watchList.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {watchList.watchCount}
          </Badge>
          {watchList.highPriorityCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {watchList.highPriorityCount}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  if (!showActions) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit List
          </DropdownMenuItem>
          {!watchList.isDefault && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete List
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EditWatchListDialog
        watchList={watchList}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-destructive h-5 w-5" />
              Delete Watch List
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{watchList.name}"? This will remove the list but keep
              your product watches. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
