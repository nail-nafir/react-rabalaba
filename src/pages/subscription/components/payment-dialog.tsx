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
import { toast } from "sonner";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
  const { t } = useTranslation();

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
          <div className="p-3 bg-muted/40 border border-border/80 rounded-xl flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
              {t("payment.dialog.beneficiary")}
            </span>
            <span className="text-xs font-bold text-foreground">
              Nailul Firdaus
            </span>
          </div>

          {/* List of Payment Methods */}
          <div className="space-y-2 max-h-62.5 overflow-y-auto pr-1">
            {[
              { name: "BCA", value: "3450927189" },
              { name: "BNI", value: "1868303386" },
              { name: "SEABANK", value: "901623541860" },
              { name: "JAGO", value: "109072419650" },
              {
                name: "E-Wallet",
                desc: "ShopeePay, GoPay, DANA, OVO, LinkAja",
                value: "081288070110",
              },
              {
                name: "BEP20 (USDT)",
                desc: "Jaringan BNB Smart Chain",
                value: "0x02319a99c28794b9400f0598d7581575ccb5236f",
              },
            ].map((item) => (
              <div
                key={item.name}
                className="group relative overflow-hidden border border-border hover:border-primary/50 hover:bg-muted/20 p-3 rounded-xl flex items-center justify-between gap-3 transition-all duration-200"
              >
                <div className="min-w-0 space-y-0.5">
                  <span className="text-xs font-bold text-foreground tracking-wide">
                    {item.name}
                  </span>
                  {item.desc && (
                    <p className="text-[10px] text-muted-foreground truncate leading-relaxed">
                      {item.desc}
                    </p>
                  )}
                  <p className="text-[11px] font-mono font-mono-data text-foreground/80 break-all select-all">
                    {item.value}
                  </p>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(item.value);
                    toast.success(t("payment.dialog.copied"), {
                      description: `${item.name}: ${item.value}`,
                    });
                  }}
                  className="shrink-0 h-7 w-7 rounded-lg hover:bg-muted border border-transparent hover:border-border cursor-pointer transition-all active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
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
