import { useState } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";

/** Keep the page on refresh; reset on user filters and clamp shrinking results. */
export function useTablePagination(rowCount: number, resetKey: string) {
  const [state, setState] = useState({
    resetKey,
    pagination: { pageIndex: 0, pageSize: 10 },
  });
  const pageIndex =
    state.resetKey !== resetKey
      ? 0
      : Math.max(
          0,
          Math.min(
            state.pagination.pageIndex,
            Math.ceil(rowCount / state.pagination.pageSize) - 1,
          ),
        );
  const pagination = { ...state.pagination, pageIndex };
  if (state.resetKey !== resetKey || state.pagination.pageIndex !== pageIndex) {
    setState({ resetKey, pagination });
  }
  const onPaginationChange = (updater: Updater<PaginationState>) => {
    setState((previous) => ({
      resetKey,
      pagination:
        typeof updater === "function" ? updater(previous.pagination) : updater,
    }));
  };
  return { pagination, onPaginationChange };
}
