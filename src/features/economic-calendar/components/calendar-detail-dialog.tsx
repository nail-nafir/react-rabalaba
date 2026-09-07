import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getEmojiFlag } from "@/lib/country";
import { IMPACT_LEVELS } from "@/constants/calendar";
import { BADGE } from "@/constants/taxonomy/palette";
import { Activity, CalendarDays, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CalendarEvent } from "@/types/calendar";
import type { ReactElement } from "react";

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className="text-xs font-bold text-foreground">
        {value}
      </span>
    </div>
  );
}

interface CalendarDetailDialogProps {
  event: CalendarEvent;
  trigger: ReactElement;
}

export function CalendarDetailDialog({
  event,
  trigger,
}: CalendarDetailDialogProps) {
  const { t } = useTranslation();
  const impactBadge = {
    high: BADGE.negative,
    medium: BADGE.warning,
    low: BADGE.positive,
  }[event.impact];

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2 flex-wrap pr-6">
            {event.title}
          </DialogTitle>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                BADGE.neutral.bg,
                BADGE.neutral.text,
                BADGE.neutral.border,
              )}
            >
              {getEmojiFlag(event.country)} {event.country}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "font-bold uppercase tracking-wider text-[10px] rounded-md",
                impactBadge.bg,
                impactBadge.text,
                impactBadge.border,
              )}
            >
              {t(IMPACT_LEVELS[event.impact].labelKey)}
            </Badge>
          </div>

          <Separator className="mt-4" />
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("calendar.detail.event_details")}
              </h3>
            </div>
            <Card className="border border-border bg-muted/50">
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <DetailBox
                  label={t("calendar.detail.date")}
                  value={event.date}
                />
                <DetailBox
                  label={t("calendar.detail.time")}
                  value={event.time}
                />
                <DetailBox
                  label={t("calendar.detail.actual")}
                  value={event.actual || "N/A"}
                />
                <DetailBox
                  label={t("calendar.detail.forecast")}
                  value={event.forecast || "N/A"}
                />
                <DetailBox
                  label={t("calendar.detail.previous")}
                  value={event.previous || "N/A"}
                />
              </CardContent>
            </Card>
          </div>

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
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed italic">
                  "{event.description}"
                </DialogDescription>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t("calendar.detail.asset_correlation")}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {event.assetRelevance.map((asset) => (
                <Badge
                  variant="outline"
                  key={asset}
                  className={cn(
                    "font-bold uppercase tracking-wider text-[10px] rounded-md",
                    BADGE.neutral.bg,
                    BADGE.neutral.text,
                    BADGE.neutral.border,
                  )}
                >
                  {asset}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
