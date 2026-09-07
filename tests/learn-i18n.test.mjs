import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const FEATURE = resolve("src/features/learn");
const STRATEGY_DATA = resolve("src/features/learn/data/strategy-data.ts");
const CHART_DATA = resolve("src/features/learn/data/chart-pattern-data.ts");
const PATTERN_VISUAL = resolve(
  "src/features/learn/components/pattern-visual.tsx",
);
const INTERACTIVE_QUIZ = resolve(
  "src/features/learn/components/interactive-quiz.tsx",
);
const CANDLESTICK_SIMULATOR = resolve(
  "src/features/learn/components/candlestick-simulator.tsx",
);
const CHART_SIMULATOR = resolve(
  "src/features/learn/components/chart-pattern-simulator.tsx",
);
const resources = Object.fromEntries(
  ["en", "id"].map((language) => [
    language,
    JSON.parse(
      readFileSync(resolve(`src/assets/locales/${language}.json`), "utf8"),
    ),
  ]),
);
const locales = Object.fromEntries(
  Object.entries(resources).map(([language, resource]) => [
    language,
    resource.learn,
  ]),
);

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? files(path)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, shape(child)]),
    );
  }
  return typeof value;
}

function get(value, path) {
  return path.split(".").reduce((current, key) => current?.[key], value);
}

test("Learn locales stay complete and structurally identical", () => {
  assert.deepEqual(shape(locales.en), shape(locales.id));

  for (const [language, locale] of Object.entries(locales)) {
    const content = JSON.stringify(locale);
    assert.doesNotMatch(content, /""/, language);
    assert.equal(Object.keys(locale.patterns.candlestick).length, 24);
    assert.equal(Object.keys(locale.patterns.chart).length, 22);
    assert.equal(Object.keys(locale.strategies.items).length, 24);
    assert.equal(Object.keys(locale.quiz.questions).length, 30);
  }
});

test("Learn copy uses the normalized labels and titles", () => {
  assert.equal(
    locales.id.subtitle,
    "Bedah candlestick, pola chart, indikator, struktur, dan likuiditas untuk trading lebih tajam.",
  );
  assert.equal(
    locales.en.subtitle,
    "Study candlesticks, chart patterns, indicators, structure, and liquidity for sharper trading.",
  );
  assert.equal(locales.id.strategies_ui.results, "{{count}} strategi");
  assert.equal(locales.en.strategies_ui.results, "{{count}} strategies");
  assert.equal(
    locales.id.cheatsheet.search_placeholder,
    "Cari pola candlestick, pola chart, atau nama pola...",
  );
  assert.equal(
    locales.en.cheatsheet.search_placeholder,
    "Search candlesticks, chart patterns, or pattern names...",
  );
  assert.equal(
    locales.id.strategies_ui.search_placeholder,
    "Cari indikator, struktur, likuiditas, atau setup...",
  );
  assert.equal(
    locales.en.strategies_ui.search_placeholder,
    "Search indicators, structure, liquidity, or setups...",
  );
  assert.equal(
    locales.id.candlestick_simulator.presets.long_legged,
    "Long Legged Doji",
  );
  assert.equal(
    locales.en.candlestick_simulator.presets.long_legged,
    "Long Legged Doji",
  );
  assert.equal(
    locales.en.candlestick_simulator.detected.long_legged,
    "Long Legged Doji (High Volatility Indecision)",
  );
  assert.equal(
    locales.id.chart_simulator.presets.head_and_shoulders.name,
    "Head & Shoulders",
  );
  assert.equal(
    locales.en.chart_simulator.presets.inverse_head_and_shoulders.name,
    "Inverse Head & Shoulders",
  );

  assert.deepEqual(
    {
      id: {
        indicators: locales.id.common.strategy_categories.indicators,
        liquidity: locales.id.common.strategy_categories.smc,
        structure: locales.id.common.strategy_categories.market_structure,
        candlestick: locales.id.overview.pattern_filters.candlestick,
        chart: locales.id.overview.pattern_filters.chart,
      },
      en: {
        indicators: locales.en.common.strategy_categories.indicators,
        liquidity: locales.en.common.strategy_categories.smc,
        structure: locales.en.common.strategy_categories.market_structure,
        candlestick: locales.en.overview.pattern_filters.candlestick,
        chart: locales.en.overview.pattern_filters.chart,
      },
    },
    {
      id: {
        indicators: "Indikator",
        liquidity: "Likuiditas",
        structure: "Struktur",
        candlestick: "Candlestick",
        chart: "Pola Chart",
      },
      en: {
        indicators: "Indicators",
        liquidity: "Liquidity",
        structure: "Structure",
        candlestick: "Candlesticks",
        chart: "Chart Patterns",
      },
    },
  );

  assert.equal(
    locales.id.strategies.items.smc_market_structure.title,
    "Baca Struktur dan Perubahan Tren",
  );
  assert.equal(
    locales.en.strategies.items.smc_market_structure.title,
    "Reading Structure and Trend Shifts",
  );
  assert.equal(
    locales.id.strategies.items.rsi_divergence_mastery.title,
    "Penguasaan RSI Divergence Reversal Reguler dan Hidden Continuation",
  );
  assert.equal(
    locales.en.strategies.items.rsi_divergence_mastery.title,
    "RSI Divergence Regular Reversal and Hidden Continuation",
  );
  for (const [language, locale] of Object.entries(locales)) {
    const emaStrategy = JSON.stringify(
      locale.strategies.items.moving_average_cross,
    );
    assert.match(emaStrategy, /Golden Cross/, `${language}.moving_average_cross`);
    assert.match(emaStrategy, /Death Cross/, `${language}.moving_average_cross`);
    assert.equal(locale.visual.golden_cross, "GOLDEN CROSS");
    assert.equal(locale.visual.death_cross, "DEATH CROSS");
  }

  for (const [language, locale] of Object.entries(locales)) {
    const content = JSON.stringify(locale);
    assert.doesNotMatch(content, /smart money/i, language);
    for (const [id, item] of Object.entries(locale.strategies.items)) {
      assert.doesNotMatch(item.title, /Buy-Side|Sell-Side|Multi-Timeframe|Top-Down/, `${language}.${id}`);
    }
    assert.doesNotMatch(
      locale.strategies.items.rsi_divergence_mastery.title,
      /:/,
      `${language}.rsi_divergence_mastery.title`,
    );
  }
});

