import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductWithOffers } from '@shared/schema';
import { PriceHistoryChart } from './price-history/PriceHistoryChart';
import { TimeRangeSelector, type TimeRange } from './price-history/TimeRangeSelector';
import { PriceTrendIndicator } from './price-history/PriceTrendIndicator';
import { BestTimeToBuy } from './price-history/BestTimeToBuy';
import { PriceVolatilityScore } from './price-history/PriceVolatilityScore';
import { SeasonalPatterns } from './price-history/SeasonalPatterns';
import { RetailerReliability } from './price-history/RetailerReliability';
import { TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/useMediaQuery';

// Type definitions for API responses (matching backend response shapes)
interface PriceHistoryData {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

interface PriceTrendData {
  productId: number;
  currentPrice: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  trend: 'rising' | 'falling' | 'stable';
  changePercentage: number;
  daysAnalyzed: number;
}

interface BestTimeAnalysis {
  productId: number;
  currentPrice: number;
  historicalAverage: number;
  lowestPriceLast90Days: number;
  daysSinceLowest: number;
  recommendation: 'buy_now' | 'wait' | 'good_deal';
  confidenceScore: number;
  priceChangeVelocity: number;
}

interface VolatilityData {
  score: number;
  level: 'low' | 'moderate' | 'high' | 'very-high';
  standardDeviation: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  recommendation: string;
}

interface SeasonalAnalysis {
  hasSeasonalPattern: boolean;
  monthlyPatterns: Array<{
    month: number;
    monthName: string;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    dataPoints: number;
  }>;
  seasonalPatterns: Array<{
    season: 'winter' | 'spring' | 'summer' | 'fall';
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    dataPoints: number;
  }>;
  bestMonthToBuy: {
    month: number;
    monthName: string;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    dataPoints: number;
  } | null;
  worstMonthToBuy: {
    month: number;
    monthName: string;
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    dataPoints: number;
  } | null;
  bestSeasonToBuy: {
    season: 'winter' | 'spring' | 'summer' | 'fall';
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    dataPoints: number;
  } | null;
  recommendation: { timeframe: string; reason: string; expectedSavings: number } | null;
  confidence: 'low' | 'medium' | 'high';
}

interface ReliabilityScore {
  retailerId: number;
  retailerName: string;
  overallScore: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: {
    priceStability: number;
    availability: number;
    competitiveness: number;
    consistency: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

interface ProductDetailDialogProps {
  product: ProductWithOffers | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({ product, open, onOpenChange }: ProductDetailDialogProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Mutation for creating price alerts
  const createAlertMutation = useMutation({
    mutationFn: async (data: { productId: number; targetPrice: number; notifyForum: boolean }) => {
      const res = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to create price alert');
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
    },
  });

  // Handler for setting price alert from interactive tooltip
  const handleSetAlert = useCallback(
    (retailerId: number, price: number) => {
      if (!product?.id) return;

      const retailer = product?.offers?.find((o) => o.retailer.id === retailerId)?.retailer;

      createAlertMutation.mutate(
        {
          productId: product.id,
          targetPrice: price,
          notifyForum: false,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Price Alert Created',
              description: `You'll be notified when the price at ${retailer?.name || 'this retailer'} drops below $${price.toFixed(2)}`,
            });
          },
          onError: (error: Error) => {
            toast({
              title: 'Failed to Create Alert',
              description:
                error.message === 'Unauthorized'
                  ? 'Please log in to create price alerts'
                  : error.message,
              variant: 'destructive',
            });
          },
        }
      );
    },
    [product, toast, createAlertMutation]
  );

  // Handler for viewing retailer from interactive tooltip
  const handleViewRetailer = useCallback(
    (retailerId: number) => {
      const offer = product?.offers?.find((o) => o.retailer.id === retailerId);
      if (offer?.productUrl) {
        window.open(offer.productUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [product]
  );

  // Fetch price history
  const { data: priceHistory, isLoading: historyLoading } = useQuery<PriceHistoryData[]>({
    queryKey: ['priceHistory', product?.id, timeRange],
    queryFn: async () => {
      if (!product?.id) return [];
      const url = timeRange
        ? `/api/products/${product.id}/price-history?days=${timeRange}`
        : `/api/products/${product.id}/price-history`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch price history');
      return response.json() as Promise<PriceHistoryData[]>;
    },
    enabled: !!product?.id && open,
  });

  // Fetch price trend
  const { data: priceTrend, isLoading: trendLoading } = useQuery<PriceTrendData | null>({
    queryKey: ['priceTrend', product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const response = await fetch(`/api/products/${product.id}/price-trend`);
      if (!response.ok) throw new Error('Failed to fetch price trend');
      return response.json() as Promise<PriceTrendData>;
    },
    enabled: !!product?.id && open,
  });

  // Fetch best time to buy
  const { data: bestTimeToBuy, isLoading: bestTimeLoading } = useQuery<BestTimeAnalysis | null>({
    queryKey: ['bestTimeToBuy', product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const response = await fetch(`/api/products/${product.id}/best-time-to-buy`);
      if (!response.ok) throw new Error('Failed to fetch best time to buy');
      return response.json() as Promise<BestTimeAnalysis>;
    },
    enabled: !!product?.id && open,
  });

  // Fetch price volatility
  const { data: volatility, isLoading: volatilityLoading } = useQuery<VolatilityData | null>({
    queryKey: ['volatility', product?.id, timeRange],
    queryFn: async () => {
      if (!product?.id) return null;
      const url = timeRange
        ? `/api/products/${product.id}/volatility?days=${timeRange}`
        : `/api/products/${product.id}/volatility`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch volatility');
      return response.json() as Promise<VolatilityData>;
    },
    enabled: !!product?.id && open,
  });

  // Fetch seasonal patterns
  const { data: seasonalPatterns, isLoading: seasonalLoading } = useQuery<SeasonalAnalysis | null>({
    queryKey: ['seasonalPatterns', product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const response = await fetch(`/api/products/${product.id}/seasonal-patterns`);
      if (!response.ok) throw new Error('Failed to fetch seasonal patterns');
      return response.json() as Promise<SeasonalAnalysis>;
    },
    enabled: !!product?.id && open,
  });

  // Fetch retailer reliability
  const { data: retailerReliability, isLoading: reliabilityLoading } = useQuery<
    ReliabilityScore[] | null
  >({
    queryKey: ['retailerReliability', product?.id, timeRange],
    queryFn: async () => {
      if (!product?.id) return null;
      const url = timeRange
        ? `/api/products/${product.id}/retailer-reliability?days=${timeRange}`
        : `/api/products/${product.id}/retailer-reliability`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch retailer reliability');
      return response.json() as Promise<ReliabilityScore[]>;
    },
    enabled: !!product?.id && open,
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto ${isMobile ? 'max-w-[95vw] p-4' : 'max-w-5xl'}`}
      >
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}
          >
            <span className="line-clamp-2">{product.name}</span>
            <TrendingUp
              className={`text-primary flex-shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`}
            />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history" className={isMobile ? 'text-sm' : ''}>
              {isMobile ? 'History' : 'Price History'}
            </TabsTrigger>
            <TabsTrigger value="analysis" className={isMobile ? 'text-sm' : ''}>
              {isMobile ? 'Analysis' : 'Buy Analysis'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="mt-4 space-y-4">
            {/* Time Range Selector */}
            <div
              className={`flex items-center justify-between ${isMobile ? 'flex-col gap-2' : ''}`}
            >
              <h3 className={`font-semibold ${isMobile ? 'w-full text-base' : 'text-lg'}`}>
                Time Range
              </h3>
              <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
            </div>

            {/* Price Trend Summary */}
            <PriceTrendIndicator data={priceTrend ?? null} isLoading={trendLoading} />

            {/* Price History Chart */}
            <PriceHistoryChart
              data={priceHistory || []}
              isLoading={historyLoading}
              onSetAlert={handleSetAlert}
              onViewRetailer={handleViewRetailer}
              productName={product.name}
              productId={product.id}
              timeRange={timeRange}
            />
          </TabsContent>

          <TabsContent value="analysis" className="mt-4 space-y-4">
            <div className="space-y-6">
              {/* Price Volatility Score */}
              <PriceVolatilityScore data={volatility ?? null} isLoading={volatilityLoading} />

              {/* Seasonal Patterns */}
              <SeasonalPatterns data={seasonalPatterns ?? null} isLoading={seasonalLoading} />

              {/* Best Time to Buy Analysis */}
              <BestTimeToBuy data={bestTimeToBuy ?? null} isLoading={bestTimeLoading} />

              {/* Retailer Reliability */}
              <RetailerReliability
                data={retailerReliability ?? null}
                isLoading={reliabilityLoading}
              />

              {/* Current Offers */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Current Offers</h3>
                <div className="grid gap-3">
                  {product.offers?.map((offer) => (
                    <div
                      key={offer.id}
                      className="hover:bg-muted/50 flex items-center justify-between rounded-lg border p-4 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {offer.retailer.logo && (
                          <img
                            src={offer.retailer.logo}
                            alt={offer.retailer.name}
                            className="h-8 w-8 object-contain"
                          />
                        )}
                        <span className="font-medium">{offer.retailer.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ${parseFloat(offer.price).toFixed(2)}
                          </div>
                          {offer.originalPrice &&
                            parseFloat(offer.originalPrice) > parseFloat(offer.price) && (
                              <div className="text-muted-foreground text-sm line-through">
                                ${parseFloat(offer.originalPrice).toFixed(2)}
                              </div>
                            )}
                        </div>
                        <a
                          href={offer.productUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors"
                        >
                          View Deal
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
