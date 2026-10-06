import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
    this.setState({ componentStack: info.componentStack ?? null });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render() {
    if (this.state.hasError) {
      const { error, componentStack } = this.state;

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <Card className="max-w-3xl w-full">
            <CardContent className="flex flex-col items-center text-center py-12 space-y-4">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold font-display">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Try refreshing or go back.
              </p>

              {import.meta.env.DEV && error && (
                <details className="w-full text-left rounded-lg border border-destructive/30 bg-muted/30 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-destructive">
                    Developer diagnostic
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Error name
                      </p>
                      <pre className="select-text whitespace-pre-wrap break-words rounded bg-background p-3 text-xs">
                        {error.name}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Error message
                      </p>
                      <pre className="select-text whitespace-pre-wrap break-words rounded bg-background p-3 text-xs">
                        {error.message}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Stack trace
                      </p>
                      <pre className="max-h-72 overflow-auto select-text whitespace-pre-wrap break-words rounded bg-background p-3 text-xs">
                        {error.stack || 'No stack trace available'}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        React component stack
                      </p>
                      <pre className="max-h-72 overflow-auto select-text whitespace-pre-wrap break-words rounded bg-background p-3 text-xs">
                        {componentStack || 'No component stack available'}
                      </pre>
                    </div>
                  </div>
                </details>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reload Page
                </Button>
                <Button onClick={this.handleReset}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
