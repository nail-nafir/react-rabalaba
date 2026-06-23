import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { usePremiumAccess } from "@/hooks/use-premium-access";
import { PageLoader } from "@/components/shared/page-loader";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Radio,
  Database,
  Users,
  ArrowLeft,
  Sun,
  Moon,
  Laptop,
  Languages,
  LogOut,
  User,
  PanelLeft,
  ChevronUp,
  KeyRound,
} from "lucide-react";

const LANGUAGES = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
] as const;

export function AdminLayout() {
  const { t, i18n } = useTranslation();
  const { ready, isAuthenticated, user, signOut } = useAuth();
  const { isAdmin, isOwner, isLoading } = usePremiumAccess();
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const currentLang = i18n.language.split("-")[0];

  // Gated: wait for auth & profile hydration
  if (!ready || isLoading) {
    return <PageLoader trigger />;
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    toast.success(t("auth.logout_success"));
  };

  const navItems = [
    {
      to: "/admin/assets",
      label: t("admin.menu_assets", "Manajemen Aset"),
      icon: Database,
    },
    {
      to: "/admin/users",
      label: t("admin.menu_users", "Manajemen User"),
      icon: Users,
    },
    {
      to: "/admin/codes",
      label: t("admin.menu_codes", "Kode Akses"),
      icon: KeyRound,
    },
  ];

  return (
    <TooltipProvider>
      <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Sidebar */}
        <Sidebar className="border-r border-border bg-card">
          {/* Header */}
          <SidebarHeader className="h-16 px-4 flex flex-row items-center justify-start border-b border-border">
            <Link to="/terminal" className="flex items-center gap-2.5 hover:opacity-90 group py-1">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/30">
                <Radio className="h-4 w-4 relative z-10" />
                <div className="absolute inset-0 rounded-lg border border-white/20 z-0" />
              </div>
              <div className="flex flex-col -space-y-0.5">
                <span className="text-[13px] font-black tracking-tighter uppercase text-foreground leading-none">
                  Raba<span className="text-primary">Laba</span>
                </span>
                <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-muted-foreground mt-1 leading-none">
                  Console
                </span>
              </div>
            </Link>
          </SidebarHeader>

          {/* Navigation Links */}
          <SidebarContent className="py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            "w-full justify-start gap-3 h-10 px-3 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                            isActive 
                              ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10" 
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          )}
                        >
                          <Link to={item.to}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Quick Links Group */}
            <SidebarGroup className="mt-2">
              <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Utilities
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="w-full justify-start gap-3 h-10 px-3 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200 cursor-pointer"
                    >
                      <Link to="/terminal">
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        <span>{t("not_found.action", "Kembali ke Beranda")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer with settings + profile */}
          <SidebarFooter className="p-4 border-t border-border bg-card/50">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="w-full h-12 flex items-center justify-between gap-3 px-3 rounded-lg border border-accent-foreground/10 hover:bg-accent/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/80 text-foreground border border-accent-foreground/10">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="text-xs font-bold text-foreground truncate">
                            {isOwner ? "Owner Console" : "Admin Console"}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">{user?.email}</span>
                        </div>
                      </div>
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 align-end side-top text-foreground" align="end" side="top">
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("auth.account_label")}
                      </span>
                      <span className="truncate text-xs font-normal text-foreground">
                        {user?.email}
                      </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Language Selection */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                        <Languages className="h-4 w-4 text-muted-foreground mr-2" />
                        {t("common.language")}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={currentLang}
                          onValueChange={(v) => i18n.changeLanguage(v)}
                        >
                          {LANGUAGES.map((lang) => (
                            <DropdownMenuRadioItem
                              key={lang.value}
                              value={lang.value}
                              className="text-xs cursor-pointer"
                            >
                              {lang.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    {/* Theme Selection */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="text-xs cursor-pointer">
                        {theme === 'dark' ? (
                          <Moon className="h-4 w-4 text-muted-foreground mr-2" />
                        ) : theme === 'light' ? (
                          <Sun className="h-4 w-4 text-muted-foreground mr-2" />
                        ) : (
                          <Laptop className="h-4 w-4 text-muted-foreground mr-2" />
                        )}
                        {t("common.theme")}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={theme}
                          onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}
                        >
                          <DropdownMenuRadioItem value="light" className="text-xs cursor-pointer">
                            {t("common.theme_light")}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="dark" className="text-xs cursor-pointer">
                            {t("common.theme_dark")}
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="system" className="text-xs cursor-pointer">
                            {t("common.theme_system")}
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleLogout}
                      className="text-xs cursor-pointer"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      {t("auth.logout_btn")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content Area */}
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Dashboard Header Bar */}
          <header className="h-16 border-b border-border flex items-center justify-between px-4 sm:px-6 shrink-0 bg-card/20 backdrop-blur-xs">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="cursor-pointer">
                <PanelLeft className="h-4 w-4" />
              </SidebarTrigger>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Console</span>
                <span className="text-xs text-muted-foreground/50">/</span>
                <span className="text-xs font-bold text-foreground capitalize">
                  {location.pathname.split("/").pop() || "Dashboard"}
                </span>
              </div>
            </div>
          </header>

          {/* Page Content Scrollport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  </TooltipProvider>
  );
}
