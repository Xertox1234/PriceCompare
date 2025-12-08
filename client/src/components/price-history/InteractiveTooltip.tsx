import { useState } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, ExternalLink, TrendingDown, TrendingUp, Calendar } from 'lucide-react';

interface TooltipDataPoint {
  retailerId: number;
  retailerName: string;
  retailerLogo: string | null;
  price: number;
  color: string;
  url?: string;
}

// Recharts payload entry type
interface RechartsPayloadEntry {
  dataKey: string;
  value?: number | string;
  color?: string;
  fill?: string;
  [key: string]: unknown;
}

interface InteractiveTooltipProps {
  active?: boolean;
  payload?: readonly RechartsPayloadEntry[];
  label?: string | number;
  retailers: Array<{ id: number; name: string; logo: string | null }>;
  onSetAlert?: (retailerId: number, price: number) => void;
  onViewRetailer?: (retailerId: number) => void;
  historicalContext?: {
    averagePrice: number;
    lowestPrice: number;
    highestPrice: number;
  };
  [key: string]: unknown; // Allow additional Recharts props
}

export function InteractiveTooltip({
  active,
  payload,
  label,
  retailers,
  onSetAlert,
  onViewRetailer,
  historicalContext,
}: InteractiveTooltipProps) {
  const [expanded, setExpanded] = useState(false);

  if (!active || !payload || payload.length === 0) return null;

  // Parse data points
  const dataPoints: TooltipDataPoint[] = payload.map((entry) => {
    const retailerId = parseInt(entry.dataKey.split('_')[1]);
    const retailer = retailers.find((r) => r.id === retailerId);

    return {
      retailerId,
      retailerName: retailer?.name || 'Unknown',
      retailerLogo: retailer?.logo || null,
      price: parseFloat(String(entry.value ?? 0)),
      color: entry.color || '#000000',
    };
  });

  // Sort by price (lowest first)
  dataPoints.sort((a, b) => a.price - b.price);

  const date = label ? new Date(label) : new Date();
  const lowestPrice = dataPoints[0];
  const highestPrice = dataPoints[dataPoints.length - 1];

  // Calculate price difference from average
  const getPriceDifference = (price: number) => {
    if (!historicalContext) return null;
    const diff = price - historicalContext.averagePrice;
    const percentDiff = (diff / historicalContext.averagePrice) * 100;
    return { diff, percentDiff };
  };

  return (
    <Card className="max-w-sm border-2 border-gray-200 shadow-xl">
      {/* Header */}
      <div className="border-b bg-gray-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <p className="text-sm font-semibold">{format(date, 'MMM d, yyyy')}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 text-xs"
          >
            {expanded ? 'Less' : 'More'}
          </Button>
        </div>
      </div>

      {/* Price List */}
      <div className="space-y-2 p-3">
        {dataPoints.map((point, index) => {
          const priceDiff = getPriceDifference(point.price);
          const isLowest = index === 0;
          const isHighest = index === dataPoints.length - 1;

          return (
            <div
              key={point.retailerId}
              className={`flex items-center justify-between rounded-md p-2 transition-colors ${
                isLowest
                  ? 'border border-green-200 bg-green-50'
                  : isHighest
                    ? 'border border-red-200 bg-red-50'
                    : 'bg-gray-50'
              }`}
            >
              <div className="flex flex-1 items-center gap-2">
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: point.color }}
                />
                <div className="flex flex-1 items-center gap-2">
                  {point.retailerLogo && (
                    <img
                      src={point.retailerLogo}
                      alt={point.retailerName}
                      className="h-4 w-4 object-contain"
                    />
                  )}
                  <span className="truncate text-sm font-medium">{point.retailerName}</span>
                </div>
                {isLowest && <TrendingDown className="h-4 w-4 text-green-600" />}
                {isHighest && dataPoints.length > 1 && (
                  <TrendingUp className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">${point.price.toFixed(2)}</div>
                {priceDiff && expanded && (
                  <div
                    className={`text-xs ${priceDiff.diff < 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {priceDiff.diff < 0 ? '' : '+'}
                    {priceDiff.percentDiff.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Content */}
      {expanded && (
        <>
          {/* Historical Context */}
          {historicalContext && (
            <div className="border-t bg-gray-50 px-3 pt-1 pb-3">
              <p className="mb-2 text-xs font-semibold text-gray-500">Historical Context</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded bg-white p-2">
                  <div className="text-xs text-gray-500">Avg</div>
                  <div className="text-sm font-semibold">
                    ${historicalContext.averagePrice.toFixed(2)}
                  </div>
                </div>
                <div className="rounded bg-white p-2">
                  <div className="text-xs text-green-600">Low</div>
                  <div className="text-sm font-semibold text-green-600">
                    ${historicalContext.lowestPrice.toFixed(2)}
                  </div>
                </div>
                <div className="rounded bg-white p-2">
                  <div className="text-xs text-red-600">High</div>
                  <div className="text-sm font-semibold text-red-600">
                    ${historicalContext.highestPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2 border-t bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-gray-500">Quick Actions</p>
            <div className="flex gap-2">
              {onSetAlert && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSetAlert(lowestPrice.retailerId, lowestPrice.price)}
                  className="h-8 flex-1 text-xs"
                >
                  <Bell className="mr-1 h-3 w-3" />
                  Set Alert
                </Button>
              )}
              {onViewRetailer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewRetailer(lowestPrice.retailerId)}
                  className="h-8 flex-1 text-xs"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  View Deal
                </Button>
              )}
            </div>
          </div>

          {/* Price Difference Insight */}
          {dataPoints.length > 1 && (
            <div className="border-t border-blue-100 bg-blue-50 px-3 pb-3">
              <div className="flex items-start gap-2 text-xs">
                <div className="flex-1">
                  <p className="mb-1 font-semibold text-blue-900">💡 Price Insight</p>
                  <p className="text-blue-800">
                    Save ${(highestPrice.price - lowestPrice.price).toFixed(2)} (
                    {(
                      ((highestPrice.price - lowestPrice.price) / highestPrice.price) *
                      100
                    ).toFixed(1)}
                    %) by choosing {lowestPrice.retailerName} over {highestPrice.retailerName}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
