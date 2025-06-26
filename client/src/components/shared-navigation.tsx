import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquare, Search, Home, User, LogOut, Bell, Settings, Menu, X } from 'lucide-react';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { useState } from 'react';
import { AuthModal } from './auth/auth-modal';
import { ThemeToggle } from './theme-toggle';

interface SharedNavigationProps {
  currentPage?: 'home' | 'forum' | 'admin';
}

export function SharedNavigation({ currentPage = 'home' }: SharedNavigationProps) {
  const { data: user, isLoading } = useAuth();
  const logoutMutation = useLogout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  const MobileNavigation = () => (
    <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Navigation Menu</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col space-y-4 p-4">
          <Link href="/" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant={location === '/' ? 'default' : 'ghost'}
              className="w-full justify-start"
            >
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
          
          <Link href="/products" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant={location === '/products' ? 'default' : 'ghost'}
              className="w-full justify-start"
            >
              <Search className="h-4 w-4 mr-2" />
              Products
            </Button>
          </Link>
          
          <Link href="/forum" onClick={() => setMobileMenuOpen(false)}>
            <Button
              variant={location === '/forum' ? 'default' : 'ghost'}
              className="w-full justify-start"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Forum
            </Button>
          </Link>
          
          {/* Theme Toggle */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between p-2">
              <span className="text-sm font-medium">Theme</span>
              <ThemeToggle />
            </div>
          </div>
          
          {user ? (
            <div className="flex flex-col space-y-2 pt-4 border-t">
              <div className="flex items-center space-x-2 p-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.username}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              
              {user.role === 'admin' && (
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              
              <Button 
                variant="ghost" 
                className="w-full justify-start" 
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-4 w-4 mr-2" />
                {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col space-y-2 pt-4 border-t">
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => {
                  handleLogin();
                  setMobileMenuOpen(false);
                }}
              >
                Sign In
              </Button>
              <Button 
                className="w-full"
                onClick={() => {
                  handleRegister();
                  setMobileMenuOpen(false);
                }}
              >
                Sign Up
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
    
  return (
    <nav className="flex items-center gap-2 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Logo/Brand - Always visible */}
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6 text-primary" />
        <Link href="/">
          <span className="font-bold text-lg hover:text-primary cursor-pointer">
            <span className="hidden sm:inline">PriceCompare Community</span>
            <span className="sm:hidden">PriceCompare</span>
          </span>
        </Link>
      </div>
      
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center gap-2 ml-auto">
        <Button
          variant={location === '/' ? 'default' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            Home
          </Link>
        </Button>
        
        <Button
          variant={location === '/products' ? 'default' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href="/products">
            <Search className="h-4 w-4 mr-2" />
            Products
          </Link>
        </Button>
        
        <Button
          variant={location === '/forum' ? 'default' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href="/forum">
            <MessageSquare className="h-4 w-4 mr-2" />
            Forum
          </Link>
        </Button>
        
        <ThemeToggle />
        
        {user && (
          <Button
            variant="ghost"
            size="sm"
            className="relative"
          >
            <Bell className="h-4 w-4" />
          </Button>
        )}
        
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-8 w-20 bg-gray-200 rounded"></div>
          </div>
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuItem disabled>
                <User className="mr-2 h-4 w-4" />
                <span>{user?.username || 'Unknown'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <span className="text-sm text-muted-foreground">{user?.email || 'No email'}</span>
              </DropdownMenuItem>
              {user?.role === 'admin' && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Panel</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout} disabled={logoutMutation.isPending}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{logoutMutation.isPending ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogin}>
              Sign In
            </Button>
            <Button size="sm" onClick={handleRegister}>
              Sign Up
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Navigation */}
      <div className="flex items-center gap-2 ml-auto md:hidden">
        {/* Mobile User Avatar or Auth Buttons */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-white border border-gray-200 shadow-lg" align="end">
              <DropdownMenuItem disabled className="text-gray-900">
                <span className="text-sm font-medium text-gray-900">{user.username}</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleLogout} 
                disabled={logoutMutation.isPending}
                className="text-gray-900 hover:bg-gray-100"
              >
                <LogOut className="mr-2 h-4 w-4 text-gray-600" />
                <span className="text-gray-900">{logoutMutation.isPending ? 'Signing out...' : 'Sign out'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleLogin}>
            <User className="h-4 w-4" />
          </Button>
        )}
        
        <MobileNavigation />
      </div>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        defaultMode={authMode}
      />
    </nav>
  );
}