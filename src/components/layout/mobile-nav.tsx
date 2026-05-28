import { Link, useLocation } from "react-router-dom";
import { Monitor, CalendarDays, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "../ui/button";

export function MobileNav() {
  const { t } = useTranslation();
  const location = useLocation();

  const NAV_ITEMS = [
    { to: "/terminal", label: t("common.terminal"), icon: Monitor },
    { to: "/calendar", label: t("common.calendar"), icon: CalendarDays },
    { to: "/pricing", label: t("common.pricing"), icon: CreditCard },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-border/50 bg-background/95 backdrop-blur-lg px-2 py-2 pb-safe"
      aria-label="Mobile navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.to;
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              buttonVariants({ variant: "link" }),
              "relative flex flex-col items-center gap-1 rounded-lg px-3 py-1 h-auto transition-colors no-underline!",
              isActive
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <div className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
