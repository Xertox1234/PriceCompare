import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MessageSquare, Search, Home, User, LogOut, Bell, Settings } from 'lucide-react';
import { useAuth, useLogout } from '@/hooks/use-auth';
import { useState } from 'react';
import { AuthModal } from './auth/auth-modal';

interface SharedNavigationProps {
  currentPage?: 'home' | 'forum' | 'admin';
}

export function SharedNavigation({ currentPage = 'home' }: SharedNavigationProps) {
  const { data: user, isLoading } = useAuth();
  const logoutMutation = useLogout();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
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
    
  return (
    <nav className="flex items-center gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6 text-primary" />
        <Link href="/">
          <span className="font-bold text-lg hover:text-primary cursor-pointer">
            PriceCompare Community
          </span>
        </Link>
      </div>
      
      <div className="flex items-center gap-2 ml-auto">
        <Button
          variant={location === '/' ? 'default' : 'ghost'}
          size="sm"
          asChild
        >
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
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
              {/* Debug role display */}
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">Role: {user?.role || 'undefined'}</span>
              </DropdownMenuItem>

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

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        defaultMode={authMode}
      />
    </nav>
  );
}