import { Component, ReactNode, ErrorInfo } from 'react';
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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ componentStack: info.componentStack || null });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <Card className={isDev ? "max-w-3xl w-full" : "max-w-md w-full"}>
            <CardContent className="flex flex-col items-center text-center py-8 space-y-4">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold font-display">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Try refreshing or go back.
              </p>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reload Page
                </Button>
                <Button onClick={this.handleReset}>Try Again</Button>
              </div>

              {isDev && this.state.error && (
                <div className="w-full mt-6 text-left border rounded-lg p-4 bg-muted/40 font-mono text-xs select-text overflow-x-auto space-y-3">
                  <div>
                    <span className="font-bold text-destructive">Error Name: </span>
                    <span>{this.state.error.name}</span>
                  </div>
                  <div>
                    <span className="font-bold text-destructive">Message: </span>
                    <span>{this.state.error.message}</span>
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <div className="font-bold text-muted-foreground mb-1">Stack Trace:</div>
                      <pre className="p-2 bg-background/80 rounded border whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                  {this.state.componentStack && (
                    <div>
                      <div className="font-bold text-muted-foreground mb-1">Component Stack:</div>
                      <pre className="p-2 bg-background/80 rounded border whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {this.state.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
