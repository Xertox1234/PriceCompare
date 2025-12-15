/**
 * Retailer Comparison Table Component
 *
 * Displays side-by-side comparison of prices across retailers.
 * Shows best deal badge on lowest-priced offer.
 */
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, handleImageError } from '@/lib/utils';
import { format } from 'date-fns';

interface RetailerOffer {
  id: number;
  retailerId: number;
  retailerName: string;
  retailerLogo?: string | null;
  price: string;
  originalPrice?: string | null;
  availability: string | null;
  productUrl?: string | null;
  affiliateUrl?: string | null;
  lastUpdated?: Date | string | null;
}

interface RetailerComparisonTableProps {
  offers: RetailerOffer[];
  className?: string;
}

export function RetailerComparisonTable({ offers, className }: RetailerComparisonTableProps) {
  if (!offers || offers.length === 0) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            No retailer offers available for comparison
          </p>
        </div>
      </Card>
    );
  }

  // Find the lowest price for "Best Deal" badge
  const prices = offers.map((offer) => parseFloat(offer.price));
  const lowestPrice = Math.min(...prices);

  // Sort offers by price (lowest first)
  const sortedOffers = [...offers].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

  const handleViewOffer = (offer: RetailerOffer) => {
    const url = offer.affiliateUrl || offer.productUrl;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)} data-testid="retailer-comparison">
      <div className="border-border border-b bg-muted/50 px-6 py-4">
        <h3 className="text-lg font-semibold">Cross-Retailer Comparison</h3>
        <p className="text-muted-foreground text-sm">
          Compare prices across {offers.length} retailer{offers.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                Retailer
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                Price
              </th>
              <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                Last Updated
              </th>
              <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedOffers.map((offer) => {
              const isBestDeal = parseFloat(offer.price) === lowestPrice;
              const price = parseFloat(offer.price);
              const originalPrice = offer.originalPrice
                ? parseFloat(offer.originalPrice)
                : undefined;
              const discount =
                originalPrice && originalPrice > price
                  ? Math.round(((originalPrice - price) / originalPrice) * 100)
                  : undefined;
              const lastUpdated = offer.lastUpdated
                ? typeof offer.lastUpdated === 'string'
                  ? new Date(offer.lastUpdated)
                  : offer.lastUpdated
                : null;

              return (
                <tr
                  key={offer.id}
                  className={cn(
                    'transition-colors hover:bg-muted/50',
                    isBestDeal && 'bg-secondary/10'
                  )}
                  data-testid="retailer-price"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {offer.retailerLogo && (
                        <img
                          src={offer.retailerLogo}
                          alt={`${offer.retailerName} logo`}
                          className="h-8 w-8 rounded object-contain"
                          onError={handleImageError}
                        />
                      )}
                      <span
                        className="font-medium text-foreground"
                        data-testid="retailer-name"
                      >
                        {offer.retailerName}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-foreground">
                        ${price.toFixed(2)}
                      </span>
                      {isBestDeal && (
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          data-testid="best-deal-badge"
                        >
                          Best Deal
                        </Badge>
                      )}
                      {discount && discount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          -{discount}% OFF
                        </Badge>
                      )}
                    </div>
                    {originalPrice && originalPrice > price && (
                      <div className="text-muted-foreground mt-1 text-xs line-through">
                        ${originalPrice.toFixed(2)}
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-muted-foreground text-sm">
                      {lastUpdated ? format(lastUpdated, 'MMM d, yyyy') : 'N/A'}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewOffer(offer)}
                      disabled={!offer.affiliateUrl && !offer.productUrl}
                      className="gap-1"
                    >
                      View Offer
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
