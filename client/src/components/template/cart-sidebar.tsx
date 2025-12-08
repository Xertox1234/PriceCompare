import * as React from 'react';
import { Link } from 'wouter';
import { X, Minus, Plus, Trash2, ShoppingCart, Truck } from 'lucide-react';
import { useShop } from '@/hooks/use-shop';
import { cn, getProductImageUrl, handleImageError } from '@/lib/utils';

const FREE_SHIPPING_THRESHOLD = 99;

export function CartSidebar() {
  const { isCartOpen, closeCart, cartItems, updateQuantity, removeFromCart, cartTotal } = useShop();

  const shippingProgress = Math.min((cartTotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const amountToFreeShipping = Math.max(FREE_SHIPPING_THRESHOLD - cartTotal, 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
          isCartOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={closeCart}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'bg-card border-border fixed top-0 right-0 z-50 flex h-full w-full max-w-md transform flex-col border-l transition-transform duration-300 ease-out',
          isCartOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4">
          <h2 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <ShoppingCart className="h-5 w-5" />
            Shopping Cart
            {cartItems.length > 0 && (
              <span className="text-muted-foreground text-sm font-normal">
                ({cartItems.length} items)
              </span>
            )}
          </h2>
          <button onClick={closeCart} className="hover:bg-muted rounded-lg p-2 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Content */}
        {cartItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="bg-muted mb-4 flex h-24 w-24 items-center justify-center rounded-full">
              <ShoppingCart className="text-muted-foreground h-10 w-10" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">Your cart is empty</h3>
            <p className="text-muted-foreground mb-6">Let us help you find the perfect item</p>
            <Link href="/products" onClick={closeCart}>
              <button className="bg-primary hover:bg-primary-hover rounded-lg px-6 py-3 font-medium text-white transition-colors">
                Browse Products
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Items List */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {cartItems.map((item) => (
                <div key={item.id} className="bg-muted/50 group flex gap-4 rounded-xl p-3">
                  {/* Product Image */}
                  <Link href={`/product/${item.id}`} onClick={closeCart} className="flex-shrink-0">
                    <div className="bg-muted h-20 w-20 overflow-hidden rounded-lg">
                      <img
                        src={getProductImageUrl(item.image)}
                        alt={item.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        onError={handleImageError}
                      />
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/product/${item.id}`}
                      onClick={closeCart}
                      className="text-foreground hover:text-primary line-clamp-2 text-sm font-medium"
                    >
                      {item.name}
                    </Link>
                    <p className="text-primary mt-1 font-semibold">${item.price.toFixed(2)}</p>

                    {/* Quantity Controls */}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="border-border bg-background flex items-center rounded-lg border">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="hover:bg-muted p-1.5 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="hover:bg-muted p-1.5 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-border space-y-4 border-t p-4">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-lg font-semibold">
                <span className="text-foreground">Subtotal:</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Link href="/cart" onClick={closeCart} className="flex-1">
                  <button className="w-full rounded-lg bg-slate-800 px-4 py-3 font-medium text-white transition-colors hover:bg-slate-700">
                    View Cart
                  </button>
                </Link>
                <Link href="/checkout" onClick={closeCart} className="flex-1">
                  <button className="bg-primary hover:bg-primary-hover w-full rounded-lg px-4 py-3 font-medium text-white transition-colors">
                    Checkout
                  </button>
                </Link>
              </div>

              {/* Free Shipping Progress */}
              <div className="space-y-2">
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-success h-full transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="text-primary h-4 w-4" />
                  {amountToFreeShipping > 0 ? (
                    <span className="text-muted-foreground">
                      Add{' '}
                      <span className="text-foreground font-semibold">
                        ${amountToFreeShipping.toFixed(2)}
                      </span>{' '}
                      more for free shipping
                    </span>
                  ) : (
                    <span className="text-success font-medium">You've unlocked free shipping!</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
