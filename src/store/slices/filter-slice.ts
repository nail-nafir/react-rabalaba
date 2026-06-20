import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AssetFilterType, SignalDirection } from "@/types/asset";

export type SignalFilterType = "all" | SignalDirection;

interface FilterState {
  assetType: AssetFilterType;
  signalFilter: SignalFilterType;
  searchQuery: string;
}

const initialState: FilterState = {
  assetType: "all",
  signalFilter: "all",
  searchQuery: "",
};

const filterSlice = createSlice({
  name: "filter",
  initialState,
  reducers: {
    setAssetType(state, action: PayloadAction<AssetFilterType>) {
      state.assetType = action.payload;
    },
    setSignalFilter(state, action: PayloadAction<SignalFilterType>) {
      state.signalFilter = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    resetFilters() {
      return initialState;
    },
  },
});

export const filterActions = filterSlice.actions;
export default filterSlice.reducer;
