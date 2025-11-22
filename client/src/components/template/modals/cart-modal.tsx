import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useShop, type CartItem } from '@/context/shop-context';
import { cn } from '@/lib/utils';

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartModal({ isOpen, onClose }: CartModalProps) {
  const { cart, removeFromCart, updateCartQuantity, getCartTotal, getCartItemCount } = useShop();
  const cartTotal = getCartTotal();
  const cartItemCount = getCartItemCount();

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-slate-900 z-50 transition-opacity duration-300",
          isOpen ? "opacity-80" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-template-primary" />
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
            <span className="bg-template-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cartItemCount}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mb-6">
                Looks like you haven't added anything to your cart yet
              </p>
              <Button onClick={onClose} className="bg-template-primary hover:bg-template-primary-hover">
                Continue Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <CartItemCard
                  key={item.product.id}
                  item={item}
                  onRemove={() => removeFromCart(item.product.id)}
                  onUpdateQuantity={(qty) => updateCartQuantity(item.product.id, qty)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t border-border p-4 space-y-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">${cartTotal.toFixed(2)}</span>
            </div>

            {/* Shipping Notice */}
            <p className="text-xs text-muted-foreground text-center">
              Shipping & taxes calculated at checkout
            </p>

            {/* Buttons */}
            <div className="space-y-2">
              <Link href="/cart" onClick={onClose}>
                <Button variant="outline" className="w-full">
                  View Cart
                </Button>
              </Link>
              <Link href="/checkout" onClick={onClose}>
                <Button className="w-full bg-template-primary hover:bg-template-primary-hover">
                  Checkout
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface CartItemCardProps {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

function CartItemCard({ item, onRemove, onUpdateQuantity }: CartItemCardProps) {
  const { product, quantity } = item;

  return (
    <div className="flex gap-4 p-3 bg-muted rounded-lg">
      {/* Product Image */}
      <Link href={`/product/${product.id}`}>
        <div className="w-20 h-20 bg-background rounded-lg overflow-hidden flex-shrink-0">
          <img
            src={product.imgSrc}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/product/${product.id}`}>
          <h3 className="font-medium text-foreground text-sm line-clamp-2 hover:text-template-primary transition-colors">
            {product.title}
          </h3>
        </Link>
        <p className="text-sm font-bold text-template-primary mt-1">
          ${product.price.toFixed(2)}
        </p>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border border-border rounded-lg">
            <button
              onClick={() => onUpdateQuantity(Math.max(1, quantity - 1))}
              className="p-1.5 hover:bg-muted transition-colors"
              disabled={quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="px-3 text-sm font-medium min-w-[2rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(quantity + 1)}
              className="p-1.5 hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={onRemove}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors ml-auto"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
