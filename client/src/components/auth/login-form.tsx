import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { LoginFormData, RegisterFormData, AuthResponse } from '@shared/types';

interface LoginFormProps {
  onSuccess?: () => void;
  onToggleMode?: () => void;
}

export function LoginForm({ onSuccess, onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [_error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const loginMutation = useMutation<AuthResponse, Error, LoginFormData>({
    mutationFn: async (data: LoginFormData) => {
      return apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate auth queries to update authentication state without page reload
      void queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      void queryClient.invalidateQueries({ queryKey: ['user'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      setError(error.message || 'Login failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      loginMutation.mutate({ email: email.trim(), password: password.trim() });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loginMutation.isPending}
          className="bg-background text-foreground border-border"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-foreground font-medium">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loginMutation.isPending}
            className="bg-background text-foreground border-border pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-foreground absolute top-0 right-0 h-full px-3 py-2"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password">
            <Button
              type="button"
              variant="link"
              className="text-primary hover:text-primary/90 h-auto p-0 text-sm hover:underline"
            >
              Forgot password?
            </Button>
          </Link>
        </div>
      </div>

      {loginMutation.isError && (
        <Alert variant="destructive" className="bg-destructive border-red-200">
          <AlertDescription className="text-destructive">
            {loginMutation.error instanceof Error
              ? loginMutation.error.message
              : 'Login failed. Please check your credentials.'}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
        disabled={loginMutation.isPending || !email.trim() || !password.trim()}
      >
        {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
      </Button>

      {onToggleMode && (
        <div className="pt-2 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Button
            variant="link"
            className="text-primary hover:text-primary/90 p-0 hover:underline"
            onClick={onToggleMode}
          >
            Sign up
          </Button>
        </div>
      )}
    </form>
  );
}

export function RegisterForm({ onSuccess, onToggleMode }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [_error, setError] = useState<string>('');
  const queryClient = useQueryClient();

  const registerMutation = useMutation<AuthResponse, Error, RegisterFormData>({
    mutationFn: async (data: RegisterFormData) => {
      return apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate auth queries to update authentication state without page reload
      void queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      void queryClient.invalidateQueries({ queryKey: ['user'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      setError(error.message || 'Registration failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    if (username.trim() && email.trim() && password.trim()) {
      registerMutation.mutate({
        username: username.trim(),
        email: email.trim(),
        password: password.trim(),
      });
    }
  };

  const passwordMismatch = password !== confirmPassword && confirmPassword.length > 0;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username" className="text-foreground font-medium">
          Username
        </Label>
        <Input
          id="username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={registerMutation.isPending}
          className="bg-background text-foreground border-border"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={registerMutation.isPending}
          className="bg-background text-foreground border-border"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-foreground font-medium">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={registerMutation.isPending}
            className="bg-background text-foreground border-border pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-foreground absolute top-0 right-0 h-full px-3 py-2"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-foreground font-medium">
          Confirm Password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={registerMutation.isPending}
          className="bg-background text-foreground border-border"
          required
        />
        {passwordMismatch && (
          <p className="text-destructive text-sm font-medium">Passwords do not match</p>
        )}
      </div>

      {registerMutation.isError && (
        <Alert variant="destructive" className="bg-destructive border-red-200">
          <AlertDescription className="text-destructive">
            {registerMutation.error instanceof Error
              ? registerMutation.error.message
              : 'Registration failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full"
        disabled={
          registerMutation.isPending ||
          !username.trim() ||
          !email.trim() ||
          !password.trim() ||
          passwordMismatch
        }
      >
        {registerMutation.isPending ? 'Creating Account...' : 'Create Account'}
      </Button>

      {onToggleMode && (
        <div className="pt-2 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Button
            variant="link"
            className="text-primary hover:text-primary/90 p-0 hover:underline"
            onClick={onToggleMode}
          >
            Sign in
          </Button>
        </div>
      )}
    </form>
  );
}
