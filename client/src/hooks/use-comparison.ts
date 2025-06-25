import { useState, useCallback } from "react";
import type { ProductWithOffers } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const MAX_COMPARISON_ITEMS = 4;

export function useComparison() {
  const [comparisonItems, setComparisonItems] = useState<ProductWithOffers[]>([]);
  const { toast } = useToast();

  const addToComparison = useCallback((product: ProductWithOffers) => {
    setComparisonItems(current => {
      // Check if product is already in comparison
      if (current.some(item => item.id === product.id)) {
        toast({
          title: "Already in comparison",
          description: `${product.name} is already in your comparison list.`,
          variant: "default",
        });
        return current;
      }

      // Check if we've reached the maximum
      if (current.length >= MAX_COMPARISON_ITEMS) {
        toast({
          title: "Comparison list full",
          description: `You can only compare up to ${MAX_COMPARISON_ITEMS} products at once.`,
          variant: "destructive",
        });
        return current;
      }

      toast({
        title: "Added to comparison",
        description: `${product.name} has been added to your comparison list.`,
        variant: "default",
      });

      return [...current, product];
    });
  }, [toast]);

  const removeFromComparison = useCallback((productId: number) => {
    setComparisonItems(current => {
      const product = current.find(item => item.id === productId);
      if (product) {
        toast({
          title: "Removed from comparison",
          description: `${product.name} has been removed from your comparison list.`,
          variant: "default",
        });
      }
      return current.filter(item => item.id !== productId);
    });
  }, [toast]);

  const clearComparison = useCallback(() => {
    if (comparisonItems.length > 0) {
      toast({
        title: "Comparison cleared",
        description: "All products have been removed from your comparison list.",
        variant: "default",
      });
    }
    setComparisonItems([]);
  }, [comparisonItems.length, toast]);

  return {
    comparisonItems,
    addToComparison,
    removeFromComparison,
    clearComparison,
  };
}
