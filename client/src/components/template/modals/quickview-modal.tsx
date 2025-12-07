import { useState } from 'react';
import {
  X,
  Heart,
  BarChart2,
  Minus,
  Plus,
  Star,
  ShoppingCart,
  ExternalLink,
  TrendingDown,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';
import type { ProductData } from '../product-card';

interface QuickviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductData | null;
}

// Mock additional product data for demo
const mockProductFeatures = [
  { label: 'Brand', value: 'Premium Quality' },
  { label: 'Material', value: 'High-Grade' },
  { label: 'Warranty', value: '1 Year' },
  { label: 'Shipping', value: 'Free' },
];

const mockAboutItems = [
  'High-quality materials for long-lasting durability',
  'Easy to use and maintain',
  'Perfect for everyday use',
  'Backed by our satisfaction guarantee',
];

export function QuickviewModal({ isOpen, onClose, product }: QuickviewModalProps) {
  const { addSimpleToCart, toggleWishlist, isInWishlist, toggleCompare, openCart, isInCart } =
    useShop();
  const [quantity, setQuantity] = useState(1);
  const [currentImage, setCurrentImage] = useState(0);

  if (!product) return null;

  const inWishlist = isInWishlist(product.id);
  const inCart = isInCart(product.id);
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  // Create image gallery (use main image and hover image if available)
  const images = [
    product.image,
    product.hoverImage || product.image,
    product.image, // Repeat for demo
  ].filter(Boolean);

  const handleAddToCart = () => {
    addSimpleToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      quantity,
    });
    openCart();
    onClose();
  };

  const nextImage = () => {
    setCurrentImage((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImage((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/70 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'bg-card fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[95vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl transition-all duration-300',
          isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="bg-background/80 hover:bg-muted absolute top-4 right-4 z-10 rounded-full p-2 shadow-md backdrop-blur-sm transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid h-full md:grid-cols-2">
          {/* Product Image Gallery */}
          <div className="bg-muted relative">
            {/* Main Image */}
            <div className="relative aspect-square">
              <img
                src={images[currentImage]}
                alt={product.name}
                className="h-full w-full object-cover"
              />

              {/* Image Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="bg-background/80 hover:bg-background absolute top-1/2 left-3 -translate-y-1/2 rounded-full p-2 shadow-lg backdrop-blur-sm transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="bg-background/80 hover:bg-background absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-2 shadow-lg backdrop-blur-sm transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discountPercent && discountPercent > 0 && (
                  <span className="bg-destructive text-destructive-foreground rounded-lg px-3 py-1 text-sm font-bold">
                    -{discountPercent}%
                  </span>
                )}
                {product.priceChange === 'down' && (
                  <span className="bg-success flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-white">
                    <TrendingDown className="h-3 w-3" />
                    Price Drop
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Navigation */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={cn(
                    'h-16 w-16 overflow-hidden rounded-lg border-2 transition-all',
                    currentImage === idx
                      ? 'border-primary ring-primary/30 ring-2'
                      : 'border-border/50 hover:border-border opacity-70 hover:opacity-100'
                  )}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="flex max-h-[50vh] flex-col overflow-y-auto p-6 md:max-h-[90vh] md:p-8">
            {/* Category */}
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
              <span>Categories:</span>
              <Link
                href={`/products?category=${product.category}`}
                className="text-primary hover:underline"
              >
                {product.category}
              </Link>
            </div>

            {/* Name */}
            <h2 className="text-foreground mb-3 text-xl font-bold md:text-2xl">
              <Link
                href={`/product/${product.id}`}
                onClick={onClose}
                className="hover:text-primary transition-colors"
              >
                {product.name}
              </Link>
            </h2>

            {/* Rating & Stats */}
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              {product.rating && (
                <div className="flex items-center gap-1">
                  {(() => {
                    const rating = product.rating;
                    if (!rating) return null;
                    return Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < Math.floor(rating) ? 'fill-warning text-warning' : 'text-muted'
                        )}
                      />
                    ));
                  })()}
                </div>
              )}
              {product.reviewCount && (
                <span className="text-muted-foreground">
                  Reviews ({product.reviewCount.toLocaleString()})
                </span>
              )}
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">Sold: 349</span>
              {product.retailer && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Link
                    href={`/products?brand=${product.retailer}`}
                    className="text-primary hover:underline"
                  >
                    View shop
                  </Link>
                </>
              )}
            </div>

            {/* Price */}
            <div className="mb-5 flex items-baseline gap-3">
              <span className="text-primary text-3xl font-bold">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-muted-foreground text-lg line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Product Features */}
            <div className="bg-muted/50 mb-5 grid grid-cols-2 gap-2 rounded-xl p-4">
              {mockProductFeatures.map((feature, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{feature.label}</span>
                  <span className="text-muted-foreground">{feature.value}</span>
                </div>
              ))}
            </div>

            {/* About this item */}
            <div className="mb-5">
              <h6 className="text-foreground mb-3 font-semibold">About this item</h6>
              <ul className="space-y-2">
                {mockAboutItems.map((item, idx) => (
                  <li key={idx} className="text-muted-foreground flex items-start gap-2 text-sm">
                    <Check className="text-success mt-0.5 h-4 w-4 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="border-border mt-auto mb-4 flex items-center gap-4 border-t pt-4">
              <div className="border-border bg-background flex items-center rounded-lg border">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="hover:bg-muted p-3 transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[3rem] px-4 text-center font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="hover:bg-muted p-3 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                className={cn(
                  'h-12 flex-1',
                  inCart ? 'bg-success hover:bg-success/90' : 'bg-primary hover:bg-primary-hover'
                )}
                onClick={handleAddToCart}
              >
                {inCart ? (
                  <>
                    <Check className="mr-2 h-5 w-5" />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    Add to Cart
                  </>
                )}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn('flex-1', inWishlist && 'border-destructive text-destructive')}
                onClick={() => toggleWishlist(product.id)}
              >
                <Heart className={cn('mr-2 h-4 w-4', inWishlist && 'fill-current')} />
                {inWishlist ? 'In Wishlist' : 'Wishlist'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toggleCompare(product.id)}
              >
                <BarChart2 className="mr-2 h-4 w-4" />
                Compare
              </Button>
            </div>

            {/* View Full Details Link */}
            <Link href={`/product/${product.id}`} onClick={onClose} className="mt-4">
              <Button variant="ghost" className="text-primary hover:text-primary-hover w-full">
                View Full Details
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
