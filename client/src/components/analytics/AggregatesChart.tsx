import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyAggregate, MonthlyAggregate } from '@/hooks/use-price-analytics';

interface AggregatesChartProps {
  data: WeeklyAggregate[] | MonthlyAggregate[];
  type: 'weekly' | 'monthly';
  title?: string;
  description?: string;
}

export function AggregatesChart({ data, type, title, description }: AggregatesChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((item) => {
        const isWeekly = 'week' in item;
        const label = isWeekly
          ? `W${item.week} ${item.year}`
          : `${getMonthName(item.month)} ${item.year}`;

        return {
          label,
          period: isWeekly ? item.week : item.month,
          year: item.year,
          min: parseFloat(item.minPrice),
          max: parseFloat(item.maxPrice),
          avg: parseFloat(item.avgPrice),
          median: item.medianPrice ? parseFloat(item.medianPrice) : null,
          volatility: item.volatilityScore ? parseFloat(item.volatilityScore) : null,
          change: isWeekly
            ? item.weekOverWeekChange
              ? parseFloat(item.weekOverWeekChange)
              : null
            : item.monthOverMonthChange
              ? parseFloat(item.monthOverMonthChange)
              : null,
        };
      })
      .reverse(); // Reverse to show oldest to newest
  }, [data]);

  const defaultTitle = type === 'weekly' ? 'Weekly Price Trends' : 'Monthly Price Trends';
  const defaultDescription =
    type === 'weekly'
      ? 'Price aggregates by week showing min, max, and average prices'
      : 'Price aggregates by month showing min, max, and average prices';

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title || defaultTitle}</CardTitle>
          <CardDescription>{description || defaultDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[300px] items-center justify-center">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || defaultTitle}</CardTitle>
        <CardDescription>{description || defaultDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="avg"
              stroke="#8884d8"
              name="Average"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="min"
              stroke="#82ca9d"
              name="Minimum"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            <Line
              type="monotone"
              dataKey="max"
              stroke="#ff7c7c"
              name="Maximum"
              strokeWidth={1}
              strokeDasharray="5 5"
            />
            {chartData.some((d) => d.median !== null) && (
              <Line
                type="monotone"
                dataKey="median"
                stroke="#ffc658"
                name="Median"
                strokeWidth={1}
                dot={{ r: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {/* Statistics Summary */}
        {(() => {
          // Extract last entry (guaranteed to exist due to chartData.length check above)
          const lastEntry = chartData[chartData.length - 1];
          if (!lastEntry) return null; // Should never happen, but satisfies TypeScript

          return (
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-muted-foreground text-sm">Current Avg</div>
                <div className="text-lg font-bold">${lastEntry.avg.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-sm">Period Change</div>
                <div
                  className={`text-lg font-bold ${
                    (lastEntry.change || 0) > 0
                      ? 'text-red-600'
                      : (lastEntry.change || 0) < 0
                        ? 'text-green-600'
                        : 'text-gray-600'
                  }`}
                >
                  {lastEntry.change !== null && lastEntry.change !== undefined
                    ? `${lastEntry.change > 0 ? '+' : ''}${lastEntry.change.toFixed(2)}%`
                    : 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-sm">Volatility</div>
                <div className="text-lg font-bold">
                  {lastEntry.volatility !== null && lastEntry.volatility !== undefined
                    ? `${lastEntry.volatility.toFixed(2)}%`
                    : 'N/A'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-sm">Price Range</div>
                <div className="text-lg font-bold">
                  ${lastEntry.min.toFixed(2)} - ${lastEntry.max.toFixed(2)}
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      avg: number;
      min: number;
      max: number;
      median: number | null;
      volatility: number | null;
      change: number | null;
    };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0 && payload[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border-border rounded-lg border p-3 shadow-lg">
        <p className="mb-2 font-semibold">{label}</p>
        <div className="space-y-1 text-sm">
          <p className="text-blue-600">Average: ${data.avg.toFixed(2)}</p>
          <p className="text-green-600">Minimum: ${data.min.toFixed(2)}</p>
          <p className="text-red-600">Maximum: ${data.max.toFixed(2)}</p>
          {data.median !== null && (
            <p className="text-yellow-600">Median: ${data.median.toFixed(2)}</p>
          )}
          {data.volatility !== null && (
            <p className="text-gray-600">Volatility: {data.volatility.toFixed(2)}%</p>
          )}
          {data.change !== null && (
            <p
              className={
                data.change > 0
                  ? 'text-red-600'
                  : data.change < 0
                    ? 'text-green-600'
                    : 'text-gray-600'
              }
            >
              Change: {data.change > 0 ? '+' : ''}
              {data.change.toFixed(2)}%
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function getMonthName(month: number): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return months[month - 1] || '';
}
