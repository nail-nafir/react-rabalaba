import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
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
    [dispatch],
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
