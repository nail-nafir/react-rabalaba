import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./index";
import { uiActions } from "./slices/ui-slice";
import { filterActions, type SignalFilterType } from "./slices/filter-slice";
import type { AssetFilterType } from "@/types/asset";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/**
 * Global page-loader action bound to dispatch with a stable identity.
 */
export function useUIActions() {
  const dispatch = useAppDispatch();
  return useMemo(
    () => ({
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
