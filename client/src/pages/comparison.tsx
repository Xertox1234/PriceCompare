import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProductComparison } from "@/components/price-history/ProductComparison";
import { ArrowLeft } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useMemo } from "react";

export default function ComparisonPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();

  // Parse product IDs from URL query params
  const productIds = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const productsParam = params.get('products');
    if (!productsParam) return [];

    return productsParam
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));
  }, [searchParams]);

  // Fetch products data
  const { data: products, isLoading } = useQuery({
    queryKey: ["comparison-products", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];

      const responses = await Promise.all(
        productIds.map((id) =>
          fetch(`/api/products/${id}`).then((res) => res.json())
        )
      );

      return responses.map((res, index) => ({
        id: productIds[index],
        name: res.product?.name || `Product ${productIds[index]}`,
        imageUrl: res.product?.imageUrl,
        currentPrice: res.product?.bestPrice,
      }));
    },
    enabled: productIds.length > 0,
  });

  // Fetch price history function
  const fetchPriceHistory = async (productId: number, days: number) => {
    const response = await fetch(
      `/api/products/${productId}/price-history?days=${days}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch price history");
    }
    const data = await response.json();
    return data.history || [];
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation("/products")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>

        <div>
          <h1 className="text-3xl font-bold mb-2">Product Price Comparison</h1>
          <p className="text-muted-foreground">
            Compare price histories and find the best deals across retailers
          </p>
        </div>
      </div>

      {/* Comparison Component */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading comparison data...</p>
        </div>
      ) : (
        <ProductComparison
          initialProducts={products || []}
          fetchPriceHistory={fetchPriceHistory}
          onClose={() => setLocation("/products")}
        />
      )}

      {/* Help Text */}
      {products && products.length === 0 && (
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-semibold mb-2">No Products Selected</h3>
            <p className="text-muted-foreground mb-4">
              Add products to comparison from the products page to see their
              price history charts side-by-side.
            </p>
            <Button onClick={() => setLocation("/products")}>
              Browse Products
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
