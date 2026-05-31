import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DisclaimerDialog() {
  const { t } = useTranslation();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    const agreed = localStorage.getItem("rabalaba_disclaimer_agreed");
    if (!agreed) {
      const timer = setTimeout(() => {
        setShowDisclaimer(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAgreeDisclaimer = () => {
    if (!hasConfirmed) return;
    localStorage.setItem("rabalaba_disclaimer_agreed", "true");
    setShowDisclaimer(false);
    toast.success(t("disclaimer.toast_success"));
  };

  return (
    <Dialog
      open={showDisclaimer}
      onOpenChange={(open) => {
        if (open) setShowDisclaimer(true);
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-border"
        showCloseButton={false}
      >
        <div className="p-6">
          <DialogHeader className="flex flex-col items-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-amber-500/10 mb-4 ransition-all duration-500">
              <AlertTriangle className="h-8 w-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
            </div>
            <DialogTitle className="text-center text-xl font-bold tracking-tight text-foreground">
              {t("disclaimer.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-6">
            <DialogDescription className="text-xs font-medium text-foreground text-center bg-muted/30 p-3 rounded-lg border border-border/50">
              {t("disclaimer.description")}
            </DialogDescription>
            <ul className="space-y-3 px-1">
              {(
                t("disclaimer.points", { returnObjects: true }) as string[]
              ).map((point, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-xs text-muted-foreground leading-snug group/item"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <span className="transition-colors group-hover/item:text-foreground">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8">
            <label className="flex items-center gap-3 cursor-pointer group select-none p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-all active:scale-[0.98]">
              <div className="relative flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={hasConfirmed}
                  onChange={(e) => setHasConfirmed(e.target.checked)}
                  className="peer h-5 w-5 appearance-none rounded-md border border-border/50 bg-background transition-all checked:bg-primary checked:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <svg
                  className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                {t("disclaimer.confirm")}
              </span>
            </label>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 flex flex-col sm:flex-row gap-3 m-0 rounded-none">
          <Button
            disabled={!hasConfirmed}
            className="w-full font-bold h-9 text-xs transition-all duration-300 disabled:opacity-50 disabled:grayscale-[0.5] bg-primary hover:bg-primary/90 text-primary-foreground border-none cursor-pointer"
            onClick={handleAgreeDisclaimer}
          >
            {t("disclaimer.agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
