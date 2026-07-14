/**
 * Mint an invitation. On success the dialog flips to a "created" view showing
 * the shareable /invite/:code link with a copy button (the code is generated
 * server-side by admin_create_invitation).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  CheckCircle2,
  Calendar as CalendarIcon,
  X,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId, enUS as localeEn } from "date-fns/locale";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAdminInvitations } from "@/hooks/use-admin-invitations";
import { cn } from "@/lib/utils";

interface AddInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origin: string;
}

interface InviteFormProps {
  origin: string;
}

function InviteFormContent({ origin }: InviteFormProps) {
  const { t, i18n } = useTranslation();
  const { createInvitation } = useAdminInvitations();

  const [saving, setSaving] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const schema = useMemo(() => {
    return z
      .object({
        kind: z.enum(["full", "trial"]),
        trialDays: z.string().trim(),
        maxRedemptions: z
          .string()
          .trim()
          .refine((val) => !val || /^\d+$/.test(val), {
            message: t(
              "admin.codes_add_invalid_number",
              "Harus berupa angka positif",
            ),
          }),
        recipient: z.string().trim(),
        expiresAt: z.date().optional(),
      })
      .refine(
        (data) => {
          if (data.kind === "trial") {
            return /^\d+$/.test(data.trialDays) && Number(data.trialDays) > 0;
          }
          return true;
        },
        {
          message: t(
            "admin.codes_add_invalid_number",
            "Harus berupa angka positif",
          ),
          path: ["trialDays"],
        },
      );
  }, [t]);

  type InviteFormValues = z.infer<typeof schema>;

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      kind: "full",
      trialDays: "30",
      maxRedemptions: "1",
      recipient: "",
      expiresAt: undefined,
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = form;
  const kindValue = watch("kind");

  const onSubmit = async (data: InviteFormValues) => {
    setSaving(true);
    const code = await createInvitation(
      data.kind,
      data.kind === "trial" ? Number(data.trialDays) || 30 : null,
      data.maxRedemptions.trim() ? Number(data.maxRedemptions) : null,
      data.recipient.trim() || null,
      data.expiresAt ? data.expiresAt.toISOString() : null,
    );
    setSaving(false);
    if (code) {
      setCreatedCode(code);
    } else {
      toast.error(
        t("admin.invitations.create_error", "Gagal membuat undangan"),
      );
    }
  };

  const currentLocale = i18n.language?.startsWith("id") ? localeId : localeEn;

  if (createdCode) {
    const url = `${origin}/invite/${createdCode}`;
    return (
      <DialogContent className="sm:max-w-md border border-border text-foreground min-w-0">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("admin.invitations.add_title", "Buat Undangan")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.invitations.add_desc",
              "Buat link undangan yang memberi akses premium atau trial saat diklaim.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {t("admin.invitations.created_title", "Undangan dibuat!")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(
                "admin.invitations.created_desc",
                "Bagikan link ini ke calon member.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 min-w-0">
            <span className="flex-1 truncate text-[11px] text-foreground select-all">
              {url}
            </span>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success(
                  t("admin.invitations.link_copied", "Link undangan disalin"),
                );
              }}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => setCreatedCode(null)}
            size="lg"
            className="text-xs font-bold cursor-pointer shrink-0"
          >
            <Plus data-icon="inline-start" className="h-3.5 w-3.5" />
            {t("admin.invitations.create_another", "Buat Lagi")}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-md border border-border text-foreground min-w-0">
      <DialogHeader>
        <DialogTitle className="text-lg font-bold text-foreground">
          {t("admin.invitations.add_title", "Buat Undangan")}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t(
            "admin.invitations.add_desc",
            "Buat link undangan yang memberi akses premium atau trial saat diklaim.",
          )}
        </DialogDescription>
      </DialogHeader>

      <form
        id="add-invitation-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 min-w-0"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Controller
              name="kind"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("admin.invitations.field_kind", "Tipe")}
                  </Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      position="popper"
                      className="p-1"
                    >
                      <SelectItem
                        value="full"
                        className="uppercase tracking-wider text-[10px] cursor-pointer"
                      >
                        {t("admin.codes_form_type_full", "Penuh")}
                      </SelectItem>
                      <SelectItem
                        value="trial"
                        className="uppercase tracking-wider text-[10px] cursor-pointer"
                      >
                        {t("admin.codes_form_type_trial", "Uji Coba")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <Controller
              name="maxRedemptions"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("admin.invitations.field_max", "Maksimal Pakai")}
                  </Label>
                  <Input
                    {...field}
                    type="text"
                    placeholder={t(
                      "admin.codes_form_max_uses_placeholder",
                      "∞ (Unlimited)",
                    )}
                    className="h-8 text-sm placeholder:text-sm"
                  />
                </div>
              )}
            />
          </div>

          {kindValue === "trial" && (
            <Controller
              name="trialDays"
              control={control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("admin.invitations.field_trial_days", "Hari Trial")}
                  </Label>
                  <Input
                    {...field}
                    type="text"
                    className="h-8 text-sm placeholder:text-sm"
                  />
                </div>
              )}
            />
          )}

          <Controller
            name="expiresAt"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t(
                    "admin.invitations.field_expires",
                    "Kadaluarsa (opsional)",
                  )}
                </Label>
                <div className="relative w-full">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className={cn(
                          "w-full h-8 justify-start text-left font-normal text-sm cursor-pointer pr-8",
                          !field.value && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {field.value ? (
                          format(field.value, "dd MMM yyyy", {
                            locale: currentLocale,
                          })
                        ) : (
                          <span>
                            {t(
                              "admin.invitations.select_date",
                              "Pilih tanggal",
                            )}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  {field.value && (
                    <button
                      type="button"
                      onClick={() => field.onChange(undefined)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer animate-in fade-in zoom-in-95 duration-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          />

          <Controller
            name="recipient"
            control={control}
            render={({ field }) => (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t(
                    "admin.invitations.field_recipient",
                    "Untuk Siapa (opsional)",
                  )}
                </Label>
                <Input
                  {...field}
                  placeholder={t(
                    "admin.invitations.field_recipient_ph",
                    "cth: Budi / promo Juni",
                  )}
                  className="h-8 text-sm placeholder:text-sm"
                />
              </div>
            )}
          />
        </div>
      </form>

      <DialogFooter>
        <Button
          type="submit"
          form="add-invitation-form"
          size="lg"
          disabled={saving || !isValid}
          className="text-xs font-bold cursor-pointer shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Plus data-icon="inline-start" className="h-3.5 w-3.5" />
              {t("admin.invitations.create_btn", "Buat")}
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function AddInvitationDialog({
  open,
  onOpenChange,
  origin,
}: AddInvitationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <InviteFormContent key="invite-form" origin={origin} />}
    </Dialog>
  );
}
