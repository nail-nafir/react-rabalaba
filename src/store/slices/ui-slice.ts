import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type TerminalView = "market" | "journal";

interface UIState {
  // Asset detail dialog
  selectedAssetSymbol: string | null;
  isDetailDialogOpen: boolean;
  // License dialog (global)
  isLicenseDialogOpen: boolean;
  // Terminal active view (market | journal)
  terminalView: TerminalView;
  // Command palette / search
  isSearchOpen: boolean;
  // Global page loading (YouTube-style top bar)
  isPageLoading: boolean;
}

const initialState: UIState = {
  selectedAssetSymbol: null,
  isDetailDialogOpen: false,
  isLicenseDialogOpen: false,
  terminalView: "market",
  isSearchOpen: false,
  isPageLoading: false,
};

// The license dialog's "do this once access is granted" callback is a FUNCTION,
// which Redux state must not hold (serializability). It lives in a module ref
// instead; only the open/closed boolean is real Redux state. Set on open,
// consumed (and cleared) by the dialog on success, cleared on close.
let pendingLicenseAction: (() => void) | null = null;
export const setLicenseSuccessAction = (fn: (() => void) | null) => {
  pendingLicenseAction = fn;
};
export const takeLicenseSuccessAction = (): (() => void) | null => {
  const fn = pendingLicenseAction;
  pendingLicenseAction = null;
  return fn;
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    openDetailDialog(state, action: PayloadAction<string>) {
      state.selectedAssetSymbol = action.payload;
      state.isDetailDialogOpen = true;
    },
    closeDetailDialog(state) {
      state.isDetailDialogOpen = false;
      state.selectedAssetSymbol = null;
    },
    setLicenseDialogOpen(state, action: PayloadAction<boolean>) {
      state.isLicenseDialogOpen = action.payload;
    },
    setTerminalView(state, action: PayloadAction<TerminalView>) {
      state.terminalView = action.payload;
    },
    setSearchOpen(state, action: PayloadAction<boolean>) {
      state.isSearchOpen = action.payload;
    },
    toggleSearch(state) {
      state.isSearchOpen = !state.isSearchOpen;
    },
    setPageLoading(state, action: PayloadAction<boolean>) {
      state.isPageLoading = action.payload;
    },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
