/**
 * Error Boundary for Chart Components
 *
 * Handles chunk load failures gracefully when lazy loading chart components.
 * Provides user-friendly error message with retry option.
 */
import { Component, type ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { createLogger } from '@/utils/logger';

const log = createLogger('ChartErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    log.error('Chart component error', {
      error: error.message,
      componentStack: errorInfo.componentStack,
    });
  }

  /**
   * Sanitize error messages to prevent exposing technical details
   * Maps technical errors to user-friendly messages
   */
  private getSafeErrorMessage(error?: Error): string {
    if (!error) {
      return 'An error occurred while loading the chart components';
    }

    // Map technical errors to user-friendly messages
    const message = error.message.toLowerCase();

    if (message.includes('failed to fetch') || message.includes('network')) {
      return 'Network connection failed. Please check your internet and try again.';
    }

    if (message.includes('chunk') || message.includes('loading')) {
      return 'Unable to load charts. Please refresh the page.';
    }

    // Generic fallback - never expose raw error message
    return 'An error occurred while loading the chart components. Please try again.';
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <AlertTriangle className="h-12 w-12 text-warning" />
            <div>
              <h3 className="text-lg font-semibold">Failed to load analytics</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {this.getSafeErrorMessage(this.state.error)}
              </p>
            </div>
            <Button onClick={this.handleRetry} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
