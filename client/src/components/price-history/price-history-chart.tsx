import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PriceDataPoint {
  date: string;
  price: number;
  retailerName?: string;
  retailerId?: number;
}

export interface PriceHistoryData {
  productName: string;
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  priceChange24h?: number;
  priceChangePercent24h?: number;
  priceChange7d?: number;
  priceChangePercent7d?: number;
  dataPoints: PriceDataPoint[];
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface PriceHistoryChartProps {
  data: PriceHistoryData;
  className?: string;
  showStats?: boolean;
}

export function PriceHistoryChart({ data, className, showStats = true }: PriceHistoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRetailers, setSelectedRetailers] = useState<Set<number>>(new Set());

  // Filter data based on time range
  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date;

    switch (timeRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data.dataPoints;
    }

    return data.dataPoints.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= cutoffDate;
    });
  }, [data.dataPoints, timeRange]);

  // Group data by retailer
  const retailerData = useMemo(() => {
    const retailers = new Map<number, { name: string; data: PriceDataPoint[] }>();

    filteredData.forEach(point => {
      if (point.retailerId && point.retailerName) {
        if (!retailers.has(point.retailerId)) {
          retailers.set(point.retailerId, {
            name: point.retailerName,
            data: []
          });
        }
        retailers.get(point.retailerId)!.data.push(point);
      }
    });

    return Array.from(retailers.entries()).map(([id, { name, data }]) => ({
      id,
      name,
      data: data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }));
  }, [filteredData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    // Combine all data points by date
    const dateMap = new Map<string, Record<string, any>>();

    filteredData.forEach(point => {
      const dateStr = new Date(point.date).toLocaleDateString();
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr });
      }
      const record = dateMap.get(dateStr)!;

      if (point.retailerName) {
        const key = `${point.retailerName}_${point.retailerId}`;
        record[key] = point.price;
      } else {
        record['price'] = point.price;
      }
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [filteredData]);

  // Calculate price trend
  const priceTrend = useMemo(() => {
    if (!data.priceChange24h) return 'stable';
    return data.priceChange24h < 0 ? 'down' : data.priceChange24h > 0 ? 'up' : 'stable';
  }, [data.priceChange24h]);

  const trendIcon = priceTrend === 'down' ? TrendingDown : priceTrend === 'up' ? TrendingUp : Minus;
  const TrendIcon = trendIcon;

  // Chart colors
  const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const toggleRetailer = (retailerId: number) => {
    const newSelected = new Set(selectedRetailers);
    if (newSelected.has(retailerId)) {
      newSelected.delete(retailerId);
    } else {
      newSelected.add(retailerId);
    }
    setSelectedRetailers(newSelected);
  };

  // Determine which retailers to show
  const visibleRetailers = retailerData.filter(r =>
    selectedRetailers.size === 0 || selectedRetailers.has(r.id)
  );

  return (
    <Card className={cn("p-6", className)}>
      {/* Header with Stats */}
      {showStats && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Price History</h3>
            <Badge variant={priceTrend === 'down' ? 'default' : priceTrend === 'up' ? 'destructive' : 'secondary'}>
              <TrendIcon className="mr-1 h-3 w-3" />
              {data.priceChangePercent24h !== undefined
                ? `${data.priceChangePercent24h > 0 ? '+' : ''}${data.priceChangePercent24h.toFixed(1)}% (24h)`
                : 'No change'}
            </Badge>
          </div>

          {/* Price Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current</p>
              <p className="text-2xl font-bold">${data.currentPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Lowest</p>
              <p className="text-2xl font-bold text-green-600">${data.lowestPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Highest</p>
              <p className="text-2xl font-bold text-red-600">${data.highestPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Average</p>
              <p className="text-2xl font-bold">${data.averagePrice.toFixed(2)}</p>
            </div>
          </div>

          {/* 7-day change if available */}
          {data.priceChange7d !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">7-day change:</span>
              <span className={cn(
                "font-medium",
                data.priceChange7d < 0 ? "text-green-600" : data.priceChange7d > 0 ? "text-red-600" : ""
              )}>
                {data.priceChange7d < 0 ? '' : '+'}{data.priceChange7d.toFixed(2)} ({data.priceChangePercent7d?.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['7d', '30d', '90d', '1y', 'all'] as TimeRange[]).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range)}
          >
            {range === '7d' ? '7 Days' :
             range === '30d' ? '30 Days' :
             range === '90d' ? '90 Days' :
             range === '1y' ? '1 Year' :
             'All Time'}
          </Button>
        ))}
      </div>

      {/* Retailer Filter (if multiple retailers) */}
      {retailerData.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground self-center">Retailers:</span>
          {retailerData.map((retailer, idx) => (
            <Button
              key={retailer.id}
              variant={selectedRetailers.size === 0 || selectedRetailers.has(retailer.id) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleRetailer(retailer.id)}
            >
              <div
                className="mr-2 h-3 w-3 rounded-full"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              {retailer.name}
            </Button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="mt-4" style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="text-sm font-medium">{label}</div>
                      {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted-foreground">{entry.name}:</span>
                          <span className="font-medium">${Number(entry.value).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            {/* Reference line for average price */}
            <ReferenceLine
              y={data.averagePrice}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              label={{ value: 'Avg', position: 'right' }}
            />
            {retailerData.length === 0 ? (
              <Line
                type="monotone"
                dataKey="price"
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Price"
              />
            ) : (
              visibleRetailers.map((retailer, idx) => (
                <Line
                  key={retailer.id}
                  type="monotone"
                  dataKey={`${retailer.name}_${retailer.id}`}
                  stroke={colors[idx % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={retailer.name}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data Summary */}
      {filteredData.length === 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          No price data available for the selected time range.
        </div>
      )}
      {filteredData.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {filteredData.length} price points from {new Date(filteredData[0].date).toLocaleDateString()} to{' '}
          {new Date(filteredData[filteredData.length - 1].date).toLocaleDateString()}
        </div>
      )}
    </Card>
  );
}
