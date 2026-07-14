import { Link, useLocation } from "react-router-dom";
import { Radio, BarChart3, Calendar, CreditCard } from "lucide-react";
import { LicenseBadge } from "./license-badge";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "../ui/button";

const NAV_ITEMS = [
  { to: "/terminal", icon: BarChart3 },
  { to: "/calendar", icon: Calendar },
  { to: "/subscription", icon: CreditCard },
] as const;

export function Header() {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-16 w-full items-center border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60",
      )}
    >
      <div className="relative flex w-full max-w-7xl mx-auto px-6 items-center">
        {/* Left: Logo */}
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "link" }),
              "flex items-center gap-2.5 group hover:no-underline p-0 h-auto",
            )}
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:shadow-primary/30">
              <Radio className="h-4 w-4 relative z-10 transition-transform duration-500" />
              <div className="absolute inset-0 rounded-lg border border-white/20 z-0" />
            </div>
            <div className="flex flex-col -space-y-0.5">
              <span className="text-[15px] font-black tracking-tighter uppercase text-foreground leading-none">
                Raba<span className="text-primary">Laba</span>
              </span>
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-muted-foreground mt-1 leading-none">
                Terminal
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Nav (Absolute) */}
        {location.pathname !== "/" && (
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-2 rounded-lg border border-input bg-card p-1">
            {NAV_ITEMS.map(({ to, icon: Icon }) => {
              const isActive =
                location.pathname === to ||
                location.pathname.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    buttonVariants({
                      variant: isActive ? "default" : "ghost",
                      size: "xs",
                    }),
                    "flex-row text-[10px] font-bold uppercase tracking-wider",
                    !isActive && "text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t(`common.${to.replace("/", "")}`)}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right: Actions */}
        <div className="flex flex-1 items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <LicenseBadge />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
