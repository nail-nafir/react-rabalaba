import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldError } from "@/components/ui/field";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useUIStore } from "@/store/ui-store";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import {
  accessSchema,
  type AccessFormValues,
} from "@/features/market/schemas/access-schema";
import { TIER_BADGE } from "@/constants/license";

export function LicenseDialog() {
  const { t } = useTranslation();
  const isOpen = useUIStore((state) => state.isLicenseDialogOpen);
  const closeLicenseDialog = useUIStore((state) => state.closeLicenseDialog);
  const licenseSuccessAction = useUIStore(
    (state) => state.licenseSuccessAction,
  );
  const { tier, daysLeft, grantAccess } = usePremiumAccess();
  const [showCode, setShowCode] = useState(false);

  const form = useForm<AccessFormValues>({
    resolver: zodResolver(accessSchema),
    defaultValues: {
      code: "",
    },
  });

  const codeValue = useWatch({ control: form.control, name: "code" });
  const isCodeEmpty = !codeValue?.trim();

  const resetForm = () => {
    form.reset({ code: "" });
    form.clearErrors();
    setShowCode(false);
  };

  const onSubmit = (data: AccessFormValues) => {
    const result = grantAccess(data.code.trim());
    if (result === "granted" || result === "trial") {
      // Capture before close: closeLicenseDialog clears the pending action.
      const action = licenseSuccessAction;
      closeLicenseDialog();
      resetForm();
      toast.success(
        t(
          result === "trial"
            ? "terminal.access_trial_success"
            : "terminal.access_dialog_success",
        ),
      );
      action?.();
    } else {
      form.setError("code", {
        type: "manual",
        message: t(
          result === "expired"
            ? "terminal.access_trial_expired"
            : "terminal.access_dialog_invalid_code",
        ),
      });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeLicenseDialog();
      resetForm();
    }
  };

  const TierIcon = TIER_BADGE[tier].icon;
  const statusText =
    tier === "premium"
      ? t("license.status_premium")
      : tier === "trial"
        ? t("license.status_trial", { count: daysLeft ?? 0 })
        : t("license.status_free");

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("license.dialog_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("license.dialog_desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border border-border bg-card/50 p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("license.section_status")}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                TIER_BADGE[tier].className,
              )}
            >
              <TierIcon />
              {t(`license.tier_${tier}`)}
            </Badge>
            <span className="text-xs text-muted-foreground">{statusText}</span>
          </div>
        </div>

        {tier !== "premium" && (
          <form
            id="license-activation-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FieldGroup>
              <Controller
                name="code"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("license.section_activate")}
                    </span>
                    <div className="relative">
                      <Input
                        {...field}
                        id="access-code"
                        type={showCode ? "text" : "password"}
                        placeholder={t("terminal.access_dialog_placeholder")}
                        aria-invalid={fieldState.invalid}
                        className="pr-10 placeholder:text-sm text-sm"
                        autoFocus
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCode(!showCode)}
                        className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground hover:bg-transparent transition-colors"
                        tabIndex={-1}
                      >
                        {showCode ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {fieldState.invalid && (
                      <FieldError
                        errors={[fieldState.error]}
                        className="text-[10px]"
                      />
                    )}
                  </Field>
                )}
              />
            </FieldGroup>

            <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
              {t("terminal.access_dialog_no_access")}
              <Link
                to="/pricing"
                onClick={() => handleOpenChange(false)}
                className={cn(
                  buttonVariants({ variant: "link", size: "xs" }),
                  "h-auto p-0 text-primary font-semibold underline whitespace-nowrap",
                )}
              >
                {t("terminal.access_dialog_no_access_link")}
              </Link>
            </div>
          </form>
        )}

        <DialogFooter>
          {tier === "premium" ? (
            <Button
              type="button"
              size="lg"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              className="text-xs cursor-pointer"
            >
              {t("license.close_btn")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                className="text-xs cursor-pointer"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                form="license-activation-form"
                size="lg"
                disabled={form.formState.isSubmitting || isCodeEmpty}
                className="text-xs font-bold cursor-pointer shrink-0"
              >
                {t("terminal.access_dialog_unlock_btn")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
