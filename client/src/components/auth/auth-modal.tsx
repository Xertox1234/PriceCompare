import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoginForm, RegisterForm } from './login-form';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);

  // Update mode when defaultMode changes
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const handleSuccess = () => {
    onClose();
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[95vw] max-h-[90vh] overflow-y-auto bg-background text-foreground border-border">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="text-foreground text-xl font-semibold">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {mode === 'login' ? (
            <LoginForm onSuccess={handleSuccess} onToggleMode={toggleMode} />
          ) : (
            <RegisterForm onSuccess={handleSuccess} onToggleMode={toggleMode} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}