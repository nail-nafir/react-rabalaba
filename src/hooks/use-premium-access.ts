import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { create } from "zustand";

const ACCESS_KEY = import.meta.env.VITE_ACCESS_KEY;
const ACCESS_CODE = import.meta.env.VITE_ACCESS_CODE;

interface PremiumAccessState {
  hasAccess: boolean;
  setHasAccess: (access: boolean) => void;
}

const getInitialAccess = (): boolean => {
  try {
    if (!ACCESS_KEY || !ACCESS_CODE) {
      return false;
    }
    const stored = localStorage.getItem(ACCESS_KEY);
    if (!stored) return false;
    return atob(stored) === ACCESS_CODE;
  } catch {
    return false;
  }
};

const usePremiumStore = create<PremiumAccessState>((set) => ({
  hasAccess: getInitialAccess(),
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

    const validateAccess = () => {
      try {
        if (!ACCESS_KEY || !ACCESS_CODE) {
          setHasAccess(false);
          return;
        }
        const stored = localStorage.getItem(ACCESS_KEY);
        if (!stored) {
          setHasAccess(false);
          return;
        }
        setHasAccess(atob(stored) === ACCESS_CODE);
      } catch {
        setHasAccess(false);
      }
    };

    window.addEventListener("storage", validateAccess);
    window.addEventListener("focus", validateAccess);
    
    validateAccess();

    return () => {
      window.removeEventListener("storage", validateAccess);
      window.removeEventListener("focus", validateAccess);
    };
  }, [t, setHasAccess]);

  const checkAccess = useCallback(() => {
    try {
      if (!ACCESS_KEY || !ACCESS_CODE) {
        setHasAccess(false);
        return false;
      }
      const stored = localStorage.getItem(ACCESS_KEY);
      if (!stored) {
        setHasAccess(false);
        return false;
      }
      const isValid = atob(stored) === ACCESS_CODE;
      setHasAccess(isValid);
      return isValid;
    } catch {
      setHasAccess(false);
      return false;
    }
  }, [setHasAccess]);

  const grantAccess = useCallback((code: string) => {
    if (!ACCESS_KEY || !ACCESS_CODE) {
      toast.error(t("terminal.access_config_missing"));
      return false;
    }
    if (code === ACCESS_CODE) {
      localStorage.setItem(ACCESS_KEY, btoa(ACCESS_CODE));
      setHasAccess(true);
      return true;
    }
    return false;
  }, [t, setHasAccess]);

  return {
    hasAccess,
    checkAccess,
    grantAccess,
    accessCode: ACCESS_CODE || "",
    isConfigured: !!(ACCESS_KEY && ACCESS_CODE),
  };
}
