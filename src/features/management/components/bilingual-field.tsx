import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function LangField({
  value,
  onChange,
  placeholder,
  textarea,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  textarea?: boolean;
}) {
  if (textarea) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm placeholder:text-sm min-h-20"
      />
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-8 text-sm placeholder:text-sm"
    />
  );
}

export interface BilingualFieldProps {
  label: string;
  en: string;
  id: string;
  onEn: (v: string) => void;
  onId: (v: string) => void;
  textarea?: boolean;
}

export function BilingualField({
  label,
  en,
  id,
  onEn,
  onId,
  textarea,
}: BilingualFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <LangField
          value={en}
          onChange={onEn}
          placeholder="EN"
          textarea={textarea}
        />
        <LangField
          value={id}
          onChange={onId}
          placeholder="ID"
          textarea={textarea}
        />
      </div>
    </div>
  );
}
