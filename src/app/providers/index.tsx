import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { store } from "@/store";
import { queryClient } from "@/app/config/query-client";
import { router } from "@/app/router";
import { ThemeProvider } from "@/components/theme-provider";
import { useSessionActivity } from "@/hooks/use-session-activity";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Toaster } from "@/components/ui/sonner";

/** Headless: runs the app-wide last_active_at ping + idle logout. Sits here (a
 *  sibling of RouterProvider, like Toaster) so the side-effect stays out of the
 *  layout's render. Needs Redux + QueryClient in scope, so it's inside both. */
function SessionActivity() {
  useSessionActivity();
  return null;
}

export function AppProviders() {
  return (
    <Provider store={store}>
      <ThemeProvider defaultTheme="dark" storageKey="rabalaba-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <SessionActivity />
            <RouterProvider router={router} />
            <Toaster position="top-right" richColors />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </Provider>
  );
}
