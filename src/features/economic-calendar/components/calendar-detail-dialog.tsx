import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { getEmojiFlag } from "@/lib/country";
import { IMPACT_LEVELS } from "@/constants/calendar";
import { Activity, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import type { CalendarEvent } from "@/types/calendar";

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className="text-xs font-bold text-mono-data text-foreground">
        {value}
      </span>
    </div>
  );
}

interface CalendarDetailDialogProps {
  event: CalendarEvent | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarDetailDialog({
  event,
  open,
  onOpenChange,
}: CalendarDetailDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto border border-border text-foreground">
        {!event ? (
          <EmptyState
            title={t("calendar.no_events")}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                {event.title}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] rounded-md font-bold uppercase tracking-wider"
                >
                  {getEmojiFlag(event.country)} {event.country}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] rounded-md font-bold uppercase tracking-wider",
                    IMPACT_LEVELS[event.impact].badge,
                  )}
                >
                  {t(IMPACT_LEVELS[event.impact].labelKey)}
                </Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col space-y-6">
              <Separator />

              <Card className="border border-border bg-muted/50 overflow-hidden">
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
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

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">
                    {t("calendar.detail.market_context")}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed italic border-l border-primary pl-3 ml-1.5">
                  "{event.description}"
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
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
                      className="rounded-md text-[10px] font-bold uppercase tracking-wider"
                    >
                      {asset}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
