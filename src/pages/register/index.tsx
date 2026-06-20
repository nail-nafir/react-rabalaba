import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/features/auth/schemas/auth-schema";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/terminal";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  // Already logged in → no reason to be here.
  useEffect(() => {
    if (isAuthenticated) navigate(redirect, { replace: true });
  }, [isAuthenticated, navigate, redirect]);

  const onSubmit = async (data: RegisterFormValues) => {
    const { data: res, error } = await signUp(data.email, data.password);
    if (error) {
      form.setError("email", { type: "manual", message: error.message });
      return;
    }
    // No session back = email confirmation required before first login.
    if (!res.session) {
      setEmailSent(true);
      return;
    }
    toast.success(t("auth.signup_success"));
    navigate(redirect, { replace: true });
  };

  if (emailSent) {
    return (
      <AuthShell
        title={t("auth.confirm_email_title")}
        description={t("auth.confirm_email_desc")}
      >
        <div className="flex flex-col items-center gap-6 py-4 text-center animate-in fade-in zoom-in-95 duration-500">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-xl shadow-emerald-500/5 animate-bounce">
            <MailCheck className="h-8 w-8" />
          </div>
          <Link
            to="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full h-10 text-xs font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/10 hover:shadow-primary/20 active:scale-[0.985] transition-all rounded-lg cursor-pointer",
            )}
          >
            {t("auth.login_btn")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("auth.register_title")}
      description={t("auth.register_subtitle")}
      footer={
        <p className="text-left text-xs text-muted-foreground/80 animate-in fade-in duration-500 delay-300">
          {t("auth.to_login_q")}{" "}
          <Link
            to="/login"
            className="font-bold text-primary hover:underline hover:text-primary/95 transition-colors underline-offset-4"
          >
            {t("auth.login_btn")}
          </Link>
        </p>
      }
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
      >
        {/* Email Field */}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="space-y-1">
              <span className="block text-xs font-bold tracking-wide text-muted-foreground/80">
                {t("auth.email_label")}
              </span>
              <div className="relative">
                <Input
                  {...field}
                  type="email"
                  placeholder={t("auth.email_placeholder")}
                  aria-invalid={fieldState.invalid}
                  autoComplete="email"
                  autoFocus
                  className="h-10 pl-9 pr-3 text-xs sm:text-sm bg-background/50 border-border/80 focus-visible:border-primary focus-visible:ring-primary/10 transition-all rounded-lg"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <Mail className="h-4 w-4" />
                </div>
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

        {/* Password Field */}
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="space-y-1">
              <span className="block text-xs font-bold tracking-wide text-muted-foreground/80">
                {t("auth.password_label")}
              </span>
              <div className="relative">
                <Input
                  {...field}
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.password_placeholder")}
                  aria-invalid={fieldState.invalid}
                  autoComplete="new-password"
                  className="h-10 pl-9 pr-10 text-xs sm:text-sm bg-background/50 border-border/80 focus-visible:border-primary focus-visible:ring-primary/10 transition-all rounded-lg"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <Lock className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground/60 hover:text-foreground hover:bg-transparent transition-colors cursor-pointer"
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

        {/* Confirm Password Field */}
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="space-y-1">
              <span className="block text-xs font-bold tracking-wide text-muted-foreground/80">
                {t("auth.confirm_password_label")}
              </span>
              <div className="relative">
                <Input
                  {...field}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t("auth.confirm_password_placeholder")}
                  aria-invalid={fieldState.invalid}
                  autoComplete="new-password"
                  className="h-10 pl-9 pr-10 text-xs sm:text-sm bg-background/50 border-border/80 focus-visible:border-primary focus-visible:ring-primary/10 transition-all rounded-lg"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60">
                  <Lock className="h-4 w-4" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-0 top-0 h-10 w-10 text-muted-foreground/60 hover:text-foreground hover:bg-transparent transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
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

        {/* Submit button with shimmer & micro-interaction active effect */}
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="h-10 w-full cursor-pointer text-xs font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/15 hover:shadow-primary/25 hover:-translate-y-px active:translate-y-px active:scale-[0.985] transition-all rounded-lg mt-2 flex items-center justify-center gap-1.5"
        >
          {form.formState.isSubmitting ? <Spinner className="h-4 w-4" /> : null}
          <span>{t("auth.signup_btn")}</span>
        </Button>
      </form>
    </AuthShell>
  );
}
