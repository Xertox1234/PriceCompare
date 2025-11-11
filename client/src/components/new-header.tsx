import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ChevronDown, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AuthModal } from './auth/auth-modal';

export function NewHeader() {
  const { data: user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-3xl font-bold text-indigo-600 cursor-pointer">
              Price<span className="text-pink-500">Grabber</span>
            </h1>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/products">
              <span className="text-gray-600 hover:text-indigo-600 transition duration-300 cursor-pointer">
                Products
              </span>
            </Link>
            <Link href="/search">
              <span className="text-gray-600 hover:text-indigo-600 transition duration-300 cursor-pointer">
                Advanced Search
              </span>
            </Link>
            <div className="relative group">
              <span className="text-gray-600 hover:text-indigo-600 transition duration-300 cursor-pointer flex items-center">
                Categories <ChevronDown className="ml-1 h-4 w-4" />
              </span>
              {/* Dropdown menu could be added here */}
            </div>
            
            {/* Auth buttons */}
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">Welcome, {user.username}</span>
                <Button variant="outline" size="sm">
                  Account
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="sm" onClick={handleLogin}>
                  Sign In
                </Button>
                <Button size="sm" onClick={handleRegister}>
                  Sign Up
                </Button>
              </div>
            )}
          </nav>
          
          <button
            type="button"
            className="md:hidden text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        defaultMode={authMode}
      />
    </>
  );
}