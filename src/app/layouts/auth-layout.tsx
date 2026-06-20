import { Outlet, ScrollRestoration, Link } from 'react-router-dom';
import { PageLoader } from '@/components/shared/page-loader';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon, Laptop, Languages, ArrowLeft } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Layout wrapper for auth routes (login, register) that hides the main navigation
 *  header, footer, and mobile nav, but provides a focused top bar containing a
 *  Back to Home link, Language Select, and Theme Select styled like the header controls. */
export function AuthLayout() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const currentLang = i18n.language.split('-')[0];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground relative">
      <ScrollRestoration />
      <PageLoader />

      {/* Top Floating Navigation Controls */}
      <div className="absolute top-4 left-0 right-0 z-50 pointer-events-none md:top-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between w-full">
          
          {/* Left: Back to Home Link */}
          <Link 
            to="/" 
            className="pointer-events-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{t('common.back_to_home')}</span>
          </Link>

          {/* Right: Language and Theme Selects */}
          <div className="pointer-events-auto flex items-center gap-2">
            
            {/* Language Selector Dropdown */}
            <Select value={currentLang} onValueChange={(v) => i18n.changeLanguage(v)}>
              <SelectTrigger 
                className="w-fit uppercase tracking-wider text-[10px] h-8 bg-card border-input hover:bg-accent cursor-pointer pl-2.5 pr-2 gap-1 rounded-lg"
              >
                <Languages className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="p-1">
                <SelectItem value="id" className="uppercase tracking-wider text-[10px] cursor-pointer">Indonesia</SelectItem>
                <SelectItem value="en" className="uppercase tracking-wider text-[10px] cursor-pointer">English</SelectItem>
              </SelectContent>
            </Select>

            {/* Theme Selector Dropdown */}
            <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
              <SelectTrigger 
                className="w-fit uppercase tracking-wider text-[10px] h-8 bg-card border-input hover:bg-accent cursor-pointer pl-2.5 pr-2 gap-1 rounded-lg"
              >
                {theme === 'dark' ? (
                  <Moon className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                ) : theme === 'light' ? (
                  <Sun className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                ) : (
                  <Laptop className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                )}
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end" className="p-1">
                <SelectItem value="light" className="uppercase tracking-wider text-[10px] cursor-pointer">{t('common.theme_light')}</SelectItem>
                <SelectItem value="dark" className="uppercase tracking-wider text-[10px] cursor-pointer">{t('common.theme_dark')}</SelectItem>
                <SelectItem value="system" className="uppercase tracking-wider text-[10px] cursor-pointer">{t('common.theme_system')}</SelectItem>
              </SelectContent>
            </Select>

          </div>

        </div>

      </div>

      {/* Auth Content Port */}
      <main className="flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-6 py-4 pt-16 md:py-4">
        <Outlet />
      </main>
    </div>
  );
}
