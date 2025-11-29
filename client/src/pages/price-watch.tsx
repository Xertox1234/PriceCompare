import { useState, useMemo } from 'react';
import { useInView } from 'react-intersection-observer';
import { SharedNavigation } from '@/components/shared-navigation';
import { WatchedProductCard } from '@/components/price-watch/WatchedProductCard';
import { WatchlistStats } from '@/components/price-watch/WatchlistStats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useWatchedProducts,
  useWatchListStats,
  useCreateWatchList,
  useRemoveProductFromWatchList,
  type WatchedProduct,
} from '@/hooks/useWatchList';
import {
  Plus,
  Search,
  TrendingDown,
  Clock,
  Package,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type SortOption = 'priceDropPercent' | 'savings' | 'dateAdded';
type FilterOption = 'all' | 'active' | 'triggered' | 'none';

export default function PriceWatchPage() {
  const { toast } = useToast();

  // State
  const [sortBy, setSortBy] = useState<SortOption>('priceDropPercent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // Queries
  const {
    data,
    isLoading: productsLoading,
    error: productsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWatchedProducts({ sortBy });
  const { data: stats, isLoading: statsLoading, error: statsError } = useWatchListStats();

  // Flatten paginated products
  const products = useMemo(() => {
    if (!data || !data.pages) return [];
    return data.pages.flatMap((page: { products: WatchedProduct[] }) => page.products);
  }, [data]);

  // Infinite scroll trigger
  const { ref: infiniteScrollRef } = useInView({
    threshold: 0.1,
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  // Mutations
  const createWatchList = useCreateWatchList();
  const removeProduct = useRemoveProductFromWatchList();

  // Filter and search products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply alert status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter((p: WatchedProduct) => p.alertStatus === filterBy);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((p: WatchedProduct) =>
        p.productName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [products, filterBy, searchQuery]);

  // Handlers
  const handleCreateWatchList = async () => {
    if (!newListName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a watch list name',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createWatchList.mutateAsync({
        name: newListName,
        description: newListDescription || undefined,
      });

      toast({
        title: 'Success',
        description: 'Watch list created successfully',
      });

      setCreateDialogOpen(false);
      setNewListName('');
      setNewListDescription('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create watch list',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveProduct = async (productId: number, watchListId: number) => {
    try {
      await removeProduct.mutateAsync({ watchListId, productId });
      toast({
        title: 'Success',
        description: 'Product removed from watch list',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove product',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (productsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SharedNavigation currentPage="price-watch" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-8">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (productsError || statsError) {
    return (
      <div className="min-h-screen bg-background">
        <SharedNavigation currentPage="price-watch" />
        <div className="container mx-auto px-4 py-8">
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-4 p-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <div>
                <h3 className="font-semibold text-lg">Error Loading Price Watch Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  {productsError?.message || statsError?.message || 'Failed to load data'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedNavigation currentPage="price-watch" />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingDown className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Price Watch Dashboard</h1>
              <p className="text-muted-foreground">Track your favorite products and never miss a deal</p>
            </div>
          </div>

          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Watch List
          </Button>
        </div>

        {/* Stats Section */}
        {stats && (
          <div className="mb-8">
            <WatchlistStats stats={stats} />
          </div>
        )}

        {/* Filters and Search */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priceDropPercent">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Price Drop %
                  </div>
                </SelectItem>
                <SelectItem value="savings">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Savings
                  </div>
                </SelectItem>
                <SelectItem value="dateAdded">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Date Added
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Filter */}
            <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products</SelectItem>
                <SelectItem value="active">Active Alerts</SelectItem>
                <SelectItem value="triggered">Triggered</SelectItem>
                <SelectItem value="none">No Alerts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Products Found</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {searchQuery
                  ? 'No products match your search. Try different keywords.'
                  : filterBy !== 'all'
                  ? `No products with ${filterBy} alerts. Try changing the filter.`
                  : 'Start watching products to track price drops and get alerts.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product: WatchedProduct) => (
                <WatchedProductCard
                  key={product.productId}
                  product={product}
                  watchListId={product.watchListId}
                  onRemove={() => void handleRemoveProduct(product.productId, product.watchListId)}
                />
              ))}
            </div>

            {/* Infinite scroll trigger and loading indicator */}
            {hasNextPage && (
              <div ref={infiniteScrollRef} className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* Loading next page indicator */}
            {isFetchingNextPage && !hasNextPage && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Watch List Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Watch List</DialogTitle>
            <DialogDescription>
              Organize your watched products into custom lists
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Holiday Gifts, Tech Deals"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add a description for this watch list..."
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setNewListName('');
                setNewListDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreateWatchList()}
              disabled={createWatchList.isPending || !newListName.trim()}
            >
              {createWatchList.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
