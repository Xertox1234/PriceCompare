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
import {
  TemplateHeader,
  TemplateFooter,
  ProductSection,
  type ProductData,
} from '@/components/template';
import { CartSidebar } from '@/components/template/cart-sidebar';
import { MobileMenu, CompareModal, SearchModal } from '@/components/template/modals';
import { ShopProvider, useShop } from '@/context/shop-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bestSellerProducts, type TemplateProduct } from '@/data/template-data';

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
    <div className="bg-background min-h-screen">
      <TemplateHeader
        onOpenCart={openCart}
        onOpenMobileMenu={() => setMobileMenuOpen(true)}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {/* Breadcrumbs */}
      <div className="border-border border-b py-4">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground font-medium">Shopping Cart</span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-foreground flex items-center gap-3 text-2xl font-bold lg:text-3xl">
            <ShoppingCart className="text-primary h-8 w-8" />
            Shopping Cart
            {cartItems.length > 0 && (
              <span className="text-muted-foreground text-lg font-normal">
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
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Cart
            </Button>
          )}
        </div>

        {cartItems.length === 0 ? (
          /* Empty Cart State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted mb-6 flex h-32 w-32 items-center justify-center rounded-full">
              <ShoppingCart className="text-muted-foreground h-16 w-16" />
            </div>
            <h2 className="text-foreground mb-2 text-2xl font-bold">Your cart is empty</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Looks like you haven't added anything to your cart yet. Let's find something great for
              you!
            </p>
            <Link href="/shop">
              <Button size="lg" className="bg-primary hover:bg-primary-hover">
                <Package className="mr-2 h-5 w-5" />
                Start Shopping
              </Button>
            </Link>
          </div>
        ) : (
          /* Cart Content */
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Cart Items */}
            <div className="space-y-4 lg:col-span-2">
              {/* Free Shipping Progress */}
              <div className="bg-card border-border rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Truck className="text-primary h-5 w-5" />
                  {amountToFreeShipping > 0 ? (
                    <span className="text-sm">
                      Add{' '}
                      <span className="text-primary font-bold">
                        ${amountToFreeShipping.toFixed(2)}
                      </span>{' '}
                      more for <span className="text-success font-semibold">FREE shipping</span>
                    </span>
                  ) : (
                    <span className="text-success text-sm font-semibold">
                      Congratulations! You've unlocked FREE shipping!
                    </span>
                  )}
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="from-primary to-success h-full bg-gradient-to-r transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
              </div>

              {/* Items Table Header */}
              <div className="bg-muted/50 text-muted-foreground hidden grid-cols-12 gap-4 rounded-t-xl px-4 py-3 text-sm font-medium md:grid">
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
                    className="bg-card border-border group grid grid-cols-12 items-center gap-4 rounded-xl border p-4"
                  >
                    {/* Product Info */}
                    <div className="col-span-12 flex gap-4 md:col-span-6">
                      <Link href={`/product/${item.id}`} className="flex-shrink-0">
                        <div className="bg-muted h-24 w-24 overflow-hidden rounded-lg">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/product/${item.id}`}
                          className="text-foreground hover:text-primary line-clamp-2 font-medium"
                        >
                          {item.name}
                        </Link>
                        <p className="text-muted-foreground mt-1 text-sm">In Stock</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-muted-foreground hover:text-destructive mt-2 flex items-center gap-1 text-sm transition-colors md:hidden"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="col-span-4 text-center md:col-span-2">
                      <span className="text-muted-foreground mb-1 block text-sm md:hidden">
                        Price:
                      </span>
                      <span className="text-foreground font-semibold">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 flex justify-center md:col-span-2">
                      <div className="border-border flex items-center rounded-lg border">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="hover:bg-muted p-2 transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-10 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="hover:bg-muted p-2 transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Total & Remove */}
                    <div className="col-span-4 flex items-center justify-end gap-3 md:col-span-2">
                      <span className="text-primary font-bold">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-muted hidden rounded-lg p-2 transition-colors md:flex"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Continue Shopping */}
              <div className="flex items-center justify-between pt-4">
                <Link href="/shop">
                  <Button variant="outline">
                    <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card border-border sticky top-4 space-y-6 rounded-2xl border p-6">
                <h2 className="text-foreground text-xl font-bold">Order Summary</h2>

                {/* Coupon Code */}
                <div className="space-y-3">
                  <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4" />
                    Coupon Code
                  </label>
                  {appliedCoupon ? (
                    <div className="bg-success/10 border-success/20 flex items-center justify-between rounded-lg border p-3">
                      <span className="text-success text-sm font-medium">
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
                      <Button variant="outline" onClick={handleApplyCoupon} disabled={!couponCode}>
                        Apply
                      </Button>
                    </div>
                  )}
                  <p className="text-muted-foreground text-xs">Try "SAVE10" for 10% off</p>
                </div>

                {/* Price Breakdown */}
                <div className="border-border space-y-3 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground font-medium">${cartTotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-success">Discount</span>
                      <span className="text-success font-medium">-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    {shipping === 0 ? (
                      <span className="text-success font-medium">FREE</span>
                    ) : (
                      <span className="text-foreground font-medium">${shipping.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="border-border flex justify-between border-t pt-3">
                    <span className="text-foreground text-lg font-bold">Total</span>
                    <span className="text-primary text-lg font-bold">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Checkout Button */}
                <Link href="/checkout" className="block">
                  <Button className="bg-primary hover:bg-primary-hover w-full py-6 text-base">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Proceed to Checkout
                  </Button>
                </Link>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
                    <Shield className="text-primary h-5 w-5" />
                    <span className="text-muted-foreground text-xs">Secure Payment</span>
                  </div>
                  <div className="bg-muted/50 flex items-center gap-2 rounded-lg p-3">
                    <Lock className="text-primary h-5 w-5" />
                    <span className="text-muted-foreground text-xs">SSL Encrypted</span>
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="border-border border-t pt-4">
                  <p className="text-muted-foreground mb-3 text-xs">We accept</p>
                  <div className="flex gap-2">
                    {['Visa', 'Mastercard', 'Amex', 'PayPal'].map((method) => (
                      <div
                        key={method}
                        className="bg-muted/50 text-muted-foreground flex-1 rounded py-2 text-center text-xs font-medium"
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
