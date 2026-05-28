import { create } from 'zustand';
import type { AssetFilterType, SignalDirection } from '@/types/asset';

export type SignalFilterType = 'all' | SignalDirection;

interface FilterState {
  assetType: AssetFilterType;
  signalFilter: SignalFilterType;
  searchQuery: string;

  setAssetType: (type: AssetFilterType) => void;
  setSignalFilter: (type: SignalFilterType) => void;
  setSearchQuery: (q: string) => void;
  resetFilters: () => void;
}

const initialFilters = {
  assetType: 'all' as AssetFilterType,
  signalFilter: 'all' as SignalFilterType,
  searchQuery: '',
};

export const useFilterStore = create<FilterState>((set) => ({
  ...initialFilters,

  setAssetType: (assetType) => set({ assetType }),
  setSignalFilter: (signalFilter) => set({ signalFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () => set(initialFilters),
}));
