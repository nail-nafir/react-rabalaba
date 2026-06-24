import { useTranslation } from "react-i18next";
import { JournalAssetsTable } from "@/features/admin/components/journal-assets-table";

export default function AdminAssetsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.asset_list_title", "Aset Jurnal")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.admin_console_desc", "Kelola semua aset dan jadwal rutin jurnal otomatis.")}
        </p>
      </div>
      <div className="w-full">
        <JournalAssetsTable />
      </div>
    </div>
  );
}
