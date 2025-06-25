import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SearchFilters, Retailer } from "@shared/schema";

interface FilterSidebarProps {
  filters: SearchFilters;
  onFilterChange: (filters: Partial<SearchFilters>) => void;
}

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  const { data: retailers } = useQuery<Retailer[]>({
    queryKey: ["/api/retailers"],
  });

  const handlePriceRangeChange = (field: "minPrice" | "maxPrice", value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    onFilterChange({ [field]: numValue });
  };

  const handleRetailerChange = (retailerId: number, checked: boolean) => {
    const currentRetailers = filters.retailers || [];
    const newRetailers = checked
      ? [...currentRetailers, retailerId]
      : currentRetailers.filter(id => id !== retailerId);
    
    onFilterChange({ retailers: newRetailers.length > 0 ? newRetailers : undefined });
  };

  const handleRatingChange = (rating: number, checked: boolean) => {
    onFilterChange({ minRating: checked ? rating : undefined });
  };

  const handleAvailabilityChange = (availability: string, checked: boolean) => {
    const currentAvailability = filters.availability || [];
    const newAvailability = checked
      ? [...currentAvailability, availability]
      : currentAvailability.filter(a => a !== availability);
    
    onFilterChange({ availability: newAvailability.length > 0 ? newAvailability : undefined });
  };

  const clearFilters = () => {
    onFilterChange({
      minPrice: undefined,
      maxPrice: undefined,
      retailers: undefined,
      minRating: undefined,
      availability: undefined,
    });
  };

  return (
    <aside className="lg:w-80 flex-shrink-0" role="complementary" aria-label="Product filters">
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Filters</h2>
        
        {/* Price Range Filter */}
        <div className="filter-section mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Price Range</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <Label htmlFor="min-price" className="sr-only">Minimum price</Label>
                <Input
                  id="min-price"
                  type="number"
                  placeholder="Min"
                  className="focus:ring-2 focus:ring-primary focus:border-primary"
                  value={filters.minPrice || ""}
                  onChange={(e) => handlePriceRangeChange("minPrice", e.target.value)}
                  aria-label="Minimum price"
                />
              </div>
              <span className="text-muted-foreground">to</span>
              <div className="flex-1">
                <Label htmlFor="max-price" className="sr-only">Maximum price</Label>
                <Input
                  id="max-price"
                  type="number"
                  placeholder="Max"
                  className="focus:ring-2 focus:ring-primary focus:border-primary"
                  value={filters.maxPrice || ""}
                  onChange={(e) => handlePriceRangeChange("maxPrice", e.target.value)}
                  aria-label="Maximum price"
                />
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Retailers Filter */}
        <div className="filter-section mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Retailers</h3>
          <div className="filter-group">
            {retailers?.map((retailer) => (
              <div key={retailer.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`retailer-${retailer.id}`}
                  checked={(filters.retailers || []).includes(retailer.id)}
                  onCheckedChange={(checked) => handleRetailerChange(retailer.id, checked as boolean)}
                  className="focus:ring-2 focus:ring-primary"
                />
                <Label
                  htmlFor={`retailer-${retailer.id}`}
                  className="text-sm text-foreground cursor-pointer flex-1"
                >
                  {retailer.name}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Rating Filter */}
        <div className="filter-section mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Minimum Rating</h3>
          <div className="filter-group">
            {[5, 4, 3, 2, 1].map((rating) => (
              <div key={rating} className="flex items-center space-x-2">
                <Checkbox
                  id={`rating-${rating}`}
                  checked={filters.minRating === rating}
                  onCheckedChange={(checked) => handleRatingChange(rating, checked as boolean)}
                  className="focus:ring-2 focus:ring-primary"
                />
                <Label
                  htmlFor={`rating-${rating}`}
                  className="text-sm text-foreground cursor-pointer flex items-center space-x-1"
                >
                  <div className="flex text-accent" aria-label={`${rating} stars and up`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span
                        key={i}
                        className={`text-xs ${i < rating ? "text-accent" : "text-muted-foreground"}`}
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
        <div className="filter-section mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">Availability</h3>
          <div className="filter-group">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="in-stock"
                checked={(filters.availability || []).includes("in_stock")}
                onCheckedChange={(checked) => handleAvailabilityChange("in_stock", checked as boolean)}
                className="focus:ring-2 focus:ring-primary"
              />
              <Label htmlFor="in-stock" className="text-sm text-foreground cursor-pointer">
                In Stock
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="limited-stock"
                checked={(filters.availability || []).includes("limited_stock")}
                onCheckedChange={(checked) => handleAvailabilityChange("limited_stock", checked as boolean)}
                className="focus:ring-2 focus:ring-primary"
              />
              <Label htmlFor="limited-stock" className="text-sm text-foreground cursor-pointer">
                Limited Stock
              </Label>
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        <Button
          variant="outline"
          className="w-full text-primary hover:text-primary/80 border-primary hover:bg-primary/5 focus-visible"
          onClick={clearFilters}
        >
          Clear All Filters
        </Button>
      </div>
    </aside>
  );
}
