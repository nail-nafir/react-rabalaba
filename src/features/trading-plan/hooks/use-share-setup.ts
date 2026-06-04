import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { buildTradeSetupModel } from "@/features/trading-plan/lib/trade-setup-model";
import {
  buildShareCardSvg,
  svgToPngBlob,
  shareOrDownloadPng,
  SHARE_CARD_SIZE,
} from "@/features/trading-plan/lib/share-card";
import type { TradingPlan, AssetType, SignalDirection } from "@/types/asset";
import type { NormalizedYahooCandle } from "@/services/adapters/yahoo-candles";

interface ShareSetupOptions {
  symbol: string;
  name: string;
  signal: SignalDirection;
  strength: number;
  currentPrice: number;
  assetType: AssetType;
  candles: NormalizedYahooCandle[];
  tradingPlan: TradingPlan | null;
  isPosition?: boolean;
  entryPrice?: number;
  pnlPct?: number;
  pnlR?: number;
}

export function useShareSetup() {
  const { t, i18n } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);

  const shareSetup = async (options: ShareSetupOptions) => {
    const {
      symbol,
      name,
      signal,
      strength,
      currentPrice,
      assetType,
      candles,
      tradingPlan,
      isPosition = false,
      entryPrice,
      pnlPct,
      pnlR,
    } = options;

    if (!tradingPlan || !symbol) return;
    setIsSharing(true);
    try {
      const model = buildTradeSetupModel(
        candles,
        tradingPlan,
        signal,
        currentPrice,
      );
      const svg = buildShareCardSvg(model, {
        symbol,
        name,
        strength,
        currentPrice,
        assetType,
        candles,
        isPosition,
        entryPrice,
        pnlPct,
        pnlR,
        locale: i18n.language,
      });
      const blob = await svgToPngBlob(
        svg,
        SHARE_CARD_SIZE.width,
        SHARE_CARD_SIZE.height,
      );
      const filename = isPosition ? `${symbol}-position.png` : `${symbol}-setup.png`;
      const result = await shareOrDownloadPng(blob, filename);

      const successKey = isPosition
        ? (result === "shared" ? "dialog.shared_position" : "dialog.downloaded_position")
        : (result === "shared" ? "dialog.shared_signal" : "dialog.downloaded_signal");

      toast.success(t(successKey));
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const errorKey = isPosition ? "dialog.share_failed_position" : "dialog.share_failed_signal";
        toast.error(t(errorKey));
      }
    } finally {
      setIsSharing(false);
    }
  };

  return { isSharing, shareSetup };
}
