import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = (value: string | null) => {
    if (value) {
      i18n.changeLanguage(value);
    }
  };

  const currentLang = i18n.language.split("-")[0];

  return (
    <Select value={currentLang} onValueChange={toggleLanguage}>
      <SelectTrigger className="bg-card! hover:bg-accent! py-4! text-[10px] font-bold uppercase tracking-wider [&>svg]:hidden sm:[&>svg]:block">
        <div className="flex items-center gap-1.5">
          <Languages className="h-3 w-3 text-muted-foreground" />
          <span className="hidden sm:inline">
            <SelectValue placeholder="Language" className="truncate" />
          </span>
        </div>
      </SelectTrigger>
      <SelectContent align="end" position="popper" className="p-1">
        <SelectItem value="id" className="text-[10px] uppercase tracking-wider">
          Indonesia
        </SelectItem>
        <SelectItem value="en" className="text-[10px] uppercase tracking-wider">
          English
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
