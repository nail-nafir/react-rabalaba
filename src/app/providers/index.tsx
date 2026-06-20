import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { store } from "@/store";
import { queryClient } from "@/app/config/query-client";
import { router } from "@/app/router";
import { ThemeProvider } from "@/components/theme-provider";

import { Toaster } from "@/components/ui/sonner";

export function AppProviders() {
  return (
    <Provider store={store}>
      <ThemeProvider defaultTheme="dark" storageKey="rabalaba-theme">
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      </ThemeProvider>
    </Provider>
  );
}
