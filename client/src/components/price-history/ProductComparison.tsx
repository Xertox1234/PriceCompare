import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Grid, Layers, BarChart2, TrendingUp } from "lucide-react";
import { PriceHistoryChart } from "./PriceHistoryChart";
import { useProductComparison, ComparisonProduct } from "@/hooks/useProductComparison";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { createLogger } from "@/utils/logger";

const log = createLogger('ProductComparison');

interface PriceHistoryData {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

interface ProductComparisonProps {
  initialProducts?: ComparisonProduct[];
  onClose?: () => void;
  // Function to fetch price history for a product
  fetchPriceHistory?: (productId: number, days: number) => Promise<PriceHistoryData[]>;
}

const PRODUCT_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Green
  "#f59e0b", // Amber
  "#ef4444", // Red
];

export function ProductComparison({
  initialProducts = [],
  onClose,
  fetchPriceHistory,
}: ProductComparisonProps) {
  const {
    products,
    settings,
    removeProduct,
    clearAll,
    updateSettings,
    toggleMode,
  } = useProductComparison();

  const [priceHistoryData, setPriceHistoryData] = useState<
    Record<number, PriceHistoryData[]>
  >({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  // Add initial products
  useEffect(() => {
    initialProducts.forEach((product) => {
      // This would call addProduct from the hook
      // For now, we'll handle it differently
    });
  }, [initialProducts]);

  // Fetch price history when products change
  useEffect(() => {
    if (!fetchPriceHistory) return;

    products.forEach((product) => {
      if (!priceHistoryData[product.id] && !loading[product.id]) {
        setLoading((prev) => ({ ...prev, [product.id]: true }));
        fetchPriceHistory(product.id, settings.timeRange)
          .then((data) => {
            setPriceHistoryData((prev) => ({ ...prev, [product.id]: data }));
          })
          .catch((error) => {
            log.error(`Error fetching price history for product ${product.id}:`, { error });
          })
          .finally(() => {
            setLoading((prev) => ({ ...prev, [product.id]: false }));
          });
      }
    });
  }, [products, settings.timeRange, fetchPriceHistory]);

  if (products.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Products to Compare</h3>
        <p className="text-sm text-muted-foreground">
          Add products to start comparing their price histories
        </p>
      </Card>
    );
  }

  // Transform data for overlay mode
  const getOverlayChartData = () => {
    const allDataByDate = new Map<string, any>();

    products.forEach((product, productIndex) => {
      const data = priceHistoryData[product.id] || [];

      data.forEach((item) => {
        const date = typeof item.recordedAt === 'string'
          ? new Date(item.recordedAt)
          : item.recordedAt;
        const dateKey = format(date, "yyyy-MM-dd");

        if (!allDataByDate.has(dateKey)) {
          allDataByDate.set(dateKey, { date: dateKey, timestamp: date.getTime() });
        }

        // Use average price across all retailers for each product
        const productKey = `product_${product.id}`;
        const currentValue = allDataByDate.get(dateKey)![productKey];
        const newPrice = parseFloat(item.price);

        if (currentValue === undefined) {
          allDataByDate.get(dateKey)![productKey] = newPrice;
        } else {
          // Average if multiple data points on same date
          allDataByDate.get(dateKey)![productKey] = (currentValue + newPrice) / 2;
        }
      });
    });

    return Array.from(allDataByDate.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((item) => {
        const { timestamp, ...rest } = item;
        return rest;
      });
  };

  // Calculate price statistics for insights
  const getPriceInsights = () => {
    const insights = products.map((product) => {
      const data = priceHistoryData[product.id] || [];
      if (data.length === 0) return null;

      const prices = data.map((item) => parseFloat(item.price));
      const currentPrice = prices[prices.length - 1];
      const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const lowestPrice = Math.min(...prices);
      const highestPrice = Math.max(...prices);

      const savingsVsHighest = highestPrice - currentPrice;
      const percentageDiff = ((currentPrice - averagePrice) / averagePrice) * 100;

      return {
        product,
        currentPrice,
        averagePrice,
        lowestPrice,
        highestPrice,
        savingsVsHighest,
        percentageDiff,
        isGoodDeal: percentageDiff < -5, // 5% below average
      };
    });

    return insights.filter((i) => i !== null);
  };

  const insights = getPriceInsights();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5" />
            <h2 className="text-xl font-bold">Product Comparison</h2>
            <span className="text-sm text-muted-foreground">
              ({products.length} product{products.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">View Mode:</span>
            <Button
              variant={settings.mode === 'side-by-side' ? 'default' : 'outline'}
              size="sm"
              onClick={toggleMode}
              className="gap-2"
            >
              {settings.mode === 'side-by-side' ? (
                <>
                  <Grid className="h-4 w-4" />
                  Side by Side
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" />
                  Overlay
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Time Range:</span>
            <Select
              value={settings.timeRange.toString()}
              onValueChange={(value) => updateSettings({ timeRange: parseInt(value) })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
                <SelectItem value="365">1 Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear All
          </Button>
        </div>
      </Card>

      {/* Price Insights */}
      {insights.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Price Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {insights.map((insight, index) => {
              if (!insight) return null;

              return (
                <div
                  key={insight.product.id}
                  className={`p-3 rounded-lg border-2 ${
                    insight.isGoodDeal
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm truncate flex-1">
                      {insight.product.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(insight.product.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current:</span>
                      <span className="font-semibold">
                        ${insight.currentPrice.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average:</span>
                      <span>${insight.averagePrice.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">Best:</span>
                      <span className="text-green-600 font-semibold">
                        ${insight.lowestPrice.toFixed(2)}
                      </span>
                    </div>
                    {insight.isGoodDeal && (
                      <div className="pt-1 mt-1 border-t border-green-200">
                        <span className="text-green-700 font-semibold">
                          🎉 Great Deal!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Charts */}
      {settings.mode === 'side-by-side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((product) => (
            <div key={product.id} className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeProduct(product.id)}
                className="absolute top-2 right-2 z-10 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <PriceHistoryChart
                data={priceHistoryData[product.id] || []}
                isLoading={loading[product.id]}
              />
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Overlay Comparison</h3>
          {loading[products[0]?.id] ? (
            <Skeleton className="h-[400px] w-full" />
          ) : (
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={getOverlayChartData()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    className="text-xs"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !label) return null;

                      return (
                        <Card className="p-3 border-2">
                          <p className="font-semibold text-sm mb-2">
                            {format(new Date(label), "MMM d, yyyy")}
                          </p>
                          <div className="space-y-1">
                            {payload.map((entry: any, index: number) => {
                              const productId = parseInt(entry.dataKey.split("_")[1]);
                              const product = products.find((p) => p.id === productId);

                              return (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <span className="text-sm flex items-center gap-2">
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {product?.name}
                                  </span>
                                  <span className="font-semibold text-sm">
                                    ${parseFloat(entry.value).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    }}
                  />
                  <Legend />
                  {products.map((product, index) => (
                    <Line
                      key={product.id}
                      type="monotone"
                      dataKey={`product_${product.id}`}
                      stroke={PRODUCT_COLORS[index % PRODUCT_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name={product.name}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
