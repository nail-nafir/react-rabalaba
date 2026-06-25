import { useTranslation } from "react-i18next";
import { RegisteredUsersTable } from "@/features/admin/components/registered-users-table";
import { Separator } from "@/components/ui/separator";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminUsers } from "@/hooks/use-admin-users";

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { users, isLoading: isUsersLoading } = useAdminUsers();
  const isFetchingUsers = useIsFetching({ queryKey: ["admin-users"] }) > 0;
  const isRefreshing = isFetchingUsers || isUsersLoading;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const totalCount = users.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.menu_users", "Manajemen User")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.admin_console_users_desc", "Kelola pengguna terdaftar, tingkat tier, dan penggunaan kode akses premium.") || "Kelola pengguna terdaftar dan pantau kode akses premium yang ditukarkan."}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("admin.users_list_title", "Pengguna Terdaftar")}
            </h2>
            <Button
              variant="link"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title={t("journal.refresh")}
              aria-label={t("journal.refresh")}
              className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
            </Button>
          </div>

          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 shrink-0">
            {isRefreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span>
                {totalCount} {t("admin.users_total")}
              </span>
            )}
          </div>
        </div>
        <div className="w-full">
          <RegisteredUsersTable />
        </div>
      </div>
    </div>
  );
}
