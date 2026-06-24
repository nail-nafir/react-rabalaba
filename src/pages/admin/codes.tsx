import { useTranslation } from "react-i18next";
import { AccessCodesTable } from "@/features/admin/components/access-codes-table";

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
          ) ||
            "Kelola dan pantau pembuatan serta penggunaan kode akses premium."}
        </p>
      </div>
      <div className="w-full">
        <AccessCodesTable />
      </div>
    </div>
  );
}
