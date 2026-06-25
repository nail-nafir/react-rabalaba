import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { PaymentMethodsTable } from "@/features/admin/components/payment-methods-table";

export default function AdminPaymentsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.menu_payments", "Metode Pembayaran")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.payments.page_desc", "Kelola akun bank, e-wallet, dan alamat pembayaran kripto.")}
        </p>
      </div>

      <Separator />

      <div className="w-full">
        <PaymentMethodsTable />
      </div>
    </div>
  );
}
