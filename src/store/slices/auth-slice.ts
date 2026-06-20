import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True once the initial getSession() has resolved (avoids a free→premium flash). */
  ready: boolean;
}

const initialState: AuthState = { session: null, user: null, ready: false };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.user = action.payload?.user ?? null;
    },
    setReady(state, action: PayloadAction<boolean>) {
      state.ready = action.payload;
    },
  },
});

export const authActions = authSlice.actions;
export default authSlice.reducer;
