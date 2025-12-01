import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMostWatchedProducts } from '@/hooks/use-community';
import { TrendingUp, Eye, Users, Info } from 'lucide-react';
import { Link } from 'wouter';

interface MostWatchedWidgetProps {
  limit?: number;
  compact?: boolean;
}

export function MostWatchedWidget({ limit = 10, compact = false }: MostWatchedWidgetProps) {
  const { data, isLoading } = useMostWatchedProducts(limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.data || data.data.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No trending products yet. Be the first to watch products!</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Trending Products
        </CardTitle>
        {!compact && (
          <CardDescription>Most watched products by the community</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.data.map((product, index) => (
            <WatchedProductItem
              key={product.productId}
              product={product}
              rank={index + 1}
              compact={compact}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface WatchedProductData {
  productId: number;
  productName: string;
  watchCount: number;
}

// Watched Product Item Component
function WatchedProductItem({
  product,
  rank,
  compact,
}: {
  product: WatchedProductData;
  rank: number;
  compact: boolean;
}) {
  const getTrendingBadge = (rank: number) => {
    if (rank === 1) return { text: 'Hot', variant: 'destructive' as const };
    if (rank <= 3) return { text: 'Trending', variant: 'default' as const };
    return null;
  };

  const badge = getTrendingBadge(rank);

  return (
    <Link href={`/product/${product.productId}`}>
      <a className="block p-3 rounded-lg border hover:bg-accent hover:border-primary transition-colors">
        <div className="flex items-center gap-3">
          {/* Rank */}
          <div
            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
              rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {rank}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate text-sm">{product.productName}</h4>
            {!compact && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  <span>{product.watchCount} watching</span>
                </div>
                {badge && (
                  <Badge variant={badge.variant} className="text-xs">
                    {badge.text}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Watch Count Badge */}
          {compact && (
            <Badge variant="secondary" className="flex-shrink-0 text-xs">
              <Users className="w-3 h-3 mr-1" />
              {product.watchCount}
            </Badge>
          )}
        </div>
      </a>
    </Link>
  );
}
