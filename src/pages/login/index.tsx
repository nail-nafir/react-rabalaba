import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Lock, Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import {
  authSchema,
  type AuthFormValues,
} from "@/features/auth/schemas/auth-schema";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { GoogleAuthButton } from "@/features/auth/components/google-auth-button";
import { sanitizeInternalRedirect } from "@/lib/auth-redirect";

export default function LoginPage() {
  const { t } = useTranslation();
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = sanitizeInternalRedirect(params.get("redirect"));
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  // Already logged in → no reason to be here.
  useEffect(() => {
    if (isAuthenticated) navigate(redirect, { replace: true });
  }, [isAuthenticated, navigate, redirect]);

  const onSubmit = async (data: AuthFormValues) => {
    const { error } = await signIn(data.email, data.password);
    if (error) {
      form.setError("password", {
        type: "manual",
        message: t("auth.login_failed"),
      });
      return;
    }
    toast.success(t("auth.login_success"));
    navigate(redirect, { replace: true });
  };

  return (
    <AuthShell
      title={t("auth.login_title")}
      description={t("auth.login_subtitle")}
      footer={
        <p className="text-left text-xs text-muted-foreground/80 animate-in fade-in duration-500 delay-300">
          {t("auth.to_signup_q")}{" "}
          <Link
            to={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-primary hover:underline hover:text-primary/95 transition-colors underline-offset-4"
          >
            {t("auth.signup_btn")}
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
                  autoComplete="current-password"
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

        {/* Submit button with shimmer & micro-interaction active effect */}
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="h-10 w-full cursor-pointer text-xs font-extrabold bg-primary hover:bg-primary/95 text-primary-foreground shadow-lg shadow-primary/15 hover:shadow-primary/25 hover:-translate-y-px active:translate-y-px active:scale-[0.985] transition-all rounded-lg mt-2 flex items-center justify-center gap-1.5"
        >
          {form.formState.isSubmitting ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>{t("auth.login_btn")}</span>
        </Button>
      </form>

      <GoogleAuthButton redirect={redirect} />
    </AuthShell>
  );
}
