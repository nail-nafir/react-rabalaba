import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { Field, FieldError } from "@/components/ui/field";
import type { AdminUserRow } from "@/services/supabase/database.types";
import { formatDateNumeric, formatClock } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: AdminUserRow | null;
}

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const { t } = useTranslation();
  const { users, addUser, updateUser } = useAdminUsers();
  const [isSaving, setIsSaving] = useState(false);

  const isEditMode = !!user;

  const schema = useMemo(() => {
    return z.object({
      email: z
        .string()
        .trim()
        .min(1, t("admin.users_add_email_required", "Email wajib diisi"))
        .email(t("admin.users_add_invalid_email", "Format email tidak valid")),
      tier: z.enum(["free", "trial", "premium"]),
      role: z.enum(["user", "admin", "owner"]),
      trialExpiresAt: z.string().optional().or(z.literal("")),
      isBlocked: z.boolean(),
    });
  }, [t]);

  type UserFormValues = z.infer<typeof schema>;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      tier: "free",
      role: "user",
      trialExpiresAt: "",
      isBlocked: false,
    },
  });

  const emailValue = form.watch("email");
  const tierValue = form.watch("tier");
  const isInputValidLength = emailValue ? emailValue.trim().length >= 3 : false;

  const trackedSet = useMemo(
    () => new Set(users.map((u) => u.email.toLowerCase())),
    [users],
  );

  // Helper to format timestamps for display
  const formatTs = (iso: string | null): string => {
    if (!iso) return "—";
    const ts = Date.parse(iso) / 1000;
    if (!Number.isFinite(ts)) return "—";
    return `${formatDateNumeric(ts)} ${formatClock(ts)}`;
  };

  // Sync user data on edit mode
  useEffect(() => {
    if (user) {
      const getRole = (u: AdminUserRow): "user" | "admin" | "owner" => {
        if (u.is_owner) return "owner";
        if (u.is_admin) return "admin";
        return "user";
      };

      const formatDateForInput = (
        isoString: string | null | undefined,
      ): string => {
        if (!isoString) return "";
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "";
        return date.toISOString().split("T")[0];
      };

      form.reset({
        email: user.email,
        tier: user.tier,
        role: getRole(user),
        trialExpiresAt: formatDateForInput(user.trial_expires_at),
        isBlocked: user.is_blocked,
      });
    } else {
      form.reset({
        email: "",
        tier: "free",
        role: "user",
        trialExpiresAt: "",
        isBlocked: false,
      });
    }
  }, [user, form]);

  const onSubmit = async (data: UserFormValues) => {
    const trialExpiresAt = data.trialExpiresAt
      ? new Date(data.trialExpiresAt).toISOString()
      : null;

    if (isEditMode) {
      if (!user) return;

      setIsSaving(true);
      const success = await updateUser(
        user.user_id,
        data.tier,
        data.role,
        trialExpiresAt,
        data.isBlocked,
      );
      setIsSaving(false);

      if (success) {
        toast.success(
          t("admin.users_edit_toast_success", {
            email: user.email,
            defaultValue: `Berhasil mengubah pengguna ${user.email}`,
          }),
        );
        onOpenChange(false);
      } else {
        toast.error(
          t("admin.users_edit_toast_error", {
            email: user.email,
            defaultValue: `Gagal mengubah pengguna ${user.email}`,
          }),
        );
      }
    } else {
      const email = data.email.toLowerCase();

      if (trackedSet.has(email)) {
        form.setError("email", {
          type: "manual",
          message: t(
            "admin.users_add_already_exists",
            "Pengguna sudah terdaftar di sistem",
          ),
        });
        return;
      }

      setIsSaving(true);
      const result = await addUser(
        email,
        data.tier,
        data.role,
        trialExpiresAt,
        data.isBlocked,
      );
      setIsSaving(false);

      if (result === "added") {
        toast.success(
          t("admin.users_add_toast_success_single", {
            email,
            defaultValue: `Berhasil menambahkan pengguna ${email}`,
          }),
        );
        onOpenChange(false);
      } else if (result === "duplicate") {
        form.setError("email", {
          type: "manual",
          message: t(
            "admin.users_add_already_exists",
            "Pengguna sudah terdaftar di sistem",
          ),
        });
      } else {
        toast.error(
          t("admin.users_add_toast_error_single", {
            email,
            defaultValue: `Gagal menambahkan pengguna ${email}`,
          }),
        );
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      if (user) {
        const getRole = (u: AdminUserRow): "user" | "admin" | "owner" => {
          if (u.is_owner) return "owner";
          if (u.is_admin) return "admin";
          return "user";
        };
        const formatDateForInput = (
          isoString: string | null | undefined,
        ): string => {
          if (!isoString) return "";
          const date = new Date(isoString);
          if (isNaN(date.getTime())) return "";
          return date.toISOString().split("T")[0];
        };
        form.reset({
          email: user.email,
          tier: user.tier,
          role: getRole(user),
          trialExpiresAt: formatDateForInput(user.trial_expires_at),
          isBlocked: user.is_blocked,
        });
      } else {
        form.reset({
          email: "",
          tier: "free",
          role: "user",
          trialExpiresAt: "",
          isBlocked: false,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {isEditMode
                ? t("admin.users_edit_dialog_title", "Edit Pengguna")
                : t("admin.users_add_dialog_title", "Tambah Pengguna Baru")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {isEditMode
                ? t(
                    "admin.users_edit_dialog_desc",
                    "Ubah kasta atau peranan pengguna dalam sistem.",
                  )
                : t(
                    "admin.users_add_dialog_desc",
                    "Tambahkan pengguna langsung ke sistem. Password default untuk pengguna baru adalah 'ChangeMe2026!'.",
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-data-[invalid=true]/field:text-destructive">
                    {t("table.email")}
                  </label>
                  <div className="relative">
                    <Input
                      {...field}
                      type="email"
                      placeholder={t(
                        "admin.users_add_email_placeholder",
                        "Alamat email pengguna",
                      )}
                      disabled={isEditMode}
                      autoFocus={!isEditMode}
                      autoComplete="off"
                      spellCheck={false}
                      className={
                        isEditMode
                          ? "pr-10 placeholder:text-sm text-sm opacity-60 cursor-not-allowed disabled:pointer-events-auto"
                          : "pr-10 placeholder:text-sm text-sm"
                      }
                    />
                  </div>
                  {!isEditMode && fieldState.invalid && (
                    <FieldError
                      errors={[fieldState.error]}
                      className="text-[10px] sm:text-[11px] font-medium mt-1"
                    />
                  )}
                </Field>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <Controller
                name="tier"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("table.tier")}
                    </label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                        <SelectValue placeholder={t("admin.users_form_tier_placeholder", "Pilih Kasta")} />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        position="popper"
                        className="p-1"
                      >
                        <SelectItem
                          value="free"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_tier_free")}
                        </SelectItem>
                        <SelectItem
                          value="trial"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_tier_trial")}
                        </SelectItem>
                        <SelectItem
                          value="premium"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_tier_premium")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <Controller
                name="role"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("table.role")}
                    </label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                        <SelectValue placeholder={t("admin.users_form_role_placeholder", "Pilih Role")} />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        position="popper"
                        className="p-1"
                      >
                        <SelectItem
                          value="user"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_role_member")}
                        </SelectItem>
                        <SelectItem
                          value="admin"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_role_admin")}
                        </SelectItem>
                        <SelectItem
                          value="owner"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_role_owner")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            {tierValue === "trial" && (
              <Controller
                name="trialExpiresAt"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.users_form_trial_label", "Masa Berlaku Trial (Opsional)")}
                    </label>
                    <Input
                      {...field}
                      type="date"
                      className="h-8 placeholder:text-sm text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError
                        errors={[fieldState.error]}
                        className="text-[9px] font-medium mt-0.5"
                      />
                    )}
                  </div>
                )}
              />
            )}

            {isEditMode && (
              <Controller
                name="isBlocked"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.users_form_status_label", "Status Akun")}
                    </label>
                    <Select
                      value={field.value ? "blocked" : "active"}
                      onValueChange={(val) => field.onChange(val === "blocked")}
                    >
                      <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                        <SelectValue placeholder={t("admin.users_form_status_placeholder", "Pilih Status")} />
                      </SelectTrigger>
                      <SelectContent
                        align="start"
                        position="popper"
                        className="p-1"
                      >
                        <SelectItem
                          value="active"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_form_status_active", "Aktif")}
                        </SelectItem>
                        <SelectItem
                          value="blocked"
                          className="uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          {t("admin.users_form_status_blocked", "Diblokir")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            )}

            {isEditMode && user && (
              <Card className="mt-4 bg-muted/50">
                <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                  <h4 className="font-bold text-foreground text-[10px] uppercase tracking-wider mb-1">
                    {t("admin.users_form_metadata_title", "Metadata Pengguna")}
                  </h4>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("table.access_code")}
                      </span>
                      <span className="text-foreground font-mono">
                        {user.access_code ? user.access_code : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("table.code_type")}
                      </span>
                      <span className="text-foreground uppercase font-bold text-[10px]">
                        {user.access_code_kind ? user.access_code_kind : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("table.redeemed")}
                      </span>
                      <span className="text-foreground">
                        {formatTs(user.redeemed_at)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("table.joined")}
                      </span>
                      <span className="text-foreground">
                        {formatTs(user.created_at)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("table.last_login")}
                      </span>
                      <span className="text-foreground">
                        {formatTs(user.last_sign_in_at)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {t("admin.users_form_metadata_email_confirmed", "Konfirmasi Email")}
                      </span>
                      <span className="text-foreground">
                        {formatTs(user.email_confirmed_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              size="lg"
              disabled={isSaving || (!isEditMode && !isInputValidLength)}
              className="text-xs font-bold cursor-pointer shrink-0"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isEditMode ? (
                t("admin.users_edit_btn_save", "Simpan Perubahan")
              ) : (
                t("admin.users_add_btn_save", "Simpan")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
