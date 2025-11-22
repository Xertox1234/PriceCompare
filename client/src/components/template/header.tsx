import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  ChevronDown,
  GitCompareArrows,
  Sun,
  Moon,
  Contrast,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShop } from '@/context/shop-context';
import { useTheme } from '@/components/theme-provider';
import { menuItems } from '@/data/template-data';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Hook to detect scroll direction
function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      }

      setScrollY(currentScrollY);
      lastScrollY = currentScrollY;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return { scrollDirection, scrollY };
}

interface TemplateHeaderProps {
  onOpenCart?: () => void;
  onOpenMobileMenu?: () => void;
  onOpenSearch?: () => void;
  onOpenCompare?: () => void;
}

export function TemplateHeader({
  onOpenCart,
  onOpenMobileMenu,
  onOpenSearch,
  onOpenCompare,
}: TemplateHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { getCartItemCount, wishlist, compare } = useShop();
  const { theme, setTheme, contrastMode, setContrastMode } = useTheme();
  const { scrollDirection, scrollY } = useScrollDirection();

  const cartCount = getCartItemCount();
  const wishlistCount = wishlist.length;
  const compareCount = compare.length;

  // Show floating search bar when scrolling up after scrolling down past header
  const showFloatingSearch = scrollDirection === 'up' && scrollY > 200;

  return (
    <>
    {/* Main Header - Static, scrolls with page */}
    <header className="bg-background border-b border-border">

      {/* Main Header */}
      <div className="border-b border-border bg-background">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="w-10 h-10 bg-template-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="hidden sm:block text-xl font-bold text-foreground">
                Price<span className="text-template-primary">Compare</span>
              </span>
            </Link>

            {/* Search Bar - Desktop */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8 items-center gap-4">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for products, brands and more..."
                  className="w-full h-12 pl-5 pr-12 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-template-primary focus:border-transparent transition-all"
                />
                <button
                  className="absolute right-1 top-1 h-10 px-4 bg-template-primary hover:bg-template-primary-hover text-white rounded-md transition-colors"
                  onClick={() => {
                    if (searchQuery) {
                      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
                    }
                  }}
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>

              {/* Theme Toggle - beside search */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1.5 p-2 text-muted-foreground hover:text-foreground transition-colors">
                    {theme === 'dark' ? (
                      <Moon className="h-5 w-5" />
                    ) : (
                      <Sun className="h-5 w-5" />
                    )}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setContrastMode(contrastMode === 'high' ? 'normal' : 'high')}
                  >
                    <Contrast className="h-4 w-4 mr-2" />
                    {contrastMode === 'high' ? 'Normal Contrast' : 'High Contrast'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Account - beside search */}
              <Link
                href="/login"
                className="flex items-center gap-1.5 p-2 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                <User className="h-5 w-5" />
                <span className="hidden lg:inline text-sm">My account</span>
              </Link>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
              {/* Search - Mobile */}
              <button
                className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={onOpenSearch}
              >
                <Search className="h-6 w-6" />
              </button>

              {/* Compare */}
              <button
                onClick={onOpenCompare}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <GitCompareArrows className="h-6 w-6" />
                {compareCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-template-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {compareCount}
                  </span>
                )}
              </button>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Heart className="h-6 w-6" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-template-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart */}
              <button
                onClick={onOpenCart}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShoppingCart className="h-6 w-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-template-primary text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button
                className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={onOpenMobileMenu}
              >
                <Menu className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Bar - Desktop */}
      <nav className="hidden lg:block">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            {/* Main Navigation */}
            <ul className="flex items-center gap-1">
              {menuItems.map((item) => (
                <li key={item.id} className="relative group">
                  <Link
                    href={item.link}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-template-primary transition-colors',
                      item.megaMenu && 'cursor-pointer'
                    )}
                  >
                    {item.label}
                    {item.megaMenu && <ChevronDown className="h-4 w-4" />}
                  </Link>

                  {/* Mega Menu */}
                  {item.megaMenu && (
                    <div
                      className="invisible group-hover:visible opacity-0 group-hover:opacity-100 absolute top-full left-0 w-[600px] border border-border rounded-[10px] shadow-lg p-[30px] transition-all duration-200 z-[999] transform translate-y-0 group-hover:translate-y-0"
                      style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
                    >
                      <div className="grid grid-cols-3 gap-6">
                        {item.megaMenu.categories.map((category, idx) => (
                          <div key={idx}>
                            <h4 className="font-semibold text-foreground mb-3">
                              {category.title}
                            </h4>
                            <ul className="space-y-2">
                              {category.items.map((subItem, subIdx) => (
                                <li key={subIdx}>
                                  <Link
                                    href={subItem.link}
                                    className="text-sm text-muted-foreground hover:text-template-primary transition-colors"
                                  >
                                    {subItem.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>

                      {/* Featured Product */}
                      {item.megaMenu.featured && (
                        <div className="mt-6 pt-6 border-t border-border">
                          <Link
                            href={item.megaMenu.featured.link}
                            className="flex items-center gap-4 group/featured"
                          >
                            <img
                              src={item.megaMenu.featured.image}
                              alt={item.megaMenu.featured.title}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                            <div>
                              <span className="text-xs text-template-primary font-medium uppercase tracking-wider">
                                Featured
                              </span>
                              <h5 className="font-medium text-foreground group-hover/featured:text-template-primary transition-colors">
                                {item.megaMenu.featured.title}
                              </h5>
                            </div>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Right Side - View All Deals */}
            <Link
              href="/shop?deals=true"
              className="flex items-center gap-2 text-sm font-medium text-template-primary hover:underline"
            >
              <span>View All Deals</span>
              <span className="px-2 py-0.5 bg-template-primary text-white text-xs font-bold rounded">
                HOT
              </span>
            </Link>
          </div>
        </div>
      </nav>
    </header>

    {/* Floating Search Bar - Appears when scrolling up - uses explicit solid colors */}
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 shadow-lg border-b border-border transition-transform duration-300 ease-out",
        showFloatingSearch ? "translate-y-0" : "-translate-y-full"
      )}
      style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-template-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="hidden sm:block text-lg font-bold text-foreground">
              Price<span className="text-template-primary">Compare</span>
            </span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, brands and more..."
                className="w-full h-10 pl-4 pr-12 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-template-primary focus:border-transparent transition-all"
              />
              <button
                className="absolute right-1 top-1 h-8 px-3 bg-template-primary hover:bg-template-primary-hover text-white rounded-md transition-colors"
                onClick={() => {
                  if (searchQuery) {
                    window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
                  }
                }}
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <button
              onClick={onOpenCart}
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-template-primary text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-template-primary text-white text-[10px] font-medium rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// Compact header variant for inner pages
export function CompactHeader() {
  const [searchQuery, setSearchQuery] = useState('');
  const { getCartItemCount, wishlist } = useShop();

  const cartCount = getCartItemCount();
  const wishlistCount = wishlist.length;

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-template-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="text-lg font-bold text-foreground">
              Price<span className="text-template-primary">Compare</span>
            </span>
          </Link>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-10 pl-4 pr-10 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-template-primary"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/wishlist"
              className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-template-primary text-white text-xs rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-template-primary text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
