import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RootLayout } from '@/app/layouts/root-layout';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { PageLoader } from '@/components/shared/page-loader';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('@/pages/landing'));
const TerminalPage = lazy(() => import('@/pages/terminal'));
const CalendarPage = lazy(() => import('@/pages/calendar'));
const SubscriptionPage = lazy(() => import('@/pages/subscription'));
const AdminPage = lazy(() => import('@/pages/admin'));
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
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
        path: '/terminal/market',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <TerminalPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/terminal/journal',
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
        path: '/subscription',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <SubscriptionPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/admin',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/login',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <LoginPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: '/register',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <RegisterPage />
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

