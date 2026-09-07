import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FilterGroup } from "@/components/shared/filter-group";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { BarChart3, Calculator, RefreshCw, Target } from "lucide-react";

const COMPACT_SIGNAL_BADGE_CLASSNAME =
  "rounded-md text-[10px] font-bold uppercase tracking-wider";

interface RiskCalculatorProps {
  currency?: "USD" | "IDR";
  onCurrencyChange?: (curr: "USD" | "IDR") => void;
}

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({
  currency: externalCurrency,
  onCurrencyChange,
}) => {
  const { t } = useTranslation();

  const [internalCurrency, setInternalCurrency] = useState<"USD" | "IDR">(
    "USD",
  );
  const currency = externalCurrency ?? internalCurrency;

  const handleCurrencySwitch = (next: "USD" | "IDR") => {
    if (onCurrencyChange) {
      onCurrencyChange(next);
    } else {
      setInternalCurrency(next);
    }
    if (next === "IDR") {
      setAccountBalance(100000000);
      setEntryPrice(2500);
      setStopLossPrice(2375);
      setTargetPrice(2875);
    } else {
      setAccountBalance(10000);
      setEntryPrice(100);
      setStopLossPrice(95);
      setTargetPrice(115);
    }
    setActivePreset("stock");
  };

  // Calculator form states
  const [strategyTab, setStrategyTab] = useState<"template" | "custom">(
    "template",
  );
  const [accountBalance, setAccountBalance] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [entryPrice, setEntryPrice] = useState<number>(100);
  const [stopLossPrice, setStopLossPrice] = useState<number>(95);
  const [targetPrice, setTargetPrice] = useState<number>(115);
  type PresetCategory = "stock" | "crypto" | "gold";
  type TradeDirection = "long" | "short";

  const [presetDirection, setPresetDirection] =
    useState<TradeDirection>("long");
  const [activePreset, setActivePreset] = useState<PresetCategory | null>(
    "stock",
  );

  const PRESETS: Record<
    TradeDirection,
    Record<
      PresetCategory,
      {
        usd: { entry: number; sl: number; tp: number; subtext: string };
        idr: { entry: number; sl: number; tp: number; subtext: string };
      }
    >
  > = {
    long: {
      stock: {
        usd: {
          entry: 100,
          sl: 95,
          tp: 115,
          subtext: "Entry $100 • SL $95 • TP $115",
        },
        idr: {
          entry: 2500,
          sl: 2400,
          tp: 2800,
          subtext: "Entry Rp 2.500 • SL 2.400 • TP 2.800",
        },
      },
      crypto: {
        usd: {
          entry: 3000,
          sl: 2900,
          tp: 3300,
          subtext: "Entry $3,000 • SL $2,900 • TP $3,300",
        },
        idr: {
          entry: 50000000,
          sl: 48000000,
          tp: 56000000,
          subtext: "Entry Rp 50jt • SL 48jt • TP 56jt",
        },
      },
      gold: {
        usd: {
          entry: 2700,
          sl: 2680,
          tp: 2760,
          subtext: "Entry $2,700 • SL $2,680 • TP $2,760",
        },
        idr: {
          entry: 1500000,
          sl: 1480000,
          tp: 1560000,
          subtext: "Entry Rp 1.5jt • SL 1.48jt • TP 1.56jt",
        },
      },
    },
    short: {
      stock: {
        usd: {
          entry: 100,
          sl: 105,
          tp: 85,
          subtext: "Entry $100 • SL $105 • TP $85",
        },
        idr: {
          entry: 2500,
          sl: 2600,
          tp: 2200,
          subtext: "Entry Rp 2.500 • SL 2.600 • TP 2.200",
        },
      },
      crypto: {
        usd: {
          entry: 3000,
          sl: 3100,
          tp: 2700,
          subtext: "Entry $3,000 • SL $3,100 • TP $2,700",
        },
        idr: {
          entry: 50000000,
          sl: 52000000,
          tp: 44000000,
          subtext: "Entry Rp 50jt • SL 52jt • TP 44jt",
        },
      },
      gold: {
        usd: {
          entry: 2700,
          sl: 2720,
          tp: 2640,
          subtext: "Entry $2,700 • SL $2,720 • TP $2,640",
        },
        idr: {
          entry: 1500000,
          sl: 1520000,
          tp: 1440000,
          subtext: "Entry Rp 1.5jt • SL 1.52jt • TP 1.44jt",
        },
      },
    },
  };

  const isUSD = currency === "USD";
  const currPrefix = isUSD ? "$" : "Rp ";

  // Computations
  const stats = useMemo(() => {
    const isLong = targetPrice >= entryPrice && stopLossPrice < entryPrice;
    const isShort = targetPrice <= entryPrice && stopLossPrice > entryPrice;

    const stopDistance = Math.abs(entryPrice - stopLossPrice);
    const targetDistance = Math.abs(targetPrice - entryPrice);

    const stopPercentDistance =
      entryPrice > 0 ? (stopDistance / entryPrice) * 100 : 0;
    const targetPercentDistance =
      entryPrice > 0 ? (targetDistance / entryPrice) * 100 : 0;

    const maxRiskDollar = accountBalance * (riskPercent / 100);

    const positionUnits = stopDistance > 0 ? maxRiskDollar / stopDistance : 0;
    const totalPositionValue = positionUnits * entryPrice;

    const potentialRewardDollar = positionUnits * targetDistance;
    const riskRewardRatio =
      stopDistance > 0 ? targetDistance / stopDistance : 0;

    const isValidSetup =
      stopDistance > 0 &&
      entryPrice > 0 &&
      ((entryPrice > stopLossPrice && targetPrice > entryPrice) ||
        (entryPrice < stopLossPrice && targetPrice < entryPrice));

    const capitalSizingRatio =
      accountBalance > 0 ? totalPositionValue / accountBalance : 0;

    let riskLevel: "safe" | "moderate" | "danger" = "safe";
    if (riskPercent > 3.0) riskLevel = "danger";
    else if (riskPercent > 2.0) riskLevel = "moderate";
    const breakevenWinrate =
      riskRewardRatio > 0 ? (1 / (1 + riskRewardRatio)) * 100 : 50;

    return {
      isLong,
      isShort,
      stopDistance,
      targetDistance,
      stopPercentDistance,
      targetPercentDistance,
      maxRiskDollar,
      positionUnits,
      totalPositionValue,
      potentialRewardDollar,
      riskRewardRatio,
      isValidSetup,
      capitalSizingRatio,
      riskLevel,
      breakevenWinrate,
    };
  }, [accountBalance, riskPercent, entryPrice, stopLossPrice, targetPrice]);

  const quickCapitalValues = isUSD
    ? [5000, 10000, 25000, 50000]
    : [50000000, 100000000, 250000000, 500000000];

  const formatCurrency = (val: number, maxDecimals = 2) => {
    if (isUSD) {
      return `$${val.toLocaleString("en-US", { maximumFractionDigits: maxDecimals })}`;
    }
    return `Rp ${Math.round(val).toLocaleString("id-ID")}`;
  };

  const handleApplyPreset = (
    presetKey: PresetCategory,
    dir = presetDirection,
  ) => {
    setActivePreset(presetKey);
    const target = PRESETS[dir][presetKey][isUSD ? "usd" : "idr"];
    setEntryPrice(target.entry);
    setStopLossPrice(target.sl);
    setTargetPrice(target.tp);
  };

  const handleSwitchDirection = (dir: TradeDirection) => {
    setPresetDirection(dir);
    if (activePreset) {
      const target = PRESETS[dir][activePreset][isUSD ? "usd" : "idr"];
      setEntryPrice(target.entry);
      setStopLossPrice(target.sl);
      setTargetPrice(target.tp);
    }
  };

  const handlePriceChange = (
    nextEntry: number,
    nextSL: number,
    nextTP: number,
  ) => {
    setActivePreset(null);
    setEntryPrice(nextEntry);
    setStopLossPrice(nextSL);
    setTargetPrice(nextTP);
    if (nextTP > nextEntry && nextSL < nextEntry) {
      setPresetDirection("long");
    } else if (nextTP < nextEntry && nextSL > nextEntry) {
      setPresetDirection("short");
    }
  };

  const handleReset = () => {
    setActivePreset(null);
    setPresetDirection("long");
    if (isUSD) {
      setAccountBalance(10000);
      setRiskPercent(1.0);
      setEntryPrice(100);
      setStopLossPrice(95);
      setTargetPrice(115);
    } else {
      setAccountBalance(100000000);
      setRiskPercent(1.0);
      setEntryPrice(2500);
      setStopLossPrice(2400);
      setTargetPrice(2800);
    }
  };

  const handleSetTargetRR = (ratio: number) => {
    if (entryPrice <= 0 || stopLossPrice <= 0 || entryPrice === stopLossPrice)
      return;
    const isLong = entryPrice > stopLossPrice;
    const stopDist = Math.abs(entryPrice - stopLossPrice);
    const targetDist = stopDist * ratio;
    const nextTP = isLong ? entryPrice + targetDist : entryPrice - targetDist;
    if (nextTP > 0) {
      setTargetPrice(
        isUSD ? Math.round(nextTP * 100) / 100 : Math.round(nextTP),
      );
      setActivePreset(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* SECTION 1: MODAL AKUN & TOLERANSI RISIKO */}
      <section className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            {t("calculator.capital_card_title")}
          </h2>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <FilterGroup
              value={presetDirection}
              options={[
                { value: "long", label: t("calculator.direction_long") },
                { value: "short", label: t("calculator.direction_short") },
              ]}
              onChange={handleSwitchDirection}
            />

            <FilterGroup
              value={currency}
              options={[
                { value: "USD", label: t("calculator.currency_usd") },
                { value: "IDR", label: t("calculator.currency_idr") },
              ]}
              onChange={handleCurrencySwitch}
            />
          </div>
        </div>

        {/* Card Modal & Toleransi Risiko Terpadu */}
        <Card className="border border-border">
          <CardContent className="px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {/* Kolom Kiri: Modal Akun */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">
                      <label
                        htmlFor="account-capital"
                        className="cursor-pointer"
                      >
                        {t("calculator.account_capital")}
                      </label>
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        COMPACT_SIGNAL_BADGE_CLASSNAME,
                        BADGE.neutral.bg,
                        BADGE.neutral.text,
                        BADGE.neutral.border,
                      )}
                    >
                      {currency}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {currPrefix}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                    {currPrefix}
                  </div>
                  <Input
                    id="account-capital"
                    type="number"
                    value={accountBalance || ""}
                    onChange={(e) => {
                      setAccountBalance(Math.max(0, Number(e.target.value)));
                    }}
                    className="pl-11 text-sm font-bold h-10"
                    min={1}
                  />
                </div>

                <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                  {quickCapitalValues.map((amt) => {
                    const isSelected = accountBalance === amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        className={cn(
                          "w-full h-7 px-1 rounded-md border text-[11px] font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                        )}
                        onClick={() => setAccountBalance(amt)}
                      >
                        {formatCurrency(amt, 0)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Kanan: Toleransi Risiko */}
              <div className="space-y-2 lg:border-l lg:border-border/60 lg:pl-6">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">
                      <label htmlFor="risk-percent" className="cursor-pointer">
                        {t("calculator.risk_per_trade")}
                      </label>
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={cn(
                        COMPACT_SIGNAL_BADGE_CLASSNAME,
                        stats.riskLevel === "safe"
                          ? cn(
                              BADGE.positive.bg,
                              BADGE.positive.text,
                              BADGE.positive.border,
                            )
                          : stats.riskLevel === "moderate"
                            ? cn(
                                BADGE.warning.bg,
                                BADGE.warning.text,
                                BADGE.warning.border,
                              )
                            : cn(
                                BADGE.negative.bg,
                                BADGE.negative.text,
                                BADGE.negative.border,
                              ),
                      )}
                    >
                      {t(`calculator.risk_levels.${stats.riskLevel}`)}
                    </Badge>
                  </div>
                  <span className="text-xs font-bold text-primary">
                    {riskPercent}% = {formatCurrency(stats.maxRiskDollar)}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[0.5, 1.0, 2.0, 3.0].map((pct) => {
                    const isSelected = riskPercent === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        className={cn(
                          "w-full h-7 rounded-md border text-[11px] font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                        )}
                        onClick={() => setRiskPercent(pct)}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>

                <div className="pt-1 space-y-1">
                  <input
                    id="risk-percent"
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0.5% - 2.0% {t("calculator.risk_conservative")}</span>
                    <span>2.5% - 5.0% {t("calculator.risk_aggressive")}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* SECTION 2: PERHITUNGAN RISIKO POSISI (DENGAN TAB TEMPLATE ATAU CUSTOM) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("calculator.calculator_title")}
            </h2>
            <Button
              variant="link"
              size="icon"
              onClick={handleReset}
              title={t("calculator.reset")}
              aria-label={t("calculator.reset")}
              className="h-7 w-7 text-muted-foreground transition-colors flex items-center justify-center hover:text-primary hover:bg-muted cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Tab Switcher: Template vs Custom */}
            <FilterGroup
              value={strategyTab}
              options={[
                { value: "template", label: t("calculator.tab_preset") },
                { value: "custom", label: t("calculator.tab_custom") },
              ]}
              onChange={(val) => setStrategyTab(val as "template" | "custom")}
            />
          </div>
        </div>

        {/* Tab Content */}
        {strategyTab === "template" ? (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 w-full text-left items-stretch">
              {(["stock", "crypto", "gold"] as const).map((key) => {
                const isSelected = activePreset === key;
                const presetItem =
                  PRESETS[presetDirection][key][isUSD ? "usd" : "idr"];
                const stopDist = Math.abs(presetItem.entry - presetItem.sl);
                const tpDist = Math.abs(presetItem.tp - presetItem.entry);
                const slPct =
                  presetItem.entry > 0
                    ? ((stopDist / presetItem.entry) * 100).toFixed(1)
                    : "0.0";
                const tpPct =
                  presetItem.entry > 0
                    ? ((tpDist / presetItem.entry) * 100).toFixed(1)
                    : "0.0";

                return (
                  <Card
                    key={key}
                    onClick={() => handleApplyPreset(key)}
                    className={cn(
                      "group border border-border transition-all duration-200 cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                        : "hover:bg-muted/50 hover:border-primary",
                    )}
                  >
                    <CardContent className="px-4 flex flex-col justify-between gap-3 h-full">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle
                          className={cn(
                            "text-lg font-bold tracking-tight uppercase transition-colors",
                            isSelected
                              ? "text-primary"
                              : "text-foreground group-hover:text-primary",
                          )}
                        >
                          {t(`calculator.scenarios.${key}`)}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={cn(
                            COMPACT_SIGNAL_BADGE_CLASSNAME,
                            presetDirection === "long"
                              ? cn(
                                  BADGE.positive.bg,
                                  BADGE.positive.text,
                                  BADGE.positive.border,
                                )
                              : cn(
                                  BADGE.negative.bg,
                                  BADGE.negative.text,
                                  BADGE.negative.border,
                                ),
                          )}
                        >
                          {presetDirection.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-lg border border-border bg-muted/50 space-y-0.5">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                            Entry
                          </span>
                          <span className="text-xs font-bold text-foreground truncate block">
                            {formatCurrency(presetItem.entry, 0)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "p-2 rounded-lg border space-y-0.5",
                            BADGE.negative.border,
                            BADGE.negative.bg,
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px] uppercase font-bold tracking-wider block",
                              PALETTE.negative.text,
                            )}
                          >
                            SL (-{slPct}%)
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold truncate block",
                              PALETTE.negative.text,
                            )}
                          >
                            {formatCurrency(presetItem.sl, 0)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "p-2 rounded-lg border space-y-0.5",
                            BADGE.positive.border,
                            BADGE.positive.bg,
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px] uppercase font-bold tracking-wider block",
                              PALETTE.positive.text,
                            )}
                          >
                            TP (+{tpPct}%)
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold truncate block",
                              PALETTE.positive.text,
                            )}
                          >
                            {formatCurrency(presetItem.tp, 0)}
                          </span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                        <span>{t("calculator.rr_target_prefix")} 1 : 3.0</span>
                        {isSelected ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              COMPACT_SIGNAL_BADGE_CLASSNAME,
                              BADGE.accent.bg,
                              BADGE.accent.text,
                              BADGE.accent.border,
                            )}
                          >
                            {t("calculator.active")}
                          </Badge>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              PALETTE.positive.text,
                            )}
                          >
                            +{tpPct}%
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          /* Tab Custom Setup */
          <Card className="border border-border">
            <CardContent className="px-4 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">
                  {t("calculator.price_card_title")}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    COMPACT_SIGNAL_BADGE_CLASSNAME,
                    stats.isLong
                      ? cn(
                          BADGE.positive.bg,
                          BADGE.positive.text,
                          BADGE.positive.border,
                        )
                      : stats.isShort
                        ? cn(
                            BADGE.negative.bg,
                            BADGE.negative.text,
                            BADGE.negative.border,
                          )
                        : cn(
                            BADGE.neutral.bg,
                            BADGE.neutral.text,
                            BADGE.neutral.border,
                          ),
                  )}
                >
                  {stats.isLong
                    ? t("calculator.direction_long")
                    : stats.isShort
                      ? t("calculator.direction_short")
                      : t("calculator.direction_setup")}
                </Badge>
              </div>

              {/* 3 Price Inputs Grid: Entry, TP, SL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Entry */}
                <div className="space-y-1">
                  <label
                    htmlFor="entry-price"
                    className="text-xs font-semibold text-foreground flex items-center justify-between"
                  >
                    <span>{t("calculator.entry_price")}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        COMPACT_SIGNAL_BADGE_CLASSNAME,
                        BADGE.neutral.bg,
                        BADGE.neutral.text,
                        BADGE.neutral.border,
                      )}
                    >
                      {t("calculator.entry_point")}
                    </Badge>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                      {currPrefix}
                    </div>
                    <Input
                      id="entry-price"
                      type="number"
                      value={entryPrice || ""}
                      onChange={(e) =>
                        handlePriceChange(
                          Math.max(0, Number(e.target.value)),
                          stopLossPrice,
                          targetPrice,
                        )
                      }
                      className="pl-9 text-sm font-bold border-primary/40 focus-visible:border-primary h-9"
                      step="any"
                    />
                  </div>
                </div>

                {/* TP */}
                <div className="space-y-1">
                  <label
                    htmlFor="target-price"
                    className={cn(
                      "text-xs font-semibold flex items-center justify-between",
                      PALETTE.positive.text,
                    )}
                  >
                    <span>{t("calculator.target_price")}</span>
                    {stats.targetPercentDistance > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          COMPACT_SIGNAL_BADGE_CLASSNAME,
                          BADGE.positive.bg,
                          BADGE.positive.text,
                          BADGE.positive.border,
                        )}
                      >
                        +{stats.targetPercentDistance.toFixed(1)}%
                      </Badge>
                    )}
                  </label>
                  <div className="relative">
                    <div
                      className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold select-none",
                        PALETTE.positive.text,
                      )}
                    >
                      {currPrefix}
                    </div>
                    <Input
                      id="target-price"
                      type="number"
                      value={targetPrice || ""}
                      onChange={(e) =>
                        handlePriceChange(
                          entryPrice,
                          stopLossPrice,
                          Math.max(0, Number(e.target.value)),
                        )
                      }
                      className={cn(
                        "pl-9 text-sm font-bold h-9",
                        PALETTE.positive.border,
                        PALETTE.positive.text,
                      )}
                      step="any"
                    />
                  </div>
                </div>

                {/* SL */}
                <div className="space-y-1">
                  <label
                    htmlFor="stop-loss-price"
                    className={cn(
                      "text-xs font-semibold flex items-center justify-between",
                      PALETTE.negative.text,
                    )}
                  >
                    <span>{t("calculator.stop_loss_price")}</span>
                    {stats.stopPercentDistance > 0 && (
                      <Badge
                        variant="outline"
                        className={cn(
                          COMPACT_SIGNAL_BADGE_CLASSNAME,
                          BADGE.negative.bg,
                          BADGE.negative.text,
                          BADGE.negative.border,
                        )}
                      >
                        -{stats.stopPercentDistance.toFixed(1)}%
                      </Badge>
                    )}
                  </label>
                  <div className="relative">
                    <div
                      className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold select-none",
                        PALETTE.negative.text,
                      )}
                    >
                      {currPrefix}
                    </div>
                    <Input
                      id="stop-loss-price"
                      type="number"
                      value={stopLossPrice || ""}
                      onChange={(e) =>
                        handlePriceChange(
                          entryPrice,
                          Math.max(0, Number(e.target.value)),
                          targetPrice,
                        )
                      }
                      className={cn(
                        "pl-9 text-sm font-bold h-9",
                        PALETTE.negative.border,
                        PALETTE.negative.text,
                      )}
                      step="any"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Snap Target R:R */}
              <Card className="border border-border px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">
                  {t("calculator.snap_target_rr", "Snap Target R:R")}
                </CardTitle>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1.5, 2.0, 3.0, 4.0].map((ratio) => {
                    const isSelected =
                      stats.isValidSetup &&
                      Math.abs(stats.riskRewardRatio - ratio) < 0.08;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => handleSetTargetRR(ratio)}
                        disabled={
                          !entryPrice ||
                          !stopLossPrice ||
                          entryPrice === stopLossPrice
                        }
                        className={cn(
                          "h-7 px-3 rounded-md border text-xs font-semibold flex items-center justify-center transition-all duration-150 cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                        )}
                      >
                        1:{ratio.toFixed(1)}
                      </button>
                    );
                  })}
                </div>
              </Card>

              {!stats.isValidSetup && (
                <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-md border border-border/60">
                  {t("calculator.calculate_invalid_hint")}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border border-border px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg font-bold tracking-tight uppercase text-foreground">
                {stats.isValidSetup
                  ? `R:R 1 : ${stats.riskRewardRatio.toFixed(2)} · ${t("calculator.max_risk")} = ${formatCurrency(stats.maxRiskDollar)}`
                  : t("calculator.calculate_invalid_hint")}
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  COMPACT_SIGNAL_BADGE_CLASSNAME,
                  stats.isValidSetup
                    ? stats.isLong
                      ? cn(
                          BADGE.positive.bg,
                          BADGE.positive.text,
                          BADGE.positive.border,
                        )
                      : cn(
                          BADGE.negative.bg,
                          BADGE.negative.text,
                          BADGE.negative.border,
                        )
                    : cn(
                        BADGE.neutral.bg,
                        BADGE.neutral.text,
                        BADGE.neutral.border,
                      ),
                )}
              >
                {stats.isValidSetup
                  ? stats.isLong
                    ? t("calculator.direction_long")
                    : t("calculator.direction_short")
                  : t("calculator.direction_setup")}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {stats.isValidSetup
                ? t("calculator.calculate_hint")
                : t("calculator.calculate_invalid_hint")}
            </p>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                size="lg"
                disabled={!stats.isValidSetup}
                className="w-full sm:w-auto font-bold transition-all text-xs cursor-pointer items-center justify-center gap-1.5 tracking-tight shrink-0"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>{t("calculator.calculate_cta")}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] border border-border text-foreground flex flex-col gap-0 p-0 overflow-hidden">
              {/* Header styled identically to education detail dialogs */}
              <DialogHeader className="shrink-0 bg-popover p-4 pb-0">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground uppercase flex items-center gap-2 flex-wrap pr-6">
                  <span>{t("calculator.results")}</span>
                  {stats.isValidSetup && (
                    <Badge
                      variant="outline"
                      className={cn(
                        COMPACT_SIGNAL_BADGE_CLASSNAME,
                        stats.isLong
                          ? cn(
                              BADGE.positive.bg,
                              BADGE.positive.text,
                              BADGE.positive.border,
                            )
                          : cn(
                              BADGE.negative.bg,
                              BADGE.negative.text,
                              BADGE.negative.border,
                            ),
                      )}
                    >
                      {stats.isLong
                        ? t("calculator.direction_long")
                        : t("calculator.direction_short")}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      stats.riskRewardRatio >= 2
                        ? cn(
                            BADGE.positive.bg,
                            BADGE.positive.text,
                            BADGE.positive.border,
                          )
                        : cn(
                            BADGE.warning.bg,
                            BADGE.warning.text,
                            BADGE.warning.border,
                          ),
                    )}
                  >
                    {stats.riskRewardRatio >= 2
                      ? t("calculator.rr_good")
                      : t("calculator.rr_low")}
                  </Badge>
                </DialogTitle>

                <div className="space-y-0.5 mt-1">
                  <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                    {t("calculator.dialog_description")}
                  </DialogDescription>
                </div>

                {/* Meta badges */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      stats.riskLevel === "safe"
                        ? cn(
                            BADGE.positive.bg,
                            BADGE.positive.text,
                            BADGE.positive.border,
                          )
                        : stats.riskLevel === "moderate"
                          ? cn(
                              BADGE.warning.bg,
                              BADGE.warning.text,
                              BADGE.warning.border,
                            )
                          : cn(
                              BADGE.negative.bg,
                              BADGE.negative.text,
                              BADGE.negative.border,
                            ),
                    )}
                  >
                    {t(`calculator.risk_levels.${stats.riskLevel}`)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      COMPACT_SIGNAL_BADGE_CLASSNAME,
                      BADGE.neutral.bg,
                      BADGE.neutral.text,
                      BADGE.neutral.border,
                    )}
                  >
                    {currency} · {formatCurrency(accountBalance, 0)}
                  </Badge>
                </div>

                <Separator className="mt-4" />
              </DialogHeader>

              {/* Scrollable Content Body */}
              <div className="flex-1 min-h-0 flex flex-col space-y-6 p-4 overflow-y-auto">
                {/* Section: Sizing Recommendation */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {t("calculator.position_units")}
                    </h3>
                  </div>
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {t("calculator.position_units")}
                        </CardTitle>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {t("calculator.unit_suffix")}
                        </span>
                      </div>
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                        {stats.positionUnits > 0
                          ? stats.positionUnits.toLocaleString("en-US", {
                              maximumFractionDigits: 2,
                            })
                          : "0.00"}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium pt-1.5 border-t border-border/60 flex items-center justify-between">
                        <span>{t("calculator.total")}</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(stats.totalPositionValue)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Section: Risk & Reward Evaluation */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {t("calculator.calculator_title")}
                    </h3>
                  </div>

                  {/* 2-Card Grid: Max Risk & Potential Gain */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Max Risk (1R) */}
                    <Card
                      className={cn(
                        "border",
                        BADGE.negative.border,
                        BADGE.negative.bg,
                      )}
                    >
                      <CardContent className="space-y-1">
                        <CardTitle
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            PALETTE.negative.text,
                          )}
                        >
                          {t("calculator.max_risk")}
                        </CardTitle>
                        <div
                          className={cn(
                            "text-xl sm:text-2xl font-black",
                            PALETTE.negative.text,
                          )}
                        >
                          -{formatCurrency(stats.maxRiskDollar)}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          -{stats.stopPercentDistance.toFixed(2)}%{" "}
                          {t("calculator.sl_distance")}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Potential Gain */}
                    <Card
                      className={cn(
                        "border",
                        BADGE.positive.border,
                        BADGE.positive.bg,
                      )}
                    >
                      <CardContent className="space-y-1">
                        <CardTitle
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            PALETTE.positive.text,
                          )}
                        >
                          {t("calculator.potential_gain")}
                        </CardTitle>
                        <div
                          className={cn(
                            "text-xl sm:text-2xl font-black",
                            PALETTE.positive.text,
                          )}
                        >
                          +{formatCurrency(stats.potentialRewardDollar)}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          +{stats.targetPercentDistance.toFixed(2)}%{" "}
                          {t("calculator.tp_distance")}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Risk to Reward Visualizer Card */}
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {t("calculator.risk_reward")}
                        </CardTitle>
                        <span className="text-sm font-black text-foreground">
                          1 :{" "}
                          {stats.riskRewardRatio > 0
                            ? stats.riskRewardRatio.toFixed(2)
                            : "0.00"}
                        </span>
                      </div>

                      {/* Progress ratio split bar */}
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex border border-border/50">
                        <div
                          className="h-full transition-all duration-300"
                          style={{
                            width: `${Math.min(50, stats.riskRewardRatio > 0 ? 100 / (1 + stats.riskRewardRatio) : 50)}%`,
                            backgroundColor: PALETTE.negative.fill,
                          }}
                        />
                        <div
                          className="h-full flex-1 transition-all duration-300"
                          style={{
                            backgroundColor: PALETTE.positive.fill,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-0.5">
                        <span
                          className={cn("font-semibold", PALETTE.negative.text)}
                        >
                          1R {t("calculator.risk_1r")}
                        </span>
                        <span>
                          {stats.capitalSizingRatio > 0
                            ? `${stats.capitalSizingRatio.toFixed(1)}x ${t("calculator.position_leverage")}`
                            : ""}
                        </span>
                        <span
                          className={cn("font-semibold", PALETTE.positive.text)}
                        >
                          {stats.riskRewardRatio > 0
                            ? `${stats.riskRewardRatio.toFixed(1)}R ${t("calculator.target_badge")}`
                            : "0R"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Section: Trading Plan */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">
                      {t("dialog.trading_plan")}
                    </h3>
                  </div>

                  {/* Execution Strategy Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Entry */}
                    <Card className="border border-border bg-muted/50">
                      <CardContent className="space-y-1">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                          {t("calculator.entry_price")}
                        </CardTitle>
                        <p className="text-xs font-bold text-foreground leading-snug">
                          {formatCurrency(entryPrice)}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Target Profit (TP) */}
                    <Card
                      className={cn(
                        "border",
                        BADGE.positive.border,
                        BADGE.positive.bg,
                      )}
                    >
                      <CardContent className="space-y-1">
                        <CardTitle
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            PALETTE.positive.text,
                          )}
                        >
                          {t("calculator.target_price")}
                        </CardTitle>
                        <p
                          className={cn(
                            "text-xs font-bold leading-snug",
                            PALETTE.positive.text,
                          )}
                        >
                          {formatCurrency(targetPrice)}
                        </p>
                      </CardContent>
                    </Card>

                    {/* Stop Loss (SL) */}
                    <Card
                      className={cn(
                        "border",
                        BADGE.negative.border,
                        BADGE.negative.bg,
                      )}
                    >
                      <CardContent className="space-y-1">
                        <CardTitle
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            PALETTE.negative.text,
                          )}
                        >
                          {t("calculator.stop_loss_price")}
                        </CardTitle>
                        <p
                          className={cn(
                            "text-xs font-bold leading-snug",
                            PALETTE.negative.text,
                          )}
                        >
                          {formatCurrency(stopLossPrice)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Drawdown & Mathematical Edge Callout */}
                  <Card className="border border-border bg-muted/50">
                    <CardContent className="space-y-1">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">
                        {t("calculator.drawdown_title")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t("calculator.drawdown_description")}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </section>
    </div>
  );
};
