import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Price } from '@/components/ui/price';
import {
  useAlertAnalytics,
  useAlertEffectiveness,
  usePredictiveAlerts,
  PredictiveAlert,
  AlertEffectiveness,
} from '@/hooks/use-smart-alerts';
import { Bell, TrendingDown, DollarSign, Clock, Target, Award, Sparkles, Info } from 'lucide-react';

export function AlertManagementDashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useAlertAnalytics();
  const { data: effectiveness, isLoading: effectivenessLoading } = useAlertEffectiveness();
  const { data: predictive, isLoading: predictiveLoading } = usePredictiveAlerts();

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const stats = analytics?.data;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bell className="text-muted-foreground h-5 w-5" />
              <span className="text-3xl font-bold">{stats?.totalAlerts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="text-primary h-5 w-5" />
              <span className="text-primary text-3xl font-bold">{stats?.activeAlerts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-success" />
              <span className="text-3xl font-bold text-success">
                {stats?.triggeredAlerts || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              <Price value={stats?.totalSavings || 0} className="text-3xl font-bold text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictive Alerts */}
      {!predictiveLoading && predictive?.data && predictive.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="text-primary h-5 w-5" />
              Predictive Insights
            </CardTitle>
            <CardDescription>AI-powered predictions for your watched products</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {predictive.data.map((alert, index) => (
              <PredictiveAlertCard key={index} alert={alert} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alert Performance */}
      {stats && stats.averageTimeToTrigger > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Alert Performance
            </CardTitle>
            <CardDescription>How quickly your alerts get triggered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Average Time to Trigger</span>
                <span className="text-2xl font-bold">{stats.averageTimeToTrigger} days</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className="font-medium">
                    {stats.totalAlerts > 0
                      ? ((stats.triggeredAlerts / stats.totalAlerts) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    stats.totalAlerts > 0 ? (stats.triggeredAlerts / stats.totalAlerts) * 100 : 0
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Most Effective Alerts */}
      {!effectivenessLoading && effectiveness?.data && effectiveness.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-warning" />
              Most Effective Alerts
            </CardTitle>
            <CardDescription>Your best-performing price alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {effectiveness.data.slice(0, 5).map((alert) => (
                <EffectivenessCard key={alert.alertId} alert={alert} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stats && stats.totalAlerts === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            You haven't created any price alerts yet. Set up alerts to start tracking price drops!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Predictive Alert Card Component
function PredictiveAlertCard({ alert }: { alert: PredictiveAlert }) {
  const predictionConfig = {
    price_likely_to_drop: {
      icon: TrendingDown,
      color: 'text-primary',
      bgColor: 'bg-primary/10 border-primary/20',
      title: 'Price Likely to Drop',
    },
    best_deal_soon: {
      icon: Award,
      color: 'text-warning',
      bgColor: 'bg-warning/10 border-warning/20',
      title: 'Best Deal Coming Soon',
    },
    seasonal_opportunity: {
      icon: Sparkles,
      color: 'text-primary',
      bgColor: 'bg-primary/10 border-primary/20',
      title: 'Seasonal Opportunity',
    },
  } as const;

  const config = predictionConfig[alert.prediction];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border-2 p-4 ${config.bgColor}`}>
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.color}`} />
          <h3 className="font-semibold">{config.title}</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {Math.round(alert.confidence * 100)}% confidence
        </Badge>
      </div>

      <p className="mb-1 text-sm font-medium">{alert.productName}</p>
      <p className="text-muted-foreground mb-2 text-sm">{alert.reason}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Estimated: </span>
          <span className="font-medium">{alert.estimatedDays} days</span>
        </div>
        <div>
          <span className="text-muted-foreground">Current: </span>
          <Price value={alert.currentPrice} size="sm" className="font-medium" />
        </div>
      </div>

      {alert.predictedPrice && (
        <div className="mt-2 border-t pt-2">
          <span className="text-muted-foreground text-xs">Predicted Price: </span>
          <Price value={alert.predictedPrice} className="text-sm font-semibold text-success" />
        </div>
      )}
    </div>
  );
}

// Effectiveness Card Component
function EffectivenessCard({ alert }: { alert: AlertEffectiveness }) {
  const effectivenessColor = {
    high: 'text-success bg-success/10',
    medium: 'text-warning bg-warning/10',
    low: 'text-muted-foreground bg-muted/10',
  } as const;

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="text-muted-foreground h-4 w-4" />
          <Price value={alert.targetPrice} className="font-medium" />
        </div>
        <Badge className={effectivenessColor[alert.effectiveness]}>{alert.effectiveness}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Triggered</p>
          <p className="font-semibold">{alert.timesTriggered}x</p>
        </div>
        <div>
          <p className="text-muted-foreground">Savings</p>
          <Price value={alert.savingsRealized} className="font-semibold text-success" size="sm" />
        </div>
        <div>
          <p className="text-muted-foreground">Age</p>
          <p className="font-semibold">{alert.daysSinceCreated}d</p>
        </div>
      </div>

      {alert.lastTriggeredAt && (
        <p className="text-muted-foreground mt-2 text-xs">
          Last triggered: {alert.daysSinceLastTrigger} days ago
        </p>
      )}
    </div>
  );
}
