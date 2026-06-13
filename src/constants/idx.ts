/** IDX (Indonesia Stock Exchange) static reference data. All free-data
 *  driven: symbols resolve against Yahoo, the rest are tables maintained in
 *  code (no IDX API — see the engine plan). */

/** IHSG composite index — the macro driver for .JK stocks. Already fetched by
 *  the market summary row (MARKET_INDICES), so consumers share its cache. */
export const IDX_BENCHMARK_SYMBOL = "^JKSE";

/** USD/IDR — rupiah-pressure proxy. Foreign outflow shows up in FX first, so
 *  this acts as the risk tiebreak when IHSG is indecisive. Already fetched by
 *  the forex sleeve (DEFAULT_FOREX_TICKERS). */
export const USDIDR_SYMBOL = "USDIDR=X";

/** Daily auto-reject (ARA/ARB) price bands per IDX "normalisasi tahap II"
 *  (effective 4 Sep 2023): symmetric 35% / 25% / 20% by price tier, floor
 *  price Rp50 (below → no band, the stock can't trade lower anyway).
 *  ⚠️ VERIFY before release — regulation can change, and the special
 *  monitoring board (full call auction, ±10%) is NOT detectable from OHLC,
 *  so downstream warnings must stay phrased as approximate.
 *  `ara`/`arb` are split so a future asymmetric regime is a one-line change. */
export const IDX_AUTO_REJECT_TIERS = [
  // Rp50 – Rp200
  { minPrice: 50, maxPrice: 200, ara: 0.35, arb: 0.35 },
  // Rp200 – Rp5.000
  { minPrice: 200, maxPrice: 5_000, ara: 0.25, arb: 0.25 },
  // > Rp5.000
  { minPrice: 5_000, maxPrice: Infinity, ara: 0.2, arb: 0.2 },
];

/** Idul Fitri (Lebaran) day-1 dates, used by the IHSG seasonality engine to
 *  window the pre/post-Lebaran effect. Trading-day indexing downstream skips
 *  the cuti bersama gaps automatically.
 *  ⚠️ 2026+ are astronomical projections — VERIFY against sidang isbat. */
export const LEBARAN_DATES = [
  "2021-05-13",
  "2022-05-02",
  "2023-04-22",
  "2024-04-10",
  "2025-03-31",
  "2026-03-20", // VERIFY (projection)
  "2027-03-09", // VERIFY (projection)
];
