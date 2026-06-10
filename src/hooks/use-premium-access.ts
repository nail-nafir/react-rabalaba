import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import {
  encodeTrialStamp,
  decodeTrialStamp,
  isTrialActive,
  trialExpiresAt,
  trialDaysLeft,
  parseTrialDuration,
} from "@/lib/premium-trial";

const ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY;
const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE;
const TRIAL_CODE = import.meta.env.VITE_TRIAL_CODE;
const TRIAL_STORE_KEY = ACCESS_KEY ? `${ACCESS_KEY}_trial` : null;
const TRIAL_NOTIFIED_KEY = ACCESS_KEY ? `${ACCESS_KEY}_trial_notified` : null;

// Trial length comes entirely from env; an unset/invalid value disables trials.
const TRIAL_DURATION_MS = parseTrialDuration(
  import.meta.env.VITE_TRIAL_DURATION,
);
const TRIAL_ENABLED = !!(TRIAL_CODE && TRIAL_STORE_KEY && TRIAL_DURATION_MS);

export type AccessResult = "granted" | "trial" | "expired" | "invalid";

export type LicenseTier = "free" | "trial" | "premium";

export interface LicenseStatus {
  tier: LicenseTier;
  hasAccess: boolean;
  expiresAt: number | null;
}

const readPermanent = (): boolean => {
  if (!ACCESS_KEY || !ACCESS_CODE) return false;
  const stored = localStorage.getItem(ACCESS_KEY);
  return !!stored && atob(stored) === ACCESS_CODE;
};

const readTrial = (): boolean => {
  if (!TRIAL_ENABLED) return false;
  return isTrialActive(
    decodeTrialStamp(localStorage.getItem(TRIAL_STORE_KEY!)),
    Date.now(),
    TRIAL_DURATION_MS!,
  );
};

// Permanent wins over trial so upgrading mid-trial resolves to premium.
const computeStatus = (): LicenseStatus => {
  try {
    if (readPermanent()) {
      return { tier: "premium", hasAccess: true, expiresAt: null };
    }
    const stamp = TRIAL_ENABLED
      ? decodeTrialStamp(localStorage.getItem(TRIAL_STORE_KEY!))
      : null;
    if (stamp != null && isTrialActive(stamp, Date.now(), TRIAL_DURATION_MS!)) {
      return {
        tier: "trial",
        hasAccess: true,
        expiresAt: trialExpiresAt(stamp, TRIAL_DURATION_MS!),
      };
    }
  } catch {
    // Corrupted storage falls through to free.
  }
  return { tier: "free", hasAccess: false, expiresAt: null };
};

const statusEquals = (a: LicenseStatus, b: LicenseStatus): boolean =>
  a.tier === b.tier &&
  a.hasAccess === b.hasAccess &&
  a.expiresAt === b.expiresAt;

interface PremiumAccessState {
  status: LicenseStatus;
  setStatus: (status: LicenseStatus) => void;
}

const usePremiumStore = create<PremiumAccessState>((set) => ({
  status: computeStatus(),
  // Skip the set when nothing changed; focus events fire constantly and a
  // fresh object would re-render every subscriber.
  setStatus: (status) =>
    set((state) => (statusEquals(state.status, status) ? state : { status })),
}));

export function usePremiumAccess() {
  const { t } = useTranslation();
  const status = usePremiumStore((state) => state.status);
  const setStatus = usePremiumStore((state) => state.setStatus);
  const expiresAt = status.expiresAt;

  useEffect(() => {
    const validateAccess = () => {
      setStatus(computeStatus());

      if (TRIAL_ENABLED && TRIAL_NOTIFIED_KEY) {
        const trialStamp = decodeTrialStamp(
          localStorage.getItem(TRIAL_STORE_KEY!),
        );
        const notifiedStamp = localStorage.getItem(TRIAL_NOTIFIED_KEY);
        if (
          trialStamp != null &&
          !isTrialActive(trialStamp, Date.now(), TRIAL_DURATION_MS!) &&
          notifiedStamp !== String(trialStamp)
        ) {
          toast.info(t("terminal.access_trial_expired"), {
            id: "trial-expired",
            duration: 5000,
          });
          localStorage.setItem(TRIAL_NOTIFIED_KEY, String(trialStamp));
        }
      }
    };

    window.addEventListener("storage", validateAccess);
    window.addEventListener("focus", validateAccess);

    // Flip an active trial to free the moment it runs out, even while the
    // tab stays open; the grace keeps isTrialActive strictly false on fire.
    let expiryTimer: number | undefined;
    if (expiresAt != null) {
      expiryTimer = window.setTimeout(
        validateAccess,
        Math.max(0, expiresAt - Date.now()) + 250,
      );
    }

    setStatus(computeStatus());

    // The Toaster mounts after this effect in the first commit, so toasts
    // fired here would be dropped; defer them one tick past the commit.
    const mountTimer = window.setTimeout(() => {
      if (!ACCESS_KEY || !ACCESS_CODE) {
        toast.error(t("terminal.access_config_missing"), {
          id: "premium-access-missing",
          duration: 5000,
        });
      }
      validateAccess();
    }, 0);

    return () => {
      window.removeEventListener("storage", validateAccess);
      window.removeEventListener("focus", validateAccess);
      if (expiryTimer != null) window.clearTimeout(expiryTimer);
      window.clearTimeout(mountTimer);
    };
  }, [t, setStatus, expiresAt]);

  const checkAccess = useCallback(() => {
    const next = computeStatus();
    setStatus(next);
    return next.hasAccess;
  }, [setStatus]);

  const grantAccess = useCallback(
    (code: string): AccessResult => {
      if (!ACCESS_KEY || !ACCESS_CODE) {
        toast.error(t("terminal.access_config_missing"));
        return "invalid";
      }
      if (code === ACCESS_CODE) {
        localStorage.setItem(ACCESS_KEY, btoa(ACCESS_CODE));
        setStatus(computeStatus());
        return "granted";
      }
      if (TRIAL_ENABLED && code === TRIAL_CODE) {
        // First redeem starts the env-configured clock; never reset a stamp.
        if (decodeTrialStamp(localStorage.getItem(TRIAL_STORE_KEY!)) == null) {
          localStorage.setItem(TRIAL_STORE_KEY!, encodeTrialStamp(Date.now()));
        }
        const ok = readTrial();
        setStatus(computeStatus());
        return ok ? "trial" : "expired";
      }
      return "invalid";
    },
    [t, setStatus],
  );

  return {
    hasAccess: status.hasAccess,
    tier: status.tier,
    expiresAt,
    daysLeft: expiresAt != null ? trialDaysLeft(expiresAt) : null,
    checkAccess,
    grantAccess,
    accessCode: ACCESS_CODE || "",
    isConfigured: !!(ACCESS_KEY && ACCESS_CODE),
  };
}
