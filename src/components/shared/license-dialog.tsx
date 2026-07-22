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
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { useAuth } from "@/hooks/use-auth";
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

interface LicenseDialogProps {
  trigger: ReactElement;
  onSuccess?: () => void;
}

export function LicenseDialog({ trigger, onSuccess }: LicenseDialogProps) {
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
      <LicenseDialogContent
        onSuccess={onSuccess}
        onClose={() => setOpen(false)}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
      />
    </Dialog>
  );
}

function LicenseDialogContent({
  onSuccess,
  onClose,
  isSubmitting,
  setIsSubmitting,
}: Pick<LicenseDialogProps, "onSuccess"> & {
  onClose: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const { tier, daysLeft, grantAccess, isBlocked } = usePremiumAccess();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [showCode, setShowCode] = useState(false);
  const loginPath = buildLoginRedirect(
    location.pathname,
    location.search,
    location.hash,
  );

  const form = useForm<AccessFormValues>({
    resolver: zodResolver(accessSchema),
    defaultValues: { code: "" },
    shouldUnregister: true,
    mode: "onChange",
  });

  const onSubmit = async (data: AccessFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await grantAccess(data.code.trim());
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
        return;
      }
      form.setError("code", {
        type: "manual",
        message: t(
          result === "exhausted"
            ? "license.redeem_exhausted"
            : result === "already"
              ? "license.redeem_already"
              : result === "blocked"
                ? "license.redeem_blocked"
                : "terminal.access_dialog_invalid_code",
        ),
      });
      const errorToastKey =
        result === "exhausted"
          ? "toasts.license.exhausted_error"
          : result === "already"
            ? "toasts.license.redeemed_error"
            : result === "blocked"
              ? "toasts.license.blocked_error"
              : "toasts.license.invalid_error";
      toast.error(t(errorToastKey));
    } catch {
      form.setError("code", {
        type: "manual",
        message: t("terminal.access_dialog_invalid_code"),
      });
      toast.error(t("toasts.license.unknown_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const TierIcon = TIER_BADGE[tier].icon;
  const statusText = isBlocked
    ? t("license.status_blocked")
    : tier === "premium"
      ? t("license.status_premium")
      : tier === "trial"
        ? t("license.status_trial", { count: daysLeft ?? 0 })
        : t("license.status_free");

  const showCodeForm = tier !== "premium" && !isBlocked;

  if (!isAuthenticated) {
    return (
      <DialogContent
        className="sm:max-w-md border border-border text-foreground"
        showCloseButton={!isSubmitting}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("license.login_required_title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("license.login_required_desc")}
          </DialogDescription>
        </DialogHeader>

        {/* Simple Elegant Lock State Graphic Container */}
        <div className="relative flex flex-col items-center justify-center rounded-xl border border-border bg-card/45 p-8 text-center">
          {/* Elegant Lock Icon Frame */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-primary mb-4">
            <Lock className="h-5 w-5" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-primary uppercase tracking-wider block">
              {t("license.auth_required")}
            </span>
            <p className="text-[11px] text-muted-foreground leading-normal mx-auto">
              {t("auth.auth_desc")}
            </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Link
              to={loginPath}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              <ActionButtonContent label={t("common.actions.login")} />
            </Link>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent
      className="sm:max-w-md border border-border text-foreground"
      showCloseButton={!isSubmitting}
    >
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground">
          {t("license.dialog_title")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t("license.dialog_desc")}
        </DialogDescription>
      </DialogHeader>

      {/* Plan hero — current tier + status, no account identity */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border",
            TIER_BADGE[tier].className,
          )}
        >
          <TierIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <span className="block text-sm font-bold uppercase tracking-wide text-foreground">
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
          className="space-y-3"
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

          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {t("terminal.access_dialog_no_access")}
            <DialogClose asChild>
              <Link
                to="/subscription"
                className={cn(
                  buttonVariants({ variant: "link", size: "xs" }),
                  "h-auto p-0 text-primary font-semibold underline whitespace-nowrap",
                )}
              >
                {t("terminal.access_dialog_no_access_link")}
              </Link>
            </DialogClose>
          </div>
        </form>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-end">
        {showCodeForm ? (
          <Button
            type="submit"
            form="license-activation-form"
            size="lg"
            disabled={isSubmitting || !form.formState.isValid}
            aria-busy={isSubmitting}
          >
            <ActionButtonContent
              label={t("common.actions.unlock")}
              pending={isSubmitting}
            />
          </Button>
        ) : (
          <DialogClose asChild>
            <Link
              to="/subscription"
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "items-center",
              )}
            >
              <ActionButtonContent label={t("common.actions.upgrade")} />
            </Link>
          </DialogClose>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
