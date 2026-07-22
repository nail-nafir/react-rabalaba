import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldContent,
  FieldTitle,
} from "@/components/ui/field";
import { useDisclaimer } from "@/hooks/use-disclaimer";
import { pickLocale } from "@/lib/localized";
import { toast } from "sonner";

/**
 * First-touch risk gate. Clauses are server-truth (DB, bilingual + versioned);
 * acceptance is hybrid — recorded in `disclaimer_agreements` for logged-in users
 * and localStorage for anonymous ones (see [[use-disclaimer]]). Shows whenever
 * the visitor is behind the current clause version.
 */
export function DisclaimerDialog() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { clauses, needsAgreement, agree, hasLoadError, retry } =
    useDisclaimer();
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  const handleAgree = async () => {
    if (!hasConfirmed || saving) return;
    setSaving(true);
    try {
      await agree();
      toast.success(t("toasts.disclaimer.accept_success"));
    } catch {
      toast.error(t("toasts.disclaimer.accept_error"));
    } finally {
      setSaving(false);
    }
  };

  const points = (pickLocale(clauses?.points, lang, []) as string[]) ?? [];

  if (hasLoadError) {
    return (
      <Card className="mx-auto w-full sm:max-w-md border border-border text-foreground">
        <CardHeader>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex size-16 items-center justify-center rounded-md bg-amber-500/10">
              <AlertTriangle className="size-8 text-amber-500" />
            </div>
            <CardTitle className="text-lg font-bold text-foreground">
              {t("disclaimer.load_error_title")}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed text-muted-foreground">
              {t("disclaimer.load_error_description")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardFooter>
          <Button
            type="button"
            size="lg"
            disabled={retrying}
            onClick={() => void handleRetry()}
            className="min-h-11 w-full text-xs font-bold"
          >
            {t("common.retry")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!needsAgreement) return null;

  return (
    <Card className="mx-auto w-full sm:max-w-md border border-border text-foreground">
      <CardHeader>
        <div className="flex flex-col items-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md bg-amber-500/10 mb-2 transition-all duration-500">
            <AlertTriangle className="h-8 w-8 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
          </div>
          <CardTitle className="text-lg font-bold text-foreground text-center">
            {pickLocale(clauses?.title, lang, "") as string}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <CardDescription className="text-xs text-muted-foreground leading-relaxed mt-1">
          {pickLocale(clauses?.description, lang, "") as string}
        </CardDescription>

        <ul className="space-y-3 px-1">
          {points.map((point, i) => (
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
                  {(pickLocale(clauses?.confirm_label, lang) as string) ??
                    t("disclaimer.confirm")}
                </FieldTitle>
              </FieldContent>
            </Field>
          </FieldLabel>
        </FieldGroup>
      </CardContent>

      <CardFooter>
        <Button
          type="button"
          size="lg"
          disabled={!hasConfirmed || saving}
          onClick={handleAgree}
          className="text-xs font-bold cursor-pointer shrink-0 w-full"
        >
          <Check data-icon="inline-start" className="h-3.5 w-3.5" />
          {(pickLocale(clauses?.agree_label, lang) as string) ??
            t("disclaimer.agree")}
        </Button>
      </CardFooter>
    </Card>
  );
}
