import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAlertAnalytics, useAlertEffectiveness, usePredictiveAlerts, PredictiveAlert, AlertEffectiveness } from '@/hooks/use-smart-alerts';
import {
  Bell,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
  Award,
  Sparkles,
  AlertTriangle,
  Info,
} from 'lucide-react';

export function AlertManagementDashboard() {
  const { data: analytics, isLoading: analyticsLoading } = useAlertAnalytics();
  const { data: effectiveness, isLoading: effectivenessLoading } = useAlertEffectiveness();
  const { data: predictive, isLoading: predictiveLoading } = usePredictiveAlerts();

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
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
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="text-3xl font-bold">{stats?.totalAlerts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span className="text-3xl font-bold text-blue-600">{stats?.activeAlerts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              <span className="text-3xl font-bold text-green-600">{stats?.triggeredAlerts || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              <span className="text-3xl font-bold text-emerald-600">
                ${(stats?.totalSavings || 0).toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictive Alerts */}
      {!predictiveLoading && predictive?.data && predictive.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
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
              <Clock className="w-5 h-5" />
              Alert Performance
            </CardTitle>
            <CardDescription>How quickly your alerts get triggered</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Average Time to Trigger</span>
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
              <Award className="w-5 h-5 text-amber-600" />
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      title: 'Price Likely to Drop',
    },
    best_deal_soon: {
      icon: Award,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200',
      title: 'Best Deal Coming Soon',
    },
    seasonal_opportunity: {
      icon: Sparkles,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      title: 'Seasonal Opportunity',
    },
  } as const;

  const config = predictionConfig[alert.prediction];
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.bgColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <h3 className="font-semibold">{config.title}</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {Math.round(alert.confidence * 100)}% confidence
        </Badge>
      </div>

      <p className="font-medium text-sm mb-1">{alert.productName}</p>
      <p className="text-sm text-muted-foreground mb-2">{alert.reason}</p>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Estimated: </span>
          <span className="font-medium">{alert.estimatedDays} days</span>
        </div>
        <div>
          <span className="text-muted-foreground">Current: </span>
          <span className="font-medium">${alert.currentPrice.toFixed(2)}</span>
        </div>
      </div>

      {alert.predictedPrice && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">Predicted Price: </span>
          <span className="text-sm font-semibold text-green-600">
            ${alert.predictedPrice.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

// Effectiveness Card Component
function EffectivenessCard({ alert }: { alert: AlertEffectiveness }) {
  const effectivenessColor = {
    high: 'text-green-600 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    low: 'text-gray-600 bg-gray-50',
  } as const;

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">${alert.targetPrice.toFixed(2)}</span>
        </div>
        <Badge className={effectivenessColor[alert.effectiveness]}>
          {alert.effectiveness}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Triggered</p>
          <p className="font-semibold">{alert.timesTriggered}x</p>
        </div>
        <div>
          <p className="text-muted-foreground">Savings</p>
          <p className="font-semibold text-green-600">${alert.savingsRealized.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Age</p>
          <p className="font-semibold">{alert.daysSinceCreated}d</p>
        </div>
      </div>

      {alert.lastTriggeredAt && (
        <p className="text-xs text-muted-foreground mt-2">
          Last triggered: {alert.daysSinceLastTrigger} days ago
        </p>
      )}
    </div>
  );
}
