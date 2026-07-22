import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { pickLocale } from "@/lib/localized";
import { toast } from "sonner";
import type { ReactElement } from "react";
import { ActionButtonContent } from "@/components/shared/action-button-content";

interface PaymentDialogProps {
  trigger: ReactElement;
}

export function PaymentDialog({ trigger }: PaymentDialogProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { methods, isLoading } = usePaymentMethods();

  // Channels are admin-editable; the beneficiary follows the rows (all share one).
  const active = methods.filter((m) => m.active);
  const beneficiary = active.find((m) => m.account_name)?.account_name ?? "";

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md border border-border text-foreground max-w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("payment.dialog.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
            {t("payment.dialog.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {/* Beneficiary Header Card */}
          {beneficiary && (
            <div className="p-3 bg-muted/40 border border-border/80 rounded-xl flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                {t("payment.dialog.beneficiary")}
              </span>
              <span className="text-xs font-bold text-foreground">
                {beneficiary}
              </span>
            </div>
          )}

          {/* List of Payment Methods (admin-managed) */}
          <div className="space-y-2 max-h-62.5 overflow-y-auto pr-1">
            {isLoading && active.length === 0 ? (
              <div className="flex h-24 items-center justify-center">
                <Spinner className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              active.map((item) => {
                const desc = pickLocale(item.note, lang) as string | undefined;
                const value = item.account_no ?? "";
                return (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden border border-border hover:border-primary/50 hover:bg-muted/20 p-3 rounded-xl flex items-center justify-between gap-3 transition-all duration-200"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-xs font-bold text-foreground tracking-wide">
                        {item.name}
                      </span>
                      {desc && (
                        <p className="text-[10px] text-muted-foreground truncate leading-relaxed">
                          {desc}
                        </p>
                      )}
                      <p className="text-[11px] text-foreground/80 break-all select-all">
                        {value}
                      </p>
                    </div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(value);
                        toast.success(t("toasts.payment.details_copied"));
                      }}
                      className="shrink-0 h-7 w-7 rounded-lg hover:bg-muted border border-transparent hover:border-border cursor-pointer transition-all active:scale-95"
                    >
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button asChild size="lg" className="w-full">
              <a
                href="https://t.me/nailnafir"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  toast.success(t("toasts.payment.contact_opened"))
                }
              >
                <ActionButtonContent label={t("common.actions.confirm")} />
              </a>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
