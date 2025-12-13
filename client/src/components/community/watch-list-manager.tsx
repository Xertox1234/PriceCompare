import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useWatchLists,
  useWatchListProducts,
  useBulkRemoveProductWatches,
  type WatchListWithStats,
  type WatchListProduct,
} from '@/hooks/use-community';
import { Plus, FolderOpen } from 'lucide-react';
import { WatchListCard } from './watch-list-card';
import { WatchListProductCard } from './watch-list-product-card';
import { CreateWatchListDialog } from './create-watch-list-dialog';
import { BulkActionToolbar } from './bulk-action-toolbar';
import { ImportExportButtons } from './import-export-buttons';

export function WatchListManager() {
  const { data: watchListsData, isLoading } = useWatchLists();
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const watchLists = watchListsData || [];
  const _selectedList = watchLists.find((list: WatchListWithStats) => list.id === selectedListId);

  // Auto-select first list if none selected
  if (!selectedListId && watchLists.length > 0 && !isLoading) {
    setSelectedListId(watchLists[0].id);
  }

  const { data: productsData, isLoading: productsLoading } = useWatchListProducts(
    selectedListId || 0
  );
  const products = productsData || [];

  const bulkDelete = useBulkRemoveProductWatches();

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p: { id: number }) => p.id)));
    }
  };

  const handleToggleProduct = (productWatchId: number) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productWatchId)) {
      newSelection.delete(productWatchId);
    } else {
      newSelection.add(productWatchId);
    }
    setSelectedProducts(newSelection);
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;

    try {
      await bulkDelete.mutateAsync(Array.from(selectedProducts));
      setSelectedProducts(new Set());
      toast({
        title: 'Products removed',
        description: `${selectedProducts.size} product(s) removed from watch list`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove products',
        variant: 'destructive',
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedProducts(new Set());
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="mb-6 h-12 w-64" />
        <div className="grid gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Watch Lists</h1>
          <p className="text-muted-foreground mt-2">Organize and track your favorite products</p>
        </div>
        {watchLists.length > 0 && (
          <div className="flex gap-2">
            <ImportExportButtons />
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Watchlist
            </Button>
          </div>
        )}
      </div>

      {watchLists.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Watch Lists Yet</CardTitle>
            <CardDescription>
              Create your first watch list to start organizing your watched products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Watchlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={selectedListId?.toString()}
          onValueChange={(val) => setSelectedListId(Number(val))}
        >
          <div className="flex items-start gap-6">
            {/* Sidebar with watch lists */}
            <div className="w-80 shrink-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Lists</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <TabsList className="flex h-auto w-full flex-col gap-2">
                    {watchLists.map((list: WatchListWithStats) => (
                      <TabsTrigger
                        key={list.id}
                        value={list.id.toString()}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground w-full justify-start"
                      >
                        <WatchListCard watchList={list} compact />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </CardContent>
              </Card>
            </div>

            {/* Main content area */}
            <div className="flex-1">
              {watchLists.map((list: WatchListWithStats) => (
                <TabsContent key={list.id} value={list.id.toString()} className="mt-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {list.icon && <span>{list.icon}</span>}
                            {list.name}
                            {list.isDefault && (
                              <span className="text-muted-foreground text-xs font-normal">
                                (Default)
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {list.description || 'No description'}
                          </CardDescription>
                          <div className="text-muted-foreground mt-3 flex gap-4 text-sm">
                            <span>{list.watchCount} products</span>
                            {list.highPriorityCount > 0 && (
                              <span>{list.highPriorityCount} high priority</span>
                            )}
                          </div>
                        </div>
                        <WatchListCard watchList={list} showActions />
                      </div>
                    </CardHeader>
                    <CardContent>
                      {selectedProducts.size > 0 && (
                        <BulkActionToolbar
                          selectedCount={selectedProducts.size}
                          totalCount={products.length}
                          onSelectAll={handleSelectAll}
                          onClearSelection={handleClearSelection}
                          onDelete={() => void handleBulkDelete()}
                          onMove={(_targetListId) => {
                            // Will be implemented via BulkActionToolbar
                          }}
                          watchLists={watchLists}
                          currentListId={list.id}
                        />
                      )}

                      {productsLoading ? (
                        <div className="mt-4 space-y-4">
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                        </div>
                      ) : products.length === 0 ? (
                        <div className="py-12 text-center">
                          <FolderOpen className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                          <h3 className="mb-2 text-lg font-medium">No products in this list</h3>
                          <p className="text-muted-foreground mb-4 text-sm">
                            Start watching products to add them to your lists
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          {products.map((product: WatchListProduct) => (
                            <WatchListProductCard
                              key={product.id}
                              product={product}
                              isSelected={selectedProducts.has(product.id)}
                              onToggleSelect={() => handleToggleProduct(product.id)}
                              watchLists={watchLists}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      )}

      <CreateWatchListDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </div>
  );
}
