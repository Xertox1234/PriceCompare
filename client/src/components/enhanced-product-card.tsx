import { ProductCard } from './product-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquare, Users, Bell, BellRing } from 'lucide-react';
import { EmbeddedForum } from './forum/embedded-forum';
import { useState } from 'react';
import type { ProductWithOffers } from '@shared/schema';

interface EnhancedProductCardProps {
  product: ProductWithOffers;
  onAddToComparison: () => void;
}

export function EnhancedProductCard({ product, onAddToComparison }: EnhancedProductCardProps) {
  const [showForum, setShowForum] = useState(false);
  
  const discussionCount = product.discussionCount || 0;
  const hasActiveDiscussion = product.hasActiveDiscussion || false;
  
  return (
    <div className="relative">
      <ProductCard product={product} onAddToComparison={onAddToComparison} />
      
      {/* Community overlay */}
      <div className="absolute top-2 right-2 flex gap-1">
        {hasActiveDiscussion && (
          <Badge variant="secondary" className="text-xs">
            <MessageSquare className="h-3 w-3 mr-1" />
            {discussionCount}
          </Badge>
        )}
        {product.bestPrice && product.bestPrice < (product.offers[0]?.originalPrice ? parseFloat(product.offers[0].originalPrice) : 0) && (
          <Badge variant="destructive" className="text-xs">
            <BellRing className="h-3 w-3 mr-1" />
            Deal
          </Badge>
        )}
      </div>
      
      {/* Community actions */}
      <div className="mt-2 pt-2 border-t space-y-2">
        <Dialog open={showForum} onOpenChange={setShowForum}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {hasActiveDiscussion 
                ? `View ${discussionCount} discussion${discussionCount !== 1 ? 's' : ''}` 
                : 'Start discussion'
              }
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Discussion: {product.name}</DialogTitle>
            </DialogHeader>
            <EmbeddedForum 
              productId={product.id} 
              title={`Discussion about ${product.name}`}
            />
          </DialogContent>
        </Dialog>

        <PriceAlertButton productId={product.id} currentPrice={product.bestPrice} />
      </div>
    </div>
  );
}

function PriceAlertButton({ productId, currentPrice }: { productId: number; currentPrice?: number }) {
  const [showAlert, setShowAlert] = useState(false);
  
  return (
    <Dialog open={showAlert} onOpenChange={setShowAlert}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
        >
          <Bell className="h-4 w-4 mr-2" />
          Set Price Alert
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Price Alert</DialogTitle>
        </DialogHeader>
        <PriceAlertForm 
          productId={productId} 
          currentPrice={currentPrice} 
          onSuccess={() => setShowAlert(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PriceAlertForm({ 
  productId, 
  currentPrice, 
  onSuccess 
}: { 
  productId: number; 
  currentPrice?: number; 
  onSuccess: () => void; 
}) {
  const [targetPrice, setTargetPrice] = useState('');
  const [notifyForum, setNotifyForum] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          targetPrice: parseFloat(targetPrice),
          notifyForum,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create price alert');
      }
    } catch (error) {
      alert('Failed to create price alert');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="targetPrice" className="block text-sm font-medium mb-2">
          Target Price
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <input
            id="targetPrice"
            type="number"
            step="0.01"
            min="0"
            max={currentPrice}
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border rounded-md"
            placeholder="0.00"
            required
          />
        </div>
        {currentPrice && (
          <p className="text-sm text-muted-foreground mt-1">
            Current price: ${currentPrice.toFixed(2)}
          </p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          id="notifyForum"
          type="checkbox"
          checked={notifyForum}
          onChange={(e) => setNotifyForum(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="notifyForum" className="text-sm">
          Notify community when price drops
        </label>
      </div>

      <Button type="submit" disabled={isCreating || !targetPrice.trim()}>
        {isCreating ? 'Creating...' : 'Create Alert'}
      </Button>
    </form>
  );
}