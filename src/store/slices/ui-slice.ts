import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TerminalResearchContext } from "@/features/chat/terminal-context";

interface UIState {
  // Global page loading (YouTube-style top bar)
  isPageLoading: boolean;
  activeResearchContext: TerminalResearchContext | null;
  researchSessionId: number;
  researchCopilotRequestId: number;
}

const initialState: UIState = {
  isPageLoading: false,
  activeResearchContext: null,
  researchSessionId: 0,
  researchCopilotRequestId: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setPageLoading(state, action: PayloadAction<boolean>) {
      state.isPageLoading = action.payload;
    },
    setResearchContext(
      state,
      action: PayloadAction<TerminalResearchContext | null>,
    ) {
      state.activeResearchContext = action.payload;
    },
    openResearchCopilot(
      state,
      action: PayloadAction<TerminalResearchContext>,
    ) {
      state.activeResearchContext = action.payload;
      state.researchSessionId += 1;
      state.researchCopilotRequestId += 1;
    },
    clearResearchContext(state) {
      state.activeResearchContext = null;
    },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
