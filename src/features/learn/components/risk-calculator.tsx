import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FilterGroup } from "@/components/shared/filter-group";
import { BADGE, PALETTE } from "@/constants/taxonomy/palette";
import { cn } from "@/lib/utils";
import { RefreshCw, ShieldCheck } from "lucide-react";

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
    setActivePreset(null);
  };

  // Calculator form states
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

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1: Template Kasus Pasar */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("calculator.presets_title")}
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

          <div className="flex items-center gap-2">
            {/* Direction FilterGroup: LONG vs SHORT */}
            <FilterGroup
              value={presetDirection}
              options={[
                { value: "long", label: "LONG" },
                { value: "short", label: "SHORT" },
              ]}
              onChange={handleSwitchDirection}
            />

            {/* Currency FilterGroup: USD vs IDR */}
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

        {/* 3 Scenario Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["stock", "crypto", "gold"] as const).map((key) => {
            const isSelected = activePreset === key;
            const presetItem =
              PRESETS[presetDirection][key][isUSD ? "usd" : "idr"];
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={cn(
                  "group w-full p-3.5 sm:p-4 rounded-xl border text-left transition-all duration-200 flex flex-col gap-1 cursor-pointer select-none",
                  isSelected
                    ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/40 shadow-xs"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:-translate-y-0.5 hover:shadow-xs text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className={cn(
                      "text-xs sm:text-sm leading-tight transition-colors",
                      isSelected
                        ? "font-bold text-primary"
                        : "font-semibold text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {t(`calculator.scenarios.${key}`)}
                  </span>
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
                <span
                  className={cn(
                    "text-[11px] transition-colors",
                    isSelected
                      ? "text-foreground/90 font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {presetItem.subtext}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Section 2: Perhitungan Risiko Posisi */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {t("calculator.calculator_title")}
        </h2>

        {/* 50% / 50% Equal-Width Responsive Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Column: Parameter Inputs Container */}
          <Card className="border border-border bg-card shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  {t("calculator.account_capital")} &{" "}
                  {t("calculator.risk_per_trade")}
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
            </CardHeader>

            <CardContent className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              {/* Account Capital */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <label htmlFor="account-capital">
                    {t("calculator.account_capital")}
                  </label>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {currPrefix} Nominal Akun
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
                      setActivePreset(null);
                    }}
                    className="pl-11 text-sm font-bold h-10"
                    min={1}
                  />
                </div>

                {/* Quick Capital Selection Chips */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    {t("calculator.quick_capital")}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {quickCapitalValues.map((amt) => {
                      const isSelected = accountBalance === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          className={cn(
                            "w-full h-8 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all duration-200 cursor-pointer select-none",
                            isSelected
                              ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                              : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                          )}
                          onClick={() => {
                            setAccountBalance(amt);
                            setActivePreset(null);
                          }}
                        >
                          {formatCurrency(amt, 0)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Risk Tolerance Percentage */}
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <label htmlFor="risk-percent">
                    {t("calculator.risk_per_trade")}
                  </label>
                  <span className="text-xs font-bold text-primary">
                    {riskPercent}% = {formatCurrency(stats.maxRiskDollar)}
                  </span>
                </div>

                {/* Risk Pills */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-muted-foreground font-medium block">
                    {t("calculator.quick_risk")}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 1.0, 2.0, 3.0].map((pct) => {
                      const isSelected = riskPercent === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          className={cn(
                            "w-full h-8 rounded-lg border text-xs font-semibold flex items-center justify-center transition-all duration-200 cursor-pointer select-none",
                            isSelected
                              ? "border-primary bg-primary/15 text-primary font-bold ring-1 ring-primary/40 shadow-xs"
                              : "border-border bg-card hover:border-primary/50 hover:bg-muted/40 hover:text-foreground text-muted-foreground",
                          )}
                          onClick={() => {
                            setRiskPercent(pct);
                            setActivePreset(null);
                          }}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Range Slider for Fine Control */}
                <div className="pt-1">
                  <input
                    id="risk-percent"
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={riskPercent}
                    onChange={(e) => {
                      setRiskPercent(Number(e.target.value));
                      setActivePreset(null);
                    }}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>0.1% (Konservatif)</span>
                    <span>1.0% (Standar)</span>
                    <span>5.0% (Agresif)</span>
                  </div>
                </div>
              </div>

              {/* Execution Price Levels */}
              <div className="space-y-2.5 pt-2 border-t border-border/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground block">
                  {t("calculator.price_card_title")}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Entry Price */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="entry-price"
                      className="text-xs font-semibold text-foreground flex items-center justify-between"
                    >
                      <span>{t("calculator.entry_price")}</span>
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
                        className="pl-9 text-sm font-bold border-primary/40 focus-visible:border-primary h-10"
                        step="any"
                      />
                    </div>
                  </div>

                  {/* Stop Loss Price */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="stop-loss-price"
                      className={cn(
                        "text-xs font-semibold flex items-center justify-between",
                        PALETTE.negative.text,
                      )}
                    >
                      <span>{t("calculator.stop_loss_price")}</span>
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
                          "pl-9 text-sm font-bold h-10",
                          PALETTE.negative.border,
                          PALETTE.negative.text,
                        )}
                        step="any"
                      />
                    </div>
                  </div>

                  {/* Take Profit Target Price */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="target-price"
                      className={cn(
                        "text-xs font-semibold flex items-center justify-between",
                        PALETTE.positive.text,
                      )}
                    >
                      <span>{t("calculator.target_price")}</span>
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
                          "pl-9 text-sm font-bold h-10",
                          PALETTE.positive.border,
                          PALETTE.positive.text,
                        )}
                        step="any"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Calculated Results & Risk HUD Container */}
          <Card className="border border-border bg-card shadow-xs overflow-hidden flex flex-col justify-between">
            <CardHeader className="p-5 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  {t("calculator.results")}
                </CardTitle>
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
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              {/* Hero Sizing Display */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                      {t("calculator.position_units")}
                    </span>
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
                  </div>
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
                <div className="text-xs text-muted-foreground font-medium pt-0.5 flex items-center justify-between">
                  <span>{t("calculator.total")}</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(stats.totalPositionValue)}
                  </span>
                </div>
              </div>

              {/* 2x2 Risk & Reward Metrics Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Max Risk (1R) */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border space-y-1",
                    BADGE.negative.border,
                    BADGE.negative.bg,
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider",
                      PALETTE.negative.text,
                    )}
                  >
                    {t("calculator.max_risk")}
                  </div>
                  <div
                    className={cn(
                      "text-xl sm:text-2xl font-black",
                      PALETTE.negative.text,
                    )}
                  >
                    -{formatCurrency(stats.maxRiskDollar)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                    -{stats.stopPercentDistance.toFixed(2)}%{" "}
                    {t("calculator.sl_distance")}
                  </div>
                </div>

                {/* Potential Gain */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border space-y-1",
                    BADGE.positive.border,
                    BADGE.positive.bg,
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] uppercase font-bold tracking-wider",
                      PALETTE.positive.text,
                    )}
                  >
                    {t("calculator.potential_gain")}
                  </div>
                  <div
                    className={cn(
                      "text-xl sm:text-2xl font-black",
                      PALETTE.positive.text,
                    )}
                  >
                    +{formatCurrency(stats.potentialRewardDollar)}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                    +{stats.targetPercentDistance.toFixed(2)}%{" "}
                    {t("calculator.tp_distance")}
                  </div>
                </div>
              </div>

              {/* Risk to Reward Visualizer Card */}
              <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                    {t("calculator.risk_reward")}
                  </span>
                  <span className="text-base font-black text-foreground">
                    1 :{" "}
                    {stats.riskRewardRatio > 0
                      ? stats.riskRewardRatio.toFixed(2)
                      : "0.00"}
                  </span>
                </div>

                {/* Progress ratio split bar */}
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex shadow-inner">
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

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-0.5">
                  <span className={cn("font-semibold", PALETTE.negative.text)}>
                    1R {t("calculator.risk_1r")}
                  </span>
                  <span className="text-muted-foreground">
                    {stats.capitalSizingRatio > 0
                      ? `${stats.capitalSizingRatio.toFixed(1)}x ${t("calculator.position_leverage")}`
                      : ""}
                  </span>
                  <span className={cn("font-semibold", PALETTE.positive.text)}>
                    {stats.riskRewardRatio > 0
                      ? `${stats.riskRewardRatio.toFixed(1)}R Target`
                      : "0R"}
                  </span>
                </div>
              </div>

              {/* Drawdown & Mathematical Edge Callout */}
              <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs leading-relaxed text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-foreground text-xs">
                    {t("calculator.drawdown_title")}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("calculator.drawdown_description")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
