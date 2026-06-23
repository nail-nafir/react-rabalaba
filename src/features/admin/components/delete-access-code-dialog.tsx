import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import type { AccessCodeRow } from "@/services/supabase/database.types";

interface DeleteAccessCodeDialogProps {
  code: AccessCodeRow;
  onDelete: (code: string) => Promise<boolean>;
}

export function DeleteAccessCodeDialog({
  code,
  onDelete,
}: DeleteAccessCodeDialogProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete(code.code);
    setIsDeleting(false);
    if (success) {
      toast.success(
        t("admin.codes_delete_success", {
          defaultValue: `Berhasil menghapus kode akses ${code.code}`,
        }),
      );
    } else {
      toast.error(
        t("admin.codes_delete_error", {
          defaultValue: `Gagal menghapus kode akses ${code.code}`,
        }),
      );
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="link"
          size="icon"
          aria-label={t("admin.codes_delete_confirm_title", {
            code: code.code,
          })}
          className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-destructive hover:bg-muted cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {t("admin.codes_delete_confirm_title", {
              defaultValue: "Hapus Kode Akses?",
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.codes_delete_confirm_desc", {
              code: code.code,
              defaultValue: `Apakah Anda yakin ingin menghapus kode akses ${code.code}? Pengguna yang menggunakan kode ini tetap terdaftar, namun kode ini tidak dapat digunakan lagi.`,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              t("admin.delete_btn", "Hapus")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
