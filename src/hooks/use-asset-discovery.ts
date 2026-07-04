import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/services/supabase/client";

interface DiscoveryResult {
  ok?: boolean;
  added?: number;
  reactivated?: number;
  pruned?: number;
  skipped?: string;
}

/**
 * Manually trigger the asset-discovery edge function ("Discover Now"). Sends
 * `{ force: true }` to bypass the once-per-day gate (admin-gated server-side),
 * then invalidates the assets/settings/screener caches so freshly added
 * symbols show up. Pause is still respected server-side (returns
 * `skipped: "disabled"`); the UI also disables the button when off. Mirrors
 * [[use-market-scan]].
 */
export function useAssetDiscovery() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDiscovering, setIsDiscovering] = useState(false);

  const runDiscovery = useCallback(async () => {
    setIsDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke<DiscoveryResult>(
        "asset-discovery",
        { body: { force: true } },
      );
      if (error) throw error;

      // Safety net: server still honors pause even if the button slipped through.
      if (data?.skipped === "disabled") {
        toast.error(t("admin.discover_paused_hint"));
        return;
      }

      // Surface the new universe rows across the admin table + screener.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["journal-assets"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["screener-universe"] }),
      ]);

      toast.success(
        t("admin.discover_toast_success", {
          added: data?.added ?? 0,
          reactivated: data?.reactivated ?? 0,
          pruned: data?.pruned ?? 0,
        }),
      );
    } catch {
      toast.error(t("admin.discover_toast_error"));
    } finally {
      setIsDiscovering(false);
    }
  }, [queryClient, t]);

  return { runDiscovery, isDiscovering };
}
