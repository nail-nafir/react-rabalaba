import { useTranslation } from "react-i18next";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TestimonialsTable } from "@/features/management/components/testimonials-table";
import { TestimonialSettingsDialog } from "@/features/management/components/testimonial-settings-dialog";

export default function AdminTestimonialsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.testimonials.page_title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.testimonials.page_desc")}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("admin.testimonials.list_subtitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.testimonials.list_desc")}
            </p>
          </div>

          <TestimonialSettingsDialog
            trigger={
              <Button
                variant="outline"
                size="lg"
                className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {t("admin.settings_btn")}
                </span>
              </Button>
            }
          />
        </div>
        <div className="w-full">
          <TestimonialsTable />
        </div>
      </div>
    </div>
  );
}
