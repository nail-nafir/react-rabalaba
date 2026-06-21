import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { PageLoader } from "@/components/shared/page-loader";
import { Separator } from "@/components/ui/separator";
import { JournalAssetManager } from "@/features/admin/components/journal-asset-manager";

/** Admin-only console for the auto-journal universe. Gated by profiles.is_admin
 *  (exposed via usePremiumAccess); non-admins are bounced to the landing page. */
export default function AdminPage() {
  const { t } = useTranslation();
  const { ready } = useAuth();
  const { isAdmin, isLoading } = usePremiumAccess();

  // Wait for auth to hydrate + the profile to resolve before deciding — a hard
  // refresh on /admin (session still loading) would otherwise flash a redirect.
  if (!ready || isLoading) return <PageLoader trigger />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="w-full py-6 sm:py-10 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
                {t("admin.admin_console_title")}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("admin.admin_console_desc")}
            </p>
          </div>
        </div>

        <Separator />

        {/* Main: Asset Manager */}
        <div className="w-full">
          <JournalAssetManager />
        </div>
      </div>
    </div>
  );
}
