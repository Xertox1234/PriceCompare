import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Package,
  Plus,
  Edit,
  Trash2,
  Search,
  DollarSign,
  Star,
  Eye,
  Filter,
  Download,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest } from "@/lib/queryClient";
import { DEBOUNCE_DELAY } from "@/lib/constants";

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
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<CreateProductForm>({
    name: "",
    description: "",
    category: "",
    brand: "",
    model: "",
    image: ""
  });

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_DELAY.STANDARD);

  // Fetch products from admin endpoint
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/admin/products'],
    enabled: true
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (productData: CreateProductForm) => {
      return apiRequest('/api/admin/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setShowCreateForm(false);
      setNewProduct({
        name: "",
        description: "",
        category: "",
        brand: "",
        model: "",
        image: ""
      });
      toast({
        title: "Product Created",
        description: "Product has been successfully added to catalog.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to create product.";
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Edit product mutation
  const editProductMutation = useMutation({
    mutationFn: async (productData: { id: number; data: Partial<CreateProductForm> }) => {
      return apiRequest(`/api/admin/products/${productData.id}`, {
        method: 'PUT',
        body: JSON.stringify(productData.data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      setEditingProduct(null);
      toast({
        title: "Product Updated",
        description: "Product has been successfully updated.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to update product.";
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest(`/api/admin/products/${productId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/products'] });
      toast({
        title: "Product Deleted",
        description: "Product has been removed from catalog.",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete product.";
      toast({
        title: "Deletion Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    createProductMutation.mutate(newProduct);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
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
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      deleteProductMutation.mutate(productId);
    }
  };

  const filteredProducts = (products as Product[]).filter((product: Product) => {
    const matchesSearch = debouncedSearchQuery === "" ||
      product.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
      product.brand.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
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
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
                  <Filter className="h-4 w-4 mr-2" />
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
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button onClick={() => setShowCreateForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Product Name</Label>
                  <Input
                    id="product-name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., iPhone 15 Pro"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-brand">Brand</Label>
                  <Input
                    id="product-brand"
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="e.g., Apple"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-category">Category</Label>
                  <Select value={newProduct.category} onValueChange={(value) => setNewProduct(prev => ({ ...prev, category: value }))}>
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
                    onChange={(e) => setNewProduct(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="e.g., A2848"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="product-description">Description</Label>
                <Textarea
                  id="product-description"
                  value={newProduct.description}
                  onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
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
                  onChange={(e) => setNewProduct(prev => ({ ...prev, image: e.target.value }))}
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
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="space-y-4">
              {filteredProducts.map((product: Product) => (
                <div key={product.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4 flex-1">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <Badge variant={product.isActive ? "default" : "secondary"}>
                            {product.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span><strong>Brand:</strong> {product.brand}</span>
                          <span><strong>Category:</strong> {product.category}</span>
                          {product.model && <span><strong>Model:</strong> {product.model}</span>}
                        </div>
                        
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                        
                        {/* Price Offers */}
                        {product.offers && product.offers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Price Offers ({product.offers.length} retailers):</p>
                            <div className="flex flex-wrap gap-2">
                              {product.offers.slice(0, 3).map((offer: ProductOffer) => (
                                <div key={offer.id} className="flex items-center gap-2 text-xs bg-background border rounded px-2 py-1">
                                  <span className="font-medium">{offer.retailer.name}</span>
                                  <Separator orientation="vertical" className="h-3" />
                                  <span className="text-green-600 font-semibold">${offer.price}</span>
                                  {!offer.isAvailable && <Badge variant="destructive" className="text-xs">Out of Stock</Badge>}
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
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditProduct(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Products Found</p>
              <p className="text-sm">
                {searchQuery || selectedCategory !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "Get started by adding your first product to the catalog"
                }
              </p>
              {(!searchQuery && selectedCategory === "all") && (
                <Button 
                  onClick={() => setShowCreateForm(true)} 
                  className="mt-4"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Product
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Product
            </DialogTitle>
            <DialogDescription>
              Update product information and settings
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-product-name">Product Name</Label>
                <Input
                  id="edit-product-name"
                  name="name"
                  defaultValue={editingProduct?.name || ""}
                  placeholder="e.g., iPhone 15 Pro"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-brand">Brand</Label>
                <Input
                  id="edit-product-brand"
                  name="brand"
                  defaultValue={editingProduct?.brand || ""}
                  placeholder="e.g., Apple"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-product-category">Category</Label>
                <Select name="category" defaultValue={editingProduct?.category || ""}>
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
                <Label htmlFor="edit-product-model">Model</Label>
                <Input
                  id="edit-product-model"
                  name="model"
                  defaultValue={editingProduct?.model || ""}
                  placeholder="e.g., A2848"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-product-description">Description</Label>
              <Textarea
                id="edit-product-description"
                name="description"
                defaultValue={editingProduct?.description || ""}
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
                defaultValue={editingProduct?.image || ""}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingProduct(null)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editProductMutation.isPending}
              >
                {editProductMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}