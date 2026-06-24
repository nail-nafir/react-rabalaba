import { useTranslation } from "react-i18next";
import { RegisteredUsersTable } from "@/features/admin/components/registered-users-table";

export default function AdminUsersPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.users_list_title", "Pengguna Terdaftar")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.admin_console_users_desc", "Kelola pengguna terdaftar, tingkat tier, dan penggunaan kode akses premium.") || "Kelola pengguna terdaftar dan pantau kode akses premium yang ditukarkan."}
        </p>
      </div>
      <div className="w-full">
        <RegisteredUsersTable />
      </div>
    </div>
  );
}
