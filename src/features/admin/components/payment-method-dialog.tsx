/**
 * Add/edit a payment channel (bank / e-wallet / QRIS / crypto). Only the `note`
 * sub-label is bilingual; name/account are plain. Same keyed-form pattern as
 * plan-dialog.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import type { PaymentMethodRow } from "@/services/supabase/database.types";
import { Card, CardContent } from "@/components/ui/card";

const CATEGORIES = ["bank", "ewallet", "qris", "crypto"] as const;
const ICON_OPTIONS = ["Landmark", "Wallet", "Coins", "QrCode"];

interface MethodFormProps {
  method: PaymentMethodRow | null;
  onClose: () => void;
}

function MethodForm({ method, onClose }: MethodFormProps) {
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
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && accountNo.trim();

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
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
    const ok = isEdit
      ? await updateMethod(method!.id, payload)
      : await addMethod(payload);
    setSaving(false);
    if (ok) {
      toast.success(t("admin.billing.method_saved", "Metode tersimpan"));
      onClose();
    } else {
      toast.error(
        t("admin.billing.method_save_error", "Gagal menyimpan metode"),
      );
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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" position="popper" className="p-1">
                {CATEGORIES.map((c) => (
                  <SelectItem
                    key={c}
                    value={c}
                    className="uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    {t(`admin.billing.cat_${c}`, c)}
                  </SelectItem>
                ))}
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
            className="h-8 text-sm font-mono placeholder:font-sans placeholder:text-xs"
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
          <Select value={icon} onValueChange={setIcon}>
            <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" position="popper" className="p-1">
              {ICON_OPTIONS.map((ic) => (
                <SelectItem
                  key={ic}
                  value={ic}
                  className="uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  {ic}
                </SelectItem>
              ))}
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
                className="cursor-pointer data-[state=checked]:bg-emerald-500"
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
          className="text-xs font-bold cursor-pointer shrink-0"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t("admin.billing.save_btn", "Simpan")
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?: PaymentMethodRow | null;
}

export function PaymentMethodDialog({
  open,
  onOpenChange,
  method,
}: PaymentMethodDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border text-foreground">
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
        {open && (
          <MethodForm
            key={method?.id ?? "new"}
            method={method ?? null}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
