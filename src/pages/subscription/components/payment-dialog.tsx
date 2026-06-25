import { useTranslation } from "react-i18next";
import { Send, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { pickLocale } from "@/lib/localized";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { methods, isLoading } = usePaymentMethods();

  // Channels are admin-editable; the beneficiary follows the rows (all share one).
  const active = methods.filter((m) => m.active);
  const beneficiary = active.find((m) => m.account_name)?.account_name ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                      <p className="text-[11px] font-mono font-mono-data text-foreground/80 break-all select-all">
                        {value}
                      </p>
                    </div>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(value);
                        toast.success(t("payment.dialog.copied"), {
                          description: `${item.name}: ${value}`,
                        });
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
          <Button
            asChild
            type="button"
            size="lg"
            className="w-full text-xs font-bold cursor-pointer"
          >
            <a
              href="https://t.me/nailnafir"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t("payment.dialog.confirm_btn")}</span>
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
