import { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { createLogger } from '@/utils/logger';

const log = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    log.error('ErrorBoundary caught an error:', { error, errorInfo });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Report to window.reportError (React 19 feature)
    if (typeof window !== 'undefined' && 'reportError' in window) {
      window.reportError(error);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <div className="bg-destructive/10 rounded-full p-4">
                <AlertTriangle className="text-destructive h-12 w-12" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-foreground text-2xl font-bold">Something went wrong</h1>
              <p className="text-muted-foreground">
                We're sorry, but something unexpected happened. Please try refreshing the page.
              </p>
            </div>

            {this.state.error && process.env.NODE_ENV === 'development' && (
              <div className="bg-muted mt-4 overflow-auto rounded-lg p-4 text-left">
                <p className="text-destructive font-mono text-sm break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <Button onClick={this.handleReset} variant="default">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button asChild variant="outline">
                <a href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </a>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Route-level error boundary with simpler UI
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="space-y-4 text-center">
            <AlertTriangle className="text-destructive mx-auto h-8 w-8" />
            <div>
              <h2 className="text-lg font-semibold">Failed to load this section</h2>
              <p className="text-muted-foreground mt-2 text-sm">Please try refreshing the page</p>
            </div>
            <Button
              onClick={() => {
                // Note: Using window.location.reload() here is appropriate for error recovery
                // as we need to fully reset the application state after an error
                window.location.reload();
              }}
              variant="outline"
              size="sm"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
