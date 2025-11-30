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

  const watchLists = watchListsData?.data || [];
  const _selectedList = watchLists.find(list => list.id === selectedListId);

  // Auto-select first list if none selected
  if (!selectedListId && watchLists.length > 0 && !isLoading) {
    setSelectedListId(watchLists[0].id);
  }

  const { data: productsData, isLoading: productsLoading } = useWatchListProducts(
    selectedListId || 0
  );
  const products = productsData?.data || [];

  const bulkDelete = useBulkRemoveProductWatches();

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
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
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Watch Lists</h1>
          <p className="text-muted-foreground mt-2">
            Organize and track your favorite products
          </p>
        </div>
        <div className="flex gap-2">
          <ImportExportButtons />
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New List
          </Button>
        </div>
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
              <Plus className="w-4 h-4 mr-2" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={selectedListId?.toString()} onValueChange={(val) => setSelectedListId(Number(val))}>
          <div className="flex items-start gap-6">
            {/* Sidebar with watch lists */}
            <div className="w-80 shrink-0">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Lists</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <TabsList className="flex flex-col h-auto w-full gap-2">
                    {watchLists.map((list) => (
                      <TabsTrigger
                        key={list.id}
                        value={list.id.toString()}
                        className="w-full justify-start data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
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
              {watchLists.map((list) => (
                <TabsContent key={list.id} value={list.id.toString()} className="mt-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {list.icon && <span>{list.icon}</span>}
                            {list.name}
                            {list.isDefault && (
                              <span className="text-xs font-normal text-muted-foreground">(Default)</span>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {list.description || 'No description'}
                          </CardDescription>
                          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
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
                          onDelete={handleBulkDelete}
                          onMove={(_targetListId) => {
                            // Will be implemented via BulkActionToolbar
                          }}
                          watchLists={watchLists}
                          currentListId={list.id}
                        />
                      )}

                      {productsLoading ? (
                        <div className="space-y-4 mt-4">
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                          <Skeleton className="h-32" />
                        </div>
                      ) : products.length === 0 ? (
                        <div className="text-center py-12">
                          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No products in this list</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Start watching products to add them to your lists
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4 mt-4">
                          {products.map((product) => (
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

      <CreateWatchListDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
