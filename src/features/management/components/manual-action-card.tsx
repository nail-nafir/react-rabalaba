import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shared "manual trigger" card: title/desc + action button, last-run badge in
 *  the footer. One per tab, so each tab owns exactly one primary action. */
export function ManualActionCard({
  title,
  desc,
  icon,
  buttonLabel,
  loadingLabel,
  onRun,
  running,
  disabled,
  disabledHint,
  lastRunTitle,
  lastRunValue,
  badgeClassName,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  buttonLabel: string;
  loadingLabel: string;
  onRun: () => void;
  running: boolean;
  disabled: boolean;
  disabledHint?: string;
  lastRunTitle: string;
  lastRunValue: string;
  badgeClassName: string;
}) {
  return (
    <Card className="w-full border border-border shadow-xs bg-muted/50">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-foreground uppercase tracking-wider">
              {title}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-52">
              {desc}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRun}
            disabled={disabled || running}
            title={disabled ? disabledHint : undefined}
            className="text-[10px] font-bold h-8 cursor-pointer shrink-0 gap-1.5"
          >
            {running ? <Loader2 className="size-3.5 animate-spin" /> : icon}
            <span>{running ? loadingLabel : buttonLabel}</span>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 px-4 py-2.5">
        <span>{lastRunTitle}</span>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold rounded-md py-0.5 px-2",
            badgeClassName,
          )}
        >
          {lastRunValue}
        </Badge>
      </CardFooter>
    </Card>
  );
}
