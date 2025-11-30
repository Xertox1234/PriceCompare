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

export function WatchListCard({ watchList, compact = false, showActions = false }: WatchListCardProps) {
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
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {watchList.color && (
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: watchList.color }}
            />
          )}
          {watchList.icon && <span className="text-base shrink-0">{watchList.icon}</span>}
          <span className="truncate font-medium">{watchList.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit List
          </DropdownMenuItem>
          {!watchList.isDefault && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
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
              <AlertCircle className="w-5 h-5 text-destructive" />
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
