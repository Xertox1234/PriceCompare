import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import { useMoveProductsToWatchList, type WatchListWithStats } from '@/hooks/use-community';
import { Check, Trash2, FolderInput, X, AlertCircle } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onMove: (targetListId: number) => void;
  watchLists: WatchListWithStats[];
  currentListId: number;
}

export function BulkActionToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onMove,
  watchLists,
  currentListId,
}: BulkActionToolbarProps) {
  const [targetListId, setTargetListId] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const moveProducts = useMoveProductsToWatchList();
  const { toast } = useToast();

  const allSelected = selectedCount === totalCount;
  const availableLists = watchLists.filter(list => list.id !== currentListId);

  const handleMove = async () => {
    if (!targetListId) return;

    try {
      await moveProducts.mutateAsync({
        productWatchIds: [], // This will be passed from parent
        targetListId: parseInt(targetListId),
      });
      toast({
        title: 'Products moved',
        description: `${selectedCount} product(s) moved successfully`,
      });
      setTargetListId('');
      onClearSelection();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to move products',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = () => {
    setIsDeleteDialogOpen(false);
    onDelete();
  };

  return (
    <>
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">
              {selectedCount} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? onClearSelection : onSelectAll}
            >
              <Check className="w-4 h-4 mr-2" />
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {availableLists.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={targetListId} onValueChange={setTargetListId}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Move to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.icon && `${list.icon} `}
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleMove}
                  disabled={!targetListId || moveProducts.isPending}
                >
                  <FolderInput className="w-4 h-4 mr-2" />
                  Move
                </Button>
              </div>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Delete Products
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedCount} product(s) from your watch list? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
