import { Component, type ReactNode } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Translation } from 'react-i18next';

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

      return (
        <Translation>
          {(t) => (
            <Empty role="alert" className="min-h-[80vh] border-0 px-4">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t('error_boundary.title')}</EmptyTitle>
                <EmptyDescription>{t('error_boundary.description')}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {this.state.error && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      this.setState({ showDetails: !this.state.showDetails })
                    }
                  >
                    {this.state.showDetails ? (
                      <>
                        <ChevronUp data-icon="inline-start" />
                        {t('error_boundary.hide_details')}
                      </>
                    ) : (
                      <>
                        <ChevronDown data-icon="inline-start" />
                        {t('error_boundary.show_details')}
                      </>
                    )}
                  </Button>
                )}
                {this.state.showDetails && this.state.error && (
                  <div className="w-full max-w-md rounded-xl border border-border bg-muted p-4 text-left">
                    <p className="text-xs text-muted-foreground break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    this.setState({
                      hasError: false,
                      error: undefined,
                      showDetails: false,
                    });
                    window.location.reload();
                  }}
                >
                  <RefreshCw data-icon="inline-start" />
                  {t('error_boundary.action')}
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}
