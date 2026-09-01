import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { RiskCalculator } from "@/features/learn/components/risk-calculator";

export default function CalculatorPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");

  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        {/* Page Header */}
        <div className="min-w-0">
          <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
            {t("calculator.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("calculator.subtitle")}
          </p>
        </div>

        <Separator />

        {/* Position Sizing & Risk:Reward Terminal */}
        <RiskCalculator currency={currency} onCurrencyChange={setCurrency} />
      </div>
    </div>
  );
}
