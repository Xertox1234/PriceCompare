import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { InteractiveTooltip } from './InteractiveTooltip';
import { ChartExport } from './ChartExport';
import { TrendingDown } from 'lucide-react';
import { createLogger } from '@/utils/logger';
import { cn } from '@/lib/utils';

interface PriceHistoryData {
  id: number;
  productId: number;
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: string;
  recordedAt: Date | string;
}

interface PriceHistoryChartProps {
  data: PriceHistoryData[];
  isLoading?: boolean;
  selectedRetailerIds?: number[];
  onSetAlert?: (retailerId: number, price: number) => void;
  onViewRetailer?: (retailerId: number) => void;
  productName?: string;
  productId?: number;
  timeRange?: number | null;
  onChartClick?: (price: number) => void;
  onTimeRangeChange?: (days: number) => void;
}

// Color palette for different retailers
const RETAILER_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const logger = createLogger('PriceHistoryChart');

export function PriceHistoryChart({
  data,
  isLoading,
  selectedRetailerIds,
  onSetAlert,
  onViewRetailer,
  productName = 'Product',
  productId,
  timeRange,
  onChartClick,
  onTimeRangeChange,
}: PriceHistoryChartProps) {
  const [hiddenRetailers, setHiddenRetailers] = useState<Set<number>>(new Set());
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const getNumericPrice = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  // Calculate historical context for tooltips
  const historicalContext = useMemo(() => {
    if (!data || data.length === 0) return undefined;

    const prices = data.map((item) => parseFloat(item.price));
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);

    return {
      averagePrice,
      lowestPrice,
      highestPrice,
    };
  }, [data]);

  // Detect significant price drops (>15%) for annotations
  const priceDropAnnotations = useMemo(() => {
    if (!data || data.length === 0) return [];

    const annotations: Array<{
      date: string;
      retailerId: number;
      drop: number;
      retailerName: string;
    }> = [];

    // Group data by retailer
    const dataByRetailer = new Map<number, typeof data>();
    data.forEach((item) => {
      if (!dataByRetailer.has(item.retailerId)) {
        dataByRetailer.set(item.retailerId, []);
      }
      const retailerData = dataByRetailer.get(item.retailerId);
      if (retailerData) {
        retailerData.push(item);
      } else {
        // Defensive: Initialize if missing (shouldn't happen in normal flow)
        logger.warn(`Missing retailer data for ID: ${item.retailerId}, initializing`);
        dataByRetailer.set(item.retailerId, [item]);
      }
    });

    // Check each retailer's price history for significant drops
    dataByRetailer.forEach((retailerData, retailerId) => {
      const sorted = [...retailerData].sort((a, b) => {
        const dateA = typeof a.recordedAt === 'string' ? new Date(a.recordedAt) : a.recordedAt;
        const dateB = typeof b.recordedAt === 'string' ? new Date(b.recordedAt) : b.recordedAt;
        return dateA.getTime() - dateB.getTime();
      });

      for (let i = 1; i < sorted.length; i++) {
        const prevPrice = parseFloat(sorted[i - 1].price);
        const currPrice = parseFloat(sorted[i].price);
        const drop = ((prevPrice - currPrice) / prevPrice) * 100;

        if (drop > 15) {
          const date =
            typeof sorted[i].recordedAt === 'string'
              ? new Date(sorted[i].recordedAt)
              : sorted[i].recordedAt;
          annotations.push({
            date: format(date, 'yyyy-MM-dd'),
            retailerId,
            drop,
            retailerName: sorted[i].retailerName,
          });
        }
      }
    });

    return annotations;
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-[400px] w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex h-[400px] flex-col items-center justify-center text-center">
          <p className="text-muted-foreground text-lg">No price history available yet</p>
          <p className="text-muted-foreground mt-2 text-sm">
            Price tracking will begin shortly and historical data will appear here
          </p>
        </div>
      </Card>
    );
  }

  // Transform data for Recharts
  // Group by date and create a data point for each date with all retailers
  const dataByDate = new Map<string, Record<string, string | number>>();

  data.forEach((item) => {
    const date = typeof item.recordedAt === 'string' ? new Date(item.recordedAt) : item.recordedAt;
    const dateKey = format(date, 'yyyy-MM-dd');

    if (!dataByDate.has(dateKey)) {
      dataByDate.set(dateKey, { date: dateKey, timestamp: date.getTime() });
    }

    const retailerKey = `retailer_${item.retailerId}`;
    const dateData = dataByDate.get(dateKey);
    if (dateData) {
      dateData[retailerKey] = parseFloat(item.price);
    } else {
      // Defensive: Initialize if missing (shouldn't happen in normal flow)
      logger.warn(`Missing date data for key: ${dateKey}, initializing`);
      dataByDate.set(dateKey, {
        date: dateKey,
        timestamp: date.getTime(),
        [retailerKey]: parseFloat(item.price),
      });
    }
  });

  // Convert to array and sort by date
  const chartData = Array.from(dataByDate.values())
    .sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
    .map((item) => {
      const { timestamp: _timestamp, ...rest } = item;
      return rest;
    });

  // Get unique retailers
  const retailers = Array.from(
    new Map(
      data.map((item) => [
        item.retailerId,
        { id: item.retailerId, name: item.retailerName, logo: item.retailerLogo },
      ])
    ).values()
  );

  // Filter retailers if selectedRetailerIds is provided
  const displayRetailers = selectedRetailerIds
    ? retailers.filter((r) => selectedRetailerIds.includes(r.id))
    : retailers;

  // Toggle retailer visibility
  const toggleRetailer = (retailerId: number) => {
    const newHidden = new Set(hiddenRetailers);
    if (newHidden.has(retailerId)) {
      newHidden.delete(retailerId);
    } else {
      newHidden.add(retailerId);
    }
    setHiddenRetailers(newHidden);
  };

  return (
    <Card className="p-6" id="price-history-chart">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Price History</h3>
            <p className="text-muted-foreground text-sm">
              Track price changes over time across different retailers
            </p>
          </div>
          {productId && (
            <ChartExport
              chartElementId="price-history-chart"
              data={data}
              productName={productName}
              productId={productId}
              timeRange={timeRange ?? undefined}
            />
          )}
        </div>

        {/* Time Range Selector */}
        {onTimeRangeChange && (
          <div className="flex items-center gap-2" role="group" aria-label="Time range selector">
            <span className="text-muted-foreground text-sm font-medium">Show:</span>
            {[
              { label: '7 Days', days: 7 },
              { label: '30 Days', days: 30 },
              { label: '90 Days', days: 90 },
            ].map(({ label, days }) => (
              <button
                key={days}
                onClick={() => onTimeRangeChange(days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  timeRange === days
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                aria-pressed={timeRange === days}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Retailer legend with toggle */}
        <div className="flex flex-wrap gap-3">
          {displayRetailers.map((retailer, index) => {
            const isHidden = hiddenRetailers.has(retailer.id);
            const color = RETAILER_COLORS[index % RETAILER_COLORS.length];

            return (
              <button
                key={retailer.id}
                onClick={() => toggleRetailer(retailer.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-1.5 transition-all',
                  isHidden
                    ? 'border-border bg-muted opacity-40'
                    : 'border-border bg-card hover:shadow-sm'
                )}
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: isHidden ? 'var(--muted-foreground)' : color,
                  }}
                />
                <span className="text-sm font-medium">{retailer.name}</span>
              </button>
            );
          })}
        </div>

        {/* Price Drop Alerts */}
        {priceDropAnnotations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {priceDropAnnotations.slice(0, 3).map((annotation, index) => (
              <Badge key={index} variant="destructive" className="text-xs">
                <TrendingDown className="mr-1 h-3 w-3" />
                {annotation.retailerName}: {annotation.drop.toFixed(0)}% drop on{' '}
                {format(new Date(annotation.date), 'MMM d')}
              </Badge>
            ))}
            {priceDropAnnotations.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{priceDropAnnotations.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Chart */}
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string | number | Date) => format(new Date(value), 'MMM d')}
                className="text-xs"
              />
              <YAxis
                tickFormatter={(value: number) => `$${value.toFixed(2)}`}
                className="text-xs"
              />
              <Tooltip
                content={(props) => (
                  <InteractiveTooltip
                    {...props}
                    retailers={retailers}
                    onSetAlert={onSetAlert}
                    onViewRetailer={onViewRetailer}
                    historicalContext={historicalContext}
                  />
                )}
              />
              <Legend content={() => null} />

              {/* Average price reference line */}
              {historicalContext && (
                <ReferenceLine
                  y={historicalContext.averagePrice}
                  stroke="hsl(210 5% 60%)"
                  strokeDasharray="3 3"
                  label={{ value: 'Avg', position: 'right', fill: 'hsl(210 5% 60%)', fontSize: 12 }}
                />
              )}

              {displayRetailers.map((retailer, index) => {
                if (hiddenRetailers.has(retailer.id)) return null;

                const color = RETAILER_COLORS[index % RETAILER_COLORS.length];
                return (
                  <Line
                    key={retailer.id}
                    type="monotone"
                    dataKey={`retailer_${retailer.id}`}
                    stroke={color}
                    strokeWidth={2}
                    dot={
                      onChartClick
                        ? (dotProps: unknown) => {
                            if (!dotProps || typeof dotProps !== 'object') return null;
                            const props = dotProps as Record<string, unknown>;

                            const cx = typeof props.cx === 'number' ? props.cx : null;
                            const cy = typeof props.cy === 'number' ? props.cy : null;
                            if (cx === null || cy === null) return null;

                            const price = getNumericPrice(props.value);
                            const payload =
                              props.payload && typeof props.payload === 'object'
                                ? (props.payload as Record<string, unknown>)
                                : null;
                            const date =
                              payload && typeof payload.date === 'string' ? payload.date : null;

                            return (
                              <circle
                                className="recharts-dot"
                                cx={cx}
                                cy={cy}
                                r={4}
                                fill={color}
                                style={{ cursor: 'pointer' }}
                                data-price={price !== null ? String(price) : undefined}
                                data-date={date ?? undefined}
                                onClick={() => {
                                  if (price !== null) onChartClick(price);
                                }}
                              />
                            );
                          }
                        : { fill: color, r: 4 }
                    }
                    activeDot={
                      onChartClick
                        ? (dotProps: unknown) => {
                            if (!dotProps || typeof dotProps !== 'object') return null;
                            const props = dotProps as Record<string, unknown>;

                            const cx = typeof props.cx === 'number' ? props.cx : null;
                            const cy = typeof props.cy === 'number' ? props.cy : null;
                            if (cx === null || cy === null) return null;

                            const price = getNumericPrice(props.value);
                            const payload =
                              props.payload && typeof props.payload === 'object'
                                ? (props.payload as Record<string, unknown>)
                                : null;
                            const date =
                              payload && typeof payload.date === 'string' ? payload.date : null;

                            return (
                              <circle
                                className="recharts-dot"
                                cx={cx}
                                cy={cy}
                                r={6}
                                fill={color}
                                style={{ cursor: 'pointer' }}
                                data-price={price !== null ? String(price) : undefined}
                                data-date={date ?? undefined}
                                onClick={() => {
                                  if (price !== null) onChartClick(price);
                                }}
                              />
                            );
                          }
                        : { r: 6 }
                    }
                    name={retailer.name}
                    connectNulls
                  />
                );
              })}

              {/* Brush for zoom/pan functionality */}
              <Brush
                dataKey="date"
                height={30}
                stroke="hsl(217 91% 60%)"
                tickFormatter={(value: string | number | Date) => format(new Date(value), 'MMM d')}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={(range) => {
                  if (range && 'startIndex' in range && 'endIndex' in range) {
                    setBrushStartIndex(range.startIndex);
                    setBrushEndIndex(range.endIndex);
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
