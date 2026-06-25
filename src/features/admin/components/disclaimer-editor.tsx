/**
 * Admin editor for the risk-disclaimer clauses (bilingual, versioned). "Save"
 * edits in place; "Publish new version" bumps the version so every user is
 * re-prompted. Shows how many users accepted the current version. Keyed-form
 * pattern (drafts initialized straight from props).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/services/supabase/client";
import { useDisclaimer } from "@/hooks/use-disclaimer";
import type { DisclaimerRow } from "@/services/supabase/database.types";

const toList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

type ClausePatch = Partial<
  Pick<DisclaimerRow, "title" | "description" | "points" | "confirm_label" | "agree_label">
>;

interface EditorFormProps {
  clauses: DisclaimerRow;
  currentVersion: number;
  update: (patch: ClausePatch, bump?: boolean) => Promise<boolean>;
}

function EditorForm({ clauses, currentVersion, update }: EditorFormProps) {
  const { t } = useTranslation();
  const [titleEn, setTitleEn] = useState(clauses.title?.en ?? "");
  const [titleId, setTitleId] = useState(clauses.title?.id ?? "");
  const [descEn, setDescEn] = useState(clauses.description?.en ?? "");
  const [descId, setDescId] = useState(clauses.description?.id ?? "");
  const [pointsEn, setPointsEn] = useState((clauses.points?.en ?? []).join("\n"));
  const [pointsId, setPointsId] = useState((clauses.points?.id ?? []).join("\n"));
  const [confirmEn, setConfirmEn] = useState(clauses.confirm_label?.en ?? "");
  const [confirmId, setConfirmId] = useState(clauses.confirm_label?.id ?? "");
  const [agreeEn, setAgreeEn] = useState(clauses.agree_label?.en ?? "");
  const [agreeId, setAgreeId] = useState(clauses.agree_label?.id ?? "");
  const [saving, setSaving] = useState(false);

  // How many users accepted the live version (compliance readout).
  const { data: agreedCount } = useQuery({
    queryKey: ["disclaimer-agree-count", currentVersion],
    enabled: currentVersion > 0,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("disclaimer_agreements")
        .select("*", { count: "exact", head: true })
        .eq("version", currentVersion);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const buildPatch = (): ClausePatch => ({
    title: { en: titleEn.trim(), id: titleId.trim() },
    description: { en: descEn.trim(), id: descId.trim() },
    points: { en: toList(pointsEn), id: toList(pointsId) },
    confirm_label: { en: confirmEn.trim(), id: confirmId.trim() },
    agree_label: { en: agreeEn.trim(), id: agreeId.trim() },
  });

  const save = async (bump: boolean) => {
    setSaving(true);
    const ok = await update(buildPatch(), bump);
    setSaving(false);
    if (ok) {
      toast.success(
        bump
          ? t("admin.disclaimer.published", "Versi baru diterbitkan, semua user akan diminta setuju ulang")
          : t("admin.disclaimer.saved", "Disclaimer tersimpan"),
      );
    } else {
      toast.error(t("admin.disclaimer.save_error", "Gagal menyimpan disclaimer"));
    }
  };

  const bilingual = (
    label: string,
    en: string,
    setEn: (v: string) => void,
    id: string,
    setId: (v: string) => void,
    textarea?: boolean,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {textarea ? (
          <>
            <Textarea value={en} onChange={(e) => setEn(e.target.value)} placeholder="EN" className="text-sm min-h-28" />
            <Textarea value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="text-sm min-h-28" />
          </>
        ) : (
          <>
            <Input value={en} onChange={(e) => setEn(e.target.value)} placeholder="EN" className="text-sm" />
            <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="ID" className="text-sm" />
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground"
        >
          {t("admin.disclaimer.version", "Versi")} {currentVersion}
        </Badge>
        <Badge
          variant="outline"
          className="font-bold tracking-wider uppercase text-[10px] rounded-md bg-muted-foreground/15 border-muted-foreground/30 text-muted-foreground"
        >
          {agreedCount ?? 0} {t("admin.disclaimer.accepted", "menyetujui")}
        </Badge>
      </div>

      {bilingual(t("admin.disclaimer.title_label", "Judul"), titleEn, setTitleEn, titleId, setTitleId)}
      {bilingual(t("admin.disclaimer.desc_label", "Deskripsi"), descEn, setDescEn, descId, setDescId, true)}
      {bilingual(t("admin.disclaimer.points_label", "Poin (satu per baris)"), pointsEn, setPointsEn, pointsId, setPointsId, true)}
      {bilingual(t("admin.disclaimer.confirm_label", "Teks Centang"), confirmEn, setConfirmEn, confirmId, setConfirmId)}
      {bilingual(t("admin.disclaimer.agree_label", "Teks Tombol Setuju"), agreeEn, setAgreeEn, agreeId, setAgreeId)}

      <div className="flex items-center gap-2 border-t border-border/40 pt-4">
        <Button
          type="button"
          size="lg"
          variant="secondary"
          onClick={() => save(false)}
          disabled={saving}
          className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("admin.disclaimer.save_btn", "Simpan")}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" size="lg" disabled={saving} className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight">
              <Users className="h-3.5 w-3.5" />
              {t("admin.disclaimer.publish_btn", "Terbitkan Versi Baru")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-amber-500/10 text-amber-500">
                <Users />
              </AlertDialogMedia>
              <AlertDialogTitle>
                {t("admin.disclaimer.publish_confirm_title", "Terbitkan versi baru?")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.disclaimer.publish_confirm_desc", "Semua pengguna (login & anonim) akan diminta menyetujui ulang pada kunjungan berikutnya.")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel", "Batal")}</AlertDialogCancel>
              <AlertDialogAction onClick={() => save(true)}>
                {t("admin.disclaimer.publish_btn", "Terbitkan Versi Baru")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function DisclaimerEditor() {
  const { clauses, isLoading, currentVersion, update } = useDisclaimer();

  if (isLoading && !clauses) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }
  if (!clauses) return null;

  return (
    <EditorForm
      key={currentVersion}
      clauses={clauses}
      currentVersion={currentVersion}
      update={update}
    />
  );
}