test("Learn source has one i18n path and no language-specific fields", () => {
  const source = files(FEATURE)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /i18n\.(?:language|resolvedLanguage)/);
  assert.doesNotMatch(source, /\bisId\b/);
  assert.doesNotMatch(
    source,
    /\b(?:name|title|summary|description|psychology|rules|proTip|question|text|explanation|warningMessage)Id\b/,
  );

  const staticKeys = [
    ...source.matchAll(/\bt\(\s*["']((?:learn|calculator)\.[^"']+)["']/g),
  ].map((match) => match[1]);
  for (const key of staticKeys) {
    for (const [language, resource] of Object.entries(resources)) {
      assert.notEqual(get(resource, key), undefined, `${language}.${key}`);
    }
  }
});

test("Learn visible copy stays in locale resources", () => {
  const quizSource = readFileSync(INTERACTIVE_QUIZ, "utf8");
  const visualSource = readFileSync(PATTERN_VISUAL, "utf8");

  for (const [language, locale] of Object.entries(locales)) {
    assert.ok(locale.quiz_ui.target_badge, `${language}.quiz_ui.target_badge`);
    for (const key of [
      "signal",
      "retest",
      "price",
      "resistance",
      "support",
      "buy_side_liquidity",
      "sell_side_liquidity",
      "sweep",
      "order_block",
      "premium",
      "discount",
      "breaker",
      "liquidity",
      "reclaim",
      "displacement",
    ]) {
      assert.ok(locale.visual[key], `${language}.visual.${key}`);
    }
  }

  for (const key of [
    "badge_questions",
    "rules_timer",
    "target_badge",
  ]) {
    assert.match(quizSource, new RegExp(`t\\(["']learn\\.quiz_ui\\.${key}`));
  }
  assert.doesNotMatch(quizSource, />\s*(?:5 Soal|30 Detik per Soal|Target 60%)\s*</);

  for (const key of [
    "signal",
    "retest",
    "price",
    "resistance",
    "support",
    "buy_side_liquidity",
    "sell_side_liquidity",
    "sweep",
    "order_block",
    "premium",
    "discount",
    "breaker",
    "liquidity",
    "reclaim",
    "displacement",
  ]) {
    assert.match(
      visualSource,
      new RegExp(`t\\(["']learn\\.visual\\.${key}`),
      `learn.visual.${key}`,
    );
  }

  for (const label of [
    "SIGNAL",
    "RETEST",
    "PRICE",
    "RESISTANCE",
    "SUPPORT",
    "BUY-SIDE LIQUIDITY",
    "SELL-SIDE LIQUIDITY",
    "SWEEP",
    "ORDER BLOCK",
    "PREMIUM",
    "DISCOUNT",
    "BREAKER",
    "LIQUIDITY",
    "RECLAIM",
    "DISPLACEMENT",
  ]) {
    const escaped = label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
    assert.doesNotMatch(
      visualSource,
      new RegExp(`>\\s*${escaped}\\s*<`),
      `hardcoded visual label: ${label}`,
    );
  }
  assert.doesNotMatch(visualSource, /["'](?:BUY-SIDE|SELL-SIDE) LIQUIDITY["']/);
});

test("Learn strategy visuals stay one-to-one and implemented", () => {
  const strategySource = readFileSync(STRATEGY_DATA, "utf8");
  const svgTypes = [...strategySource.matchAll(/svgType: "([^"]+)"/g)].map(
    ([, svgType]) => svgType,
  );
  const visualSource = readFileSync(PATTERN_VISUAL, "utf8");

  assert.equal(new Set(svgTypes).size, svgTypes.length);
  for (const svgType of svgTypes) {
    assert.match(visualSource, new RegExp(`case "${svgType}"`), svgType);
  }
  const emaVisual = visualSource.slice(
    visualSource.indexOf('case "ema_strategy"'),
    visualSource.indexOf('case "rsi_divergence"'),
  );
  assert.equal((emaVisual.match(/<path\b/g) ?? []).length, 3);
  assert.equal((emaVisual.match(/<circle\b/g) ?? []).length, 2);
  assert.equal((emaVisual.match(/fontSize="8"/g) ?? []).length, 5);
  assert.match(emaVisual, /golden_cross/);
  assert.match(emaVisual, /death_cross/);
  assert.doesNotMatch(emaVisual, /strokeDasharray|stroke=\{green\}|stroke=\{red\}/);

  const bollingerVisual = visualSource.slice(
    visualSource.indexOf('case "bollinger_strategy"'),
    visualSource.indexOf('case "mtf_strategy"'),
  );
  assert.equal((bollingerVisual.match(/<path\b/g) ?? []).length, 6);
  assert.match(bollingerVisual, /fill=\{primary\}[\s\S]*fillOpacity="0\.08"/);
  assert.match(bollingerVisual, /stroke=\{primary\}/);
  assert.match(bollingerVisual, /stroke=\{muted\}/);
  assert.match(bollingerVisual, /stroke=\{green\}/);
  assert.match(bollingerVisual, /cx="130" cy="68" r="4"/);
  assert.match(bollingerVisual, /learn\.visual\.squeeze/);
  assert.match(bollingerVisual, /learn\.visual\.expansion/);
  assert.match(bollingerVisual, /strokeLinecap="round"[\s\S]*strokeLinejoin="round"/);
  assert.doesNotMatch(bollingerVisual, /strokeDasharray/);
});

test("Learn SVG visuals use the shared palette", () => {
  const patternSource = readFileSync(PATTERN_VISUAL, "utf8");
  const candlestickSource = readFileSync(CANDLESTICK_SIMULATOR, "utf8");
  const chartSource = readFileSync(CHART_SIMULATOR, "utf8");
  const visualSource = [patternSource, candlestickSource, chartSource].join(
    "\n",
  );

  assert.doesNotMatch(visualSource, /#[0-9a-f]{3,8}/i);
  for (const token of [
    "PALETTE.positive.fill",
    "PALETTE.negative.fill",
    "PALETTE.accent.fill",
    "PALETTE.warning.fill",
    "PALETTE.neutral.fill",
  ]) {
    assert.match(patternSource, new RegExp(token), token);
  }
  for (const token of [
    "PALETTE.positive.fill",
    "PALETTE.negative.fill",
    "PALETTE.neutral.fill",
  ]) {
    assert.match(candlestickSource, new RegExp(token), token);
  }
  for (const token of [
    "PALETTE.positive.fill",
    "PALETTE.negative.fill",
    "PALETTE.warning.fill",
    "PALETTE.neutral.fill",
  ]) {
    assert.match(chartSource, new RegExp(token), token);
  }
  assert.match(candlestickSource, /fill="currentColor"/);
});

test("Inverse Cup and Handle is complete across catalog and simulator", () => {
  const chartSource = readFileSync(CHART_DATA, "utf8");
  const chartIds = [
    ...chartSource.matchAll(/id: "([^"]+)"/g),
  ].map(([, id]) => id);
  const visualSource = readFileSync(PATTERN_VISUAL, "utf8");
  const simulatorSource = readFileSync(CHART_SIMULATOR, "utf8");

  assert.equal(new Set(chartIds).size, chartIds.length);
  assert.match(chartSource, /id: "inverse_cup_and_handle"[\s\S]*svgType: "inverse_cup_and_handle"/);
  assert.match(visualSource, /case "inverse_cup_and_handle"/);
  assert.match(simulatorSource, /id: "inverse_cup_and_handle"/);
  assert.match(simulatorSource, /selectedPresetId === "inverse_cup_and_handle"/);

  for (const [language, locale] of Object.entries(locales)) {
    assert.deepEqual(
      Object.keys(locale.patterns.chart).sort(),
      [...chartIds].sort(),
      `${language}.patterns.chart`,
    );
    for (const field of [
      "name",
      "description",
      "psychology",
      "structure_rules",
      "neckline_rule",
      "target_calculation",
      "stop_loss_placement",
      "false_breakout_warning",
      "pro_tip",
    ]) {
      assert.ok(
        locale.patterns.chart.inverse_cup_and_handle[field],
        `${language}.patterns.chart.inverse_cup_and_handle.${field}`,
      );
    }
    assert.ok(
      locale.chart_simulator.presets.inverse_cup_and_handle.description,
      `${language}.chart_simulator.presets.inverse_cup_and_handle.description`,
    );
    assert.ok(
      locale.chart_simulator.presets.inverse_cup_and_handle.pro_tip,
      `${language}.chart_simulator.presets.inverse_cup_and_handle.pro_tip`,
    );
  }
});

test("Learn identifiers use underscores", () => {
  const source = files(FEATURE)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /(?:id|category|svgType):\s*"[^"]*-/);
  assert.doesNotMatch(source, /\bcase\s*"[^"]*-/);
  assert.doesNotMatch(
    source,
    /\b(?:type|selectedPresetId)\s*(?:===|!==)\s*"[^"]*-/,
  );
});
