import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminUsers } from "@/hooks/use-admin-users";
import { Field, FieldError } from "@/components/ui/field";

interface AddAccessCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddAccessCodeDialog({ open, onOpenChange }: AddAccessCodeDialogProps) {
  const { t } = useTranslation();
  const { accessCodes, addAccessCode } = useAdminUsers();
  const [isSaving, setIsSaving] = useState(false);

  const schema = useMemo(() => {
    return z.object({
      code: z
        .string()
        .trim()
        .min(1, t("admin.codes_add_code_required", "Kode wajib diisi")),
      kind: z.enum(["full", "trial"]),
      maxRedemptions: z
        .string()
        .trim()
        .refine((val) => !val || /^\d+$/.test(val), {
          message: t("admin.codes_add_invalid_number", "Harus berupa angka positif"),
        }),
      trialDays: z
        .string()
        .trim()
        .refine((val) => !val || /^\d+$/.test(val), {
          message: t("admin.codes_add_invalid_number", "Harus berupa angka positif"),
        }),
      note: z.string().trim(),
    });
  }, [t]);

  type AddAccessCodeFormValues = z.infer<typeof schema>;

  const form = useForm<AddAccessCodeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      kind: "full",
      maxRedemptions: "",
      trialDays: "",
      note: "",
    },
  });

  const codeValue = form.watch("code");
  const kindValue = form.watch("kind");
  const isCodeValidLength = codeValue ? codeValue.trim().length >= 3 : false;

  const trackedSet = useMemo(
    () => new Set(accessCodes.map((c) => c.code.toLowerCase())),
    [accessCodes]
  );

  const onSubmit = async (data: AddAccessCodeFormValues) => {
    const code = data.code.trim();

    if (trackedSet.has(code.toLowerCase())) {
      form.setError("code", {
        type: "manual",
        message: t("admin.codes_add_already_exists", "Kode akses sudah terdaftar"),
      });
      return;
    }

    const maxRedemptions = data.maxRedemptions.trim() ? Number(data.maxRedemptions) : null;
    const trialDays = data.trialDays.trim() ? Number(data.trialDays) : null;

    setIsSaving(true);
    const result = await addAccessCode(
      code,
      data.kind,
      maxRedemptions,
      data.kind === "trial" ? trialDays : null,
      data.note.trim() || null
    );
    setIsSaving(false);

    if (result === "added") {
      toast.success(t("admin.codes_add_toast_success", {
        code,
        defaultValue: `Berhasil menambahkan kode akses ${code}`
      }));
      onOpenChange(false);
    } else if (result === "duplicate") {
      form.setError("code", {
        type: "manual",
        message: t("admin.codes_add_already_exists", "Kode akses sudah terdaftar"),
      });
    } else {
      toast.error(t("admin.codes_add_toast_error", {
        code,
        defaultValue: `Gagal menambahkan kode akses ${code}`
      }));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      form.reset({
        code: "",
        kind: "full",
        maxRedemptions: "",
        trialDays: "",
        note: "",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">
              {t("admin.codes_add_dialog_title", "Tambah Kode Akses")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
              {t("admin.codes_add_dialog_desc", "Buat kode akses premium baru untuk dibagikan ke pengguna.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-data-[invalid=true]/field:text-destructive">
                    {t("admin.codes_col_code", "Kode")}
                  </label>
                  <Input
                    {...field}
                    placeholder={t("admin.codes_add_code_placeholder", "KODE-AKSES-PREMIUM")}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="placeholder:text-sm text-sm uppercase font-mono"
                  />
                  {fieldState.invalid && (
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
                name="kind"
                control={form.control}
                render={({ field }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.codes_col_type", "Tipe")}
                    </label>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                        <SelectValue placeholder={t("admin.codes_form_type_placeholder", "Pilih Tipe")} />
                      </SelectTrigger>
                       <SelectContent align="start" position="popper" className="p-1">
                        <SelectItem value="full" className="uppercase tracking-wider text-[10px] cursor-pointer">{t("admin.codes_form_type_full", "Full")}</SelectItem>
                        <SelectItem value="trial" className="uppercase tracking-wider text-[10px] cursor-pointer">{t("admin.codes_form_type_trial", "Trial")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <Controller
                name="maxRedemptions"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.codes_col_max_uses", "Maksimal Pakai")}
                    </label>
                    <Input
                      {...field}
                      placeholder={t("admin.codes_form_max_uses_placeholder", "∞ (Unlimited)")}
                      type="text"
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
            </div>

            {kindValue === "trial" && (
              <Controller
                name="trialDays"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.codes_col_trial_days", "Hari Trial")}
                    </label>
                    <Input
                      {...field}
                      placeholder={t("admin.codes_form_trial_days_placeholder", "Jumlah hari trial (cth: 30)")}
                      type="text"
                      className="h-8 placeholder:text-sm text-sm"
                    />
                    {fieldState.invalid && (
                      <FieldError
                        errors={[fieldState.error]}
                        className="text-[9px] font-medium mt-0.5"
                      />
                    )}
                  </Field>
                )}
              />
            )}

            <Controller
              name="note"
              control={form.control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("admin.codes_col_note", "Catatan")}
                  </label>
                  <Input
                    {...field}
                    placeholder={t("admin.codes_form_note_placeholder", "Catatan opsional (cth: Promo Juni 2026)")}
                    className="h-8 placeholder:text-sm text-sm"
                  />
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              size="lg"
              disabled={isSaving || !isCodeValidLength}
              className="text-xs font-bold cursor-pointer shrink-0"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t("admin.codes_add_btn_save", "Simpan")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
