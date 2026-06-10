import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Home, Binoculars } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-40 w-40 items-center justify-center rounded-4xl bg-muted/20 ring-1 ring-border/50 animate-empty-float">
          <Binoculars className="h-24 w-24 text-muted-foreground/60 animate-empty-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">
          {t("not_found.title")}
        </h1>
        <p className="text-base text-muted-foreground max-w-md mb-8">
          {t("not_found.description")}
        </p>
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "rounded-xl px-10 font-bold shadow-lg shadow-primary/20 text-base",
          )}
        >
          <Home className="h-5 w-5 mr-2" />
          {t("not_found.action")}
        </Link>
      </div>
    </div>
  );
}
