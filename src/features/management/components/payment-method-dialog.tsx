/**
 * Add/edit a payment channel (bank / e-wallet / QRIS / crypto). Only the `note`
 * sub-label is bilingual; name/account are plain. Same keyed-form pattern as
 * plan-dialog.
 */
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import type { PaymentMethodRow } from "@/services/supabase/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";

const CATEGORIES = ["bank", "ewallet", "qris", "crypto"] as const;
const ICON_OPTIONS = ["Landmark", "Wallet", "Coins", "QrCode"];

interface MethodFormProps {
  method: PaymentMethodRow | null;
  onClose: () => void;
  saving: boolean;
  setSaving: (pending: boolean) => void;
}

function MethodForm({ method, onClose, saving, setSaving }: MethodFormProps) {
  const { t } = useTranslation();
  const { addMethod, updateMethod } = usePaymentMethods();
  const isEdit = !!method;

  const [category, setCategory] = useState<string>(method?.category ?? "bank");
  const [name, setName] = useState(method?.name ?? "");
  const [accountNo, setAccountNo] = useState(method?.account_no ?? "");
  const [accountName, setAccountName] = useState(method?.account_name ?? "");
  const [noteEn, setNoteEn] = useState(method?.note?.en ?? "");
  const [noteId, setNoteId] = useState(method?.note?.id ?? "");
  const [icon, setIcon] = useState(method?.icon ?? "Landmark");
  const [sortOrder, setSortOrder] = useState(String(method?.sort_order ?? 0));
  const [active, setActive] = useState(method?.active ?? true);
  const categoryItems = CATEGORIES.map((value) => ({
    value,
    label: t(`admin.billing.cat_${value}`, value),
  }));
  const iconItems = ICON_OPTIONS.map((value) => ({ value, label: value }));

  const draftSnapshot = JSON.stringify({
    category,
    name: name.trim(),
    accountNo: accountNo.trim(),
    accountName: accountName.trim(),
    noteEn: noteEn.trim(),
    noteId: noteId.trim(),
    icon,
    sortOrder: Number(sortOrder) || 0,
    active,
  });
  const initialSnapshot = method
    ? JSON.stringify({
        category: method.category,
        name: method.name.trim(),
        accountNo: method.account_no?.trim() ?? "",
        accountName: method.account_name?.trim() ?? "",
        noteEn: method.note?.en?.trim() ?? "",
        noteId: method.note?.id?.trim() ?? "",
        icon: method.icon ?? "Landmark",
        sortOrder: method.sort_order ?? 0,
        active: method.active,
      })
    : null;
  const isValid = Boolean(name.trim() && accountNo.trim());
  const canSave = isValid && (!isEdit || draftSnapshot !== initialSnapshot);

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      category: category as PaymentMethodRow["category"],
      name: name.trim(),
      account_no: accountNo.trim(),
      account_name: accountName.trim() || null,
      note:
        noteEn.trim() || noteId.trim()
          ? { en: noteEn.trim(), id: noteId.trim() }
          : null,
      icon,
      sort_order: Number(sortOrder) || 0,
      active,
    };
    setSaving(true);
    try {
      const ok = isEdit
        ? await updateMethod(method!.id, payload)
        : await addMethod(payload);
      if (ok) {
        toast.success(t("toasts.payment_method.save_success"));
        onClose();
      } else {
        toast.error(t("toasts.payment_method.save_error"));
      }
    } catch {
      toast.error(t("toasts.payment_method.save_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.billing.method_category", "Kategori")}
            </Label>
            <Select
              value={category}
              onValueChange={(nextValue) => {
                if (nextValue !== null) setCategory(nextValue);
              }}
            >
              <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="p-1">
                <SelectGroup>
                  {categoryItems.map((item) => (
                    <SelectItem
                      key={item.value}
                      value={item.value}
                      className="uppercase tracking-wider text-[10px] cursor-pointer"
                    >
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.billing.sort_order", "Urutan")}
            </Label>
            <Input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.method_name", "Nama")}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="BCA, E-Wallet, BEP20 (USDT)"
            className="h-8 text-sm placeholder:text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.method_account_no", "Nomor, Alamat")}
          </Label>
          <Input
            value={accountNo}
            onChange={(e) => setAccountNo(e.target.value)}
            placeholder="0123456789 or 0x..."
            className="h-8 text-sm placeholder:font-sans placeholder:text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.method_account_name", "Atas Nama")}
          </Label>
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="John Doe"
            className="h-8 text-sm placeholder:text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.method_note", "Catatan (opsional, EN, ID)")}
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={noteEn}
              onChange={(e) => setNoteEn(e.target.value)}
              placeholder="EN"
              className="h-8 text-sm placeholder:text-xs"
            />
            <Input
              value={noteId}
              onChange={(e) => setNoteId(e.target.value)}
              placeholder="ID"
              className="h-8 text-sm placeholder:text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.method_icon", "Ikon")}
          </Label>
          <Select
            value={icon}
            onValueChange={(nextValue) => {
              if (nextValue !== null) setIcon(nextValue);
            }}
          >
            <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="p-1">
              <SelectGroup>
                {iconItems.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    className="uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Card className="w-full border border-border shadow-xs bg-muted/50">
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t("admin.billing.method_active_label", "Aktifkan")}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-72">
                  {t(
                    "admin.billing.method_active_desc",
                    "Metode pembayaran akan aktif dan dapat dipilih oleh pengguna saat transaksi.",
                  )}
                </p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                className="cursor-pointer data-checked:bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <DialogFooter>
        <Button
          type="button"
          onClick={handleSave}
          size="lg"
          disabled={saving || !canSave}
          aria-busy={saving}
        >
          <ActionButtonContent
            label={t(isEdit ? "common.actions.save" : "common.actions.add")}
            pending={saving}
          />
        </Button>
      </DialogFooter>
    </>
  );
}

interface PaymentMethodDialogProps {
  trigger: ReactElement;
  method?: PaymentMethodRow | null;
}

export function PaymentMethodDialog({
  trigger,
  method,
}: PaymentMethodDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!saving) setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="sm:max-w-md border border-border text-foreground"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {method
              ? t("admin.billing.method_edit_title", "Ubah Metode")
              : t("admin.billing.method_add_title", "Tambah Metode")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.billing.method_dialog_desc",
              "Atur rekening / e-wallet / alamat kripto pembayaran.",
            )}
          </DialogDescription>
        </DialogHeader>
        <MethodForm
          key={method?.id ?? "new"}
          method={method ?? null}
          onClose={() => setOpen(false)}
          saving={saving}
          setSaving={setSaving}
        />
      </DialogContent>
    </Dialog>
  );
}
