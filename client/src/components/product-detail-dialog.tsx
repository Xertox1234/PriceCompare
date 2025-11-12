import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductWithOffers } from "@shared/schema";
import { PriceHistoryChart } from "./price-history/PriceHistoryChart";
import { TimeRangeSelector, type TimeRange } from "./price-history/TimeRangeSelector";
import { PriceTrendIndicator } from "./price-history/PriceTrendIndicator";
import { BestTimeToBuy } from "./price-history/BestTimeToBuy";
import { TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProductDetailDialogProps {
  product: ProductWithOffers | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailDialog({
  product,
  open,
  onOpenChange,
}: ProductDetailDialogProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const { toast } = useToast();

  // Handler for setting price alert from interactive tooltip
  const handleSetAlert = useCallback((retailerId: number, price: number) => {
    const retailer = product?.offers?.find(o => o.retailer.id === retailerId)?.retailer;
    toast({
      title: "Price Alert Created",
      description: `You'll be notified when the price at ${retailer?.name || 'this retailer'} drops below $${price.toFixed(2)}`,
    });
    // TODO: Implement actual alert creation API call
  }, [product, toast]);

  // Handler for viewing retailer from interactive tooltip
  const handleViewRetailer = useCallback((retailerId: number) => {
    const offer = product?.offers?.find(o => o.retailer.id === retailerId);
    if (offer?.productUrl) {
      window.open(offer.productUrl, '_blank', 'noopener,noreferrer');
    }
  }, [product]);

  // Fetch price history
  const { data: priceHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["priceHistory", product?.id, timeRange],
    queryFn: async () => {
      if (!product?.id) return [];
      const url = timeRange
        ? `/api/products/${product.id}/price-history?days=${timeRange}`
        : `/api/products/${product.id}/price-history`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch price history");
      return response.json();
    },
    enabled: !!product?.id && open,
  });

  // Fetch price trend
  const { data: priceTrend, isLoading: trendLoading } = useQuery({
    queryKey: ["priceTrend", product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const response = await fetch(`/api/products/${product.id}/price-trend`);
      if (!response.ok) throw new Error("Failed to fetch price trend");
      return response.json();
    },
    enabled: !!product?.id && open,
  });

  // Fetch best time to buy
  const { data: bestTimeToBuy, isLoading: bestTimeLoading } = useQuery({
    queryKey: ["bestTimeToBuy", product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      const response = await fetch(`/api/products/${product.id}/best-time-to-buy`);
      if (!response.ok) throw new Error("Failed to fetch best time to buy");
      return response.json();
    },
    enabled: !!product?.id && open,
  });

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {product.name}
            <TrendingUp className="w-5 h-5 text-primary" />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Price History</TabsTrigger>
            <TabsTrigger value="analysis">Buy Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4 mt-4">
            {/* Time Range Selector */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Time Range</h3>
              <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
            </div>

            {/* Price Trend Summary */}
            <PriceTrendIndicator data={priceTrend} isLoading={trendLoading} />

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

          <TabsContent value="analysis" className="space-y-4 mt-4">
            <div className="space-y-6">
              {/* Best Time to Buy Analysis */}
              <BestTimeToBuy data={bestTimeToBuy} isLoading={bestTimeLoading} />

              {/* Current Offers */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Current Offers</h3>
                <div className="grid gap-3">
                  {product.offers?.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {offer.retailer.logo && (
                          <img
                            src={offer.retailer.logo}
                            alt={offer.retailer.name}
                            className="w-8 h-8 object-contain"
                          />
                        )}
                        <span className="font-medium">{offer.retailer.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold">
                            ${parseFloat(offer.price).toFixed(2)}
                          </div>
                          {offer.originalPrice && parseFloat(offer.originalPrice) > parseFloat(offer.price) && (
                            <div className="text-sm text-muted-foreground line-through">
                              ${parseFloat(offer.originalPrice).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <a
                          href={offer.productUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
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
