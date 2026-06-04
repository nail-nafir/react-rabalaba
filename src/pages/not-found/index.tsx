import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="flex flex-col items-center text-center">
        <DotLottieReact
          src="/animations/empty.lottie"
          className="mb-6 size-48"
          loop
          autoplay
        />
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
