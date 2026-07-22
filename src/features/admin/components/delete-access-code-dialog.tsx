import { useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
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
import { ActionButtonContent } from "@/components/shared/action-button-content";
import type { AccessCodeRow } from "@/services/supabase/database.types";
import { toast } from "sonner";

interface DeleteAccessCodeDialogProps {
  code: AccessCodeRow;
  onDelete: (code: string) => Promise<boolean>;
}

export function DeleteAccessCodeDialog({
  code,
  onDelete,
}: DeleteAccessCodeDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (): Promise<boolean> => {
    const success = await onDelete(code.code);
    if (success) {
      toast.success(t("toasts.access_code.delete_success"));
    } else {
      toast.error(t("toasts.access_code.delete_error"));
    }
    return success;
  };
  const handleAction = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (await handleDelete()) setOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isDeleting) setOpen(nextOpen);
      }}
    >
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
          <AlertDialogCancel disabled={isDeleting}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleAction}
            disabled={isDeleting}
            aria-busy={isDeleting}
          >
            <ActionButtonContent
              label={t("common.actions.delete")}
              pending={isDeleting}
            />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
