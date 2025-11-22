import { useState } from 'react';
import { X, ChevronRight, ChevronDown, Home, Package, Tag, Users, Mail, Search, Heart, User } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { useShop } from '@/context/shop-context';
import { cn } from '@/lib/utils';
import { menuItems, categories } from '@/data/template-data';

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
          "fixed inset-0 bg-slate-900 z-50 transition-opacity duration-300",
          isOpen ? "opacity-80" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-full max-w-xs z-50 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-template-primary text-white">
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
        <div className="p-4 border-b border-border">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              className="w-full px-4 py-2.5 pl-10 bg-muted rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-template-primary"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      onClick={() => setExpandedItem(expandedItem === item.label ? null : item.label)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <item.icon className="h-5 w-5 text-template-primary" />
                        <span className="font-medium">{item.label}</span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expandedItem === item.label && "rotate-180"
                        )}
                      />
                    </button>
                    {/* Submenu */}
                    <ul
                      className={cn(
                        "bg-muted overflow-hidden transition-all duration-300",
                        expandedItem === item.label ? "max-h-96" : "max-h-0"
                      )}
                    >
                      <li>
                        <Link
                          href="/shop"
                          onClick={onClose}
                          className="block px-4 py-2.5 pl-12 text-sm hover:bg-muted transition-colors"
                        >
                          All Products
                        </Link>
                      </li>
                      {categories.slice(0, 6).map((cat) => (
                        <li key={cat.slug}>
                          <Link
                            href={`/shop?category=${cat.slug}`}
                            onClick={onClose}
                            className="block px-4 py-2.5 pl-12 text-sm hover:bg-muted transition-colors"
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
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <item.icon className="h-5 w-5 text-template-primary" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="border-t border-border my-2" />

          {/* Secondary Links */}
          <ul className="py-2">
            <li>
              <Link
                href="/wishlist"
                onClick={onClose}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-template-primary" />
                  <span className="font-medium">Wishlist</span>
                </span>
                {wishlist.length > 0 && (
                  <span className="bg-template-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {wishlist.length}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
              >
                <User className="h-5 w-5 text-template-primary" />
                <span className="font-medium">My Account</span>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted">
          <div className="space-y-2">
            <Link href="/login" onClick={onClose}>
              <Button variant="outline" className="w-full">
                Sign In
              </Button>
            </Link>
            <Link href="/register" onClick={onClose}>
              <Button className="w-full bg-template-primary hover:bg-template-primary-hover">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
