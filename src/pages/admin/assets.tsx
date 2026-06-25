import { useTranslation } from "react-i18next";
import { JournalAssetsTable } from "@/features/admin/components/journal-assets-table";
import { Separator } from "@/components/ui/separator";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useJournalAssets } from "@/hooks/use-journal-assets";

export default function AdminAssetsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { assets, isLoading: isAssetsLoading } = useJournalAssets();
  const isFetchingAssets = useIsFetching({ queryKey: ["journal-assets"] }) > 0;
  const isFetchingData = useIsFetching({ queryKey: ["asset-data"] }) > 0;
  const isRefreshing = isFetchingAssets || isFetchingData || isAssetsLoading;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["journal-assets"] });
    queryClient.invalidateQueries({ queryKey: ["asset-data"] });
  };

  const activeCount = assets.filter((a) => a.active).length;
  const totalCount = assets.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.menu_assets", "Manajemen Aset")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.admin_console_desc", "Kelola semua aset dan jadwal rutin jurnal otomatis.")}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("admin.asset_list_title", "Aset Jurnal Otomatis")}
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
                {activeCount} {t("admin.status_active").toLowerCase()} / {totalCount} {t("market.assets_found")}
              </span>
            )}
          </div>
        </div>
        <div className="w-full">
          <JournalAssetsTable />
        </div>
      </div>
    </div>
  );
}
