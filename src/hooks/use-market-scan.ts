import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/services/supabase/client";

interface ScanResult {
  ok?: boolean;
  emitted?: number;
  closed?: number;
  skipped?: string;
}

/**
 * Manually trigger the auto-journal edge function ("Scan Sekarang"). Sends
 * `{ force: true }` to bypass the cron due-gate (admin-gated server-side), then
 * invalidates the journal + screener caches so fresh signals show up. Pause is
 * still respected server-side (returns `skipped: "disabled"`); the UI also
 * disables the button when paused.
 */
export function useMarketScan() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  const runScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke<ScanResult>(
        "auto-journal",
        { body: { force: true } },
      );
      if (error) throw error;

      // Safety net: server still honors pause even if the button slipped through.
      if (data?.skipped === "disabled") {
        toast.error(t("admin.scan_paused_hint"));
        return;
      }

      // Surface the freshly-emitted / closed trades across the app.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["journal-trades"] }),
        queryClient.invalidateQueries({ queryKey: ["asset-data"] }),
      ]);

      toast.success(
        t("admin.scan_toast_success", {
          emitted: data?.emitted ?? 0,
          closed: data?.closed ?? 0,
        }),
      );
    } catch {
      toast.error(t("admin.scan_toast_error"));
    } finally {
      setIsScanning(false);
    }
  }, [queryClient, t]);

  return { runScan, isScanning };
}
