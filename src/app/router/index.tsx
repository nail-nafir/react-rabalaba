import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense, type ReactNode } from "react";
import { RootLayout } from "@/app/layouts/root-layout";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { PageLoader } from "@/components/shared/page-loader";
import {
  AdminAssetsPage,
  AdminCodesPage,
  AdminDisclaimerPage,
  AdminInvitationsPage,
  AdminPage,
  AdminPaymentsPage,
  AdminPlansPage,
  AdminSystemPage,
  AdminTestimonialsPage,
  AdminUsersPage,
  AuthCallbackPage,
  CalculatorPage,
  CalendarPage,
  InvitePage,
  LandingPage,
  LearnPage,
  LoginPage,
  NotFoundPage,
  RegisterPage,
  SubscriptionPage,
  TerminalPage,
} from "@/app/router/lazy-pages";

function lazyRoute(page: ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader trigger />}>{page}</Suspense>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: lazyRoute(<LandingPage />),
      },
      {
        path: "/terminal",
        element: lazyRoute(<TerminalPage />),
      },
      {
        path: "/terminal/market",
        element: lazyRoute(<TerminalPage />),
      },
      {
        path: "/terminal/journal",
        element: lazyRoute(<TerminalPage />),
      },
      {
        path: "/calculator",
        element: lazyRoute(<CalculatorPage />),
      },
      {
        path: "/calendar",
        element: lazyRoute(<CalendarPage />),
      },
      {
        path: "/learn",
        element: lazyRoute(<LearnPage />),
      },
      {
        path: "/subscription",
        element: lazyRoute(<SubscriptionPage />),
      },
      {
        path: "/invite/:code",
        element: lazyRoute(<InvitePage />),
      },
    ],
  },
  {
    path: "/admin",
    element: (
      <ErrorBoundary>
        <AdminLayout />
      </ErrorBoundary>
    ),
    children: [
      {
        index: true,
        element: lazyRoute(<AdminPage />),
      },
      {
        path: "assets",
        element: lazyRoute(<AdminAssetsPage />),
      },
      {
        path: "users",
        element: lazyRoute(<AdminUsersPage />),
      },
      {
        path: "codes",
        element: lazyRoute(<AdminCodesPage />),
      },
      {
        path: "billing",
        element: <Navigate to="/admin/codes" replace />,
      },
      {
        path: "plans",
        element: lazyRoute(<AdminPlansPage />),
      },
      {
        path: "payments",
        element: lazyRoute(<AdminPaymentsPage />),
      },
      {
        path: "disclaimer",
        element: lazyRoute(<AdminDisclaimerPage />),
      },
      {
        path: "invitations",
        element: lazyRoute(<AdminInvitationsPage />),
      },
      {
        path: "testimonials",
        element: lazyRoute(<AdminTestimonialsPage />),
      },
      {
        path: "statistics",
        element: lazyRoute(<AdminSystemPage />),
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: lazyRoute(<LoginPage />),
      },
      {
        path: "/register",
        element: lazyRoute(<RegisterPage />),
      },
    ],
  },
  {
    // OAuth landing — standalone, no layout (it's just a full-screen loader).
    path: "/auth/callback",
    element: lazyRoute(<AuthCallbackPage />),
  },
  {
    path: "*",
    element: lazyRoute(<NotFoundPage />),
  },
]);
