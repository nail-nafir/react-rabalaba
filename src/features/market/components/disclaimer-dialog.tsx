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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldTitle,
} from "@/components/ui/field";

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
        className="sm:max-w-md border border-border text-foreground"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex flex-col items-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-amber-500/10 mb-2 transition-all duration-500">
              <AlertTriangle className="h-8 w-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground text-center">
              {t("disclaimer.title")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {t("disclaimer.description")}
        </DialogDescription>

        <ul className="space-y-3 px-1">
          {(t("disclaimer.points", { returnObjects: true }) as string[]).map(
            (point, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-xs text-muted-foreground leading-snug group/item"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span className="transition-colors group-hover/item:text-foreground">
                  {point}
                </span>
              </li>
            ),
          )}
        </ul>

        <FieldGroup>
          <FieldLabel htmlFor="disclaimer-confirm">
            <Field orientation="horizontal">
              <Checkbox
                id="disclaimer-confirm"
                checked={hasConfirmed}
                onCheckedChange={(v) => setHasConfirmed(v === true)}
              />
              <FieldContent>
                <FieldTitle className="text-xs font-semibold">
                  {t("disclaimer.confirm")}
                </FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            size="lg"
            disabled={!hasConfirmed}
            onClick={handleAgreeDisclaimer}
            className="text-xs font-bold cursor-pointer shrink-0 w-full"
          >
            {t("disclaimer.agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
