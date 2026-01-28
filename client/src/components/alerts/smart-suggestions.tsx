import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Price } from '@/components/ui/price';
import {
  useSmartThresholdSuggestions,
  useCreateSuggestedAlert,
  SmartThresholdSuggestion,
} from '@/hooks/use-smart-alerts';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, TrendingDown, Calendar, Activity, DollarSign, Info } from 'lucide-react';

interface SmartSuggestionsProps {
  productId: number;
  currentPrice: number;
  onSuggestionAccepted?: () => void;
}

export function SmartSuggestions({
  productId,
  currentPrice,
  onSuggestionAccepted,
}: SmartSuggestionsProps) {
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
          <Skeleton className="mt-2 h-4 w-64" />
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
          <Sparkles className="text-primary h-5 w-5" />
          Smart Suggestions
        </CardTitle>
        <CardDescription>
          AI-powered price alert recommendations based on historical data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.data.map((suggestion) => (
          <SuggestionCard
            key={`${productId}-${suggestion.basedOn}`}
            suggestion={suggestion}
            onAccept={() => handleAcceptSuggestion(suggestion)}
            isCreating={createAlert.isPending}
          />
        ))}

        <div className="text-muted-foreground border-t pt-2 text-xs">
          <p>
            💡 These suggestions are based on historical price patterns and may not guarantee future
            results.
          </p>
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
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    seasonal_pattern: {
      icon: Calendar,
      label: 'Seasonal Pattern',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    trending_down: {
      icon: Activity,
      label: 'Trending Down',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    below_average: {
      icon: DollarSign,
      label: 'Below Average',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  } as const;

  const config = basedOnConfig[suggestion.basedOn];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border-2 p-4 ${config.bgColor} border-current/20`}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <div>
            <Price value={suggestion.targetPrice} className="text-lg font-semibold" />
            <p className="text-muted-foreground text-xs">{config.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {Math.round(suggestion.confidence * 100)}% confidence
          </Badge>
        </div>
      </div>

      <p className="text-muted-foreground mb-3 text-sm">{suggestion.reason}</p>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded bg-white/50 p-2">
          <p className="text-muted-foreground text-xs">Potential Savings</p>
          <p className="text-sm font-semibold text-success">
            <Price value={suggestion.savingsAmount} size="sm" /> ({suggestion.savingsPercent.toFixed(1)}%)
          </p>
        </div>

        <div className="rounded bg-white/50 p-2">
          <p className="text-muted-foreground text-xs">Alert Price</p>
          <Price value={suggestion.targetPrice} className="text-sm font-semibold" />
        </div>
      </div>

      <Button onClick={onAccept} disabled={isCreating} className="w-full" variant="default">
        {isCreating ? 'Creating...' : 'Create This Alert'}
      </Button>
    </div>
  );
}
