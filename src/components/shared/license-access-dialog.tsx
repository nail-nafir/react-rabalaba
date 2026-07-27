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
import { Button } from "@/components/ui/button";
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

interface LicenseAccessDialogProps {
  trigger: ReactElement;
  onSuccess?: () => void;
}

export function LicenseAccessDialog({ trigger, onSuccess }: LicenseAccessDialogProps) {
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
        toast.success(t("toasts.license.activated"));
        onSuccess?.();
        onClose();
      } else {
        const errorKey =
          result === "invalid"
            ? "code_invalid"
            : result === "exhausted"
              ? "code_exhausted"
              : result === "already"
                ? "code_expired"
                : "code_failed";
        toast.error(t(`toasts.license.${errorKey}`));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const badge = TIER_BADGE[tier];

  if (!user) {
    return (
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Lock className="size-4 text-primary" aria-hidden="true" />
            <span>{t("license.login_required_title")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("license.login_required_desc")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto font-medium text-xs cursor-pointer"
            >
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            asChild
            className="w-full sm:w-auto font-bold transition-all text-xs cursor-pointer"
          >
            <Link to={loginRedirectPath}>
              <ActionButtonContent label={t("common.actions.sign_in")} />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-md border border-border text-foreground">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground flex items-center justify-between gap-2">
          <span>{t("license.dialog_title")}</span>
          <span
            className={cn(
              "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
              badge.className,
            )}
          >
            {t(`license.tier_${tier}`)}
          </span>
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t("license.dialog_desc")}
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 my-2"
      >
        <FieldGroup>
          <Field>
            <div className="relative">
              <Controller
                name="code"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type={showCode ? "text" : "password"}
                    placeholder={t("license.input_placeholder")}
                    className="h-10 text-sm font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal pr-10"
                    disabled={isSubmitting}
                  />
                )}
              />
              <button
                type="button"
                onClick={() => setShowCode(!showCode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title={
                  showCode
                    ? t("common.actions.hide")
                    : t("common.actions.show")
                }
              >
                {showCode ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {form.formState.errors.code?.message && (
              <FieldError className="text-xs">
                {form.formState.errors.code.message}
              </FieldError>
            )}
          </Field>
        </FieldGroup>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-6">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto font-medium text-xs cursor-pointer"
              disabled={isSubmitting}
            >
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={!form.formState.isValid || isSubmitting}
            className="w-full sm:w-auto font-bold transition-all text-xs cursor-pointer"
          >
            <ActionButtonContent
              pending={isSubmitting}
              label={t("license.activate_btn")}
            />
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
