import { Outlet, ScrollRestoration } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageLoader } from "@/components/shared/page-loader";
import { useTranslation } from "react-i18next";

export function RootLayout() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground pb-20 md:pb-0">
      <ScrollRestoration />
      <PageLoader />
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-60 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("common.skip_to_content")}
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
}
