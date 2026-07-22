import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UIState {
  // Global page loading (YouTube-style top bar)
  isPageLoading: boolean;
}

const initialState: UIState = {
  isPageLoading: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setPageLoading(state, action: PayloadAction<boolean>) {
      state.isPageLoading = action.payload;
    },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
