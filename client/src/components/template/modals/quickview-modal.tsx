import { useState } from 'react';
import { X, Heart, BarChart2, Minus, Plus, Star, ShoppingCart, ExternalLink, TrendingDown, Check, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { addSimpleToCart, toggleWishlist, isInWishlist, toggleCompare, openCart, isInCart } = useShop();
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
          "fixed inset-0 bg-black/70 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-5xl max-h-[90vh] bg-card rounded-2xl z-50 shadow-2xl transition-all duration-300 overflow-hidden",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-background/80 backdrop-blur-sm shadow-md rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid md:grid-cols-2 h-full">
          {/* Product Image Gallery */}
          <div className="relative bg-muted">
            {/* Main Image */}
            <div className="relative aspect-square">
              <img
                src={images[currentImage]}
                alt={product.name}
                className="w-full h-full object-cover"
              />

              {/* Image Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-background transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-background transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {discountPercent && discountPercent > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-sm font-bold px-3 py-1 rounded-lg">
                    -{discountPercent}%
                  </span>
                )}
                {product.priceChange === 'down' && (
                  <span className="bg-success text-white text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    Price Drop
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnail Navigation */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImage(idx)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    currentImage === idx
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/50 hover:border-border opacity-70 hover:opacity-100"
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-6 md:p-8 flex flex-col overflow-y-auto max-h-[50vh] md:max-h-[90vh]">
            {/* Category */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Categories:</span>
              <Link href={`/products?category=${product.category}`} className="text-primary hover:underline">
                {product.category}
              </Link>
            </div>

            {/* Name */}
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
              <Link href={`/product/${product.id}`} onClick={onClose} className="hover:text-primary transition-colors">
                {product.name}
              </Link>
            </h2>

            {/* Rating & Stats */}
            <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
              {product.rating && (
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < Math.floor(product.rating!) ? "fill-warning text-warning" : "text-muted"
                      )}
                    />
                  ))}
                </div>
              )}
              {product.reviewCount && (
                <span className="text-muted-foreground">Reviews ({product.reviewCount.toLocaleString()})</span>
              )}
              <span className="text-muted-foreground">|</span>
              <span className="text-muted-foreground">Sold: 349</span>
              {product.retailer && (
                <>
                  <span className="text-muted-foreground">|</span>
                  <Link href={`/products?brand=${product.retailer}`} className="text-primary hover:underline">
                    View shop
                  </Link>
                </>
              )}
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-3xl font-bold text-primary">${product.price.toFixed(2)}</span>
              {product.originalPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  ${product.originalPrice.toFixed(2)}
                </span>
              )}
            </div>

            {/* Product Features */}
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-xl mb-5">
              {mockProductFeatures.map((feature, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{feature.label}</span>
                  <span className="text-muted-foreground">{feature.value}</span>
                </div>
              ))}
            </div>

            {/* About this item */}
            <div className="mb-5">
              <h6 className="font-semibold text-foreground mb-3">About this item</h6>
              <ul className="space-y-2">
                {mockAboutItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="flex items-center gap-4 mb-4 mt-auto pt-4 border-t border-border">
              <div className="flex items-center border border-border rounded-lg bg-background">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-3 hover:bg-muted transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 font-medium min-w-[3rem] text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-3 hover:bg-muted transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                className={cn(
                  "flex-1 h-12",
                  inCart
                    ? "bg-success hover:bg-success/90"
                    : "bg-primary hover:bg-primary-hover"
                )}
                onClick={handleAddToCart}
              >
                {inCart ? (
                  <>
                    <Check className="h-5 w-5 mr-2" />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Add to Cart
                  </>
                )}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn(
                  "flex-1",
                  inWishlist && "border-destructive text-destructive"
                )}
                onClick={() => toggleWishlist(product.id)}
              >
                <Heart className={cn("h-4 w-4 mr-2", inWishlist && "fill-current")} />
                {inWishlist ? 'In Wishlist' : 'Wishlist'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => toggleCompare(product.id)}
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Compare
              </Button>
            </div>

            {/* View Full Details Link */}
            <Link href={`/product/${product.id}`} onClick={onClose} className="mt-4">
              <Button variant="ghost" className="w-full text-primary hover:text-primary-hover">
                View Full Details
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
