import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ListResponse, DataResponse } from '@shared/api-types';
import { useAuth } from './use-auth';

export interface SmartThresholdSuggestion {
  targetPrice: number;
  reason: string;
  confidence: number;
  savingsPercent: number;
  savingsAmount: number;
  basedOn: 'historical_low' | 'seasonal_pattern' | 'trending_down' | 'below_average';
}

export interface PredictiveAlert {
  productId: number;
  productName: string;
  prediction: 'price_likely_to_drop' | 'best_deal_soon' | 'seasonal_opportunity';
  confidence: number;
  reason: string;
  estimatedDays: number;
  currentPrice: number;
  predictedPrice?: number;
}

export interface AlertEffectiveness {
  alertId: number;
  productId: number;
  targetPrice: number;
  timesTriggered: number;
  lastTriggeredAt: string | null;
  daysSinceCreated: number;
  daysSinceLastTrigger: number | null;
  effectiveness: 'high' | 'medium' | 'low';
  savingsRealized: number;
}

export interface AlertAnalytics {
  totalAlerts: number;
  activeAlerts: number;
  triggeredAlerts: number;
  averageTimeToTrigger: number;
  totalSavings: number;
  mostEffectiveAlerts: AlertEffectiveness[];
  alertsByProduct: Record<number, number>;
}

/**
 * Fetch AI-generated smart threshold suggestions for a product
 *
 * Returns intelligent price alert suggestions based on historical data, seasonal patterns,
 * and trending analysis. Helps users set optimal price targets for alerts.
 *
 * @param productId - The product ID to analyze
 * @param currentPrice - The current product price for comparison
 * @returns React Query result with ListResponse containing SmartThresholdSuggestion array
 *
 * @example
 * ```tsx
 * function SmartAlertSuggestions({ productId, currentPrice }: Props) {
 *   const { data } = useSmartThresholdSuggestions(productId, currentPrice);
 *
 *   return (
 *     <div>
 *       <h3>Suggested Price Targets</h3>
 *       {data?.data.map(suggestion => (
 *         <div key={suggestion.targetPrice}>
 *           <p>${suggestion.targetPrice}</p>
 *           <p>{suggestion.reason}</p>
 *           <p>Confidence: {suggestion.confidence}%</p>
 *           <p>Save: {suggestion.savingsPercent}%</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSmartThresholdSuggestions(productId?: number, currentPrice?: number) {
  const { data: user } = useAuth();

  return useQuery<ListResponse<SmartThresholdSuggestion>>({
    queryKey: ['/api/smart-alerts/suggestions', productId, currentPrice],
    queryFn: async () => {
      if (!productId || !currentPrice) {
        throw new Error('Product ID and current price are required');
      }
      return apiRequest<ListResponse<SmartThresholdSuggestion>>(
        `/api/smart-alerts/suggestions/${productId}?currentPrice=${currentPrice}`
      );
    },
    enabled: !!productId && !!currentPrice && !!user, // Only fetch if product data exists and user is authenticated
  });
}

/**
 * Fetch predictive price alerts for the current user
 *
 * Returns AI-generated predictions about upcoming price changes and deal opportunities
 * for products in the user's watchlist. Automatically refreshes every 5 minutes.
 *
 * @returns React Query result with ListResponse containing PredictiveAlert array
 *
 * @example
 * ```tsx
 * function PredictiveAlertsDashboard() {
 *   const { data, isLoading } = usePredictiveAlerts();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <h2>Price Predictions</h2>
 *       {data?.data.map(alert => (
 *         <div key={alert.productId}>
 *           <h3>{alert.productName}</h3>
 *           <p>Prediction: {alert.prediction}</p>
 *           <p>Confidence: {alert.confidence}%</p>
 *           <p>Estimated in {alert.estimatedDays} days</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePredictiveAlerts() {
  const { data: user } = useAuth();

  return useQuery<ListResponse<PredictiveAlert>>({
    queryKey: ['/api/smart-alerts/predictive'],
    queryFn: async () => {
      return apiRequest<ListResponse<PredictiveAlert>>('/api/smart-alerts/predictive');
    },
    enabled: !!user, // Only fetch if user is authenticated
    refetchInterval: 300000, // Refresh every 5 minutes
    refetchIntervalInBackground: false, // Pause polling when tab is inactive
  });
}

/**
 * Fetch alert effectiveness metrics for the current user
 *
 * Returns performance metrics for all user price alerts, including trigger frequency,
 * time to trigger, and savings realized. Helps users understand which alerts are most valuable.
 *
 * @returns React Query result with ListResponse containing AlertEffectiveness array
 *
 * @example
 * ```tsx
 * function AlertPerformance() {
 *   const { data } = useAlertEffectiveness();
 *
 *   return (
 *     <table>
 *       <thead>
 *         <tr>
 *           <th>Alert ID</th>
 *           <th>Effectiveness</th>
 *           <th>Triggers</th>
 *           <th>Savings</th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {data?.data.map(alert => (
 *           <tr key={alert.alertId}>
 *             <td>{alert.alertId}</td>
 *             <td>{alert.effectiveness}</td>
 *             <td>{alert.timesTriggered}</td>
 *             <td>${alert.savingsRealized}</td>
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   );
 * }
 * ```
 */
