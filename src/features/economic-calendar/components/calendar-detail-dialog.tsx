import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getCountryName,
  getCurrencyCode,
  getCurrencyName,
} from "@/lib/country";
import { CountryFlag } from "@/components/shared/country-flag";
import { IMPACT_LEVELS } from "@/constants/calendar";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import {
  AlertTriangle,
  Info,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActionButtonContent } from "@/components/shared/action-button-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { CalendarEvent } from "@/types/calendar";

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";

interface CalendarDetailDialogProps {
  event: CalendarEvent;
  trigger: ReactElement;
}

export function CalendarDetailDialog({
  event,
  trigger,
}: CalendarDetailDialogProps) {
  const { t, i18n } = useTranslation();

  const handleCopyDetails = () => {
    const text = [
      `📅 ${event.title} (${event.country})`,
      `⏰ ${event.date} • ${event.time}`,
      `📊 Aktual: ${event.actual || "N/A"} | Prediksi: ${event.forecast || "N/A"} | Sebelumnya: ${event.previous || "N/A"}`,
      `⚡ Dampak: ${event.impact.toUpperCase()}`,
      event.description ? `📝 ${event.description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text);
    toast.success(t("calendar.copied_toast"));
  };

  const formattedDate = new Date(event.date).toLocaleDateString(
    i18n.language === "id" ? "id-ID" : "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );

  const deviation = (() => {
    if (!event.actual || event.actual === "N/A" || event.actual === "—")
      return "neutral";
    const benchmark =
      event.forecast && event.forecast !== "N/A" && event.forecast !== "—"
        ? event.forecast
        : event.previous;
    if (!benchmark || benchmark === "N/A" || benchmark === "—")
      return "neutral";

    const actNum = parseFloat(event.actual.replace(/[^0-9.-]+/g, ""));
    const benchNum = parseFloat(benchmark.replace(/[^0-9.-]+/g, ""));
    if (isNaN(actNum) || isNaN(benchNum) || actNum === benchNum)
      return "neutral";
    return actNum > benchNum ? "beat" : "miss";
  })();

  const impactBadge =
    event.impact === "high"
      ? BADGE.negative
      : event.impact === "medium"
        ? BADGE.warning
        : BADGE.positive;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header styled identically to education detail dialogs */}
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2 flex-wrap pr-6">
            <span>{event.title}</span>
            <Badge
              variant="outline"
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                impactBadge.bg,
                impactBadge.text,
                impactBadge.border,
              )}
            >
              {t(IMPACT_LEVELS[event.impact].labelKey)}
            </Badge>
          </DialogTitle>

          <div className="space-y-0.5 mt-1">
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {formattedDate} • {event.time}
            </DialogDescription>
          </div>

          {/* Meta badges */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
                "px-1.5 py-0.5",
              )}
            >
              <CountryFlag
                countryCode={event.country}
                className="w-4 h-2.5 rounded-[1px]"
              />
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {getCountryName(event.country, i18n.language)}
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                COMPACT_SIGNAL_BADGE_CLASSNAME,
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {getCurrencyName(getCurrencyCode(event.country), i18n.language)}
            </Badge>
          </div>

          <Separator className="mt-4" />
        </DialogHeader>

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          {/* Section: Historical Comparison */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("calendar.historical_comparison")}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Actual */}
              <Card
                className={cn(
                  "border",
                  deviation === "beat"
                    ? cn(BADGE.positive.border, BADGE.positive.bg)
                    : deviation === "miss"
                      ? cn(BADGE.negative.border, BADGE.negative.bg)
                      : "border-border bg-muted/50",
                )}
              >
                <CardContent className="space-y-1">
                  <CardTitle
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      deviation === "beat"
                        ? PALETTE.positive.text
                        : deviation === "miss"
                          ? PALETTE.negative.text
                          : "text-foreground",
                    )}
                  >
                    {t("calendar.actual")}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-base font-bold">
                    <span>
                      {event.actual && event.actual !== "N/A"
                        ? event.actual
                        : "—"}
                    </span>
                    {deviation === "beat" && (
                      <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                    )}
                    {deviation === "miss" && (
                      <TrendingDown className="h-4 w-4 text-rose-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {event.actual && event.actual !== "N/A"
                      ? deviation === "beat"
                        ? "Beat (Diatas konsensus)"
                        : deviation === "miss"
                          ? "Miss (Dibawah konsensus)"
                          : t("calendar.scheduled_event")
                      : "Belum rilis"}
                  </p>
                </CardContent>
              </Card>

              {/* Forecast */}
              <Card className="border border-border bg-muted/50">
                <CardContent className="space-y-1">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("calendar.forecast")}
                  </CardTitle>
                  <p className="text-base font-semibold text-foreground/90 leading-snug">
                    {event.forecast && event.forecast !== "N/A"
                      ? event.forecast
                      : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Konsensus pasar
                  </p>
                </CardContent>
              </Card>

              {/* Previous */}
              <Card className="border border-border bg-muted/50">
                <CardContent className="space-y-1">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {t("calendar.previous")}
                  </CardTitle>
                  <p className="text-base font-semibold text-foreground/90 leading-snug">
                    {event.previous && event.previous !== "N/A"
                      ? event.previous
                      : "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Periode lalu
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          {/* Section: Market Volatility Guidance */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("calendar.market_volatility")}
              </h3>
            </div>

            <Card
              className={cn(
                "border",
                event.impact === "high"
                  ? cn(BADGE.negative.border, BADGE.negative.bg)
                  : event.impact === "medium"
                    ? cn(BADGE.warning.border, BADGE.warning.bg)
                    : cn(BADGE.neutral.border, BADGE.neutral.bg),
              )}
            >
              <CardContent className="space-y-1">
                <CardTitle
                  className={cn(
                    "font-bold uppercase tracking-wider text-xs",
                    event.impact === "high"
                      ? PALETTE.negative.text
                      : event.impact === "medium"
                        ? PALETTE.warning.text
                        : "text-foreground",
                  )}
                >
                  {event.impact === "high"
                    ? "High Volatility Alert"
                    : event.impact === "medium"
                      ? "Moderate Volatility"
                      : "Low Impact Event"}
                </CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {event.impact === "high"
                    ? t("calendar.volatility_high")
                    : event.impact === "medium"
                      ? t("calendar.volatility_medium")
                      : t("calendar.volatility_low")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Section: Market Context */}
          {event.description && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t("calendar.detail.market_context")}
                  </h3>
                </div>

                <Card className="border border-border bg-muted/50">
                  <CardContent>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {event.description}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Section: Cross-Asset Correlation */}
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("calendar.detail.asset_correlation")}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {event.assetRelevance.map((asset) => (
                <Badge
                  key={asset}
                  variant="outline"
                  className={cn(
                    COMPACT_SIGNAL_BADGE_CLASSNAME,
                    BADGE.neutral.bg,
                    BADGE.neutral.text,
                    BADGE.neutral.border,
                  )}
                >
                  {t(`calendar.asset.${asset}`, asset)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="m-0 shrink-0">
          <Button
            type="button"
            onClick={handleCopyDetails}
            size="lg"
          >
            <ActionButtonContent
              label={t("calendar.copy_info")}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
