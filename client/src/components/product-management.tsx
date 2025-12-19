import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, Plus, Edit, Trash2, Search, Eye, Filter, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/use-debounce';
import { apiRequest } from '@/lib/queryClient';
import { DEBOUNCE_DELAY } from '@/lib/constants';

interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  image: string;
  isActive: boolean;
  createdAt: string;
  offers?: ProductOffer[];
}

interface ProductOffer {
  id: number;
  retailer: {
    id: number;
    name: string;
    logo: string;
  };
  price: string;
  originalPrice?: string;
  isAvailable: boolean;
  shipping: string;
  url: string;
  affiliateUrl?: string;
  lastUpdated: string;
}

interface CreateProductForm {
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  image: string;
}

export function ProductManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');
  const [newProduct, setNewProduct] = useState<CreateProductForm>({
    name: '',
    description: '',
    category: '',
    brand: '',
    model: '',
    image: '',
  });

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY.STANDARD);

  // Fetch products from admin endpoint
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/admin/products'],
    enabled: true,
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: CreateProductForm) => {
      return apiRequest('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(productData),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setShowCreateForm(false);
      setNewProduct({
        name: '',
        description: '',
        category: '',
        brand: '',
        model: '',
        image: '',
      });
      toast({
        title: 'Product Created',
        description: 'Product has been successfully added to catalog.',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create product.';
      toast({
        title: 'Creation Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Edit product mutation
  const editProductMutation = useMutation({
    mutationFn: async (productData: { id: number; data: Partial<CreateProductForm> }) => {
      return apiRequest(`/api/admin/products/${productData.id}`, {
        method: 'PUT',
        body: JSON.stringify(productData.data),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setEditingProduct(null);
      toast({
        title: 'Product Updated',
        description: 'Product has been successfully updated.',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update product.';
      toast({
        title: 'Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      toast({
        title: 'Product Deleted',
        description: 'Product has been removed from catalog.',
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete product.';
      toast({
        title: 'Deletion Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate(newProduct);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setEditCategory(product.category || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const updateData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      brand: formData.get('brand') as string,
      model: formData.get('model') as string,
      image: formData.get('image') as string,
    };

    editProductMutation.mutate({ id: editingProduct.id, data: updateData });
  };

  const handleDeleteProduct = (productId: number) => {
    if (
      window.confirm('Are you sure you want to delete this product? This action cannot be undone.')
    ) {
      deleteProductMutation.mutate(productId);
    }
  };

  const filteredProducts = (products as Product[]).filter((product: Product) => {
    const matchesSearch =
      debouncedSearchQuery === '' ||
      product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Catalog Management
          </CardTitle>
          <CardDescription>
            Manage your product catalog, monitor pricing data, and track inventory across retailers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-4 sm:flex-row">
              {/* Search Input */}
              <div className="relative max-w-md flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search products, brands, models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                  <SelectItem value="Clothing">Clothing</SelectItem>
                  <SelectItem value="Sports">Sports</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button onClick={() => setShowCreateForm(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Product Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Product
            </CardTitle>
            <CardDescription>
              Add a new product to your catalog for price monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Product Name</Label>
                  <Input
                    id="product-name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., iPhone 15 Pro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">Brand</Label>
                  <Input
                    id="product-brand"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="e.g., Apple"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <Select
                    value={newProduct.category}
                    onValueChange={(value) =>
                      setNewProduct((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                      <SelectItem value="Clothing">Clothing</SelectItem>
                      <SelectItem value="Sports">Sports</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-model">Model</Label>
                  <Input
                    id="product-model"
                    value={newProduct.model}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="e.g., A2848"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Detailed product description..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-image">Image URL</Label>
                <Input
                  id="product-image"
                  type="url"
                  value={newProduct.image}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="https://example.com/product-image.jpg"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? 'Creating...' : 'Create Product'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle>Product Catalog ({filteredProducts.length} products)</CardTitle>
          <CardDescription>
            Manage products and monitor their pricing across retailers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="py-8 text-center">
              <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-4">
              {filteredProducts.map((product: Product) => (
                <div
                  key={product.id}
                  className="hover:bg-muted/50 rounded-lg border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-1 gap-4">
                      <div className="bg-muted flex h-16 w-16 items-center justify-center rounded-lg">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full rounded-lg object-cover"
                          />
                        ) : (
                          <Package className="text-muted-foreground h-8 w-8" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="truncate font-semibold">{product.name}</h3>
                          <Badge variant={product.isActive ? 'default' : 'secondary'}>
                            {product.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        <div className="text-muted-foreground mb-2 flex items-center gap-4 text-sm">
                          <span>
                            <strong>Brand:</strong> {product.brand}
                          </span>
                          <span>
                            <strong>Category:</strong> {product.category}
                          </span>
                          {product.model && (
                            <span>
                              <strong>Model:</strong> {product.model}
                            </span>
                          )}
                        </div>

                        {product.description && (
                          <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                            {product.description}
                          </p>
                        )}

                        {/* Price Offers */}
                        {product.offers && product.offers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">
                              Price Offers ({product.offers.length} retailers):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {product.offers.slice(0, 3).map((offer: ProductOffer) => (
                                <div
                                  key={offer.id}
                                  className="bg-background flex items-center gap-2 rounded border px-2 py-1 text-xs"
                                >
                                  <span className="font-medium">{offer.retailer.name}</span>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span className="font-semibold text-green-600">
                                    ${offer.price}
                                  </span>
                                  {!offer.isAvailable && (
                                    <Badge variant="destructive" className="text-xs">
                                      Out of Stock
                                    </Badge>
                                  )}
                                </div>
                              ))}
                              {product.offers.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{product.offers.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ml-4 flex items-center gap-1">
                      <Button variant="ghost" size="sm" aria-label={`View product ${product.name}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                        aria-label={`Edit product ${product.name}`}
                        data-testid={`admin-product-edit-${product.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        aria-label={`Delete product ${product.name}`}
                        data-testid={`admin-product-delete-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="mb-2 text-lg font-medium">No Products Found</p>
              <p className="text-sm">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first product to the catalog'}
              </p>
              {!searchQuery && selectedCategory === 'all' && (
                <Button onClick={() => setShowCreateForm(true)} className="mt-4" variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Product
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setEditCategory('');
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Product
            </DialogTitle>
            <DialogDescription>Update product information and settings</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <input type="hidden" name="category" value={editCategory} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-product-name">Product Name</Label>
                <Input
                  id="edit-product-name"
                  name="name"
                  defaultValue={editingProduct?.name || ''}
                  placeholder="e.g., iPhone 15 Pro"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-brand">Brand</Label>
                <Input
                  id="edit-product-brand"
                  name="brand"
                  defaultValue={editingProduct?.brand || ''}
                  placeholder="e.g., Apple"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-category">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger aria-label="Category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Home & Garden">Home & Garden</SelectItem>
                    <SelectItem value="Clothing">Clothing</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-model">Model</Label>
                <Input
                  id="edit-product-model"
                  name="model"
                  defaultValue={editingProduct?.model || ''}
                  placeholder="e.g., A2848"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-product-description">Description</Label>
              <Textarea
                id="edit-product-description"
                name="description"
                defaultValue={editingProduct?.description || ''}
                placeholder="Detailed product description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-product-image">Image URL</Label>
              <Input
                id="edit-product-image"
                name="image"
                type="url"
                defaultValue={editingProduct?.image || ''}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editProductMutation.isPending}>
                {editProductMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
