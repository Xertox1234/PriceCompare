import { useState, memo, useMemo, useCallback } from 'react';
import { Star, TrendingUp, Zap, Search, Target, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LazyImage } from './optimized/lazy-image';
import type { ProductWithOffers } from '@shared/schema';

interface AdvancedSearchResult {
  product: ProductWithOffers;
  relevanceScore: number;
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'synonym';
}

interface SearchMetadata {
  totalResults: number;
  searchStrategy?: string;
  detectedIntent?: string;
  confidence?: number;
}

interface EnhancedSearchResultsProps {
  results: AdvancedSearchResult[];
  metadata?: SearchMetadata;
  isLoading?: boolean;
  onProductClick?: (product: ProductWithOffers) => void;
}

const matchTypeIcons = {
  exact: Search,
  fuzzy: Zap,
  semantic: TrendingUp,
  synonym: Hash,
};

const matchTypeColors = {
  exact: 'bg-success text-success border-green-200',
  fuzzy: 'bg-primary text-primary border-blue-200',
  semantic: 'bg-secondary text-secondary border-purple-200',
  synonym: 'bg-warning text-warning border-orange-200',
};

const matchTypeLabels = {
  exact: 'Exact Match',
  fuzzy: 'Fuzzy Match',
  semantic: 'Semantic Match',
  synonym: 'Synonym Match',
};

// Helper function to calculate product metrics (cached per product)
const getProductMetrics = (product: ProductWithOffers) => {
  const offers = product.offers || [];
  const prices = offers.map((o) => Number(o.price));
  const ratings = offers.map((o) => Number(o.rating) || 0);

  return {
    minPrice: prices.length ? Math.min(...prices) : Infinity,
    maxRating: ratings.length ? Math.max(...ratings) : 0,
    bestOffer: offers.length
      ? offers.reduce((best, current) =>
          Number(current.price) < Number(best.price) ? current : best
        )
      : null,
    averageRating: ratings.length ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : 0,
    totalReviews: offers.reduce((sum, offer) => sum + (offer.reviewCount || 0), 0),
  };
};

export const EnhancedSearchResults = memo(
  ({ results, metadata, isLoading = false, onProductClick }: EnhancedSearchResultsProps) => {
    const [sortBy, setSortBy] = useState<'relevance' | 'price' | 'rating'>('relevance');

    // Memoize product metrics to avoid recalculation
    const resultsWithMetrics = useMemo(() => {
      return results.map((result) => ({
        ...result,
        metrics: getProductMetrics(result.product),
      }));
    }, [results]);

    // Memoize sorted results to avoid re-sorting on every render
    const sortedResults = useMemo(() => {
      return [...resultsWithMetrics].sort((a, b) => {
        switch (sortBy) {
          case 'relevance':
            return b.relevanceScore - a.relevanceScore;
          case 'price':
            return a.metrics.minPrice - b.metrics.minPrice;
          case 'rating':
            return b.metrics.maxRating - a.metrics.maxRating;
          default:
            return 0;
        }
      });
    }, [resultsWithMetrics, sortBy]);

    // Memoize sort handlers
    const handleSortChange = useCallback((newSortBy: 'relevance' | 'price' | 'rating') => {
      setSortBy(newSortBy);
    }, []);

    if (isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <div className="bg-muted h-20 w-20 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-4 w-3/4 rounded"></div>
                    <div className="bg-muted h-3 w-1/2 rounded"></div>
                    <div className="bg-muted h-3 w-1/4 rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (results.length === 0) {
      return (
        <Card className="py-12 text-center">
          <CardContent>
            <Search className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-2 text-lg font-semibold">No results found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Search Metadata */}
        {metadata && (
          <Card className="bg-primary dark:bg-primary/30 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="text-primary h-4 w-4" />
                    <span className="text-primary dark:text-primary font-medium">
                      {metadata.totalResults} results found
                    </span>
                  </div>

                  {metadata.detectedIntent && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-primary text-primary">
                        Intent: {metadata.detectedIntent.replace(/_/g, ' ')}
                      </Badge>
                      {metadata.confidence && (
                        <Badge variant="outline" className="text-xs">
                          {(metadata.confidence * 100).toFixed(0)}% confident
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {metadata.searchStrategy && (
                  <Badge variant="outline" className="text-xs">
                    Strategy: {metadata.searchStrategy}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sort Controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Search Results</h2>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Sort by:</span>
            <div className="flex gap-1">
              {[
                { key: 'relevance' as const, label: 'Relevance' },
                { key: 'price' as const, label: 'Price' },
                { key: 'rating' as const, label: 'Rating' },
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={sortBy === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {sortedResults.map((result, index) => {
            const { product, relevanceScore, matchType, metrics } = result;
            const MatchIcon = matchTypeIcons[matchType];
            const { bestOffer, averageRating, totalReviews } = metrics;

            return (
              <Card
                key={`${product.id}-${index}`}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => onProductClick?.(product)}
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                      <LazyImage
                        src={product.image || '/placeholder-product.jpg'}
                        alt={product.name}
                        className="h-20 w-20 rounded-lg border object-cover"
                      />
                    </div>

                    {/* Product Details */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="mb-1 truncate text-lg leading-tight font-semibold">
                            {product.name}
                          </h3>
                          {product.brand && (
                            <p className="text-muted-foreground mb-1 text-sm">
                              {product.brand} • {product.category}
                            </p>
                          )}
                        </div>

                        {/* Match Type Badge */}
                        <div className="ml-4 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`${matchTypeColors[matchType]} flex items-center gap-1`}
                          >
                            <MatchIcon className="h-3 w-3" />
                            {matchTypeLabels[matchType]}
                          </Badge>
                        </div>
                      </div>

                      {/* Relevance Score */}
                      <div className="mb-3">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">Relevance:</span>
                          <span className="text-xs font-medium">
                            {(relevanceScore * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={relevanceScore * 100} className="h-1" />
                      </div>

                      {/* Product Description */}
                      {product.description && (
                        <p className="text-muted-foreground mb-3 line-clamp-2 text-sm">
                          {product.description}
                        </p>
                      )}

                      {/* Offers Summary */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {bestOffer && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground text-sm">Best Price:</span>
                              <span className="text-primary text-lg font-semibold">
                                ${Number(bestOffer.price).toFixed(2)}
                              </span>
                              {product.offers && product.offers.length > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{product.offers.length - 1} more
                                </Badge>
                              )}
                            </div>
                          )}

                          {averageRating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="text-warning h-4 w-4 fill-yellow-400" />
                              <span className="text-sm font-medium">
                                {averageRating.toFixed(1)}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                ({totalReviews} reviews)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Available Retailers */}
                        {product.offers && product.offers.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground text-xs">Available at:</span>
                            <div className="flex -space-x-1">
                              {product.offers.slice(0, 3).map((offer, idx) => (
                                <div
                                  key={idx}
                                  className="border-background h-6 w-6 overflow-hidden rounded-full border-2"
                                  title={offer.retailer?.name}
                                >
                                  <LazyImage
                                    src={offer.retailer?.logo || '/placeholder-retailer.jpg'}
                                    alt={offer.retailer?.name || 'Retailer'}
                                    className="h-full w-full object-cover"
                                  />
                                </div>
                              ))}
                              {product.offers.length > 3 && (
                                <div className="border-background bg-muted flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-medium">
                                  +{product.offers.length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Load More */}
        {results.length >= 20 && (
          <div className="text-center">
            <Button variant="outline">Load More Results</Button>
          </div>
        )}
      </div>
    );
  }
);

EnhancedSearchResults.displayName = 'EnhancedSearchResults';
