import { lazy } from "react";

export const LandingPage = lazy(() => import("@/pages/landing"));
export const TerminalPage = lazy(() => import("@/pages/terminal"));
export const CalendarPage = lazy(() => import("@/pages/calendar"));
export const SubscriptionPage = lazy(() => import("@/pages/subscription"));
export const AdminPage = lazy(() => import("@/pages/admin"));
export const AdminAssetsPage = lazy(() => import("@/pages/admin/assets"));
export const AdminUsersPage = lazy(() => import("@/pages/admin/users"));
export const AdminCodesPage = lazy(() => import("@/pages/admin/codes"));
export const AdminInvitationsPage = lazy(
  () => import("@/pages/admin/invitations"),
);
export const AdminTestimonialsPage = lazy(
  () => import("@/pages/admin/testimonials"),
);
export const AdminPlansPage = lazy(() => import("@/pages/admin/plans"));
export const AdminPaymentsPage = lazy(() => import("@/pages/admin/payments"));
export const AdminDisclaimerPage = lazy(
  () => import("@/pages/admin/disclaimer"),
);
export const InvitePage = lazy(() => import("@/pages/invite"));
export const AdminSystemPage = lazy(() => import("@/pages/admin/statistics"));
export const LoginPage = lazy(() => import("@/pages/login"));
export const RegisterPage = lazy(() => import("@/pages/register"));
export const AuthCallbackPage = lazy(() => import("@/pages/auth-callback"));
export const NotFoundPage = lazy(() => import("@/pages/not-found"));
