import { useState } from 'react';
import { Link } from 'wouter';
import {
  ChevronRight,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Truck,
  Shield,
  Tag,
  ArrowRight,
  Package,
  CreditCard,
  Lock,
} from 'lucide-react';
import { TemplateHeader, TemplateFooter, ProductSection, type ProductData } from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  bestSellerProducts,
  type TemplateProduct,
} from '@/data/template-data';

const FREE_SHIPPING_THRESHOLD = 99;

function toProductData(products: TemplateProduct[]): ProductData[] {
  return products.map((p) => ({
    id: p.id,
    name: p.title,
    category: p.category,
    price: p.price,
    originalPrice: p.oldPrice,
    image: p.imgSrc,
    hoverImage: p.imgHover,
    rating: p.rating,
    reviewCount: p.reviewCount,
    retailer: p.brand,
    discount: p.salePercentage ? parseInt(p.salePercentage) : undefined,
  }));
}

function CartContent() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    clearCart,
    cartTotal,
    openCart,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
  } = useShop();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);

  const shippingProgress = Math.min((cartTotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - cartTotal, 0);
  const shipping = cartTotal >= FREE_SHIPPING_THRESHOLD ? 0 : 9.99;
  const discount = appliedCoupon ? cartTotal * 0.1 : 0; // 10% discount with coupon
  const total = cartTotal + shipping - discount;

  // Suggested products
  const suggestedProducts = toProductData(bestSellerProducts.slice(0, 4)).map((p) => ({
    ...p,
    inWatchlist: isInWishlist(p.id),
  }));

  const handleApplyCoupon = () => {
    if (couponCode.toLowerCase() === 'save10') {
      setAppliedCoupon(couponCode);
      setCouponCode('');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-b border-border py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground font-medium">Shopping Cart</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Shopping Cart
            {cartItems.length > 0 && (
              <span className="text-lg font-normal text-muted-foreground">
                ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'})
              </span>
            )}
          </h1>
          {cartItems.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Cart
            </Button>
          )}
        </div>

        {cartItems.length === 0 ? (
          /* Empty Cart State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-6">
              <ShoppingCart className="h-16 w-16 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Looks like you haven't added anything to your cart yet. Let's find something great for you!
            </p>
            <Link href="/shop">
              <Button size="lg" className="bg-primary hover:bg-primary-hover">
                <Package className="h-5 w-5 mr-2" />
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : (
          /* Cart Content */
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {/* Free Shipping Progress */}
              <div className="p-4 bg-card rounded-xl border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <Truck className="h-5 w-5 text-primary" />
                  {amountToFreeShipping > 0 ? (
                    <span className="text-sm">
                      Add <span className="font-bold text-primary">${amountToFreeShipping.toFixed(2)}</span> more
                      for <span className="font-semibold text-success">FREE shipping</span>
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-success">
                      Congratulations! You've unlocked FREE shipping!
                    </span>
                  )}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-success transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </div>

              {/* Items Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 rounded-t-xl text-sm font-medium text-muted-foreground">
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-center">Price</div>
                <div className="col-span-2 text-center">Quantity</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Cart Items */}
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-4 p-4 bg-card rounded-xl border border-border items-center group"
                  >
                    {/* Product Info */}
                    <div className="col-span-12 md:col-span-6 flex gap-4">
                      <Link href={`/product/${item.id}`} className="flex-shrink-0">
                        <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/product/${item.id}`}
                          className="font-medium text-foreground hover:text-primary line-clamp-2"
                        >
                          {item.name}
                        </Link>
                        <p className="text-sm text-muted-foreground mt-1">
                          In Stock
                        </p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-sm text-muted-foreground hover:text-destructive transition-colors mt-2 flex items-center gap-1 md:hidden"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-4 md:col-span-2 text-center">
                      <span className="md:hidden text-sm text-muted-foreground block mb-1">Price:</span>
                      <span className="font-semibold text-foreground">${item.price.toFixed(2)}</span>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 md:col-span-2 flex justify-center">
                      <div className="flex items-center border border-border rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-10 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-muted transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Total & Remove */}
                    <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-3">
                      <span className="font-bold text-primary">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="hidden md:flex p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping */}
              <div className="flex justify-between items-center pt-4">
                <Link href="/shop">
                  <Button variant="outline">
                    <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl border border-border p-6 sticky top-4 space-y-6">
                <h2 className="text-xl font-bold text-foreground">Order Summary</h2>

                {/* Coupon Code */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Coupon Code
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                      <span className="text-sm font-medium text-success">
                        "{appliedCoupon}" applied (-10%)
                      </span>
                      <button
                        onClick={handleRemoveCoupon}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Try "SAVE10" for 10% off</p>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium text-foreground">${cartTotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-success">Discount</span>
                      <span className="font-medium text-success">-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    {shipping === 0 ? (
                      <span className="font-medium text-success">FREE</span>
                    ) : (
                      <span className="font-medium text-foreground">${shipping.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex justify-between pt-3 border-t border-border">
                    <span className="text-lg font-bold text-foreground">Total</span>
                    <span className="text-lg font-bold text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <Link href="/checkout" className="block">
                  <Button className="w-full py-6 text-base bg-primary hover:bg-primary-hover">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Proceed to Checkout
                  </Button>
                </Link>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="text-xs text-muted-foreground">Secure Payment</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Lock className="h-5 w-5 text-primary" />
                    <span className="text-xs text-muted-foreground">SSL Encrypted</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3">We accept</p>
                  <div className="flex gap-2">
                    {['Visa', 'Mastercard', 'Amex', 'PayPal'].map((method) => (
                      <div
                        key={method}
                        className="flex-1 py-2 bg-muted/50 rounded text-center text-xs font-medium text-muted-foreground"
                      >
                        {method}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggested Products */}
        {cartItems.length > 0 && suggestedProducts.length > 0 && (
          <div className="mt-12">
            <ProductSection
              title="You Might Also Like"
              subtitle="Complete your purchase with these items"
              products={suggestedProducts}
              columns={4}
              onWatchlist={(p) => toggleWishlist(p.id)}
              onCompare={(p) => {
                toggleCompare(p.id);
                setCompareOpen(true);
              }}
            />
          </div>
        )}
      </main>

      <TemplateFooter />

      {/* Modals */}
      <CartSidebar />
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <CompareModal isOpen={compareOpen} onClose={() => setCompareOpen(false)} />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export default function CartPage() {
  return (
    <ShopProvider>
      <CartContent />
    </ShopProvider>
  );
}
