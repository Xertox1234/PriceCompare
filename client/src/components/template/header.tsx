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
      <header className="bg-background border-border border-b">
        {/* Main Header */}
        <div className="border-border bg-background border-b">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between lg:h-20">
              {/* Logo */}
              <Link href="/" className="flex shrink-0 items-center gap-2">
                <div className="bg-template-primary flex h-10 w-10 items-center justify-center rounded-lg">
                  <span className="text-xl font-bold text-white">P</span>
                </div>
                <span className="text-foreground hidden text-xl font-bold sm:block">
                  Price<span className="text-template-primary">Compare</span>
                </span>
              </Link>

              {/* Search Bar - Desktop */}
              <div className="mx-8 hidden max-w-2xl flex-1 items-center gap-4 md:flex">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for products, brands and more..."
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:ring-template-primary h-12 w-full rounded-lg border pr-12 pl-5 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none"
                  />
                  <button
                    className="bg-template-primary hover:bg-template-primary-hover absolute top-1 right-1 h-10 rounded-md px-4 text-white transition-colors"
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
                    <button className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-2 transition-colors">
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
                      <Sun className="mr-2 h-4 w-4" />
                      Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon className="mr-2 h-4 w-4" />
                      Dark
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setContrastMode(contrastMode === 'high' ? 'normal' : 'high')}
                    >
                      <Contrast className="mr-2 h-4 w-4" />
                      {contrastMode === 'high' ? 'Normal Contrast' : 'High Contrast'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Account - beside search */}
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 p-2 whitespace-nowrap transition-colors"
                >
                  <User className="h-5 w-5" />
                  <span className="hidden text-sm lg:inline">My account</span>
                </Link>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
                {/* Search - Mobile */}
                <button
                  className="text-muted-foreground hover:text-foreground p-2 transition-colors md:hidden"
                  onClick={onOpenSearch}
                >
                  <Search className="h-6 w-6" />
                </button>

                {/* Compare */}
                <button
                  onClick={onOpenCompare}
                  className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
                >
                  <GitCompareArrows className="h-6 w-6" />
                  {compareCount > 0 && (
                    <span className="bg-template-primary absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white">
                      {compareCount}
                    </span>
                  )}
                </button>

                {/* Wishlist */}
                <Link
                  href="/wishlist"
                  className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
                >
                  <Heart className="h-6 w-6" />
                  {wishlistCount > 0 && (
                    <span className="bg-template-primary absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                {/* Cart */}
                <button
                  onClick={onOpenCart}
                  className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
                >
                  <ShoppingCart className="h-6 w-6" />
                  {cartCount > 0 && (
                    <span className="bg-template-primary absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white">
                      {cartCount}
                    </span>
                  )}
                </button>

                {/* Mobile Menu Toggle */}
                <button
                  className="text-muted-foreground hover:text-foreground p-2 transition-colors lg:hidden"
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
            <div className="flex h-12 items-center justify-between">
              {/* Main Navigation */}
              <ul className="flex items-center gap-1">
                {menuItems.map((item) => (
                  <li key={item.id} className="group relative">
                    <Link
                      href={item.link}
                      className={cn(
                        'text-muted-foreground hover:text-template-primary flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors',
                        item.megaMenu && 'cursor-pointer'
                      )}
                    >
                      {item.label}
                      {item.megaMenu && <ChevronDown className="h-4 w-4" />}
                    </Link>

                    {/* Mega Menu */}
                    {item.megaMenu && (
                      <div
                        className="border-border invisible absolute top-full left-0 z-[999] w-[600px] translate-y-0 transform rounded-[10px] border p-[30px] opacity-0 shadow-lg transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
                        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
                      >
                        <div className="grid grid-cols-3 gap-6">
                          {item.megaMenu.categories.map((category, idx) => (
                            <div key={idx}>
                              <h4 className="text-foreground mb-3 font-semibold">
                                {category.title}
                              </h4>
                              <ul className="space-y-2">
                                {category.items.map((subItem, subIdx) => (
                                  <li key={subIdx}>
                                    <Link
                                      href={subItem.link}
                                      className="text-muted-foreground hover:text-template-primary text-sm transition-colors"
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
                          <div className="border-border mt-6 border-t pt-6">
                            <Link
                              href={item.megaMenu.featured.link}
                              className="group/featured flex items-center gap-4"
                            >
                              <img
                                src={item.megaMenu.featured.image}
                                alt={item.megaMenu.featured.title}
                                className="h-20 w-20 rounded-lg object-cover"
                              />
                              <div>
                                <span className="text-template-primary text-xs font-medium tracking-wider uppercase">
                                  Featured
                                </span>
                                <h5 className="text-foreground group-hover/featured:text-template-primary font-medium transition-colors">
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
                className="text-template-primary flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <span>View All Deals</span>
                <span className="bg-template-primary rounded px-2 py-0.5 text-xs font-bold text-white">
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
          'border-border fixed top-0 right-0 left-0 z-50 border-b shadow-lg transition-transform duration-300 ease-out',
          showFloatingSearch ? 'translate-y-0' : '-translate-y-full'
        )}
        style={{ backgroundColor: 'var(--floating-header-bg, white)' }}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <div className="bg-template-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-lg font-bold text-white">P</span>
              </div>
              <span className="text-foreground hidden text-lg font-bold sm:block">
                Price<span className="text-template-primary">Compare</span>
              </span>
            </Link>

            {/* Search Bar */}
            <div className="max-w-2xl flex-1">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for products, brands and more..."
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:ring-template-primary h-10 w-full rounded-lg border pr-12 pl-4 text-sm transition-all focus:border-transparent focus:ring-2 focus:outline-none"
                />
                <button
                  className="bg-template-primary hover:bg-template-primary-hover absolute top-1 right-1 h-8 rounded-md px-3 text-white transition-colors"
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
                className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="bg-template-primary absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-2xs font-medium text-white">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Wishlist */}
              <Link
                href="/wishlist"
                className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
              >
                <Heart className="h-5 w-5" />
                {wishlistCount > 0 && (
                  <span className="bg-template-primary absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-2xs font-medium text-white">
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
    <header className="bg-background border-border sticky top-0 z-50 border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-template-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-lg font-bold text-white">P</span>
            </div>
            <span className="text-foreground text-lg font-bold">
              Price<span className="text-template-primary">Compare</span>
            </span>
          </Link>

          {/* Search */}
          <div className="mx-6 hidden max-w-xl flex-1 md:flex">
            <div className="relative w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground focus:ring-template-primary h-10 w-full rounded-lg border pr-10 pl-4 text-sm focus:ring-2 focus:outline-none"
              />
              <Search className="text-muted-foreground absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/wishlist"
              className="text-muted-foreground hover:text-foreground relative p-2 transition-colors"
            >
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="bg-template-primary absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-white">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <button className="text-muted-foreground hover:text-foreground relative p-2 transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="bg-template-primary absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs text-white">
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
