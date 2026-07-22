/**
 * Add/edit a subscription plan. Bilingual copy is captured as paired EN/ID
 * inputs and written as JSONB ({ en, id }). Follows the journal-settings-dialog
 * pattern: a keyed inner form initializes its draft state straight from props
 * (no useEffect setState), the container mounts it fresh per plan.
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubscriptionPlans } from "@/hooks/use-subscription-plans";
import type { SubscriptionPlanRow } from "@/services/supabase/database.types";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { toast } from "sonner";

const ICON_OPTIONS = ["Terminal", "Zap", "Shield"];
const CTA_KINDS = ["link", "payment", "license", "contact"] as const;
const toList = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

function LangField({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  textarea?: boolean;
}) {
  if (textarea) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm placeholder:text-sm min-h-20"
      />
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-sm placeholder:text-sm"
    />
  );
}

interface BilingualProps {
  label: string;
  en: string;
  id: string;
  onEn: (v: string) => void;
  onId: (v: string) => void;
  textarea?: boolean;
}

function Bilingual({ label, en, id, onEn, onId, textarea }: BilingualProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <LangField
          value={en}
          onChange={onEn}
          placeholder="EN"
          textarea={textarea}
        />
        <LangField
          value={id}
          onChange={onId}
          placeholder="ID"
          textarea={textarea}
        />
      </div>
    </div>
  );
}

interface PlanFormProps {
  plan: SubscriptionPlanRow | null;
  onClose: () => void;
  saving: boolean;
  setSaving: (pending: boolean) => void;
}

function PlanForm({ plan, onClose, saving, setSaving }: PlanFormProps) {
  const { t } = useTranslation();
  const { addPlan, updatePlan } = useSubscriptionPlans();
  const isEdit = !!plan;

  const [slug, setSlug] = useState(plan?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(String(plan?.sort_order ?? 0));
  const [nameEn, setNameEn] = useState(plan?.name?.en ?? "");
  const [nameId, setNameId] = useState(plan?.name?.id ?? "");
  const [priceEn, setPriceEn] = useState(plan?.price?.en ?? "");
  const [priceId, setPriceId] = useState(plan?.price?.id ?? "");
  const [origEn, setOrigEn] = useState(plan?.original_price?.en ?? "");
  const [origId, setOrigId] = useState(plan?.original_price?.id ?? "");
  const [descEn, setDescEn] = useState(plan?.description?.en ?? "");
  const [descId, setDescId] = useState(plan?.description?.id ?? "");
  const [featEn, setFeatEn] = useState((plan?.features?.en ?? []).join("\n"));
  const [featId, setFeatId] = useState((plan?.features?.id ?? []).join("\n"));
  const [icon, setIcon] = useState(plan?.icon ?? "Terminal");
  const [highlighted, setHighlighted] = useState(plan?.highlighted ?? false);
  const [ctaKind, setCtaKind] = useState<string>(plan?.cta_kind ?? "link");
  const [ctaLink, setCtaLink] = useState(plan?.cta_link ?? "");
  const [active, setActive] = useState(plan?.active ?? true);
  const iconItems = ICON_OPTIONS.map((value) => ({ value, label: value }));
  const ctaKindItems = CTA_KINDS.map((value) => ({
    value,
    label: t(`admin.billing.cta_${value}`, value),
  }));

  const isValid = Boolean(
    slug.trim() &&
    nameEn.trim() &&
    nameId.trim() &&
    priceEn.trim() &&
    priceId.trim(),
  );
  const draftSnapshot = JSON.stringify({
    slug: slug.trim().toLowerCase(),
    sortOrder: Number(sortOrder) || 0,
    nameEn: nameEn.trim(),
    nameId: nameId.trim(),
    priceEn: priceEn.trim(),
    priceId: priceId.trim(),
    origEn: origEn.trim(),
    origId: origId.trim(),
    descEn: descEn.trim(),
    descId: descId.trim(),
    featEn: toList(featEn),
    featId: toList(featId),
    icon,
    highlighted,
    ctaKind,
    ctaLink: ctaLink.trim(),
    active,
  });
  const initialSnapshot = plan
    ? JSON.stringify({
        slug: plan.slug.trim().toLowerCase(),
        sortOrder: plan.sort_order ?? 0,
        nameEn: plan.name?.en?.trim() ?? "",
        nameId: plan.name?.id?.trim() ?? "",
        priceEn: plan.price?.en?.trim() ?? "",
        priceId: plan.price?.id?.trim() ?? "",
        origEn: plan.original_price?.en?.trim() ?? "",
        origId: plan.original_price?.id?.trim() ?? "",
        descEn: plan.description?.en?.trim() ?? "",
        descId: plan.description?.id?.trim() ?? "",
        featEn: toList((plan.features?.en ?? []).join("\n")),
        featId: toList((plan.features?.id ?? []).join("\n")),
        icon: plan.icon ?? "Terminal",
        highlighted: plan.highlighted ?? false,
        ctaKind: plan.cta_kind ?? "link",
        ctaLink: plan.cta_link?.trim() ?? "",
        active: plan.active ?? true,
      })
    : null;
  const canSave = isValid && (!isEdit || draftSnapshot !== initialSnapshot);

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      sort_order: Number(sortOrder) || 0,
      name: { en: nameEn.trim(), id: nameId.trim() },
      description: { en: descEn.trim(), id: descId.trim() },
      price: { en: priceEn.trim(), id: priceId.trim() },
      original_price:
        origEn.trim() || origId.trim()
          ? { en: origEn.trim(), id: origId.trim() }
          : null,
      features: { en: toList(featEn), id: toList(featId) },
      icon,
      highlighted,
      cta_kind: ctaKind as SubscriptionPlanRow["cta_kind"],
      cta_link: ctaLink.trim() || null,
      active,
    };
    setSaving(true);
    try {
      const ok = isEdit
        ? await updatePlan(plan!.slug, payload)
        : (await addPlan({ slug: slug.trim().toLowerCase(), ...payload })) ===
          "added";
      if (ok) {
        toast.success(t("toasts.plan.save_success"));
        onClose();
      } else {
        toast.error(t("toasts.plan.save_error"));
      }
    } catch {
      toast.error(t("toasts.plan.save_error"));
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
              {t("admin.billing.plan_slug", "Slug")}
            </Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              disabled={isEdit}
              placeholder="professional"
              className="h-8 text-sm lowercase disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-auto"
            />
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

        <Bilingual
          label={t("admin.billing.plan_name", "Nama")}
          en={nameEn}
          id={nameId}
          onEn={setNameEn}
          onId={setNameId}
        />
        <Bilingual
          label={t("admin.billing.plan_price", "Harga")}
          en={priceEn}
          id={priceId}
          onEn={setPriceEn}
          onId={setPriceId}
        />
        <Bilingual
          label={t(
            "admin.billing.plan_original_price",
            "Harga Coret (opsional)",
          )}
          en={origEn}
          id={origId}
          onEn={setOrigEn}
          onId={setOrigId}
        />
        <Bilingual
          label={t("admin.billing.plan_description", "Deskripsi")}
          en={descEn}
          id={descId}
          onEn={setDescEn}
          onId={setDescId}
          textarea
        />
        <Bilingual
          label={t("admin.billing.plan_features", "Benefit (satu per baris)")}
          en={featEn}
          id={featId}
          onEn={setFeatEn}
          onId={setFeatId}
          textarea
        />

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.billing.plan_icon", "Ikon")}
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
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("admin.billing.plan_cta_kind", "Aksi Tombol")}
            </Label>
            <Select
              value={ctaKind}
              onValueChange={(nextValue) => {
                if (nextValue !== null) setCtaKind(nextValue);
              }}
            >
              <SelectTrigger className="w-full h-8 uppercase tracking-wider text-[10px] cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start" className="p-1">
                <SelectGroup>
                  {ctaKindItems.map((item) => (
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
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("admin.billing.plan_cta_link", "Link Tombol (opsional)")}
          </Label>
          <Input
            value={ctaLink}
            onChange={(e) => setCtaLink(e.target.value)}
            placeholder="/terminal or https://t.me/..."
            className="h-8 text-sm placeholder:text-xs"
          />
        </div>

        <Card className="w-full border border-border shadow-xs bg-muted/50">
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t("admin.billing.plan_highlighted", "Tandai best seller")}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-72">
                  {t(
                    "admin.billing.plan_highlighted_desc",
                    "Tampilkan badge Best Seller dan highlight paket.",
                  )}
                </p>
              </div>
              <Switch
                checked={highlighted}
                onCheckedChange={setHighlighted}
                className="cursor-pointer data-checked:bg-amber-500"
              />
            </div>

            <div className="border-t border-border/40 my-0.5" />

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                  {t("admin.billing.plan_active", "Tampilkan di halaman")}
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-72">
                  {t(
                    "admin.billing.plan_active_desc",
                    "Paket akan ditampilkan publik di halaman langganan.",
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

interface PlanDialogProps {
  trigger: ReactElement;
  plan?: SubscriptionPlanRow | null;
}

export function PlanDialog({ trigger, plan }: PlanDialogProps) {
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
        className="sm:max-w-lg border border-border text-foreground"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {plan
              ? t("admin.billing.plan_edit_title", "Ubah Paket")
              : t("admin.billing.plan_add_title", "Tambah Paket")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t(
              "admin.billing.plan_dialog_desc",
              "Atur harga dan benefit paket langganan (EN + ID).",
            )}
          </DialogDescription>
        </DialogHeader>
        <PlanForm
          key={plan?.slug ?? "new"}
          plan={plan ?? null}
          onClose={() => setOpen(false)}
          saving={saving}
          setSaving={setSaving}
        />
      </DialogContent>
    </Dialog>
  );
}
