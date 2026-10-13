import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function PageHelp({ title, description }: {
  title: string;
  description: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 cursor-pointer text-muted-foreground sm:size-8 motion-reduce:transition-none"
          aria-label={t("page_help.label", { title })}
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <Info className="size-4" aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        collisionPadding={16}
        className="max-w-[min(13.75rem,calc(100vw-2rem))] leading-relaxed motion-reduce:animate-none!"
      >
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}
