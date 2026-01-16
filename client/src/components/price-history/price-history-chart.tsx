import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

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

    return data.dataPoints.filter((point) => {
      const pointDate = new Date(point.date);
      return pointDate >= cutoffDate;
    });
  }, [data.dataPoints, timeRange]);

  // Group data by retailer
  const retailerData = useMemo(() => {
    const retailers = new Map<number, { name: string; data: PriceDataPoint[] }>();

    filteredData.forEach((point) => {
      if (point.retailerId && point.retailerName) {
        if (!retailers.has(point.retailerId)) {
          retailers.set(point.retailerId, {
            name: point.retailerName,
            data: [],
          });
        }
        const retailer = retailers.get(point.retailerId);
        if (retailer) {
          retailer.data.push(point);
        }
      }
    });

    return Array.from(retailers.entries()).map(([id, { name, data }]) => ({
      id,
      name,
      data: data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }));
  }, [filteredData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    // Combine all data points by date
    const dateMap = new Map<string, Record<string, string | number>>();

    filteredData.forEach((point) => {
      const dateStr = new Date(point.date).toLocaleDateString();
      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { date: dateStr });
      }
      const record = dateMap.get(dateStr);
      if (!record) return; // Should never happen after has/set check above

      if (point.retailerName) {
        const key = `${point.retailerName}_${point.retailerId}`;
        record[key] = point.price;
      } else {
        record['price'] = point.price;
      }
    });

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
    );
  }, [filteredData]);

  // Calculate price trend based on filtered data
  const priceTrend = useMemo(() => {
    if (filteredData.length < 2) return 'stable';

    // Compare current price to oldest price in filtered range
    const oldestPrice = filteredData[0].price;
    const newestPrice = filteredData[filteredData.length - 1].price;
    const priceDiff = newestPrice - oldestPrice;

    // Consider a change less than 1% as stable
    const threshold = oldestPrice * 0.01;

    if (priceDiff < -threshold) return 'down';
    if (priceDiff > threshold) return 'up';
    return 'stable';
  }, [filteredData]);

  // Calculate price change percentage for filtered range
  const priceChangePercentage = useMemo(() => {
    if (filteredData.length < 2) return 0;

    const oldestPrice = filteredData[0].price;
    const newestPrice = filteredData[filteredData.length - 1].price;

    return ((newestPrice - oldestPrice) / oldestPrice) * 100;
  }, [filteredData]);

  const trendIcon = priceTrend === 'down' ? TrendingDown : priceTrend === 'up' ? TrendingUp : Minus;
  const TrendIcon = trendIcon;

  // Get trend label for display
  const trendLabel = priceTrend === 'down' ? 'falling' : priceTrend === 'up' ? 'rising' : 'stable';

  // Chart colors
  const colors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

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
  const visibleRetailers = retailerData.filter(
    (r) => selectedRetailers.size === 0 || selectedRetailers.has(r.id)
  );

  return (
    <Card className={cn('p-6', className)}>
      {/* Header with Stats */}
      {showStats && (
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Price History</h3>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  priceTrend === 'down'
                    ? 'default'
                    : priceTrend === 'up'
                      ? 'destructive'
                      : 'secondary'
                }
                data-testid="price-change-percentage"
              >
                <TrendIcon className="mr-1 h-3 w-3" />
                {priceChangePercentage !== 0
                  ? `${priceChangePercentage > 0 ? '+' : ''}${priceChangePercentage.toFixed(1)}%`
                  : 'No change'}
              </Badge>
            </div>
          </div>

          {/* Price Trend Indicator */}
          <div
            className={cn(
              'flex items-center gap-2 text-sm',
              priceTrend === 'down' && 'text-success',
              priceTrend === 'up' && 'text-destructive',
              priceTrend === 'stable' && 'text-muted-foreground'
            )}
            data-testid="price-trend-indicator"
          >
            <TrendIcon className="h-4 w-4" />
            <span className="font-medium">
              Price is {trendLabel}
              {priceTrend !== 'stable' &&
                ` (${priceChangePercentage > 0 ? '+' : ''}${priceChangePercentage.toFixed(1)}% over ${timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : timeRange === '90d' ? '90 days' : timeRange === '1y' ? '1 year' : 'all time'})`}
            </span>
          </div>

          {/* Price Stats Grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="price-stats">
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Current</p>
              <p className="text-2xl font-bold">${data.currentPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Lowest</p>
              <p className="text-2xl font-bold text-success">${data.lowestPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Highest</p>
              <p className="text-2xl font-bold text-destructive">${data.highestPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Average</p>
              <p className="text-2xl font-bold">${data.averagePrice.toFixed(2)}</p>
            </div>
          </div>

          {/* 7-day change if available */}
          {data.priceChange7d !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">7-day change:</span>
              <span
                className={cn(
                  'font-medium',
                  data.priceChange7d < 0
                    ? 'text-success'
                    : data.priceChange7d > 0
                      ? 'text-destructive'
                      : ''
                )}
              >
                {data.priceChange7d < 0 ? '' : '+'}
                {data.priceChange7d.toFixed(2)} ({data.priceChangePercent7d?.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Time Range Selector */}
      <div className="mb-4 flex flex-wrap gap-2" data-testid="time-range-selector">
        {(['7d', '30d', '90d', '1y', 'all'] as TimeRange[]).map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range)}
          >
            {range === '7d'
              ? '7 Days'
              : range === '30d'
                ? '30 Days'
                : range === '90d'
                  ? '90 Days'
                  : range === '1y'
                    ? '1 Year'
                    : 'All Time'}
          </Button>
        ))}
      </div>

      {/* Retailer Filter (if multiple retailers) */}
      {retailerData.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-sm">Retailers:</span>
          {retailerData.map((retailer, idx) => (
            <Button
              key={retailer.id}
              variant={
                selectedRetailers.size === 0 || selectedRetailers.has(retailer.id)
                  ? 'default'
                  : 'outline'
              }
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
      <div className="mt-4" style={{ width: '100%', height: 400 }} data-testid="price-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                  <div className="bg-background rounded-lg border p-2 shadow-sm">
                    <div className="grid gap-2">
                      <div className="text-sm font-medium">{label}</div>
                      {payload.map(
                        (
                          entry: { color?: string; name?: string; value?: number },
                          index: number
                        ) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-medium">${Number(entry.value).toFixed(2)}</span>
                          </div>
                        )
                      )}
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
        <div className="text-muted-foreground mt-4 text-center text-sm">
          No price data available for the selected time range.
        </div>
      )}
      {filteredData.length > 0 && (
        <div className="text-muted-foreground mt-4 text-center text-sm">
          Showing {filteredData.length} price points from{' '}
          {new Date(filteredData[0].date).toLocaleDateString()} to{' '}
          {new Date(filteredData[filteredData.length - 1].date).toLocaleDateString()}
        </div>
      )}
    </Card>
  );
}
