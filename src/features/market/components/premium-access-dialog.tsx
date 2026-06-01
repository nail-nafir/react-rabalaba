import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldError } from "@/components/ui/field";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import {
  accessSchema,
  type AccessFormValues,
} from "@/features/market/schemas/access-schema";

interface PremiumAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PremiumAccessDialog({
  open,
  onOpenChange,
  onSuccess,
}: PremiumAccessDialogProps) {
  const { t } = useTranslation();
  const { grantAccess } = usePremiumAccess();
  const [showCode, setShowCode] = useState(false);

  const form = useForm<AccessFormValues>({
    resolver: zodResolver(accessSchema),
    defaultValues: {
      code: "",
    },
  });

  const onSubmit = (data: AccessFormValues) => {
    const result = grantAccess(data.code.trim());
    if (result === "granted" || result === "trial") {
      onOpenChange(false);
      form.reset();
      setShowCode(false);
      toast.success(
        t(
          result === "trial"
            ? "terminal.access_trial_success"
            : "terminal.access_dialog_success",
        ),
      );
      onSuccess?.();
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

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      form.reset({ code: "" });
      form.clearErrors();
      setShowCode(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground shadow-2xl rounded-xl overflow-hidden p-0">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {t("terminal.access_dialog_title")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {t("terminal.access_dialog_desc")}
            </DialogDescription>
          </DialogHeader>
          <form
            id="premium-access-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5 mt-5"
          >
            <FieldGroup>
              <Controller
                name="code"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="relative">
                      <Input
                        {...field}
                        id="access-code"
                        type={showCode ? "text" : "password"}
                        placeholder={t("terminal.access_dialog_placeholder")}
                        aria-invalid={fieldState.invalid}
                        className="pr-10"
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
        </div>

        <DialogFooter className="px-6 py-4 m-0 rounded-none">
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            className="h-9 text-xs cursor-pointer"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="premium-access-form"
            size="sm"
            disabled={form.formState.isSubmitting}
            className="h-9 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md shadow-primary/10 cursor-pointer shrink-0"
          >
            {t("terminal.access_dialog_unlock_btn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
