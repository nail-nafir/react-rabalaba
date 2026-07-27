import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** The one dropdown look every option row shares (width, casing, size). */
export function SettingSelect({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  renderLabel: (value: number) => string;
}) {
  const items = options.map((option) => ({
    value: String(option),
    label: renderLabel(option),
  }));

  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(Number(nextValue));
      }}
    >
      <SelectTrigger className="w-28 h-8 uppercase tracking-wider text-[10px] cursor-pointer">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="p-1">
        <SelectGroup>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              className="uppercase tracking-wider text-[10px] cursor-pointer"
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
