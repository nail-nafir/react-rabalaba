import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterGroupProps<T extends string> {
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** "tabs" (default) = segmented control on desktop; "select" forces the
   *  dropdown on every breakpoint (mobile always renders the dropdown). */
  variant?: "tabs" | "select";
}

export function FilterGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  variant = "tabs",
}: FilterGroupProps<T>) {
  const isMobile = useIsMobile();

  if (isMobile || variant === "select") {
    return (
      <Select value={value} onValueChange={(v) => v && onChange(v as T)}>
        <SelectTrigger
          className={cn(
            "w-fit min-w-30 sm:w-45 uppercase tracking-wider text-[10px] h-8 cursor-pointer",
            className,
          )}
        >
          <SelectValue className="truncate text-left" />
        </SelectTrigger>
        <SelectContent align="start" className="p-1">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="uppercase tracking-wider text-[10px] cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg border border-input bg-card p-1",
        className,
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "ghost"}
          size="xs"
          onClick={() => onChange(option.value)}
          className={cn(
            "text-[10px] font-bold whitespace-nowrap uppercase tracking-wider cursor-pointer",
            value !== option.value && "text-muted-foreground hover:bg-accent!",
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
