import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
}

export function FilterGroup<T extends string>({
  value,
  options,
  onChange,
  className,
}: FilterGroupProps<T>) {
  const isMobile = useIsMobile();
  const selectedOption = options.find((o) => o.value === value);

  if (isMobile) {
    return (
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className={cn("w-fit min-w-30 sm:w-45 uppercase tracking-wider text-[10px] h-8", className)}>
          <span className="truncate text-left">
            {selectedOption?.label || value}
          </span>
        </SelectTrigger>
        <SelectContent align="start" className="p-1">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="uppercase tracking-wider text-[10px]">
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
        "flex items-center gap-1 rounded-lg border bg-muted p-0.5 shadow-sm",
        className,
      )}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded-md px-3 text-[10px] font-bold transition-all duration-200 whitespace-nowrap uppercase tracking-wider",
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50",
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
