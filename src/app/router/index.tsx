import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RootLayout } from '@/app/layouts/root-layout';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { PageLoader } from '@/components/shared/page-loader';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('@/pages/landing'));
const TerminalPage = lazy(() => import('@/pages/terminal'));
const CalendarPage = lazy(() => import('@/pages/calendar'));
const PricingPage = lazy(() => import('@/pages/pricing'));
const NotFoundPage = lazy(() => import('@/pages/not-found'));

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <LandingPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/terminal',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <TerminalPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/calendar',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <CalendarPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/pricing',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <PricingPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader trigger />}>
          <NotFoundPage />
        </Suspense>
      </ErrorBoundary>
    ),
  },
]);

