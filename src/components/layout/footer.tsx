import { Link } from "react-router-dom";
import { Radio, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "../ui/button";
import { cn } from "@/lib/utils";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="relative z-10 border-t border-border bg-background pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
        <div className="col-span-1 md:col-span-2 space-y-4">
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "link" }),
              "flex items-center gap-2.5 group w-fit hover:no-underline p-0 h-auto",
            )}
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-primary via-primary/80 to-primary/60 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 group-hover:scale-110">
              <Radio className="h-4 w-4 relative z-10" />
              <div className="absolute inset-0 rounded-lg border border-white/20 z-0" />
            </div>
            <div className="flex flex-col -space-y-0.5 text-left">
              <span className="text-xl font-black tracking-tighter uppercase text-foreground leading-none">
                Raba<span className="text-primary">Laba</span>
              </span>
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-muted-foreground mt-1 leading-none">
                Terminal
              </span>
            </div>
          </Link>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            {t("footer.description")}
          </p>
        </div>

        {/* Assets Column */}
        <div className="space-y-4 text-left">
          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
            {t("footer.assets")}
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("footer.links.id_stocks")}
              </Link>
            </li>
            <li>
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("footer.links.us_stocks")}
              </Link>
            </li>
            <li>
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("footer.links.crypto")}
              </Link>
            </li>
            <li>
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("footer.links.commodities")}
              </Link>
            </li>
            <li className="opacity-50 cursor-not-allowed">
              <span className="flex items-center gap-2">
                {t("footer.links.indices")}
                <span className="text-[9px] bg-muted px-1 rounded uppercase tracking-tighter">
                  Soon
                </span>
              </span>
            </li>
            <li className="opacity-50 cursor-not-allowed">
              <span className="flex items-center gap-2">
                {t("footer.links.currencies")}
                <span className="text-[9px] bg-muted px-1 rounded uppercase tracking-tighter">
                  Soon
                </span>
              </span>
            </li>
          </ul>
        </div>

        {/* Platform Column */}
        <div className="space-y-4 text-left">
          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
            Platform
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link
                to="/terminal"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("common.terminal")}
              </Link>
            </li>
            <li>
              <Link
                to="/calendar"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("common.calendar")}
              </Link>
            </li>
            <li>
              <Link
                to="/pricing"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors",
                )}
              >
                {t("common.pricing")}
              </Link>
            </li>
          </ul>
        </div>

        {/* Connect Column */}
        <div className="space-y-4 text-left">
          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">
            {t("footer.connect")}
          </h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link
                to="https://x.com/nailnafir"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2",
                )}
              >
                X (Twitter) <ExternalLink className="h-3 w-3" />
              </Link>
            </li>
            <li>
              <Link
                to="https://instagram.com/nailnafir"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "p-0 h-auto font-normal text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2",
                )}
              >
                Instagram <ExternalLink className="h-3 w-3" />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          {t("footer.rights")}
        </p>
        <div className="flex items-center gap-6 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
          <span className="opacity-40">v1.0.0</span>
          <div className="flex items-center gap-1.5 text-primary">
            <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
            <span>{t("footer.status")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
