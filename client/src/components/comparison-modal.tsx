import { useEffect, useRef } from 'react';
import { X, Trash2, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProductWithOffers } from '@shared/schema';
import { MAX_COMPARISON_ITEMS } from '@/lib/constants';
import { useLocation } from 'wouter';

interface ComparisonModalProps {
  items: ProductWithOffers[];
  onRemoveItem: (productId: number) => void;
  onClear: () => void;
}

export function ComparisonModal({ items, onRemoveItem, onClear }: ComparisonModalProps) {
  const [, setLocation] = useLocation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Focus management: Auto-focus modal when it opens
  useEffect(() => {
    if (items.length > 0 && dialogRef.current) {
      // Store the previously focused element
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      // Focus the first focusable element in the modal
      const firstFocusable = dialogRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [items.length]);

  // Focus trap: Keep focus within the modal
  useEffect(() => {
    if (items.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [items.length]);

  // Restore focus when modal closes
  useEffect(() => {
    return () => {
      if (items.length === 0 && previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <div
      ref={dialogRef}
      className="comparison-modal"
      role="dialog"
      aria-label="Product comparison"
      aria-modal="true"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-foreground font-semibold">Compare Products</h3>
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

      <div className="max-h-60 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate font-medium">{item.name}</p>
              <p className="text-muted-foreground">${item.bestPrice?.toFixed(2)}</p>
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

      <div className="mt-3 flex space-x-2">
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible flex-1"
          disabled={items.length < 2}
          onClick={() => {
            const productIds = items.map((item) => item.id).join(',');
            setLocation(`/compare?products=${productIds}`);
          }}
        >
          <BarChart2 className="mr-2 h-4 w-4" />
          Compare ({items.length})
        </Button>
        <Button variant="outline" size="sm" onClick={onClear} className="focus-visible">
          Clear
        </Button>
      </div>

      <div className="text-muted-foreground mt-2 text-center text-xs">
        Add up to {MAX_COMPARISON_ITEMS} products to compare
      </div>
    </div>
  );
}
