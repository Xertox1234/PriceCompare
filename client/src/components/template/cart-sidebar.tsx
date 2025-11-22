import * as React from 'react';
import { Link } from 'wouter';
import { X, Minus, Plus, Trash2, ShoppingCart, Truck } from 'lucide-react';
import { useShop } from '@/hooks/use-shop';
import { cn } from '@/lib/utils';

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
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isCartOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeCart}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-border z-50 transform transition-transform duration-300 ease-out flex flex-col",
          isCartOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Shopping Cart
            {cartItems.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({cartItems.length} items)
              </span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Content */}
        {cartItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground mb-6">Let us help you find the perfect item</p>
            <Link href="/products" onClick={closeCart}>
              <button className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
                Browse Products
              </button>
            </Link>
          </div>
        ) : (
          <>
            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 bg-muted/50 rounded-xl group"
                >
                  {/* Product Image */}
                  <Link
                    href={`/product/${item.id}`}
                    onClick={closeCart}
                    className="flex-shrink-0"
                  >
                    <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  </Link>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.id}`}
                      onClick={closeCart}
                      className="font-medium text-foreground hover:text-primary line-clamp-2 text-sm"
                    >
                      {item.name}
                    </Link>
                    <p className="text-primary font-semibold mt-1">
                      ${item.price.toFixed(2)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-border rounded-lg bg-background">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1.5 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1.5 hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 space-y-4">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-lg font-semibold">
                <span className="text-foreground">Subtotal:</span>
                <span className="text-primary">${cartTotal.toFixed(2)}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Link href="/cart" onClick={closeCart} className="flex-1">
                  <button className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors">
                    View Cart
                  </button>
                </Link>
                <Link href="/checkout" onClick={closeCart} className="flex-1">
                  <button className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors">
                    Checkout
                  </button>
                </Link>
              </div>

              {/* Free Shipping Progress */}
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-primary" />
                  {amountToFreeShipping > 0 ? (
                    <span className="text-muted-foreground">
                      Add <span className="font-semibold text-foreground">${amountToFreeShipping.toFixed(2)}</span> more for free shipping
                    </span>
                  ) : (
                    <span className="text-success font-medium">
                      You've unlocked free shipping!
                    </span>
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
