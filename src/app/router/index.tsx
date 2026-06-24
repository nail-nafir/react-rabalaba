import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { RootLayout } from '@/app/layouts/root-layout';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { AdminLayout } from '@/app/layouts/admin-layout';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { PageLoader } from '@/components/shared/page-loader';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('@/pages/landing'));
const TerminalPage = lazy(() => import('@/pages/terminal'));
const CalendarPage = lazy(() => import('@/pages/calendar'));
const SubscriptionPage = lazy(() => import('@/pages/subscription'));
const AdminPage = lazy(() => import('@/pages/admin'));
const AdminAssetsPage = lazy(() => import('@/pages/admin/assets'));
const AdminUsersPage = lazy(() => import('@/pages/admin/users'));
const AdminCodesPage = lazy(() => import('@/pages/admin/codes'));
const AdminSystemPage = lazy(() => import('@/pages/admin/summary'));
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const AuthCallbackPage = lazy(() => import('@/pages/auth-callback'));
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
    ],
  },
  {
    path: '/admin',
    element: (
      <ErrorBoundary>
        <AdminLayout />
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'assets',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminAssetsPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'users',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminUsersPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'codes',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminCodesPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'summary',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminSystemPage />
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
    // OAuth landing — standalone, no layout (it's just a full-screen loader).
    path: '/auth/callback',
    element: (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader trigger />}>
          <AuthCallbackPage />
        </Suspense>
      </ErrorBoundary>
    ),
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

