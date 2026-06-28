import { Crown, Hourglass, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePremiumAccess, type LicenseTier } from "@/hooks/use-premium-access";
import { useUIActions } from "@/store/hooks";
import { cn } from "@/lib/utils";

const TIER_ICONS: Record<LicenseTier, React.ElementType> = {
  free: Lock,
  trial: Hourglass,
  premium: Crown,
};

const TIER_STYLES: Record<LicenseTier, string> = {
  free: "text-muted-foreground",
  trial:
    "border-amber-500/50! bg-amber-500/10! text-amber-600 dark:text-amber-400 hover:bg-amber-500/20!",
  premium:
    "border-primary/50! bg-primary/10! text-primary hover:bg-primary/20!",
};

export function LicenseBadge() {
  const { t } = useTranslation();
  const { tier, daysLeft, isConfigured, isResolving } = usePremiumAccess();
  const { openLicenseDialog } = useUIActions();

  if (!isConfigured) return null;

  // While the entitlement is still resolving, show a placeholder instead of the
  // default 'free' badge — otherwise it flashes 'free' then snaps to 'premium'.
  if (isResolving) {
    return <Skeleton className="h-8 w-22 rounded-md" />;
  }

  const Icon = TIER_ICONS[tier];
  const tierLabel = t(`license.tier_${tier}`);
  const label =
    tier === "trial"
      ? `${tierLabel} · ${t("license.badge_trial_days", { count: daysLeft ?? 0 })}`
      : tierLabel;
  const ariaLabel =
    tier === "trial"
      ? `${t("license.badge_label")}: ${t("license.status_trial", { count: daysLeft ?? 0 })}`
      : `${t("license.badge_label")}: ${tierLabel}`;

  return (
    <Button
      variant="ghost"
      onClick={() => openLicenseDialog()}
      aria-label={ariaLabel}
      className={cn(
        "flex justify-center border border-accent-foreground/20! py-4! bg-card! hover:bg-accent! cursor-pointer",
        TIER_STYLES[tier],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        {label}
      </span>
    </Button>
  );
}
