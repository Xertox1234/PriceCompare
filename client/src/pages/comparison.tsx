import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ProductComparison } from '@/components/price-history/ProductComparison';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useSearch } from 'wouter';
import { useMemo } from 'react';
import { useIsMobile } from '@/hooks/useMediaQuery';

// API response types
interface ProductResponse {
  product?: {
    name?: string;
    imageUrl?: string;
    bestPrice?: number;
  };
}

interface PriceHistoryEntry {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

interface PriceHistoryResponse {
  history?: PriceHistoryEntry[];
}

/**
 * Type-safe JSON parsing helper
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}

export default function ComparisonPage() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const isMobile = useIsMobile();

  // Parse product IDs from URL query params
  const productIds = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const productsParam = params.get('products');
    if (!productsParam) return [];

    return productsParam
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }, [searchParams]);

  // Fetch products data
  const { data: products, isLoading } = useQuery({
    queryKey: ['comparison-products', productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];

      const responses = await Promise.all(
        productIds.map((id) =>
          fetch(`/api/products/${id}`).then((res) => parseJsonResponse<ProductResponse>(res))
        )
      );

      return responses.map((res, index) => ({
        id: productIds[index],
        name: res.product?.name ?? `Product ${productIds[index]}`,
        imageUrl: res.product?.imageUrl,
        currentPrice: res.product?.bestPrice,
      }));
    },
    enabled: productIds.length > 0,
  });

  // Fetch price history function
  const fetchPriceHistory = async (
    productId: number,
    days: number
  ): Promise<PriceHistoryEntry[]> => {
    const response = await fetch(`/api/products/${productId}/price-history?days=${days}`);
    if (!response.ok) {
      throw new Error('Failed to fetch price history');
    }
    const data = await parseJsonResponse<PriceHistoryResponse>(response);
    return data.history ?? [];
  };

  return (
    <div className={`container mx-auto max-w-7xl ${isMobile ? 'px-2 py-4' : 'px-4 py-8'}`}>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setLocation('/products')}
          className="mb-4"
          size={isMobile ? 'sm' : 'default'}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {isMobile ? 'Back' : 'Back to Products'}
        </Button>

        <div>
          <h1 className={`mb-2 font-bold ${isMobile ? 'text-xl' : 'text-3xl'}`}>
            {isMobile ? 'Price Comparison' : 'Product Price Comparison'}
          </h1>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
            Compare price histories and find the best deals{!isMobile && ' across retailers'}
          </p>
        </div>
      </div>

      {/* Comparison Component */}
      {isLoading ? (
        <div className="py-12 text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">Loading comparison data...</p>
        </div>
      ) : (
        <ProductComparison
          initialProducts={products || []}
          fetchPriceHistory={fetchPriceHistory}
          onClose={() => setLocation('/products')}
        />
      )}

      {/* Help Text */}
      {products && products.length === 0 && (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="mb-2 text-lg font-semibold">No Products Selected</h3>
            <p className="text-muted-foreground mb-4">
              Add products to comparison from the products page to see their price history charts
              side-by-side.
            </p>
            <Button onClick={() => setLocation('/products')}>Browse Products</Button>
          </div>
        </div>
      )}
    </div>
  );
}
