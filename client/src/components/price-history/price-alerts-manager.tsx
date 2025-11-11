import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Bell, BellOff, Trash2, Edit, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PriceAlert {
  id: number;
  userId: number;
  productId: number;
  targetPrice: string;
  isActive: boolean;
  notifyForum: boolean;
  createdAt: string;
}

interface PriceAlertsManagerProps {
  productId: number;
  currentPrice?: number;
  className?: string;
}

export function PriceAlertsManager({ productId, currentPrice, className }: PriceAlertsManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PriceAlert | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch user's alerts for this product
  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ['/api/price-alerts', productId],
    queryFn: async () => {
      const res = await fetch(`/api/price-alerts?productId=${productId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      const data = await res.json();
      // Filter for this product
      return data.filter((alert: PriceAlert) => alert.productId === productId);
    },
  });

  const activeAlerts = alerts.filter(a => a.isActive);

  const handleSuccess = (message: string) => {
    queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
    toast({ title: "Success", description: message });
    setIsDialogOpen(false);
    setEditingAlert(null);
  };

  const handleError = (error: Error, action: string) => {
    toast({
      title: "Error",
      description: `Failed to ${action}: ${error.message}`,
      variant: "destructive",
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Price Alerts
            </CardTitle>
            <CardDescription>
              Get notified when the price drops to your target
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingAlert(null)}>
                <Plus className="w-4 h-4 mr-2" />
                New Alert
              </Button>
            </DialogTrigger>
            <CreateEditAlertDialog
              productId={productId}
              currentPrice={currentPrice}
              alert={editingAlert}
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentPrice && (
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Price</span>
              <span className="text-lg font-semibold">${currentPrice.toFixed(2)}</span>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No alerts set for this product. Create one to get notified when the price drops!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                currentPrice={currentPrice}
                onEdit={() => {
                  setEditingAlert(alert);
                  setIsDialogOpen(true);
                }}
                onDelete={() => handleSuccess('Alert deleted')}
                onToggle={() => handleSuccess('Alert updated')}
                onError={handleError}
              />
            ))}
          </div>
        )}

        {activeAlerts.length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              {activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'} monitoring this product
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Alert Item Component
function AlertItem({
  alert,
  currentPrice,
  onEdit,
  onDelete,
  onToggle,
  onError,
}: {
  alert: PriceAlert;
  currentPrice?: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onError: (error: Error, action: string) => void;
}) {
  const queryClient = useQueryClient();
  const targetPrice = parseFloat(alert.targetPrice);

  const isTriggered = currentPrice !== undefined && currentPrice <= targetPrice;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/price-alerts/${alert.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete alert');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      onDelete();
    },
    onError: (error: Error) => onError(error, 'delete alert'),
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/price-alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !alert.isActive }),
      });
      if (!res.ok) throw new Error('Failed to update alert');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/price-alerts'] });
      onToggle();
    },
    onError: (error: Error) => onError(error, 'update alert'),
  });

  return (
    <div className={`p-3 rounded-lg border-2 ${isTriggered ? 'border-green-500 bg-green-50' : 'border-border bg-card'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-lg">${targetPrice.toFixed(2)}</span>
            {alert.isActive ? (
              <Badge variant="default" className="text-xs">Active</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Paused</Badge>
            )}
            {alert.notifyForum && (
              <Badge variant="outline" className="text-xs">Forum Post</Badge>
            )}
          </div>
          {isTriggered && (
            <div className="flex items-center gap-1 text-green-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Target price reached!
            </div>
          )}
          {!isTriggered && currentPrice && (
            <p className="text-xs text-muted-foreground">
              {currentPrice > targetPrice
                ? `$${(currentPrice - targetPrice).toFixed(2)} away from target`
                : 'Below target price'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {alert.isActive ? (
              <Bell className="w-4 h-4" />
            ) : (
              <BellOff className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Created {new Date(alert.createdAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// Create/Edit Alert Dialog
function CreateEditAlertDialog({
  productId,
  currentPrice,
  alert,
  onSuccess,
  onError,
}: {
  productId: number;
  currentPrice?: number;
  alert: PriceAlert | null;
  onSuccess: (message: string) => void;
  onError: (error: Error, action: string) => void;
}) {
  const [targetPrice, setTargetPrice] = useState(alert?.targetPrice || '');
  const [notifyForum, setNotifyForum] = useState(alert?.notifyForum || false);

  const createMutation = useMutation({
    mutationFn: async (data: { productId: number; targetPrice: number; notifyForum: boolean }) => {
      const res = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to create alert');
      }
      return res.json();
    },
    onSuccess: () => onSuccess('Price alert created successfully!'),
    onError: (error: Error) => onError(error, 'create alert'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { targetPrice: number; notifyForum: boolean }) => {
      const res = await fetch(`/api/price-alerts/${alert?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update alert');
      return res.json();
    },
    onSuccess: () => onSuccess('Price alert updated successfully!'),
    onError: (error: Error) => onError(error, 'update alert'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(targetPrice);

    if (isNaN(price) || price <= 0) {
      onError(new Error('Please enter a valid price'), alert ? 'update alert' : 'create alert');
      return;
    }

    if (alert) {
      updateMutation.mutate({ targetPrice: price, notifyForum });
    } else {
      createMutation.mutate({ productId, targetPrice: price, notifyForum });
    }
  };

  const suggestedPrices = currentPrice ? [
    { label: '5% off', value: (currentPrice * 0.95).toFixed(2) },
    { label: '10% off', value: (currentPrice * 0.90).toFixed(2) },
    { label: '15% off', value: (currentPrice * 0.85).toFixed(2) },
    { label: '20% off', value: (currentPrice * 0.80).toFixed(2) },
  ] : [];

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{alert ? 'Edit' : 'Create'} Price Alert</DialogTitle>
        <DialogDescription>
          {alert ? 'Update your' : 'Set a'} target price and we'll notify you when it's reached
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="targetPrice">Target Price ($)</Label>
          <Input
            id="targetPrice"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            required
          />
          {currentPrice && (
            <p className="text-xs text-muted-foreground">
              Current price: ${currentPrice.toFixed(2)}
            </p>
          )}
        </div>

        {suggestedPrices.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Suggestions</Label>
            <div className="grid grid-cols-4 gap-2">
              {suggestedPrices.map((suggested) => (
                <Button
                  key={suggested.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setTargetPrice(suggested.value)}
                >
                  {suggested.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="notifyForum"
            checked={notifyForum}
            onCheckedChange={setNotifyForum}
          />
          <Label htmlFor="notifyForum" className="text-sm cursor-pointer">
            Post to forum when alert triggers
          </Label>
        </div>

        <DialogFooter>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) && "Saving..."}
            {!createMutation.isPending && !updateMutation.isPending && (alert ? 'Update Alert' : 'Create Alert')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
