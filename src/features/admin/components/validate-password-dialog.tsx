import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { useAuth } from "@/hooks/use-auth";

interface ValidatePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ValidatePasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}: ValidatePasswordDialogProps) {
  const { t } = useTranslation();
  const { user, signIn } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
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
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (!user?.email) {
      toast.error(t("auth.unauthenticated", "Silakan login kembali"));
      return;
    }

    setIsValidating(true);
    const { error } = await signIn(user.email, data.password);
    setIsValidating(false);

    if (error) {
      form.setError("password", {
        type: "manual",
        message: t("auth.login_failed", "Password salah"),
      });
    } else {
      toast.success(
        t("admin.password_validated_success", "Password berhasil divalidasi"),
      );
      onOpenChange(false);
      onSuccess();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      form.reset({ password: "" });
      setShowPassword(false);
    }
  };

  const passwordValue = form.watch("password");
  const isFormValid = passwordValue && passwordValue.length >= 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
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
              disabled={isValidating || !isFormValid}
              className="text-xs font-bold cursor-pointer shrink-0"
            >
              {isValidating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Check data-icon="inline-start" className="h-3.5 w-3.5" />
                  {t("common.confirm", "Konfirmasi")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
