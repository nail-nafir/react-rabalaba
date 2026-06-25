import { useState } from "react";
import { useTranslation } from "react-i18next";
import { InvitationsTable } from "@/features/admin/components/invitations-table";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddInvitationDialog } from "@/features/admin/components/add-invitation-dialog";

export default function AdminInvitationsPage() {
  const { t } = useTranslation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground uppercase">
          {t("admin.invitations.page_title", "Undangan")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.invitations.page_desc", "Buat dan kelola link undangan premium/trial untuk calon member.")}
        </p>
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("admin.invitations.list_subtitle", "Daftar Undangan")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("admin.invitations.list_desc", "Daftar kode undangan aktif beserta informasi pemakaian dan status aksesnya.") || "Daftar kode undangan aktif beserta informasi pemakaian dan status aksesnya."}
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => setIsAddDialogOpen(true)}
            className="font-bold transition-all text-xs cursor-pointer items-center gap-1.5 tracking-tight shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("admin.invitations.add_btn", "Buat Undangan")}</span>
          </Button>
        </div>
        <div className="w-full">
          <InvitationsTable />
        </div>
      </div>

      <AddInvitationDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        origin={origin}
      />
    </div>
  );
}
