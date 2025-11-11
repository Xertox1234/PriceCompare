import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

// Fetch smart threshold suggestions for a product
export function useSmartThresholdSuggestions(productId?: number, currentPrice?: number) {
  return useQuery<{ success: boolean; data: SmartThresholdSuggestion[]; count: number }>({
    queryKey: ['/api/smart-alerts/suggestions', productId, currentPrice],
    queryFn: async () => {
      if (!productId || !currentPrice) {
        throw new Error('Product ID and current price are required');
      }
      const res = await fetch(
        `/api/smart-alerts/suggestions/${productId}?currentPrice=${currentPrice}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      return res.json();
    },
    enabled: !!productId && !!currentPrice,
  });
}

// Fetch predictive alerts for the user
export function usePredictiveAlerts() {
  return useQuery<{ success: boolean; data: PredictiveAlert[]; count: number }>({
    queryKey: ['/api/smart-alerts/predictive'],
    queryFn: async () => {
      const res = await fetch('/api/smart-alerts/predictive', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch predictive alerts');
      return res.json();
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

// Fetch alert effectiveness metrics
export function useAlertEffectiveness() {
  return useQuery<{ success: boolean; data: AlertEffectiveness[]; count: number }>({
    queryKey: ['/api/smart-alerts/effectiveness'],
    queryFn: async () => {
      const res = await fetch('/api/smart-alerts/effectiveness', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch effectiveness metrics');
      return res.json();
    },
  });
}

// Fetch alert analytics
export function useAlertAnalytics() {
  return useQuery<{ success: boolean; data: AlertAnalytics }>({
    queryKey: ['/api/smart-alerts/analytics'],
    queryFn: async () => {
      const res = await fetch('/api/smart-alerts/analytics', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });
}

// Create a suggested alert
export function useCreateSuggestedAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      productId: number;
      targetPrice: number;
      reason: string;
      confidence: number;
      savingsPercent: number;
      savingsAmount: number;
      basedOn: 'historical_low' | 'seasonal_pattern' | 'trending_down' | 'below_average';
    }) => {
      const res = await fetch('/api/smart-alerts/create-suggested', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create suggested alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/smart-alerts'] });
    },
  });
}
