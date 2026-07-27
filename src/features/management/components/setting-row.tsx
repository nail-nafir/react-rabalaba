interface SettingRowProps {
  title: string;
  desc: string;
  children: React.ReactNode;
}

export function SettingRow({ title, desc, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground leading-snug">
          {desc}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
