/** US-equities static reference data — the macro drivers for `us-stock`
 *  signals. All free-data driven (Yahoo symbols), mirroring constants/idx.ts. */

/** S&P 500 — the macro driver for US stocks. Already fetched by the market
 *  summary row (MARKET_INDICES), so consumers share its cache. */
export const US_BENCHMARK_SYMBOL = "^GSPC";

/** CBOE Volatility Index ("fear gauge"). A VIX spike is risk-off pressure for
 *  equities, so it acts as a risk tiebreak when the S&P is indecisive. */
export const VIX_SYMBOL = "^VIX";

/** US Dollar Index. A surging dollar is risk-off pressure for equities/risk
 *  assets, so it acts as a second tiebreak alongside VIX. */
export const DXY_SYMBOL = "DX-Y.NYB";
