import { Component, type ReactNode } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import i18next from 'i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[ErrorBoundary]', error);
    // Partial update — React merges this into state, preserving showDetails.
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const t = i18next.t.bind(i18next);

      return (
            <div className="flex min-h-[80vh] items-center justify-center px-4">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/15">
              <AlertTriangle className="h-14 w-14 text-rose-400" />
            </div>
            <h1 className="text-sm font-medium text-foreground">
              {t('error_boundary.title')}
            </h1>
            <p className="mt-2 mb-6 text-sm text-muted-foreground max-w-sm">
              {t('error_boundary.description')}
            </p>
            {this.state.error && (
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                {this.state.showDetails ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    {t('error_boundary.hide_details')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('error_boundary.show_details')}
                  </>
                )}
              </button>
            )}
            {this.state.showDetails && this.state.error && (
              <div className="w-full max-w-md mb-6 rounded-xl border border-border bg-muted p-4 text-left">
                <p className="text-xs font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: undefined, showDetails: false });
                window.location.reload();
              }}
              className={cn(
                buttonVariants({ variant: 'default', size: 'lg' }),
                'rounded-xl px-10 font-bold shadow-lg shadow-primary/20 text-base gap-2',
              )}
            >
              <RefreshCw className="h-5 w-5" />
              {t('error_boundary.action')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
