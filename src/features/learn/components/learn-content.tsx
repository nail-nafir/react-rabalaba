import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FilterGroup } from "@/components/shared/filter-group";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { CANDLESTICK_PATTERNS } from "../data/candlestick-data";
import { CHART_PATTERNS } from "../data/chart-pattern-data";
import { LearnSimulatorDialog } from "./learn-simulator-dialog";
import { PatternCard } from "./pattern-card";
import { StrategySection } from "./strategy-section";
import { InteractiveQuiz } from "./interactive-quiz";
import { CheatsheetTable } from "./cheatsheet-table";
import { Search, X } from "lucide-react";

export type LearnTab = "patterns" | "strategies" | "quiz";
type PatternCategory = "all" | "candlestick" | "chart";
type BiasFilter = "all" | "bullish" | "bearish" | "bilateral";
type ViewMode = "cards" | "table";

export const LearnContent: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<LearnTab>("patterns");
  const [patternCategory, setPatternCategory] =
    useState<PatternCategory>("all");
  const [biasFilter, setBiasFilter] = useState<BiasFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const tabOptions = [
    {
      value: "patterns",
      label: t("learn.overview.tabs.patterns"),
    },
    {
      value: "strategies",
      label: t("learn.overview.tabs.strategies"),
    },
    { value: "quiz", label: t("learn.overview.tabs.quiz") },
  ];

  const patternCategoryOptions = [
    { value: "all" as const, label: t("learn.overview.pattern_filters.all") },
    {
      value: "candlestick" as const,
      label: t("learn.overview.pattern_filters.candlestick"),
    },
    {
      value: "chart" as const,
      label: t("learn.overview.pattern_filters.chart"),
    },
  ];

  const biasFilterOptions = [
    { value: "all" as const, label: t("learn.cheatsheet.filters.all") },
    { value: "bullish" as const, label: t("learn.cheatsheet.filters.bullish") },
    { value: "bearish" as const, label: t("learn.cheatsheet.filters.bearish") },
    {
      value: "bilateral" as const,
      label: t("learn.cheatsheet.filters.bilateral"),
    },
  ];

  const viewModeOptions = [
    { value: "cards" as const, label: t("learn.overview.view_modes.cards") },
    { value: "table" as const, label: t("learn.overview.view_modes.table") },
  ];

  // Unified Filtered Patterns based on category, bias, and search
  const filteredPatterns = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let base = [...CANDLESTICK_PATTERNS, ...CHART_PATTERNS];
    if (patternCategory === "candlestick") base = CANDLESTICK_PATTERNS;
    if (patternCategory === "chart") base = CHART_PATTERNS;

    return base.filter((item) => {
      const isCandle = item.category.startsWith("candlestick");
      const patternKey = `learn.patterns.${isCandle ? "candlestick" : "chart"}.${item.id}`;

      const matchesSearch =
        !query ||
        [
          t(`${patternKey}.name`),
          t(`${patternKey}.description`),
          isCandle
            ? t(`${patternKey}.entry_trigger`)
            : t(`${patternKey}.neckline_rule`),
          "nativeName" in item ? item.nativeName : undefined,
        ].some((value) => value?.toLowerCase().includes(query));

      const matchesBias = biasFilter === "all" || item.bias === biasFilter;

      return matchesSearch && matchesBias;
    });
  }, [patternCategory, biasFilter, searchQuery, t]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header & Navigation Tabs (space-between) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold uppercase tracking-tight text-foreground">
            {t("learn.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("learn.subtitle")}
          </p>
        </div>

        <FilterGroup
          value={activeTab}
          options={tabOptions}
          onChange={(tab) => setActiveTab(tab as LearnTab)}
        />
      </div>

      <Separator />

      {/* Tab 1: Patterns & Formations */}
      {activeTab === "patterns" && (
        <section className="flex flex-col gap-4">
          {/* Section Header Info */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t("learn.overview.catalog.title")}
            </h2>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
              {t("learn.cheatsheet.patterns_found", {
                count: filteredPatterns.length,
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Row 1: Filters (Category + Separator + Bias Select) on Left, View Switcher on Right */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FilterGroup
                  value={patternCategory}
                  options={patternCategoryOptions}
                  onChange={(cat) => setPatternCategory(cat as PatternCategory)}
                  className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
                />

                <Separator orientation="vertical" className="mx-1 h-8" />

                <FilterGroup
                  value={biasFilter}
                  options={biasFilterOptions}
                  onChange={(b) => setBiasFilter(b as BiasFilter)}
                  variant="select"
                  className="flex-1 sm:flex-none"
                />
              </div>

              {/* View Switcher */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <FilterGroup
                  value={viewMode}
                  options={viewModeOptions}
                  onChange={(v) => setViewMode(v as ViewMode)}
                />
              </div>
            </div>

            {/* Row 2: Search Input and Actions Group (Terminal style) */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder={t("learn.cheatsheet.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 text-sm placeholder:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Separator orientation="vertical" className="mx-2 h-9" />

              <div className="flex items-center gap-2 shrink-0">
                <LearnSimulatorDialog
                  defaultMode={
                    patternCategory === "chart" ? "chart" : "candlestick"
                  }
                />
              </div>
            </div>
          </div>

          {/* View Mode Content */}
          {viewMode === "cards" ? (
            filteredPatterns.length === 0 ? (
              <div className="rounded-md border p-12 text-center text-xs text-muted-foreground">
                {t("learn.cheatsheet.empty")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
                {filteredPatterns.map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            )
          ) : (
            <CheatsheetTable patterns={filteredPatterns} />
          )}
        </section>
      )}

      {/* Tab 2: Strategies, Indicators & SMC */}
      {activeTab === "strategies" && <StrategySection />}

      {/* Tab 3: Trading Aptitude Assessment Quiz */}
      {activeTab === "quiz" && <InteractiveQuiz />}
    </div>
  );
};
