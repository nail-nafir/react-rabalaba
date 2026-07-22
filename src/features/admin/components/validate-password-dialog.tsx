import { useMemo, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { useAuth } from "@/hooks/use-auth";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";

interface ValidatePasswordDialogProps {
  trigger: ReactElement;
  onSuccess: () => void;
}

export function ValidatePasswordDialog({
  trigger,
  onSuccess,
}: ValidatePasswordDialogProps) {
  const [open, setOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isValidating) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <ValidatePasswordDialogContent
        onSuccess={onSuccess}
        onClose={() => setOpen(false)}
        isValidating={isValidating}
        setIsValidating={setIsValidating}
      />
    </Dialog>
  );
}

function ValidatePasswordDialogContent({
  onSuccess,
  onClose,
  isValidating,
  setIsValidating,
}: Pick<ValidatePasswordDialogProps, "onSuccess"> & {
  onClose: () => void;
  isValidating: boolean;
  setIsValidating: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => {
    return z.object({
      password: z
        .string()
        .min(1, t("auth.password_required", "Password wajib diisi")),
    });
  }, [t]);

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!user?.email) {
      toast.error(t("toasts.auth.session_required"));
      return;
    }

    setIsValidating(true);
    try {
      const { error } = await signIn(user.email, data.password);

      if (error) {
        form.setError("password", {
          type: "manual",
          message: t("auth.login_failed", "Password salah"),
        });
        toast.error(t("toasts.password.validation_error"));
      } else {
        toast.success(t("toasts.password.validation_success"));
        onSuccess();
        onClose();
      }
    } catch {
      toast.error(t("toasts.password.validation_error"));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <DialogContent
      className="sm:max-w-md border border-border text-foreground"
      showCloseButton={!isValidating}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.validate_password_title", "Validasi Password")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.validate_password_desc",
              "Masukkan password Anda untuk memverifikasi tindakan sensitif ini.",
            )}
          </DialogDescription>
        </DialogHeader>

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="space-y-1">
              <div className="relative">
                <Input
                  {...field}
                  type={showPassword ? "text" : "password"}
                  placeholder={t(
                    "auth.password_placeholder",
                    "Masukkan password Anda",
                  )}
                  aria-invalid={fieldState.invalid}
                  autoFocus
                  autoComplete="current-password"
                  className="pr-10 placeholder:text-sm text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full w-9 text-muted-foreground/60 hover:text-foreground hover:bg-transparent transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {fieldState.invalid && (
                <FieldError
                  errors={[fieldState.error]}
                  className="text-[10px] sm:text-[11px] font-medium mt-1"
                />
              )}
            </Field>
          )}
        />

        <DialogFooter>
          <Button
            type="submit"
            size="lg"
            disabled={isValidating || !form.formState.isValid}
            aria-busy={isValidating}
          >
            <ActionButtonContent
              label={t("common.actions.confirm")}
              pending={isValidating}
            />
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
