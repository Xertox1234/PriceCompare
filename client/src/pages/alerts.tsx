import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type AlertProduct = {
  id: number;
  name: string;
};

type UserPriceAlert = {
  id: number;
  productId: number;
  targetPrice: string;
  isActive: boolean | null;
  timesTriggered?: number | null;
  lastTriggeredAt?: string | null;
  product?: AlertProduct;
};

function formatMoney(value: string): string {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return value;
  return num.toFixed(2);
}

function getStatus(alert: UserPriceAlert): string {
  if ((alert.timesTriggered ?? 0) > 0 || alert.lastTriggeredAt) return 'Triggered';
  if (alert.isActive) return 'Active';
  return 'Inactive';
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingAlertId, setEditingAlertId] = useState<number | null>(null);
  const [targetPriceDraft, setTargetPriceDraft] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [confirmDeleteAlertId, setConfirmDeleteAlertId] = useState<number | null>(null);

  const { data: alerts = [], isLoading } = useQuery<UserPriceAlert[]>({
    queryKey: ['/api/price-alerts'],
    queryFn: async () => apiRequest<UserPriceAlert[]>('/api/price-alerts'),
  });

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => b.id - a.id);
  }, [alerts]);

  const updateMutation = useMutation({
    mutationFn: async ({ alertId, targetPrice }: { alertId: number; targetPrice: number }) => {
      return apiRequest(`/api/price-alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ targetPrice }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      toast({ title: 'Alert updated' });
      setEditingAlertId(null);
      setTargetPriceDraft('');
      setValidationError(null);
    },
    onError: () => {
      toast({ title: 'Failed to update alert', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest(`/api/price-alerts/${alertId}`, { method: 'DELETE' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      toast({ title: 'Alert deleted' });
      setConfirmDeleteAlertId(null);
    },
    onError: () => {
      toast({ title: 'Failed to delete alert', variant: 'destructive' });
    },
  });

  const startEdit = (alert: UserPriceAlert) => {
    setEditingAlertId(alert.id);
    setTargetPriceDraft(formatMoney(alert.targetPrice));
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingAlertId(null);
    setTargetPriceDraft('');
    setValidationError(null);
  };

  const submitEdit = (alertId: number) => {
    const parsed = Number.parseFloat(targetPriceDraft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValidationError('Price must be positive');
      return;
    }

    setValidationError(null);
    updateMutation.mutate({ alertId, targetPrice: parsed });
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Alerts</title>
        <meta name="description" content="Manage your price alerts" />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle>Price Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : sortedAlerts.length === 0 ? (
            <p className="text-muted-foreground">No price alerts yet. Create your first alert.</p>
          ) : (
            <div className="space-y-3">
              {sortedAlerts.map((alert) => {
                const productName = alert.product?.name || `Product ${alert.productId}`;
                const isEditing = editingAlertId === alert.id;
                const isConfirmingDelete = confirmDeleteAlertId === alert.id;

                return (
                  <div key={alert.id} className="flex flex-col gap-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-foreground font-medium">{productName}</p>
                        <p className="text-muted-foreground text-sm">
                          Target: ${formatMoney(alert.targetPrice)} • Status: {getStatus(alert)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {isEditing ? null : isConfirmingDelete ? (
                          <>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteMutation.mutate(alert.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setConfirmDeleteAlertId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => startEdit(alert)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => setConfirmDeleteAlertId(alert.id)}
                              aria-label={`Delete ${productName} alert`}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isConfirmingDelete ? (
                      <p className="text-muted-foreground text-sm">
                        Are you sure you want to delete this alert?
                      </p>
                    ) : null}

                    {isEditing ? (
                      <form
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitEdit(alert.id);
                        }}
                        className="space-y-3"
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`targetPrice-${alert.id}`}>Target Price</Label>
                          <Input
                            id={`targetPrice-${alert.id}`}
                            name="targetPrice"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0.01"
                            value={targetPriceDraft}
                            onChange={(e) => setTargetPriceDraft(e.target.value)}
                          />
                          {validationError ? (
                            <p className="text-destructive text-sm">{validationError}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button type="submit" disabled={updateMutation.isPending}>
                            Save
                          </Button>
                          <Button type="button" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
