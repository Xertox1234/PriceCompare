import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  useWatchLists,
  useSharedWatchLists,
  useCreateWatchList,
  useDeleteWatchList,
  useWatchListProducts,
  useBulkRemoveProductWatches,
  useMoveProductsToWatchList,
  useImportWatchLists,
  useShareWatchList,
  useSetWatchListPublic,
  useRemoveProductFromWatchList,
  type SharedWatchListWithStats,
  type WatchListSharePermission,
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
import { Loader2, Plus, Trash2, Download, MoveRight, Upload } from 'lucide-react';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };
  const pushRow = () => {
    // Avoid adding a trailing empty row if the file ends with a newline
    if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      pushCell();
      continue;
    }

    if (char === '\n') {
      pushCell();
      pushRow();
      continue;
    }

    if (char === '\r') {
      // Ignore CR (handles CRLF)
      continue;
    }

    cell += char;
  }

  // Flush final cell/row
  pushCell();
  pushRow();

  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getPublicWatchlistUrl(token: string) {
  return `${window.location.origin}/watchlists/public/${token}`;
}

export default function WatchListManager() {
  const { toast } = useToast();
  const { data: watchlistsData, isLoading } = useWatchLists();
  const { data: sharedWatchlistsData } = useSharedWatchLists();

  const importInputRef = useRef<HTMLInputElement>(null);

  const watchlists = watchlistsData || [];
  const sharedWatchlists = sharedWatchlistsData || [];
  const allWatchlists = [...watchlists, ...sharedWatchlists];

  const isSharedWatchlist = (wl: unknown): wl is SharedWatchListWithStats => {
    return (
      typeof wl === 'object' && wl !== null && 'sharedPermission' in wl && 'ownerUsername' in wl
    );
  };

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
  const importMutation = useImportWatchLists();
  const shareMutation = useShareWatchList();
  const setPublicMutation = useSetWatchListPublic();
  const removeFromListMutation = useRemoveProductFromWatchList();

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<WatchListSharePermission>('view');
  const [shareTargetWatchlistId, setShareTargetWatchlistId] = useState<number | null>(null);

  const [sharedRemoveDialogOpen, setSharedRemoveDialogOpen] = useState(false);
  const [sharedRemoveProductId, setSharedRemoveProductId] = useState<number | null>(null);

  const [publicLinkDialogOpen, setPublicLinkDialogOpen] = useState(false);
  const [publicLinkToken, setPublicLinkToken] = useState<string | null>(null);

  const defaultWatchlistId = watchlists[0]?.id ?? sharedWatchlists[0]?.id ?? null;
  const activeWatchlistId = selectedWatchlistId ?? defaultWatchlistId ?? 0;

  const { data: productsData, isLoading: isLoadingProducts } =
    useWatchListProducts(activeWatchlistId);
  const products = productsData || [];

  const selectedWatchlist = allWatchlists.find((wl) => wl.id === activeWatchlistId);

  const setWatchlistPublic = async (nextIsPublic: boolean) => {
    if (!selectedWatchlist || isSharedWatchlist(selectedWatchlist)) {
      toast({
        title: 'Error',
        description: 'Only the owner can change public sharing',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await setPublicMutation.mutateAsync({
        watchListId: selectedWatchlist.id,
        isPublic: nextIsPublic,
      });

      setPublicLinkToken(result.publicShareToken);

      if (result.isPublic && result.publicShareToken) {
        setPublicLinkDialogOpen(true);
        toast({ title: 'Success', description: 'Watchlist is now public' });
      } else {
        toast({ title: 'Success', description: 'Watchlist is now private' });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update public sharing',
        variant: 'destructive',
      });
    }
  };

  const copyPublicLink = async () => {
    if (!publicLinkToken) return;
    const url = getPublicWatchlistUrl(publicLinkToken);

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Copied', description: 'Public link copied to clipboard' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  // Ensure the products query uses the same watchlist as the default selected tab.
  // Without this, the first tab can be active while `selectedWatchlistId` is null,
  // leading to a products query for watchlist id=0 and an empty list.
  useEffect(() => {
    if (selectedWatchlistId === null && defaultWatchlistId !== null) {
      setSelectedWatchlistId(defaultWatchlistId);
    }
  }, [selectedWatchlistId, defaultWatchlistId]);

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

  const handleShareWatchlist = () => {
    if (!shareTargetWatchlistId) return;

    const email = shareEmail.trim();
    if (!email) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    shareMutation.mutate(
      {
        watchListId: shareTargetWatchlistId,
        email,
        permission: sharePermission,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Invite sent',
            description: 'Watchlist shared successfully',
          });
          setShareDialogOpen(false);
          setShareEmail('');
          setSharePermission('view');
          setShareTargetWatchlistId(null);
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to share watchlist',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleSharedRemove = () => {
    if (!selectedWatchlist || !isSharedWatchlist(selectedWatchlist)) return;
    if (sharedRemoveProductId === null) return;

    removeFromListMutation.mutate(
      { watchListId: selectedWatchlist.id, productId: sharedRemoveProductId },
      {
        onSuccess: () => {
          toast({
            title: 'Removed',
            description: 'Product removed from watchlist',
          });
          setSharedRemoveDialogOpen(false);
          setSharedRemoveProductId(null);
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to remove product',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleExport = () => {
    if (!selectedWatchlist) return;

    // Generate CSV data
    const headers = ['Product ID', 'Product Name', 'Priority', 'Target Price', 'Notes'];
    const rows = products.map((p) => [
      String(p.productId),
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

  const handleImportCsv = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length < 2) {
      throw new Error('CSV file must include a header row and at least one product row');
    }

    const headerRow = rows[0].map(normalizeHeader);
    const columnIndex = (names: string[]) =>
      headerRow.findIndex((h) => names.some((n) => h === normalizeHeader(n)));

    const productIdIdx = columnIndex(['product id', 'productid', 'id']);
    if (productIdIdx < 0) {
      throw new Error('CSV must include a "Product ID" column');
    }

    const priorityIdx = columnIndex(['priority']);
    const targetPriceIdx = columnIndex(['target price', 'targetprice']);
    const notesIdx = columnIndex(['notes', 'note']);

    const productsToImport = rows
      .slice(1)
      .map((row) => {
        const rawProductId = (row[productIdIdx] ?? '').trim();
        const productId = Number.parseInt(rawProductId, 10);
        if (!Number.isFinite(productId) || productId <= 0) return null;

        const rawPriority = priorityIdx >= 0 ? (row[priorityIdx] ?? '').trim() : '';
        const parsedPriority = rawPriority ? Number.parseInt(rawPriority, 10) : undefined;
        const priority =
          parsedPriority && Number.isFinite(parsedPriority)
            ? Math.min(5, Math.max(1, parsedPriority))
            : undefined;

        const targetPrice = targetPriceIdx >= 0 ? (row[targetPriceIdx] ?? '').trim() : '';
        const notes = notesIdx >= 0 ? (row[notesIdx] ?? '').trim() : '';

        return {
          productId,
          ...(notes ? { notes } : {}),
          ...(priority ? { priority } : {}),
          ...(targetPrice ? { targetPrice } : {}),
        };
      })
      .filter(
        (p): p is { productId: number; notes?: string; priority?: number; targetPrice?: string } =>
          Boolean(p)
      );

    if (productsToImport.length === 0) {
      throw new Error('No valid Product ID rows found in CSV');
    }

    const filenameBase = file.name.replace(/\.[^.]+$/, '').trim();
    const watchListName = filenameBase || 'Imported Watchlist';

    const result = await importMutation.mutateAsync({
      watchLists: [
        {
          name: watchListName,
          products: productsToImport,
        },
      ],
    });

    toast({
      title: 'Import successful',
      description: `Created ${result.created} list(s), skipped ${result.skipped} duplicate(s)`,
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
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
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
        <div className="flex gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              void (async () => {
                try {
                  await handleImportCsv(file);
                } catch (error) {
                  toast({
                    title: 'Import failed',
                    description:
                      error instanceof Error ? error.message : 'Failed to import watchlist',
                    variant: 'destructive',
                  });
                } finally {
                  e.target.value = '';
                }
              })();
            }}
          />
          <Button
            variant="outline"
            onClick={() => importInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import Watchlist
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Watchlist
          </Button>
        </div>
      </div>

      {allWatchlists.length === 0 ? (
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
          value={activeWatchlistId.toString()}
          onValueChange={(value) => {
            setSelectedWatchlistId(parseInt(value));
            setSelectedProductWatchIds([]);
          }}
          className="space-y-6"
        >
          <TabsList className="flex flex-wrap gap-2">
            {allWatchlists.map((watchlist) => {
              const shared = isSharedWatchlist(watchlist);
              return (
                <TabsTrigger key={watchlist.id} value={watchlist.id.toString()}>
                  {watchlist.name}
                  <span className="text-muted-foreground ml-2 text-xs">
                    ({watchlist.watchCount} items)
                    {shared && (
                      <>
                        {' '}
                        Shared by {watchlist.ownerUsername} ({watchlist.sharedPermission})
                      </>
                    )}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {allWatchlists.map((watchlist) => {
            const shared = isSharedWatchlist(watchlist);
            const canEdit = !shared || watchlist.sharedPermission === 'edit';

            return (
              <TabsContent key={watchlist.id} value={watchlist.id.toString()}>
                <Card data-testid="watchlist-card">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{watchlist.name}</CardTitle>
                        <CardDescription>
                          {watchlist.watchCount} {watchlist.watchCount === 1 ? 'item' : 'items'}
                          {shared && (
                            <>
                              {' '}
                              Shared by {watchlist.ownerUsername} ({watchlist.sharedPermission})
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {products.length > 0 && (
                          <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </Button>
                        )}
                        {!shared && (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShareTargetWatchlistId(watchlist.id);
                                setShareDialogOpen(true);
                              }}
                            >
                              Share
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                // "Make Public" behavior: enable public sharing + show link dialog
                                void setWatchlistPublic(true);
                              }}
                              disabled={setPublicMutation.isPending}
                            >
                              Make Public
                            </Button>
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
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isLoadingProducts ? (
                      <div className="flex h-32 items-center justify-center">
                        <Loader2 className="text-primary h-6 w-6 animate-spin" />
                      </div>
                    ) : products.length === 0 ? (
                      <div className="text-muted-foreground py-8 text-center">
                        No products in this watchlist yet
                      </div>
                    ) : (
                      <>
                        {!shared && selectedProductWatchIds.length > 0 && (
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
                                  {!shared && (
                                    <Checkbox
                                      checked={selectedProductWatchIds.includes(product.id)}
                                      onCheckedChange={() => toggleProductSelection(product.id)}
                                      data-testid={`product-checkbox-${product.productId}`}
                                      className="mt-1"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <h3 className="font-medium">{product.productName}</h3>
                                    {product.targetPrice && (
                                      <p className="text-muted-foreground text-sm">
                                        Target: ${product.targetPrice}
                                      </p>
                                    )}
                                    {product.notes && (
                                      <p className="text-muted-foreground mt-2 text-sm">
                                        {product.notes}
                                      </p>
                                    )}
                                    {!shared && (
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
                                    )}
                                    {shared && canEdit && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="mt-2"
                                        onClick={() => {
                                          setSharedRemoveProductId(product.productId);
                                          setSharedRemoveDialogOpen(true);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-3 w-3" />
                                        Remove
                                      </Button>
                                    )}
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
            );
          })}
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

      {/* Share Watchlist Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Watchlist</DialogTitle>
            <DialogDescription>
              Invite someone by email to view or edit this watchlist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="share-email">Email</Label>
              <Input
                id="share-email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="name@example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !shareMutation.isPending) {
                    handleShareWatchlist();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="share-permission">Permission</Label>
              <Select
                value={sharePermission}
                onValueChange={(v) => setSharePermission(v as WatchListSharePermission)}
              >
                <SelectTrigger id="share-permission">
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShareDialogOpen(false);
                setShareEmail('');
                setSharePermission('view');
                setShareTargetWatchlistId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleShareWatchlist} disabled={shareMutation.isPending}>
              {shareMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Link Dialog */}
      <Dialog open={publicLinkDialogOpen} onOpenChange={setPublicLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Public Watchlist Link</DialogTitle>
            <DialogDescription>Anyone with this link can view your watchlist.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="public-watchlist-link">Shareable link</Label>
            <Input
              id="public-watchlist-link"
              readOnly
              value={publicLinkToken ? getPublicWatchlistUrl(publicLinkToken) : ''}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPublicLinkDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void copyPublicLink()} disabled={!publicLinkToken}>
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shared Watchlist Remove Confirmation */}
      <AlertDialog open={sharedRemoveDialogOpen} onOpenChange={setSharedRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this product from the shared watchlist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setSharedRemoveDialogOpen(false);
                setSharedRemoveProductId(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSharedRemove}
              className="bg-destructive hover:bg-destructive/90"
              disabled={removeFromListMutation.isPending}
            >
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
