import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductWithOffers } from "@shared/schema";

interface ComparisonModalProps {
  items: ProductWithOffers[];
  onRemoveItem: (productId: number) => void;
  onClear: () => void;
}

export function ComparisonModal({ items, onRemoveItem, onClear }: ComparisonModalProps) {
  if (items.length === 0) return null;

  return (
    <div 
      className="comparison-modal" 
      role="dialog" 
      aria-label="Product comparison"
      aria-modal="true"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Compare Products</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground focus-visible"
          onClick={onClear}
          aria-label="Close comparison"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {item.name}
              </p>
              <p className="text-muted-foreground">
                ${item.bestPrice?.toFixed(2)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive/80 focus-visible ml-2"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remove ${item.name} from comparison`}
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        ))}
      </div>
      
      <div className="flex space-x-2 mt-3">
        <Button 
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 focus-visible"
          disabled={items.length < 2}
        >
          Compare ({items.length})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="focus-visible"
        >
          Clear
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground mt-2 text-center">
        Add up to 4 products to compare
      </div>
    </div>
  );
}
