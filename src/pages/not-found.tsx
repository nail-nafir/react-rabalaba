import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Home, Binoculars } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Empty className="min-h-[80vh] border-0 px-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Binoculars aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle className="text-3xl">{t("not_found.title")}</EmptyTitle>
        <EmptyDescription>{t("not_found.description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "font-bold",
          )}
        >
          <Home data-icon="inline-start" />
          {t("not_found.action")}
        </Link>
      </EmptyContent>
    </Empty>
  );
}
