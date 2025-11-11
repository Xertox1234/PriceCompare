import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, ExternalLink, Loader2 } from "lucide-react";
import { PriceHistoryChart, type PriceHistoryData } from "./price-history-chart";
import { usePriceHistory, usePriceStats } from "@/hooks/use-price-history";
import type { ProductWithOffers } from "@shared/schema";

interface PriceHistoryModalProps {
  product: ProductWithOffers;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}

export function PriceHistoryModal({ product, trigger, defaultOpen = false }: PriceHistoryModalProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Get the best offer for this product
  const bestOffer = product.offers?.[0] || product.offers?.reduce((best, offer) =>
    Number(offer.price) < Number(best.price) ? offer : best
  );

  const { data: history, isLoading: historyLoading } = usePriceHistory(
    product.id,
    bestOffer?.id,
    { limit: 365 } // Get up to 1 year of data
  );

  const { data: stats, isLoading: statsLoading } = usePriceStats(
    product.id,
    bestOffer?.id,
    365 // 1 year stats
  );

  const isLoading = historyLoading || statsLoading;

  // Transform history data for chart
  const chartData: PriceHistoryData | null = history && stats ? {
    productName: product.name,
    currentPrice: stats.currentPrice,
    lowestPrice: stats.lowestPrice,
    highestPrice: stats.highestPrice,
    averagePrice: stats.averagePrice,
    priceChange24h: stats.priceChange24h || 0,
    priceChangePercent24h: stats.priceChangePercent24h || 0,
    priceChange7d: stats.priceChange7d,
    priceChangePercent7d: stats.priceChangePercent7d,
    dataPoints: history.map(h => ({
      date: (h.recordedAt || h.createdAt || new Date()).toString(),
      price: Number(h.price),
      retailerId: bestOffer?.retailerId,
      retailerName: bestOffer?.retailer?.name
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } : null;

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <TrendingDown className="mr-2 h-4 w-4" />
      View Price History
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex-1">{product.name}</span>
            {bestOffer?.productUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => bestOffer.productUrl && window.open(bestOffer.productUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Product
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Track price changes over time and find the best deal
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && !chartData && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No price history available for this product yet.</p>
            <p className="text-sm mt-2">Price tracking will begin now.</p>
          </div>
        )}

        {!isLoading && chartData && chartData.dataPoints.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <p>No price data points recorded yet.</p>
            <p className="text-sm mt-2">Check back later for price history.</p>
          </div>
        )}

        {!isLoading && chartData && chartData.dataPoints.length > 0 && (
          <div className="space-y-4">
            <PriceHistoryChart data={chartData} showStats={true} />

            {/* Additional Insights */}
            <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <h4 className="font-semibold mb-2">Price Insights</h4>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    {chartData.currentPrice <= chartData.averagePrice ? (
                      <>
                        <TrendingDown className="h-4 w-4 text-green-600" />
                        <span>Current price is below average</span>
                      </>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4 text-red-600" />
                        <span>Current price is above average</span>
                      </>
                    )}
                  </li>
                  <li className="text-muted-foreground">
                    Savings from highest: ${(chartData.highestPrice - chartData.currentPrice).toFixed(2)}
                  </li>
                  <li className="text-muted-foreground">
                    Distance from lowest: ${(chartData.currentPrice - chartData.lowestPrice).toFixed(2)}
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Recommendation</h4>
                <p className="text-sm">
                  {chartData.currentPrice <= chartData.lowestPrice * 1.05 ? (
                    <span className="text-green-600 font-medium">
                      ✓ Great time to buy! Price is near the lowest recorded.
                    </span>
                  ) : chartData.currentPrice <= chartData.averagePrice ? (
                    <span className="text-blue-600 font-medium">
                      Good deal. Price is below average.
                    </span>
                  ) : (
                    <span className="text-amber-600 font-medium">
                      Consider waiting. Price is above average.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
