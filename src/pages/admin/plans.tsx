import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { SubscriptionPlansTable } from "@/features/admin/components/subscription-plans-table";

export default function AdminPlansPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.menu_plans", "Paket Langganan")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.plans.page_desc", "Kelola harga paket, benefit, dan penawaran langganan.")}
        </p>
      </div>

      <Separator />

      <div className="w-full">
        <SubscriptionPlansTable />
      </div>
    </div>
  );
}
