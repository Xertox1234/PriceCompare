import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [error, setError] = useState<string>('');

  const loginMutation = useMutation<AuthResponse, Error, LoginFormData>({
    mutationFn: async (data: LoginFormData) => {
      return apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      onSuccess?.();
      // Refresh the page to update authentication state
      window.location.reload();
    },
    onError: (error: Error) => {
      console.error('Login error:', error);
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
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label 
          htmlFor="email" 
          className="font-medium"
          style={{ color: 'black' }}
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loginMutation.isPending}
          style={{
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #d1d5db'
          }}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label 
          htmlFor="password" 
          className="font-medium"
          style={{ color: 'black' }}
        >
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
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db',
              paddingRight: '2.5rem'
            }}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2"
            style={{ color: 'black' }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {loginMutation.isError && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-600">
            {loginMutation.error instanceof Error 
              ? loginMutation.error.message 
              : 'Login failed. Please check your credentials.'}
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        className="w-full"
        style={{
          backgroundColor: '#5A5DFF',
          color: 'white'
        }}
        disabled={loginMutation.isPending || !email.trim() || !password.trim()}
      >
        {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
      </Button>

      {onToggleMode && (
        <div className="text-center text-sm pt-2">
          <span style={{ color: '#6b7280' }}>Don't have an account? </span>
          <Button 
            variant="link" 
            className="p-0 hover:underline" 
            style={{ color: '#5A5DFF' }}
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
  const [error, setError] = useState<string>('');

  const registerMutation = useMutation<AuthResponse, Error, RegisterFormData>({
    mutationFn: async (data: RegisterFormData) => {
      console.log('Making registration API request with:', data);
      return apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      onSuccess?.();
      // Refresh the page to update authentication state
      window.location.reload();
    },
    onError: (error: Error) => {
      console.error('Registration error:', error);
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
        password: password.trim() 
      });
    }
  };

  const passwordMismatch = password !== confirmPassword && confirmPassword.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label 
          htmlFor="username" 
          className="font-medium"
          style={{ color: 'black' }}
        >
          Username
        </Label>
        <Input
          id="username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={registerMutation.isPending}
          style={{
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #d1d5db'
          }}
          required
        />
      </div>

      <div className="space-y-2">
        <Label 
          htmlFor="email" 
          className="font-medium"
          style={{ color: 'black' }}
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={registerMutation.isPending}
          style={{
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #d1d5db'
          }}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label 
          htmlFor="password" 
          className="font-medium"
          style={{ color: 'black' }}
        >
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
            style={{
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid #d1d5db',
              paddingRight: '2.5rem'
            }}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2"
            style={{ color: 'black' }}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label 
          htmlFor="confirmPassword" 
          className="font-medium"
          style={{ color: 'black' }}
        >
          Confirm Password
        </Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={registerMutation.isPending}
          style={{
            backgroundColor: 'white',
            color: 'black',
            border: '1px solid #d1d5db'
          }}
          required
        />
        {passwordMismatch && (
          <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
            Passwords do not match
          </p>
        )}
      </div>

      {registerMutation.isError && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-600">
            {registerMutation.error instanceof Error 
              ? registerMutation.error.message 
              : 'Registration failed. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        className="w-full"
        style={{
          backgroundColor: '#5A5DFF',
          color: 'white'
        }}
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
        <div className="text-center text-sm pt-2">
          <span style={{ color: '#6b7280' }}>Already have an account? </span>
          <Button 
            variant="link" 
            className="p-0 hover:underline"
            style={{ color: '#5A5DFF' }}
            onClick={onToggleMode}
          >
            Sign in
          </Button>
        </div>
      )}
    </form>
  );
}