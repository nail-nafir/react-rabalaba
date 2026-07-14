import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";
import { TestimonialsTable } from "@/features/admin/components/testimonials-table";

export default function AdminTestimonialsPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          {t("admin.testimonials.page_title", "Ulasan Pengguna")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "admin.testimonials.page_desc",
            "Moderasi ulasan pengguna dan pilih hingga enam kutipan untuk ditampilkan di landing page.",
          )}
        </p>
      </div>

      <Separator />

      <TestimonialsTable />
    </div>
  );
}
