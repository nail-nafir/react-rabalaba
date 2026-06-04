import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Crosshair, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFollowStore } from "@/store/follow-store";
import { useUIStore } from "@/store/ui-store";
import type { UnifiedAsset } from "@/types/asset";

export function FollowSignalButton({ asset }: { asset: UnifiedAsset }) {
  const { t } = useTranslation();
  const follow = useFollowStore((s) => s.follow);
  const setTerminalView = useUIStore((s) => s.setTerminalView);
  const closeDetailDialog = useUIStore((s) => s.closeDetailDialog);
  const isOpen = useFollowStore((s) =>
    s.openTrades.some((tr) => tr.symbol === asset.symbol),
  );

  const signal = asset.outlook?.signal;
  if (!asset.tradingPlan || (signal !== "long" && signal !== "short")) {
    return null;
  }

  if (isOpen) {
    return (
      <Button
        size="lg"
        disabled
        className="text-xs font-bold transition-all cursor-pointer shrink-0 tracking-tight"
      >
        <Check className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("journal.following")}</span>
      </Button>
    );
  }

  return (
    <Button
      size="lg"
      className="text-xs font-bold transition-all cursor-pointer shrink-0 tracking-tight"
      onClick={() => {
        if (follow(asset)) {
          const id = toast(
            t("journal.followed_toast", { symbol: asset.symbol }),
            {
              description: t("journal.followed_toast_desc"),
              duration: Infinity,
              closeButton: true,
              action: (
                <Button
                  size="lg"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "text-xs font-bold transition-all cursor-pointer shrink-0 tracking-tight",
                  )}
                  onClick={() => {
                    toast.dismiss(id);
                    setTerminalView("journal");
                    closeDetailDialog();
                  }}
                >
                  {t("journal.followed_toast_action")}
                </Button>
              ),
            },
          );
        }
      }}
    >
      <Crosshair className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{t("journal.follow")}</span>
    </Button>
  );
}
