import { create } from "zustand";

interface UIState {
  // Asset detail dialog
  selectedAssetSymbol: string | null;
  isDetailDialogOpen: boolean;
  openDetailDialog: (symbol: string) => void;
  closeDetailDialog: () => void;

  // Search
  isSearchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  toggleSearch: () => void;

  // Global Page Loading (for YouTube-style top bar)
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Asset detail dialog
  selectedAssetSymbol: null,
  isDetailDialogOpen: false,
  openDetailDialog: (symbol) =>
    set({ selectedAssetSymbol: symbol, isDetailDialogOpen: true }),
  closeDetailDialog: () =>
    set({ isDetailDialogOpen: false, selectedAssetSymbol: null }),

  // Search
  isSearchOpen: false,
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  toggleSearch: () => set((state) => ({ isSearchOpen: !state.isSearchOpen })),

  // Page Loading
  isPageLoading: false,
  setPageLoading: (loading) => set({ isPageLoading: loading }),
}));
