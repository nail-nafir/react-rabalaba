import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { RootState, AppDispatch } from "./index";
import { uiActions, setLicenseSuccessAction } from "./slices/ui-slice";
import { filterActions, type SignalFilterType } from "./slices/filter-slice";
import type { AssetFilterType } from "@/types/asset";
import type { TerminalView } from "./slices/ui-slice";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/**
 * UI actions (dialogs, search, page-loading), bound to dispatch with a stable
 * identity so they can sit in memo/effect deps without churn — mirrors the old
 * zustand action selectors. `openLicenseDialog`'s success callback is stashed in
 * a module ref (see ui-slice) rather than Redux state, keeping state serializable.
 */
export function useUIActions() {
  const dispatch = useAppDispatch();
  // Read the session straight off the same store rather than via useAuth() — it
  // imports from this module, so going through it would create an import cycle.
  const isAuthenticated = useAppSelector((s) => !!s.auth.session);
  const navigate = useNavigate();
  const { t } = useTranslation();
  return useMemo(
    () => ({
      openDetailDialog: (symbol: string) =>
        dispatch(uiActions.openDetailDialog(symbol)),
      closeDetailDialog: () => dispatch(uiActions.closeDetailDialog()),
      openLicenseDialog: (onSuccess?: () => void) => {
        setLicenseSuccessAction(onSuccess ?? null);
        dispatch(uiActions.setLicenseDialogOpen(true));
      },
      closeLicenseDialog: () => {
        setLicenseSuccessAction(null);
        dispatch(uiActions.setLicenseDialogOpen(false));
      },
      setTerminalView: (view: TerminalView) =>
        dispatch(uiActions.setTerminalView(view)),
      setSearchOpen: (open: boolean) => dispatch(uiActions.setSearchOpen(open)),
      toggleSearch: () => dispatch(uiActions.toggleSearch()),
      setPageLoading: (loading: boolean) =>
        dispatch(uiActions.setPageLoading(loading)),
    }),
    // Identity stays stable except on the rare events that actually matter:
    // login/logout (isAuthenticated) and language switch (t). `navigate` is
    // referentially stable across renders.
    [dispatch, isAuthenticated, navigate, t],
  );
}

/** Screener filter actions, bound to dispatch with a stable identity. */
export function useFilterActions() {
  const dispatch = useAppDispatch();
  return useMemo(
    () => ({
      setAssetType: (type: AssetFilterType) =>
        dispatch(filterActions.setAssetType(type)),
      setSignalFilter: (type: SignalFilterType) =>
        dispatch(filterActions.setSignalFilter(type)),
      setSearchQuery: (q: string) => dispatch(filterActions.setSearchQuery(q)),
      resetFilters: () => dispatch(filterActions.resetFilters()),
    }),
    [dispatch],
  );
}
