import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSmartThresholdSuggestions, useCreateSuggestedAlert, SmartThresholdSuggestion } from '@/hooks/use-smart-alerts';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, TrendingDown, Calendar, Activity, DollarSign, Info } from 'lucide-react';

interface SmartSuggestionsProps {
  productId: number;
  currentPrice: number;
  onSuggestionAccepted?: () => void;
}

export function SmartSuggestions({ productId, currentPrice, onSuggestionAccepted }: SmartSuggestionsProps) {
  const { data, isLoading } = useSmartThresholdSuggestions(productId, currentPrice);
  const createAlert = useCreateSuggestedAlert();
  const { toast } = useToast();

  const handleAcceptSuggestion = (suggestion: SmartThresholdSuggestion) => {
    createAlert.mutate(
      {
        productId,
        targetPrice: suggestion.targetPrice,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        savingsPercent: suggestion.savingsPercent,
        savingsAmount: suggestion.savingsAmount,
        basedOn: suggestion.basedOn,
      },
      {
        onSuccess: () => {
          toast({ title: 'Success', description: 'Smart alert created!' });
          onSuggestionAccepted?.();
        },
        onError: (error: Error) => {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data?.data || data.data.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Not enough historical data to generate smart suggestions for this product.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Smart Suggestions
        </CardTitle>
        <CardDescription>
          AI-powered price alert recommendations based on historical data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.data.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            suggestion={suggestion}
            onAccept={() => handleAcceptSuggestion(suggestion)}
            isCreating={createAlert.isPending}
          />
        ))}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>💡 These suggestions are based on historical price patterns and may not guarantee future results.</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  onAccept,
  isCreating,
}: {
  suggestion: SmartThresholdSuggestion;
  onAccept: () => void;
  isCreating: boolean;
}) {
  const basedOnConfig = {
    historical_low: {
      icon: TrendingDown,
      label: 'Historical Low',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    seasonal_pattern: {
      icon: Calendar,
      label: 'Seasonal Pattern',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    trending_down: {
      icon: Activity,
      label: 'Trending Down',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    below_average: {
      icon: DollarSign,
      label: 'Below Average',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  } as const;

  const config = basedOnConfig[suggestion.basedOn];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.bgColor} border-current/20`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <div>
            <h4 className="font-semibold text-lg">${suggestion.targetPrice.toFixed(2)}</h4>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {Math.round(suggestion.confidence * 100)}% confidence
          </Badge>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{suggestion.reason}</p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="p-2 rounded bg-white/50">
          <p className="text-xs text-muted-foreground">Potential Savings</p>
          <p className="text-sm font-semibold text-green-600">
            ${suggestion.savingsAmount.toFixed(2)} ({suggestion.savingsPercent.toFixed(1)}%)
          </p>
        </div>

        <div className="p-2 rounded bg-white/50">
          <p className="text-xs text-muted-foreground">Alert Price</p>
          <p className="text-sm font-semibold">${suggestion.targetPrice.toFixed(2)}</p>
        </div>
      </div>

      <Button
        onClick={onAccept}
        disabled={isCreating}
        className="w-full"
        variant="default"
      >
        {isCreating ? 'Creating...' : 'Create This Alert'}
      </Button>
    </div>
  );
}
