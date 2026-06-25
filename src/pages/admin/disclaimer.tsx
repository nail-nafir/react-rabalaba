import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { DisclaimerEditor } from "@/features/admin/components/disclaimer-editor";

export default function AdminDisclaimerPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.disclaimer.page_title", "Disclaimer")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.disclaimer.page_desc", "Atur klausul disclaimer risiko dan pantau persetujuan pengguna.")}
        </p>
      </div>

      <Separator />

      <DisclaimerEditor />
    </div>
  );
}
