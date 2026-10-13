import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { RiskCalculator } from "@/features/learn/components/risk-calculator";
import { PageHelp } from "@/components/shared/page-help";

export default function CalculatorPage() {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");

  return (
    <div className="w-full bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        {/* Page Header */}
        <div className="min-w-0">
          <div className="flex w-fit max-w-full items-start gap-2">
            <h1 className="min-w-0 text-3xl font-bold uppercase tracking-tight text-foreground">
              {t("calculator.title")}
            </h1>
            <PageHelp title={t("calculator.title")} description={t("page_help.calculator")} />
          </div>
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
