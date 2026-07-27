import { lazy } from "react";

export const LandingPage = lazy(() => import("@/pages/landing"));
export const TerminalPage = lazy(() => import("@/pages/terminal"));
export const CalendarPage = lazy(() => import("@/pages/calendar"));
export const SubscriptionPage = lazy(() => import("@/pages/subscription"));
export const AdminPage = lazy(() => import("@/pages/management"));
export const AdminAssetsPage = lazy(() => import("@/pages/management/assets"));
export const AdminUsersPage = lazy(() => import("@/pages/management/users"));
export const AdminCodesPage = lazy(() => import("@/pages/management/codes"));
export const AdminInvitationsPage = lazy(
  () => import("@/pages/management/invitations"),
);
export const AdminTestimonialsPage = lazy(
  () => import("@/pages/management/testimonials"),
);
export const AdminPlansPage = lazy(() => import("@/pages/management/plans"));
export const AdminPaymentsPage = lazy(() => import("@/pages/management/payments"));
export const AdminDisclaimerPage = lazy(
  () => import("@/pages/management/disclaimer"),
);
export const InvitePage = lazy(() => import("@/pages/invite"));
export const AdminSystemPage = lazy(() => import("@/pages/management/statistics"));
export const LoginPage = lazy(() => import("@/pages/login"));
export const RegisterPage = lazy(() => import("@/pages/register"));
export const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));
export const NotFoundPage = lazy(() => import("@/pages/not-found"));
