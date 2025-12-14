import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  useWatchLists,
  useCreateWatchList,
  useDeleteWatchList,
  useWatchListProducts,
  useBulkRemoveProductWatches,
  useMoveProductsToWatchList,
} from '@/hooks/use-community';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Trash2, Download, MoveRight } from 'lucide-react';

export default function WatchListManager() {
  const { toast } = useToast();
  const { data: watchlistsData, isLoading } = useWatchLists();

  const watchlists = watchlistsData || [];

  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [watchlistToDelete, setWatchlistToDelete] = useState<number | null>(null);
  const [selectedProductWatchIds, setSelectedProductWatchIds] = useState<number[]>([]);
  const [deleteProductsDialogOpen, setDeleteProductsDialogOpen] = useState(false);
  const [moveProductsDialogOpen, setMoveProductsDialogOpen] = useState(false);
  const [targetWatchlistId, setTargetWatchlistId] = useState<string>('');

  const createMutation = useCreateWatchList();
  const deleteMutation = useDeleteWatchList();
  const bulkDeleteMutation = useBulkRemoveProductWatches();
  const moveMutation = useMoveProductsToWatchList();

  const { data: productsData, isLoading: isLoadingProducts } = useWatchListProducts(
    selectedWatchlistId || 0
  );
  const products = productsData || [];

  const selectedWatchlist = watchlists.find((wl) => wl.id === selectedWatchlistId);

  // Auto-select newly created watchlist once it appears in the array
  // This prevents race condition where we try to select before refetch completes
  useEffect(() => {
    if (createMutation.isSuccess && createMutation.data && 'id' in createMutation.data) {
      const newWatchlistId = createMutation.data.id;
      // Only set selected if the watchlist now exists in the array
      if (watchlists.some((wl) => wl.id === newWatchlistId)) {
        setSelectedWatchlistId(newWatchlistId);
      }
    }
  }, [watchlists, createMutation.isSuccess, createMutation.data]);

  const handleCreateWatchlist = () => {
    if (!newWatchlistName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a watchlist name',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(
      { name: newWatchlistName.trim() },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Watch list created successfully!',
          });
          setCreateDialogOpen(false);
          setNewWatchlistName('');
          // Note: Auto-selection happens in useEffect once data is loaded
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to create watchlist',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDeleteWatchlist = () => {
    if (!watchlistToDelete) return;

    deleteMutation.mutate(watchlistToDelete, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Watchlist deleted successfully',
        });
        setDeleteDialogOpen(false);
        setWatchlistToDelete(null);
        // Clear selection if deleted watchlist was selected
        if (selectedWatchlistId === watchlistToDelete) {
          setSelectedWatchlistId(watchlists[0]?.id || null);
        }
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to delete watchlist',
          variant: 'destructive',
        });
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedProductWatchIds.length === 0) return;

    bulkDeleteMutation.mutate(selectedProductWatchIds, {
      onSuccess: () => {
        const count = selectedProductWatchIds.length;
        toast({
          title: 'Success',
          description: `${count} ${count === 1 ? 'item' : 'items'} deleted successfully`,
        });
        setDeleteProductsDialogOpen(false);
        setSelectedProductWatchIds([]);
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to delete products',
          variant: 'destructive',
        });
      },
    });
  };

  const handleMoveProducts = () => {
    if (selectedProductWatchIds.length === 0 || !targetWatchlistId) return;

    const targetId = targetWatchlistId === 'null' ? null : parseInt(targetWatchlistId);

    moveMutation.mutate(
      {
        productWatchIds: selectedProductWatchIds,
        targetListId: targetId,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Products moved successfully',
          });
          setMoveProductsDialogOpen(false);
          setSelectedProductWatchIds([]);
          setTargetWatchlistId('');
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to move products',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleExport = () => {
    if (!selectedWatchlist) return;

    // Generate CSV data
    const headers = ['Product Name', 'Priority', 'Target Price', 'Notes'];
    const rows = products.map((p) => [
      p.productName || '',
      p.priority?.toString() || '',
      p.targetPrice || '',
      p.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${selectedWatchlist.name.toLowerCase().replace(/\s+/g, '-')}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Success',
      description: 'Watchlist exported successfully',
    });
  };

  const toggleProductSelection = (productWatchId: number) => {
    setSelectedProductWatchIds((prev) =>
      prev.includes(productWatchId)
        ? prev.filter((id) => id !== productWatchId)
        : [...prev, productWatchId]
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Watchlists</h1>
          <p className="text-muted-foreground">Organize and track your favorite products</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Watchlist
        </Button>
      </div>

      {watchlists.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No watchlists yet</CardTitle>
            <CardDescription>Create your first watchlist to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Watchlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={selectedWatchlistId?.toString() || (watchlists[0]?.id?.toString() ?? '')}
          onValueChange={(value) => {
            setSelectedWatchlistId(parseInt(value));
            setSelectedProductWatchIds([]);
          }}
          className="space-y-6"
        >
          <TabsList className="flex flex-wrap gap-2">
            {watchlists.map((watchlist) => (
              <TabsTrigger key={watchlist.id} value={watchlist.id.toString()}>
                {watchlist.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  ({watchlist.watchCount} items)
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {watchlists.map((watchlist) => (
            <TabsContent key={watchlist.id} value={watchlist.id.toString()}>
              <Card data-testid="watchlist-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{watchlist.name}</CardTitle>
                      <CardDescription>
                        {watchlist.watchCount} {watchlist.watchCount === 1 ? 'item' : 'items'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {products.length > 0 && (
                        <Button variant="outline" onClick={handleExport}>
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setWatchlistToDelete(watchlist.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {isLoadingProducts ? (
                    <div className="flex h-32 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : products.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      No products in this watchlist yet
                    </div>
                  ) : (
                    <>
                      {selectedProductWatchIds.length > 0 && (
                        <div className="mb-4 flex gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteProductsDialogOpen(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedProductWatchIds.length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMoveProductsDialogOpen(true)}
                          >
                            <MoveRight className="mr-2 h-4 w-4" />
                            Move to
                          </Button>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {products.map((product) => (
                          <Card key={product.id} data-testid="product-card">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedProductWatchIds.includes(product.id)}
                                  onCheckedChange={() => toggleProductSelection(product.id)}
                                  data-testid={`product-checkbox-${product.productId}`}
                                  className="mt-1"
                                />
                                <div className="flex-1">
                                  <h3 className="font-medium">{product.productName}</h3>
                                  {product.targetPrice && (
                                    <p className="text-sm text-muted-foreground">
                                      Target: ${product.targetPrice}
                                    </p>
                                  )}
                                  {product.notes && (
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      {product.notes}
                                    </p>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2"
                                    onClick={() => {
                                      setSelectedProductWatchIds([product.id]);
                                      setDeleteProductsDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Create Watchlist Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Watchlist</DialogTitle>
            <DialogDescription>
              Give your watchlist a name to start organizing products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="watchlist-name">Name</Label>
              <Input
                id="watchlist-name"
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="e.g., Holiday Shopping 2025"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !createMutation.isPending) {
                    handleCreateWatchlist();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWatchlist} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Watchlist Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Watchlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this watchlist? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWatchlist}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Products Confirmation */}
      <AlertDialog open={deleteProductsDialogOpen} onOpenChange={setDeleteProductsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedProductWatchIds.length}{' '}
              {selectedProductWatchIds.length === 1 ? 'product' : 'products'} from this watchlist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move Products Dialog */}
      <Dialog open={moveProductsDialogOpen} onOpenChange={setMoveProductsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Products</DialogTitle>
            <DialogDescription>
              Select a watchlist to move {selectedProductWatchIds.length}{' '}
              {selectedProductWatchIds.length === 1 ? 'product' : 'products'} to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-watchlist">Select Watchlist</Label>
              <Select value={targetWatchlistId} onValueChange={setTargetWatchlistId}>
                <SelectTrigger id="target-watchlist">
                  <SelectValue placeholder="Choose a watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {watchlists
                    .filter((wl) => wl.id !== selectedWatchlistId)
                    .map((watchlist) => (
                      <SelectItem key={watchlist.id} value={watchlist.id.toString()}>
                        {watchlist.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveProductsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveProducts}
              disabled={!targetWatchlistId || moveMutation.isPending}
            >
              {moveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
