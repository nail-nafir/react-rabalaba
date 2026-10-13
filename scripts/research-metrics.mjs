/** Pure research statistics. Win rate is in percentage points, BE stays in n. */
export function aggregate(trades, { gross = false, costMultiplier = 1 } = {}) {
  let wins = 0, profit = 0, loss = 0, equity = 0, peak = 0, drawdown = 0;
  const exits = new Map();
  for (const trade of trades) {
    const r = gross ? trade.grossR : trade.grossR - costMultiplier * (trade.grossR - trade.r);
    if (!Number.isFinite(r) || !Number.isFinite(trade.exitTimestamp)) throw new Error("Invalid research trade");
    if (r > 0) { wins++; profit += r; } else loss -= r;
    exits.set(trade.exitTimestamp, (exits.get(trade.exitTimestamp) ?? 0) + r);
  }
  // Concurrent closes form one equal-risk basket; symbol order cannot alter DD.
  for (const [, r] of [...exits].sort(([a], [b]) => a - b)) {
    equity += r;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, peak - equity);
  }
  return {
    trades: trades.length,
    winRate: trades.length ? wins / trades.length * 100 : 0,
    expectancy: trades.length ? (profit - loss) / trades.length : 0,
    profitFactor: loss > 0 ? profit / loss : profit > 0 ? Infinity : 0,
    maxDrawdownR: drawdown,
  };
}

export function passesMetrics(candidate, baseline) {
  return baseline.trades > 0 && candidate.trades > 0 &&
    candidate.winRate >= baseline.winRate + 2 &&
    candidate.expectancy >= baseline.expectancy + 0.05 &&
    candidate.profitFactor >= Math.max(1.1, baseline.profitFactor) &&
    candidate.maxDrawdownR <= baseline.maxDrawdownR + 1e-10 &&
    candidate.trades >= baseline.trades * 0.5;
}

export function windowTrades(trades, start, end) {
  return trades.filter((t) => t.exitReason !== "end_of_data" &&
    (t.decisionClosedAt ?? t.decisionTimestamp + 3600) >= start &&
    t.entryTimestamp >= start && t.exitTimestamp >= t.entryTimestamp &&
    (t.exitClosedAt ?? t.exitTimestamp + 3600) <= end);
}

export function pairedBlockBootstrap(candidate, baseline, start, end, { iterations = 1000, blockDays = 7, seed = 73421 } = {}) {
  const size = blockDays * 86400;
  const count = Math.ceil((end - start) / size);
  if (count < 1 || iterations < 1 || !Number.isInteger(iterations)) throw new Error("Invalid bootstrap window");
  const buckets = (trades) => {
    const result = Array.from({ length: count }, () => []);
    for (const trade of trades) {
      const i = Math.floor((trade.exitTimestamp - start) / size);
      if (i >= 0 && i < count) result[i].push(trade);
    }
    return result;
  };
  const a = buckets(candidate), b = buckets(baseline);
  const occupiedBlocks = b.filter((block) => block.length).length;
  const deltas = { winRate: [], expectancy: [] };
  for (let draw = 0; draw < iterations; draw++) {
    const ca = [], cb = [];
    for (let i = 0; i < count; i++) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const block = Math.floor(seed / 2 ** 32 * count);
      // The same time block carries ALL assets and BOTH strategies together.
      ca.push(...a[block]); cb.push(...b[block]);
    }
    if (!ca.length || !cb.length) continue;
    const ma = aggregate(ca), mb = aggregate(cb);
    deltas.winRate.push(ma.winRate - mb.winRate);
    deltas.expectancy.push(ma.expectancy - mb.expectancy);
  }
  const interval = (values) => {
    values.sort((a, b) => a - b);
    return values.length ? [values[Math.floor((values.length - 1) * 0.025)], values[Math.ceil((values.length - 1) * 0.975)]] : null;
  };
  return {
    blockDays, iterations, occupiedBlocks,
    sufficient: baseline.length >= 100 && candidate.length >= 50 && occupiedBlocks >= 12,
    winRateDelta95: interval(deltas.winRate), expectancyDelta95: interval(deltas.expectancy),
  };
}

export function compare(candidate, baseline, start, end, classes) {
  const normal = { candidate: aggregate(candidate), baseline: aggregate(baseline) };
  const stressed = { candidate: aggregate(candidate, { costMultiplier: 2 }), baseline: aggregate(baseline, { costMultiplier: 2 }) };
  const byClass = Object.fromEntries(classes.map((assetType) => {
    const c = candidate.filter((t) => t.assetType === assetType), b = baseline.filter((t) => t.assetType === assetType);
    const costs = [1, 2].map((costMultiplier) => {
      const cm = aggregate(c, { costMultiplier }), bm = aggregate(b, { costMultiplier });
      return { costMultiplier, candidate: cm, baseline: bm,
        nonDegrading: cm.trades >= bm.trades * 0.5 && cm.winRate >= bm.winRate && cm.expectancy >= bm.expectancy &&
          cm.profitFactor >= bm.profitFactor && cm.maxDrawdownR <= bm.maxDrawdownR + 1e-10 };
    });
    return [assetType, { sufficient: b.length >= 20 && c.length >= 10, costs }];
  }));
  const uncertainty = pairedBlockBootstrap(candidate, baseline, start, end);
  const stressUncertainty = pairedBlockBootstrap(candidate.map((t) => ({ ...t, r: t.grossR - 2 * (t.grossR - t.r) })), baseline.map((t) => ({ ...t, r: t.grossR - 2 * (t.grossR - t.r) })), start, end);
  const pointPass = passesMetrics(normal.candidate, normal.baseline) && passesMetrics(stressed.candidate, stressed.baseline) &&
    Object.values(byClass).every((c) => c.costs.every((cost) => cost.nonDegrading));
  const sufficient = uncertainty.sufficient && Object.values(byClass).every((c) => c.sufficient);
  const supported = [uncertainty, stressUncertainty].every((u) => u.winRateDelta95?.[0] > 0 && u.expectancyDelta95?.[0] > 0);
  return { status: !sufficient ? "unproven" : !pointPass ? "failed" : supported ? "passed" : "unproven", normal, stressed, byClass, uncertainty, stressUncertainty };
}

export function selectCandidate(results) {
  return Object.entries(results).filter(([, result]) => result.status === "passed")
    .sort(([a, x], [b, y]) => (y.normal.candidate.expectancy - y.normal.baseline.expectancy) -
      (x.normal.candidate.expectancy - x.normal.baseline.expectancy) || a.localeCompare(b))[0]?.[0] ?? null;
}

export function cohortReport(trades) {
  const summarize = (rows) => ({ gross: aggregate(rows, { gross: true }), net: aggregate(rows), netDoubleCost: aggregate(rows, { costMultiplier: 2 }) });
  return {
    ...summarize(trades),
    cohorts: Object.fromEntries(["engineVersion", "assetType", "direction", "regime", "tier", "exitReason"].map((key) => [key,
      Object.fromEntries([...new Set(trades.map((t) => t[key] ?? "unavailable"))].map((value) => [value, summarize(trades.filter((t) => (t[key] ?? "unavailable") === value))])),
    ])),
  };
}
