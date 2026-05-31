import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Crosshair, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Button variant="outline" size="sm" disabled>
        <Check /> {t("journal.following")}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (follow(asset)) {
          toast(t("journal.followed_toast", { symbol: asset.symbol }), {
            description: t("journal.followed_toast_desc"),
            duration: Infinity,
            closeButton: true,
            action: {
              label: t("journal.followed_toast_action"),
              onClick: () => {
                setTerminalView("journal");
                closeDetailDialog();
              },
            },
          });
        }
      }}
    >
      <Crosshair /> {t("journal.follow")}
    </Button>
  );
}
