import { type CSSProperties } from "react";
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
  SidebarRail,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";

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
  LineChart,
  ShieldAlert,
  KeyRound,
  Crown,
  Wallet,
  Mail,
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

  const consoleTitle = isOwner
    ? t("admin.owner_console_title", "Pemilik")
    : t("admin.admin_console_title", "Dashboard Admin");

  const overviewItem = {
    to: "/admin/summary",
    label: t("admin.menu_summary", "Summary"),
    icon: LineChart,
  };

  const managementItems = [
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
    {
      to: "/admin/invitations",
      label: t("admin.menu_invitations", "Undangan"),
      icon: Mail,
    },
    {
      to: "/admin/plans",
      label: t("admin.menu_plans", "Paket Langganan"),
      icon: Crown,
    },
    {
      to: "/admin/payments",
      label: t("admin.menu_payments", "Metode Pembayaran"),
      icon: Wallet,
    },
    {
      to: "/admin/disclaimer",
      label: t("admin.menu_disclaimer", "Disclaimer"),
      icon: ShieldAlert,
    },
  ];

  const navItems = [overviewItem, ...managementItems];

  // Breadcrumb leaf: resolve the active nav label from the current route.
  const activeNav = navItems.find((item) =>
    location.pathname.startsWith(item.to),
  );
  const currentLabel =
    activeNav?.label ?? t("admin.console_label", "Dashboard");

  return (
    <TooltipProvider>
      <SidebarProvider
        className="h-svh overflow-hidden"
        style={{ "--sidebar-width": "17rem" } as CSSProperties}
      >
        {/* Floating Sidebar (collapses to an icon rail) */}
        <Sidebar variant="floating" collapsible="icon">
          {/* Brand */}
          <SidebarHeader className="h-16 border-b border-sidebar-border pb-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  asChild
                  tooltip={consoleTitle}
                  className="group/brand gap-2.5 hover:bg-transparent"
                >
                  <Link to="/terminal">
                    <div className="relative flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 group-hover/brand:scale-110 group-hover/brand:shadow-primary/30">
                      <Radio className="size-4 relative z-10" />
                      <div className="absolute inset-0 rounded-lg border border-white/20 z-0" />
                    </div>
                    <div className="flex flex-col -space-y-0.5 leading-none">
                      <span className="text-[13px] font-black tracking-tighter uppercase text-foreground leading-none">
                        Raba<span className="text-primary">Laba</span>
                      </span>
                      <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-muted-foreground mt-1 leading-none">
                        {t("admin.console_label", "Dashboard")}
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          {/* Navigation Links */}
          <SidebarContent className="py-2 flex flex-col gap-2">
            {/* Overview / Stats Group */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("admin.nav_group_overview", "Ikhtisar")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname.startsWith(overviewItem.to)}
                      tooltip={overviewItem.label}
                      className={cn(
                        "gap-3 text-sm font-medium transition-all duration-200 cursor-pointer",
                        location.pathname.startsWith(overviewItem.to)
                          ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10 hover:bg-primary hover:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Link to={overviewItem.to}>
                        <overviewItem.icon className="size-4 shrink-0" />
                        <span>{overviewItem.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Management Group */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("admin.nav_group_management", "Manajemen")}
              </SidebarGroupLabel>
              <SidebarGroupContent className="mt-1">
                <SidebarMenu className="gap-1">
                  {managementItems.map((item) => {
                    const isActive = location.pathname.startsWith(item.to);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            "gap-3 text-sm font-medium transition-all duration-200 cursor-pointer",
                            isActive
                              ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/10 hover:bg-primary hover:text-primary-foreground data-active:bg-primary data-active:text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Link to={item.to}>
                            <item.icon className="size-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer with settings + profile */}
          <SidebarFooter className="border-t border-sidebar-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      size="lg"
                      tooltip={consoleTitle}
                      className="gap-2.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                    >
                      <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border">
                        <User className="size-4" />
                      </div>
                      <div className="flex flex-col text-left min-w-0 flex-1">
                        <span className="text-[10px] text-muted-foreground truncate">
                          {consoleTitle}
                        </span>
                        <span className="text-xs font-bold text-foreground truncate">
                          {user?.email}
                        </span>
                      </div>
                      <ChevronUp className="size-4 text-muted-foreground shrink-0" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-(--radix-dropdown-menu-trigger-width) min-w-56 text-foreground"
                    align="end"
                    side="top"
                    sideOffset={8}
                  >
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {t("auth.account_label")}
                      </span>
                      <span className="truncate text-xs font-normal text-foreground">
                        {user?.email}
                      </span>
                    </DropdownMenuLabel>
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

          <SidebarRail />
        </Sidebar>

        {/* Main Content Area */}
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Dashboard Header Bar */}
          <header className="h-18 border-b border-border flex items-center gap-4 px-4 sm:px-6 shrink-0 bg-card/20 backdrop-blur-xs">
            <SidebarTrigger className="cursor-pointer">
              <PanelLeft className="h-4 w-4" />
            </SidebarTrigger>
            <Separator
              orientation="vertical"
              className="h-6 data-vertical:self-center"
            />
            <Breadcrumb>
              <BreadcrumbList>
                {location.pathname === "/admin/summary" ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-xs font-bold text-foreground tracking-wider uppercase">
                      {t("admin.console_label", "Dashboard")}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <>
                    <BreadcrumbItem className="hidden sm:block">
                      <BreadcrumbLink asChild>
                        <Link
                          to="/admin/summary"
                          className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors duration-200"
                        >
                          {t("admin.console_label", "Dashboard")}
                        </Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden sm:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="text-xs font-bold text-foreground tracking-wider uppercase">
                        {currentLabel}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>

            {/* Right Side Controls: Language, Theme & User Switchers */}
            <div className="ml-auto flex items-center gap-2">
              {/* Back to Terminal Button */}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs cursor-pointer flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground h-8 w-8 md:w-auto md:px-3 rounded-lg"
              >
                <Link to="/terminal">
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden md:inline">
                    {t("admin.back_to_terminal", "Kembali ke Terminal")}
                  </span>
                </Link>
              </Button>

              <Separator
                orientation="vertical"
                className="h-6 data-vertical:self-center"
              />

              {/* Language Selector Dropdown */}
              <Select
                value={currentLang}
                onValueChange={(v) => i18n.changeLanguage(v)}
              >
                <SelectTrigger className="w-8 sm:w-fit uppercase tracking-wider text-[10px] h-8 bg-card border-input hover:bg-accent cursor-pointer p-0 sm:pl-2.5 sm:pr-2 justify-center sm:justify-between gap-1 rounded-lg [&>svg:last-child]:hidden sm:[&>svg:last-child]:block">
                  <Languages className="h-3.5 w-3.5 text-muted-foreground mr-0 sm:mr-1" />
                  <span className="hidden sm:inline">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" align="end" className="p-1">
                  {LANGUAGES.map((lang) => (
                    <SelectItem
                      key={lang.value}
                      value={lang.value}
                      className="uppercase tracking-wider text-[10px] cursor-pointer"
                    >
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Theme Selector Dropdown */}
              <Select
                value={theme}
                onValueChange={(v) =>
                  setTheme(v as "light" | "dark" | "system")
                }
              >
                <SelectTrigger className="w-8 sm:w-fit uppercase tracking-wider text-[10px] h-8 bg-card border-input hover:bg-accent cursor-pointer p-0 sm:pl-2.5 sm:pr-2 justify-center sm:justify-between gap-1 rounded-lg [&>svg:last-child]:hidden sm:[&>svg:last-child]:block">
                  {theme === "dark" ? (
                    <Moon className="h-3.5 w-3.5 text-muted-foreground mr-0 sm:mr-1" />
                  ) : theme === "light" ? (
                    <Sun className="h-3.5 w-3.5 text-muted-foreground mr-0 sm:mr-1" />
                  ) : (
                    <Laptop className="h-3.5 w-3.5 text-muted-foreground mr-0 sm:mr-1" />
                  )}
                  <span className="hidden sm:inline">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" align="end" className="p-1">
                  <SelectItem
                    value="light"
                    className="uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    {t("common.theme_light")}
                  </SelectItem>
                  <SelectItem
                    value="dark"
                    className="uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    {t("common.theme_dark")}
                  </SelectItem>
                  <SelectItem
                    value="system"
                    className="uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    {t("common.theme_system")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </header>

          {/* Page Content Scrollport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
