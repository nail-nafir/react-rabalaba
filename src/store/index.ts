import { configureStore } from "@reduxjs/toolkit";
import ui from "./slices/ui-slice";
import filter from "./slices/filter-slice";
import auth from "./slices/auth-slice";

export const store = configureStore({
  reducer: { ui, filter, auth },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // Supabase Session/User are plain JSON but large + library-typed; skip
        // scanning them (the only non-primitive state we hold).
        ignoredActions: ["auth/setSession"],
        ignoredPaths: ["auth.session", "auth.user"],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
