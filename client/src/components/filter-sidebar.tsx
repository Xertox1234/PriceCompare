import { memo, useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { SearchFilters, Retailer } from '@shared/schema';

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: Partial<SearchFilters>) => void;
}

export const FilterSidebar = memo(({ filters, onFilterChange }: FilterSidebarProps) => {
  const { data: retailers } = useQuery<Retailer[]>({
    queryKey: ['/api/retailers'],
  });

  const [minPriceDraft, setMinPriceDraft] = useState<string>('');
  const [maxPriceDraft, setMaxPriceDraft] = useState<string>('');

  useEffect(() => {
    setMinPriceDraft(filters.minPrice !== undefined ? String(filters.minPrice) : '');
    setMaxPriceDraft(filters.maxPrice !== undefined ? String(filters.maxPrice) : '');
  }, [filters.maxPrice, filters.minPrice]);

  const applyPriceRange = useCallback(() => {
    const min = minPriceDraft === '' ? undefined : parseFloat(minPriceDraft);
    const max = maxPriceDraft === '' ? undefined : parseFloat(maxPriceDraft);
    onFilterChange({ minPrice: min, maxPrice: max });
  }, [maxPriceDraft, minPriceDraft, onFilterChange]);

  // Memoize retailer change handler
  const handleRetailerChange = useCallback(
    (retailerId: number, checked: boolean) => {
      const currentRetailers = filters.retailers || [];
      const newRetailers = checked
        ? [...currentRetailers, retailerId]
        : currentRetailers.filter((id) => id !== retailerId);

      onFilterChange({ retailers: newRetailers.length > 0 ? newRetailers : undefined });
    },
    [filters.retailers, onFilterChange]
  );

  // Memoize rating change handler
  const handleRatingChange = useCallback(
    (rating: number, checked: boolean) => {
      onFilterChange({ minRating: checked ? rating : undefined });
    },
    [onFilterChange]
  );

  // Memoize availability change handler
  const handleAvailabilityChange = useCallback(
    (availability: string, checked: boolean) => {
      const currentAvailability = filters.availability || [];
      const newAvailability = checked
        ? [...currentAvailability, availability]
        : currentAvailability.filter((a) => a !== availability);

      onFilterChange({ availability: newAvailability.length > 0 ? newAvailability : undefined });
    },
    [filters.availability, onFilterChange]
  );

  // Memoize clear filters handler
  const clearFilters = useCallback(() => {
    onFilterChange({
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      retailers: undefined,
      minRating: undefined,
      availability: undefined,
    });
  }, [onFilterChange]);

  return (
    <div role="complementary" aria-label="Product filters">
      <h2 className="text-foreground mb-4 text-lg font-semibold">Filters</h2>

      {/* Category Filter */}
      <div className="mb-6">
        <Label htmlFor="category-select" className="text-foreground mb-2 block text-sm font-medium">
          Category
        </Label>
        <select
          id="category-select"
          className="border-input bg-background text-foreground focus:border-ring focus:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          value={filters.category || ''}
          onChange={(e) => onFilterChange({ category: e.target.value || undefined })}
          data-testid="filter-category-select"
        >
          <option value="">All categories</option>
          <option value="Electronics">Electronics</option>
          <option value="Computers">Computers</option>
          <option value="Smartphones">Smartphones</option>
          <option value="Tablets">Tablets</option>
          <option value="Accessories">Accessories</option>
        </select>
      </div>

      {/* Price Range Filter */}
      <div className="mb-6">
        <h3 className="text-foreground mb-3 text-sm font-medium">Price Range</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <Label htmlFor="min-price" className="sr-only">
                Minimum price
              </Label>
              <Input
                id="min-price"
                type="number"
                placeholder="Min"
                className="focus:ring-ring focus:border-ring focus:ring-2"
                value={minPriceDraft}
                onChange={(e) => setMinPriceDraft(e.target.value)}
                aria-label="Minimum price"
              />
            </div>
            <span className="text-muted-foreground">to</span>
            <div className="flex-1">
              <Label htmlFor="max-price" className="sr-only">
                Maximum price
              </Label>
              <Input
                id="max-price"
                type="number"
                placeholder="Max"
                className="focus:ring-ring focus:border-ring focus:ring-2"
                value={maxPriceDraft}
                onChange={(e) => setMaxPriceDraft(e.target.value)}
                aria-label="Maximum price"
              />
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={applyPriceRange}>
            Apply Filters
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Retailers Filter */}
      <div className="mb-6">
        <h3 className="text-foreground mb-3 text-sm font-medium">Retailers</h3>
        <div className="space-y-2">
          {retailers?.map((retailer) => (
            <div key={retailer.id} className="flex items-center space-x-2">
              <Checkbox
                id={`retailer-${retailer.id}`}
                checked={(filters.retailers || []).includes(retailer.id)}
                onCheckedChange={(checked) => handleRetailerChange(retailer.id, checked as boolean)}
                className="focus:ring-primary focus:ring-2"
              />
              <Label
                htmlFor={`retailer-${retailer.id}`}
                className="text-foreground flex-1 cursor-pointer text-sm"
              >
                {retailer.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Rating Filter */}
      <div className="mb-6">
        <h3 className="text-foreground mb-3 text-sm font-medium">Minimum Rating</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <div key={rating} className="flex items-center space-x-2">
              <Checkbox
                id={`rating-${rating}`}
                checked={filters.minRating === rating}
                onCheckedChange={(checked) => handleRatingChange(rating, checked as boolean)}
                className="focus:ring-primary focus:ring-2"
              />
              <Label
                htmlFor={`rating-${rating}`}
                className="text-foreground flex cursor-pointer items-center space-x-1 text-sm"
              >
                <div className="text-accent flex">
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={`text-xs ${i < rating ? 'text-accent' : 'text-muted-foreground'}`}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span>{rating}+ stars</span>
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Availability Filter */}
      <div className="mb-6">
        <h3 className="text-foreground mb-3 text-sm font-medium">Availability</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="in-stock"
              checked={(filters.availability || []).includes('in_stock')}
              onCheckedChange={(checked) =>
                handleAvailabilityChange('in_stock', checked as boolean)
              }
              className="focus:ring-primary focus:ring-2"
            />
            <Label htmlFor="in-stock" className="text-foreground cursor-pointer text-sm">
              In Stock
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="limited-stock"
              checked={(filters.availability || []).includes('limited_stock')}
              onCheckedChange={(checked) =>
                handleAvailabilityChange('limited_stock', checked as boolean)
              }
              className="focus:ring-primary focus:ring-2"
            />
            <Label htmlFor="limited-stock" className="text-foreground cursor-pointer text-sm">
              Limited Stock
            </Label>
          </div>
        </div>
      </div>

      {/* Clear Filters Button */}
      <Button
        variant="outline"
        className="text-primary hover:text-primary/80 border-primary hover:bg-primary/5 focus-visible w-full"
        onClick={clearFilters}
      >
        Clear All Filters
      </Button>
    </div>
  );
});

FilterSidebar.displayName = 'FilterSidebar';
