import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterGroupProps<T extends string> {
  value: T;
  options: readonly FilterOption<T>[];
  onChange: (value: NoInfer<T>) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  /** "tabs" (default) = segmented control on desktop; "select" forces the
   *  dropdown on every breakpoint (mobile always renders the dropdown). */
  variant?: "tabs" | "select";
}

export function FilterGroup<T extends string>({
  value,
  options,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  variant = "tabs",
}: FilterGroupProps<T>) {
  const isMobile = useIsMobile();

  if (isMobile || variant === "select") {
    return (
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) => {
          if (!disabled && nextValue !== null) onChange(nextValue as T);
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel}
          className={cn(
            "w-fit min-w-30 sm:w-45 uppercase tracking-wider text-[10px] h-8 cursor-pointer",
            disabled && "cursor-not-allowed opacity-60",
            className,
          )}
        >
          <SelectValue className="truncate text-left" />
        </SelectTrigger>
        <SelectContent position="popper" className="p-0.5">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="uppercase tracking-wider text-[10px] cursor-pointer whitespace-nowrap"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => {
        if (!disabled && nextValue !== null) onChange(nextValue as T);
      }}
      className="w-fit"
    >
      <TabsList
        aria-label={ariaLabel}
        className={cn(
          "h-auto flex w-fit items-center gap-1 rounded-lg border border-input bg-card p-1",
          className,
        )}
      >
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className={cn(
              "h-6 px-2 text-[10px] font-bold whitespace-nowrap uppercase tracking-wider cursor-pointer rounded-[min(var(--radius-md),10px)] transition-all",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs",
              disabled && "cursor-not-allowed opacity-60",
            )}
            disabled={disabled}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