export function useAlertEffectiveness() {
  const { data: user } = useAuth();

  return useQuery<ListResponse<AlertEffectiveness>>({
    queryKey: ['/api/smart-alerts/effectiveness'],
    queryFn: async () => {
      return apiRequest<ListResponse<AlertEffectiveness>>('/api/smart-alerts/effectiveness');
    },
    enabled: !!user, // Only fetch if user is authenticated
  });
}

/**
 * Fetch comprehensive alert analytics for the current user
 *
 * Returns aggregated statistics about all user alerts including total count, active alerts,
 * triggered alerts, average time to trigger, total savings, and top performing alerts.
 *
 * @returns React Query result with DataResponse containing AlertAnalytics object
 *
 * @example
 * ```tsx
 * function AlertsDashboard() {
 *   const { data } = useAlertAnalytics();
 *
 *   return (
 *     <div>
 *       <h2>Alert Performance Overview</h2>
 *       <div>
 *         <p>Total Alerts: {data?.data.totalAlerts}</p>
 *         <p>Active: {data?.data.activeAlerts}</p>
 *         <p>Triggered: {data?.data.triggeredAlerts}</p>
 *         <p>Total Savings: ${data?.data.totalSavings}</p>
 *         <p>Avg. Time to Trigger: {data?.data.averageTimeToTrigger} days</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAlertAnalytics() {
  const { data: user } = useAuth();

  return useQuery<DataResponse<AlertAnalytics>>({
    queryKey: ['/api/smart-alerts/analytics'],
    queryFn: async () => {
      return apiRequest<DataResponse<AlertAnalytics>>('/api/smart-alerts/analytics');
    },
    enabled: !!user, // Only fetch if user is authenticated
  });
}

/**
 * Request payload for creating a suggested alert
 */
export interface CreateSuggestedAlertRequest {
  productId: number;
  targetPrice: number;
  reason: string;
  confidence: number;
  savingsPercent: number;
  savingsAmount: number;
  basedOn: 'historical_low' | 'seasonal_pattern' | 'trending_down' | 'below_average';
}

/**
 * Create a price alert from an AI-generated suggestion
 *
 * Creates a new price alert using data from smart threshold suggestions.
 * Automatically invalidates related queries on success to refresh the UI.
 *
 * @returns React Query mutation result
 *
 * @example
 * ```tsx
 * function SuggestionCard({ suggestion }: Props) {
 *   const createAlert = useCreateSuggestedAlert();
 *
 *   const handleCreate = () => {
 *     createAlert.mutate({
 *       productId: suggestion.productId,
 *       targetPrice: suggestion.targetPrice,
 *       reason: suggestion.reason,
 *       confidence: suggestion.confidence,
 *       savingsPercent: suggestion.savingsPercent,
 *       savingsAmount: suggestion.savingsAmount,
 *       basedOn: suggestion.basedOn,
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleCreate}
 *       disabled={createAlert.isPending}
 *     >
 *       {createAlert.isPending ? 'Creating...' : 'Create Alert'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreateSuggestedAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSuggestedAlertRequest) => {
      return apiRequest('/api/smart-alerts/create-suggested', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/smart-alerts'] });
    },
  });
}
