import { useTranslation } from "react-i18next";
import { AccessCodesTable } from "@/features/admin/components/access-codes-table";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddAccessCodeDialog } from "@/features/admin/components/add-access-code-dialog";

export default function AdminCodesPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.codes_list_title", "Kode Akses")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "admin.admin_console_codes_desc",
            "Pantau penggunaan dan pembuatan kode akses premium di sistem.",
          )}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("admin.codes_list_subtitle", "Daftar Kode Akses")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.codes_list_desc", "Daftar kode akses aktif untuk klaim keanggotaan premium atau trial di platform.") || "Daftar kode akses aktif untuk klaim keanggotaan premium atau trial di platform."}
            </p>
          </div>

          <AddAccessCodeDialog
            trigger={
              <Button
                size="lg"
                className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("admin.codes_add_btn", "Tambah Kode")}</span>
              </Button>
            }
          />
        </div>
        <div className="w-full">
          <AccessCodesTable />
        </div>
      </div>
    </div>
  );
}
