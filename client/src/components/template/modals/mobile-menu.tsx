import { useState } from 'react';
import { X, ChevronDown, Home, Package, Tag, Users, Mail, Search, Heart, User } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';
import { categories } from '@/data/template-data';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { wishlist } = useShop();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const navItems = [
    { icon: Home, label: 'Home', href: '/new' },
    { icon: Package, label: 'Products', href: '/shop', hasSubmenu: true },
    { icon: Tag, label: 'Deals', href: '/shop?deals=true' },
    { icon: Users, label: 'Community', href: '/community' },
    { icon: Mail, label: 'Contact', href: '/contact' },
  ];

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
          'fixed top-0 left-0 z-50 flex h-full w-full max-w-xs flex-col shadow-2xl transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="border-border bg-primary flex items-center justify-between border-b p-4 text-white">
          <span className="text-lg font-bold">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-slate-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="border-border border-b p-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              className="bg-muted focus:ring-primary w-full rounded-lg px-4 py-2.5 pl-10 text-sm focus:ring-2 focus:outline-none"
            />
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="py-2">
            {navItems.map((item) => (
              <li key={item.label}>
                {item.hasSubmenu ? (
                  <>
                    <button
                      onClick={() =>
                        setExpandedItem(expandedItem === item.label ? null : item.label)
                      }
                      className="hover:bg-muted flex w-full items-center justify-between px-4 py-3 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="text-primary h-5 w-5" />
                        <span className="font-medium">{item.label}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'text-muted-foreground h-4 w-4 transition-transform',
                          expandedItem === item.label && 'rotate-180'
                        )}
                      />
                    </button>
                    {/* Submenu */}
                    <ul
                      className={cn(
                        'bg-muted overflow-hidden transition-all duration-300',
                        expandedItem === item.label ? 'max-h-96' : 'max-h-0'
                      )}
                    >
                      <li>
                        <Link
                          href="/shop"
                          onClick={onClose}
                          className="hover:bg-muted block px-4 py-2.5 pl-12 text-sm transition-colors"
                        >
                          All Products
                        </Link>
                      </li>
                      {categories.slice(0, 6).map((cat) => (
                        <li key={cat.slug}>
                          <Link
                            href={`/shop?category=${cat.slug}`}
                            onClick={onClose}
                            className="hover:bg-muted block px-4 py-2.5 pl-12 text-sm transition-colors"
                          >
                            {cat.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="hover:bg-muted flex items-center gap-3 px-4 py-3 transition-colors"
                  >
                    <item.icon className="text-primary h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="border-border my-2 border-t" />

          {/* Secondary Links */}
          <ul className="py-2">
            <li>
              <Link
                href="/wishlist"
                onClick={onClose}
                className="hover:bg-muted flex items-center justify-between px-4 py-3 transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Heart className="text-primary h-5 w-5" />
                  <span className="font-medium">Wishlist</span>
                </span>
                {wishlist.length > 0 && (
                  <span className="bg-primary rounded-full px-2 py-0.5 text-xs font-bold text-white">
                    {wishlist.length}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                onClick={onClose}
                className="hover:bg-muted flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <User className="text-primary h-5 w-5" />
                <span className="font-medium">My Account</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-border bg-muted border-t p-4">
          <div className="space-y-2">
            <Link href="/login" onClick={onClose}>
              <Button variant="outline" className="w-full">
                Sign In
              </Button>
            </Link>
            <Link href="/register" onClick={onClose}>
              <Button className="bg-primary hover:bg-primary/90 w-full">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
