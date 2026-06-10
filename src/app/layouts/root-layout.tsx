import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileNav } from '@/components/layout/mobile-nav';
import { SearchCommand } from '@/components/layout/search-command';
import { PageLoader } from '@/components/shared/page-loader';
import { LicenseDialog } from '@/components/shared/license-dialog';

export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground pb-20 md:pb-0">
      <ScrollRestoration />
      <PageLoader />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <SearchCommand />
      <LicenseDialog />
    </div>
  );
}
