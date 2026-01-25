import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { apiRequest, ApiError } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/utils/logger';
import { resetPasswordSchema } from '@shared/auth-schema';

const log = createLogger('ResetPassword');

// API response types
interface TokenValidationResponse {
  email?: string;
  username?: string;
  error?: string;
}

interface ResetPasswordResponse {
  success?: boolean;
  error?: string;
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; username: string } | null>(null);
  const { toast } = useToast();

  // Extract token from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');

    if (!tokenParam) {
      setTokenError('Invalid password reset link. No token provided.');
      setIsValidating(false);
      return;
    }

    setToken(tokenParam);
    void validateToken(tokenParam);
  }, []);

  const validateToken = async (tokenValue: string) => {
    try {
      const data = await apiRequest<TokenValidationResponse>(
        `/api/auth/reset-password/${tokenValue}`
      );

      if (data.email && data.username) {
        setUserInfo({ email: data.email, username: data.username });
      } else {
        setTokenError(data.error ?? 'Invalid or expired password reset token');
      }
    } catch (err) {
      log.error('Token validation error:', { error: err });
      if (err instanceof ApiError) {
        setTokenError(err.message);
      } else {
        setTokenError('Unable to validate reset token. Please try again.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid reset token');
      return;
    }

    // Validate with Zod schema
    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const firstError = result.error.issues[0];
      setError(firstError?.message ?? 'Invalid password');
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest<ResetPasswordResponse>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });

      setIsSuccess(true);
      toast({
        title: 'Password reset successful',
        description: 'You can now log in with your new password.',
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation('/');
      }, 3000);
    } catch (err) {
      log.error('Reset password error:', { error: err });
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to process request. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while validating token
  if (isValidating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
              <p className="text-muted-foreground">Validating reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
            <CardDescription>{tokenError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>The link may have expired (valid for 1 hour)</li>
                  <li>The link may have already been used</li>
                  <li>The link may be invalid or corrupted</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Link href="/forgot-password">
              <Button className="w-full">Request a new reset link</Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="w-full">
                Back to home
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <CardTitle className="text-2xl">Password Reset Successful</CardTitle>
            <CardDescription>
              Your password has been successfully reset. You can now log in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Redirecting you to the login page in a few seconds...
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Link href="/">
              <Button className="w-full">Go to login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            {userInfo && `Resetting password for ${userInfo.username}`}
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <Eye className="text-muted-foreground h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="text-muted-foreground h-4 w-4" />
                  ) : (
                    <Eye className="text-muted-foreground h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-2 font-semibold">Password requirements:</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  <li>At least 8 characters long</li>
                  <li>Contains at least one uppercase letter</li>
                  <li>Contains at least one lowercase letter</li>
                  <li>Contains at least one number</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="mr-2">Resetting password...</span>
                  <span className="animate-spin">⏳</span>
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Reset password
                </>
              )}
            </Button>
            <Link href="/">
              <Button variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
