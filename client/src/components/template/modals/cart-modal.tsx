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
          'fixed inset-0 z-50 bg-slate-900 transition-opacity duration-300',
          isOpen ? 'opacity-80' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col shadow-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-template-primary h-5 w-5" />
            <h2 className="text-lg font-semibold">Shopping Cart</h2>
            <span className="bg-template-primary rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {cartItemCount}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-muted">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag className="text-muted-foreground mb-4 h-16 w-16" />
              <p className="text-foreground mb-2 text-lg font-medium">Your cart is empty</p>
              <p className="text-muted-foreground mb-6 text-sm">
                Looks like you haven't added anything to your cart yet
              </p>
              <Button
                onClick={onClose}
                className="bg-template-primary hover:bg-template-primary-hover"
              >
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
          <div className="border-border space-y-4 border-t p-4">
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-lg font-bold">${cartTotal.toFixed(2)}</span>
            </div>

            {/* Shipping Notice */}
            <p className="text-muted-foreground text-center text-xs">
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
                <Button className="bg-template-primary hover:bg-template-primary-hover w-full">
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
    <div className="bg-muted flex gap-4 rounded-lg p-3">
      {/* Product Image */}
      <Link href={`/product/${product.id}`}>
        <div className="bg-background h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg">
          <img src={product.imgSrc} alt={product.title} className="h-full w-full object-cover" />
        </div>
      </Link>

      {/* Product Info */}
      <div className="min-w-0 flex-1">
        <Link href={`/product/${product.id}`}>
          <h3 className="text-foreground hover:text-template-primary line-clamp-2 text-sm font-medium transition-colors">
            {product.title}
          </h3>
        </Link>
        <p className="text-template-primary mt-1 text-sm font-bold">${product.price.toFixed(2)}</p>

        {/* Quantity Controls */}
        <div className="mt-2 flex items-center gap-2">
          <div className="border-border flex items-center rounded-lg border">
            <button
              onClick={() => onUpdateQuantity(Math.max(1, quantity - 1))}
              className="hover:bg-muted p-1.5 transition-colors"
              disabled={quantity <= 1}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[2rem] px-3 text-center text-sm font-medium">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(quantity + 1)}
              className="hover:bg-muted p-1.5 transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive ml-auto p-1.5 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
