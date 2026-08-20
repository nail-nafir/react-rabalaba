import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldError } from "@/components/ui/field";
import { usePremiumAccess } from "@/features/auth/hooks/use-premium-access";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buildLoginRedirect } from "@/lib/auth-redirect";
import { Eye, EyeOff, Lock } from "lucide-react";
import {
  accessSchema,
  type AccessFormValues,
} from "@/features/market/schemas/access-schema";
import { TIER_BADGE } from "@/constants/license";
import { toast } from "sonner";

interface LicenseAccessDialogProps {
  trigger: ReactElement;
  onSuccess?: () => void;
}

export function LicenseAccessDialog({
  trigger,
  onSuccess,
}: LicenseAccessDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <LicenseAccessDialogContent
        onSuccess={onSuccess}
        onClose={() => setOpen(false)}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
      />
    </Dialog>
  );
}

function LicenseAccessDialogContent({
  onSuccess,
  onClose,
  isSubmitting,
  setIsSubmitting,
}: {
  onSuccess?: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const { tier, grantAccess } = usePremiumAccess();
  const [showCode, setShowCode] = useState(false);

  const loginRedirectPath = buildLoginRedirect(
    location.pathname,
    location.search,
    location.hash,
  );

  const form = useForm<AccessFormValues>({
    resolver: zodResolver(accessSchema),
    mode: "onChange",
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = async (data: AccessFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await grantAccess(data.code);
      if (result === "granted" || result === "trial") {
        toast.success(
          t(
            result === "trial"
              ? "toasts.license.trial_success"
              : "toasts.license.premium_success",
          ),
        );
        onSuccess?.();
        onClose();
      } else {
        const errorKey =
          result === "invalid"
            ? "invalid_error"
            : result === "exhausted"
              ? "exhausted_error"
              : result === "already"
                ? "redeemed_error"
                : result === "blocked"
                  ? "blocked_error"
                  : "unknown_error";
        toast.error(t(`toasts.license.${errorKey}`));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const badge = TIER_BADGE[tier];
  const TierIcon = badge.icon;
  const showCodeForm = tier !== "premium";

  const statusText =
    tier === "premium"
      ? t("license.status_premium")
      : tier === "trial"
        ? t("license.status_trial", { defaultValue: "Versi uji coba aktif." })
        : t("license.dialog_desc");

  if (!user) {
    return (
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <Lock className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span>{t("license.login_required_title")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("license.login_required_desc")}
          </DialogDescription>
        </DialogHeader>

        {/* Lock Graphic Container */}
        <div className="relative flex flex-col items-center justify-center rounded-xl border border-border/80 bg-muted/40 p-6 text-center my-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary mb-3">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            {t("license.login_required_desc")}
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-2">
          <Button
            asChild
            className="w-full sm:w-auto font-bold transition-all text-xs cursor-pointer"
          >
            <Link to={loginRedirectPath}>
              <ActionButtonContent label={t("common.actions.login")} />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-md border border-border text-foreground">
      <DialogHeader>
        <DialogTitle className="text-base font-bold text-foreground">
          {t("license.dialog_title")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t("license.dialog_desc")}
        </DialogDescription>
      </DialogHeader>

      {/* Plan hero card — current tier + status */}
      <div className="flex items-start gap-3.5 rounded-xl border border-border/80 bg-card/60 p-4 my-1">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
            badge.className,
          )}
        >
          <TierIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <span className="block text-sm font-bold uppercase tracking-wider text-foreground">
            {t(`license.tier_${tier}`)}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {statusText}
          </p>
        </div>
      </div>

      {/* Activation form (hidden once premium) */}
      {showCodeForm ? (
        <form
          id="license-activation-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3.5 my-1"
        >
          <FieldGroup>
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t("license.section_activate", { defaultValue: "Kode Akses / Aktivasi" })}
                  </label>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showCode ? "text" : "password"}
                      placeholder={t("license.input_placeholder")}
                      aria-invalid={fieldState.invalid}
                      className="h-10 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal pr-10 rounded-lg"
                      disabled={isSubmitting}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5 rounded"
                      tabIndex={-1}
                      title={
                        showCode ? t("common.actions.hide") : t("common.actions.show")
                      }
                    >
                      {showCode ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {fieldState.invalid && (
                    <FieldError
                      errors={[fieldState.error]}
                      className="text-xs mt-1 font-medium"
                    />
                  )}
                </Field>
              )}
            />
          </FieldGroup>

          <div className="text-xs text-muted-foreground flex items-center justify-between gap-2 pt-1">
            <span>{t("terminal.access_dialog_no_access", { defaultValue: "Belum punya kode lisensi?" })}</span>
            <DialogClose asChild>
              <Link
                to="/subscription"
                className={cn(
                  buttonVariants({ variant: "link", size: "sm" }),
                  "h-auto p-0 text-primary font-semibold underline whitespace-nowrap text-xs",
                )}
              >
                {t("terminal.access_dialog_no_access_link", { defaultValue: "Beli Lisensi" })}
              </Link>
            </DialogClose>
          </div>
        </form>
      ) : null}

      <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
        <DialogClose asChild>
          <Link
            to="/subscription"
            className={cn(
              buttonVariants({ variant: "default" }),
              "w-full sm:w-auto font-bold transition-all text-xs cursor-pointer inline-flex items-center justify-center",
            )}
          >
            <ActionButtonContent label={t("common.actions.upgrade", { defaultValue: "Tingkatkan" })} />
          </Link>
        </DialogClose>

        {showCodeForm ? (
          <Button
            type="submit"
            form="license-activation-form"
            disabled={!form.formState.isValid || isSubmitting}
            className="w-full sm:w-auto font-bold transition-all text-xs cursor-pointer"
          >
            <ActionButtonContent
              pending={isSubmitting}
              label={t("license.activate_btn")}
            />
          </Button>
        ) : null}
      </DialogFooter>
    </DialogContent>
  );
}
