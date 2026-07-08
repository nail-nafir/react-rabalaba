import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { RootLayout } from '@/app/layouts/root-layout';
import { AuthLayout } from '@/app/layouts/auth-layout';
import { AdminLayout } from '@/app/layouts/admin-layout';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { PageLoader } from '@/components/shared/page-loader';
import {
  AdminAssetsPage,
  AdminCodesPage,
  AdminDisclaimerPage,
  AdminInvitationsPage,
  AdminPage,
  AdminPaymentsPage,
  AdminPlansPage,
  AdminSystemPage,
  AdminUsersPage,
  AuthCallbackPage,
  CalendarPage,
  InvitePage,
  LandingPage,
  LoginPage,
  NotFoundPage,
  RegisterPage,
  SubscriptionPage,
  TerminalPage,
} from '@/app/router/lazy-pages';

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
        path: '/invite/:code',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <InvitePage />
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
        path: 'billing',
        element: <Navigate to="/admin/codes" replace />,
      },
      {
        path: 'plans',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminPlansPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'payments',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminPaymentsPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'disclaimer',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminDisclaimerPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'invitations',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageLoader trigger />}>
              <AdminInvitationsPage />
            </Suspense>
          </ErrorBoundary>
        ),
      },
      {
        path: 'statistics',
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
