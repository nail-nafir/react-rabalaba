import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import {
  encodeTrialStamp,
  decodeTrialStamp,
  isTrialActive,
} from "@/lib/premium-trial";

const ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY;
const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE;
const TRIAL_CODE = import.meta.env.VITE_TRIAL_CODE;
const TRIAL_STORE_KEY = ACCESS_KEY ? `${ACCESS_KEY}_trial` : null;

export type AccessResult = "granted" | "trial" | "expired" | "invalid";

const readPermanent = (): boolean => {
  if (!ACCESS_KEY || !ACCESS_CODE) return false;
  const stored = localStorage.getItem(ACCESS_KEY);
  return !!stored && atob(stored) === ACCESS_CODE;
};

const readTrial = (): boolean => {
  if (!TRIAL_STORE_KEY) return false;
  return isTrialActive(decodeTrialStamp(localStorage.getItem(TRIAL_STORE_KEY)));
};

const computeAccess = (): boolean => {
  try {
    return readPermanent() || readTrial();
  } catch {
    return false;
  }
};

interface PremiumAccessState {
  hasAccess: boolean;
  setHasAccess: (access: boolean) => void;
}

const usePremiumStore = create<PremiumAccessState>((set) => ({
  hasAccess: computeAccess(),
  setHasAccess: (hasAccess) => set({ hasAccess }),
}));

export function usePremiumAccess() {
  const { t } = useTranslation();
  const hasAccess = usePremiumStore((state) => state.hasAccess);
  const setHasAccess = usePremiumStore((state) => state.setHasAccess);

  useEffect(() => {
    if (!ACCESS_KEY || !ACCESS_CODE) {
      toast.error(t("terminal.access_config_missing"), {
        id: "premium-access-missing",
        duration: 5000,
      });
    }

    const validateAccess = () => setHasAccess(computeAccess());

    window.addEventListener("storage", validateAccess);
    window.addEventListener("focus", validateAccess);

    validateAccess();

    return () => {
      window.removeEventListener("storage", validateAccess);
      window.removeEventListener("focus", validateAccess);
    };
  }, [t, setHasAccess]);

  const checkAccess = useCallback(() => {
    const valid = computeAccess();
    setHasAccess(valid);
    return valid;
  }, [setHasAccess]);

  const grantAccess = useCallback(
    (code: string): AccessResult => {
      if (!ACCESS_KEY || !ACCESS_CODE) {
        toast.error(t("terminal.access_config_missing"));
        return "invalid";
      }
      if (code === ACCESS_CODE) {
        localStorage.setItem(ACCESS_KEY, btoa(ACCESS_CODE));
        setHasAccess(true);
        return "granted";
      }
      if (TRIAL_CODE && code === TRIAL_CODE && TRIAL_STORE_KEY) {
        // First redeem starts the 3-day clock; never reset an existing stamp.
        if (decodeTrialStamp(localStorage.getItem(TRIAL_STORE_KEY)) == null) {
          localStorage.setItem(TRIAL_STORE_KEY, encodeTrialStamp(Date.now()));
        }
        const ok = readTrial();
        setHasAccess(ok || readPermanent());
        return ok ? "trial" : "expired";
      }
      return "invalid";
    },
    [t, setHasAccess],
  );

  return {
    hasAccess,
    checkAccess,
    grantAccess,
    accessCode: ACCESS_CODE || "",
    isConfigured: !!(ACCESS_KEY && ACCESS_CODE),
  };
}
