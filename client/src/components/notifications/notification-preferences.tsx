import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/hooks/use-notifications';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Bell, Mail, Clock } from 'lucide-react';

export function NotificationPreferences() {
  const { data, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const { toast } = useToast();

  const [prefs, setPrefs] = useState({
    priceDropEnabled: true,
    priceDropThresholdPercent: 10,
    priceDropThresholdAmount: '5.00',
    priceAlertEnabled: true,
    emailEnabled: true,
    inAppEnabled: true,
    maxDailyNotifications: 10,
    quietHoursStart: null as number | null,
    quietHoursEnd: null as number | null,
  });

  useEffect(() => {
    if (data) {
      setPrefs({
        priceDropEnabled: data.priceDropEnabled,
        priceDropThresholdPercent: data.priceDropThresholdPercent,
        priceDropThresholdAmount: data.priceDropThresholdAmount,
        priceAlertEnabled: data.priceAlertEnabled,
        emailEnabled: data.emailEnabled,
        inAppEnabled: data.inAppEnabled,
        maxDailyNotifications: data.maxDailyNotifications,
        quietHoursStart: data.quietHoursStart,
        quietHoursEnd: data.quietHoursEnd,
      });
    }
  }, [data]);

  const handleSave = () => {
    updatePrefs.mutate(prefs, {
      onSuccess: () => {
        toast({ title: 'Success', description: 'Notification preferences updated' });
      },
      onError: (error: Error) => {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Price Drop Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Price Drop Notifications
          </CardTitle>
          <CardDescription>Get notified when prices drop significantly</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="priceDropEnabled">Enable price drop notifications</Label>
            <Switch
              id="priceDropEnabled"
              aria-label="Enable price drop notifications"
              checked={prefs.priceDropEnabled}
              onCheckedChange={(checked) => setPrefs({ ...prefs, priceDropEnabled: checked })}
            />
          </div>

          {prefs.priceDropEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="priceDropThresholdPercent">Minimum percentage drop (%)</Label>
                <Input
                  id="priceDropThresholdPercent"
                  type="number"
                  min="1"
                  max="100"
                  value={prefs.priceDropThresholdPercent}
                  onChange={(e) =>
                    setPrefs({ ...prefs, priceDropThresholdPercent: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priceDropThresholdAmount">Minimum dollar amount drop ($)</Label>
                <Input
                  id="priceDropThresholdAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={prefs.priceDropThresholdAmount}
                  onChange={(e) => setPrefs({ ...prefs, priceDropThresholdAmount: e.target.value })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Price Alert Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Price Alert Notifications</CardTitle>
          <CardDescription>Notifications for your custom price alerts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="priceAlertEnabled">Enable price alert notifications</Label>
            <Switch
              id="priceAlertEnabled"
              checked={prefs.priceAlertEnabled}
              onCheckedChange={(checked) => setPrefs({ ...prefs, priceAlertEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notification Channels
          </CardTitle>
          <CardDescription>Choose how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="inAppEnabled">In-app notifications</Label>
            <Switch
              id="inAppEnabled"
              checked={prefs.inAppEnabled}
              onCheckedChange={(checked) => setPrefs({ ...prefs, inAppEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="emailEnabled">Email notifications</Label>
            <Switch
              id="emailEnabled"
              aria-label="Email notification"
              checked={prefs.emailEnabled}
              onCheckedChange={(checked) => setPrefs({ ...prefs, emailEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Frequency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Frequency Settings
          </CardTitle>
          <CardDescription>Control notification frequency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maxDailyNotifications">Maximum notifications per day</Label>
            <Input
              id="maxDailyNotifications"
              type="number"
              min="1"
              max="100"
              value={prefs.maxDailyNotifications}
              onChange={(e) =>
                setPrefs({ ...prefs, maxDailyNotifications: parseInt(e.target.value) })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quietHoursStart">Quiet hours start (0-23, optional)</Label>
              <Input
                id="quietHoursStart"
                type="number"
                min="0"
                max="23"
                placeholder="22 (10 PM)"
                value={prefs.quietHoursStart ?? ''}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHoursStart: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quietHoursEnd">Quiet hours end (0-23, optional)</Label>
              <Input
                id="quietHoursEnd"
                type="number"
                min="0"
                max="23"
                placeholder="8 (8 AM)"
                value={prefs.quietHoursEnd ?? ''}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    quietHoursEnd: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={updatePrefs.isPending} className="w-full">
        {updatePrefs.isPending ? 'Saving...' : 'Save Preferences'}
      </Button>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : null}
    </div>
  );
}
