import { useState } from "react";
import { cn } from "@/lib/utils";
import { getEmojiFlag } from "@/lib/country";

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryCode, className }: CountryFlagProps) {
  const [hasError, setHasError] = useState(false);
  const normalized = countryCode === "UK" ? "gb" : countryCode?.toLowerCase();

  if (hasError || !countryCode || countryCode.length !== 2) {
    return (
      <span className={cn("text-xs leading-none select-none", className)}>
        {getEmojiFlag(countryCode)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/24x18/${normalized}.png`}
      srcSet={`https://flagcdn.com/48x36/${normalized}.png 2x`}
      alt={countryCode}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn(
        "w-3.5 h-2.5 rounded-[2px] object-cover shrink-0 border border-foreground/10",
        className,
      )}
    />
  );
}
