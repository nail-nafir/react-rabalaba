# TSD 02 — Data Flow & State

> 🇮🇩 Flow data market (API → adapter → react-query → engine → UI) + state management (Redux/react-query/Context/i18n).
> 🇺🇸 Market data flow (API → adapter → react-query → engine → UI) + state management (Redux/react-query/Context/i18n).

---

## 🌊 Flow data market / Market data flow

```
External APIs                 Adapters                 react-query cache        Engine              UI
─────────────                 ────────                 ────────────────         ──────              ──
CoinGecko /global + /coins/markets ─▶ adaptCoinGeckoDominance ─▶ ["dominance"] ─▶ crypto context + BTC.D footer ─▶ MarketSummaryRow
Binance derivatives  ───────────────────────────────────▶ ["smart-money",sym]    ─▶ derivePositioning   ─▶ open asset detail
Yahoo chart          ─────────▶ adaptYahooChart + computeSignal ─▶ ["asset-data",sym,…] ─▶ enrichAsset ─▶ applySignalEpisode ─▶ screener / dialog
Supabase episodes    ──────────────────────────────────▶ ["signal-episode-states"] ──────────────────▶ applySignalEpisode
Yahoo quoteSummary   ─────────▶ adaptYahooFundamentals ─▶ ["fundamentals",sym]   ─▶ display-only context ─▶ detail dialog
Yahoo calendar       ─────────▶ fetchEconomicCalendar ──▶ ["economic-calendar"]  ─                      ─▶ CalendarPage
Supabase journal     ─────────▶ rowToFollowedTrade ─────▶ ["journal-trades"]     ─▶ buildTrackerStats   ─▶ JournalDashboard
Supabase profiles    ─────────▶ usePremiumAccess ──────▶ ["profile",uid]         ─                      ─▶ gating
```

### API clients (`src/services/api/`)

| File                  | Endpoint                                                                                            | Via                       |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------- |
| `client.ts:54`        | shared HTTP (timeout, `ApiError`)                                                                   | direct fetch              |
| `coingecko.ts`        | `fetchDominance` → `/api/v3/global` + `/api/v3/coins/markets`; `adaptCoinGeckoDominance` validates + derives BTC.D delta | **direct** (IP visitor)   |
| `binance.ts:76`       | `fetchBinanceDerivatives` (3 endpoint: premiumIndex, openInterestHist, globalLongShortAccountRatio) | **direct** (IP visitor)   |
| `yahoo-finance.ts:82` | chart/search/quoteSummary                                                                           | **CF proxy** `/api/yahoo` |
| `calendar.ts:36`      | Yahoo calendar events                                                                               | **CF proxy** `/api/yahoo` |

### Adapters (`src/services/adapters/`)

| File                       | Fungsi / Function                                                                                                         | Output                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `yahoo-adapter.ts:44`      | `adaptYahooChart`                                                                                                         | `UnifiedAsset` (computeSignal + tradingPlan + dailyChange) |
| `core/market/candles.ts:40`      | `normalizeYahooCandles`, `buildSignalSeriesFromCandles`, `resampleCandles`, `resampleCandlesToDaily`, `deriveCandleTrend` | `NormalizedYahooCandle[]`                                  |
| `yahoo-fundamentals.ts:37` | `adaptYahooFundamentals`                                                                                                  | `Fundamentals \| null`                                     |
| `market-context.ts`        | `adaptCryptoDominanceMarketContext`, Yahoo quote contexts, IHSG realized volatility                                      | `MarketContextByAssetClass`                                 |

### react-query hooks (`src/services/queries/`)

Global default (`app/config/query-client.ts:3`): `staleTime`/`refetchInterval` 300 000ms (5 min), `retry:1`, `refetchOnWindowFocus:false`, `gcTime:5min`.

| Hook                             | queryKey                                   | Cadence                     | Dedupe pattern                                |
| -------------------------------- | ------------------------------------------ | --------------------------- | --------------------------------------------- |
| `useCryptoDominance` (`:14`)     | `["dominance"]`                            | 30 min                      | —                                             |
| `useMarketData(symbols)` (`:28`) | `["asset-data",sym,range,interval]`        | 30 min                      | `useQueries` per-symbol                       |
| `usePeriodCandles` (`:69`)       | `["period-candles",sym,p1,p2,int]`         | `Infinity` (history closed) | —                                             |
| `useYahooSearch` (`:112`)        | `["yahoo-search",q]`                       | 5 min                       | enabled `q.length>=2`                         |
| `useCryptoContext` | shared `["asset-data","BTC-USD",range,interval]` + `["dominance"]` | 30 min | memoized context; no duplicate BTC request |
| `useMarketContexts`              | shared `["dominance"]` + Yahoo keys        | 30 min                      | BTC.D + four other card footers                |
| `useUsContext` (`:25`)           | reuse `["asset-data",^GSPC/^VIX/DX-Y.NYB]` | —                           | subscribe shared cache                        |
| `useIdxContext` (`:25`)          | reuse `["asset-data",^JKSE/USDIDR=X]`      | —                           | subscribe shared cache                        |
| `useSmartMoney` (`:44`)          | `["smart-money",sym]` per crypto           | 30 min                      | `MAX_SYMBOLS=40`, plain object (bukan Map)    |
| `useAssetBacktest` (trading-plan feature) | `["asset-backtest",sym,timeframe,dataUpdatedAt]` | no polling; fresh until candle revision changes | one module worker; abort on final observer removal |
| `useFundamentals` (`:17`)        | `["fundamentals",sym]`                     | 1 day                       | stocks only                                   |
| `useEconomicCalendar` (`:7`)     | `["economic-calendar"]`                    | 30 min                      | poll auto-stop unmount                        |
| `useSignalEpisodeStates` (market feature) | `["signal-episode-states"]` | 60 sec; always refetch mount/window focus | shared state and read status for table/dialog |
| `useJournalTrades` (journal feature) | `["journal-trades"]` | 60 sec; always refetch mount/window focus | premium journal cache |

`applySignalEpisode` publishes only valid active saved setups. Raw candidates stay internally pending and closed same-direction episodes stay blocked; both display Neutral with their respective explanation. Read errors or invalid snapshots display Unavailable. Entry/TP/initial SL/R:R are copied from the episode snapshot, while current market evidence remains live. Manual market/journal refresh and completed admin scans invalidate both episode and journal caches. See [Trading Methodology](../explainer/trading-methodology.md).

> 🇮🇩 Pola kunci: **dedupe-by-shared-key** — context subscribe cache screener (`["asset-data",…]`) → nyaris nol fetch ekstra di `/terminal`. `useMarketContexts` dan `useCryptoContext` berbagi `["dominance"]`; context BTC dan dominance digabung melalui memo tanpa query key BTC tambahan. `useMarketData.combine` stabil dan mengembalikan `dataUpdatedAt` sumber candle.
> 🇺🇸 Key pattern: **dedupe-by-shared-key** — contexts subscribe to the screener cache, while `useMarketContexts` and `useCryptoContext` share `["dominance"]`. BTC and dominance are combined through memoization without another BTC query key. The stable `useMarketData.combine` returns the candle source `dataUpdatedAt`.

---

## 🧠 State management

### Redux (`src/store/`)

Store: `src/store/index.ts:6` — `configureStore({ reducer: { ui, filter, auth } })`. Middleware skip serializability check `auth.session`/`auth.user` (Supabase Session/User besar + library-typed). Typed `useAppDispatch`/`useAppSelector` (`hooks.ts:9`). Bound action selectors `useUIActions`/`useFilterActions` (stable identity).

| Slice             | State                                      | Actions                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-slice.ts`   | `session`, `user`, `ready`                 | `setSession`, `setReady`                                                                                                                                                                                                                                        |
| `ui-slice.ts`     | `isPageLoading`                            | `setPageLoading`. Dialog market/jurnal memakai controlled state lokal untuk memasang content hanya saat terbuka; Dialog/AlertDialog yang menunggu mutation async memakai controlled state lokal agar hanya menutup setelah sukses. Redux tidak menyimpan visibility overlay. |
| `filter-slice.ts` | `assetType`, `signalFilter`, `searchQuery` | `setAssetType`/`setSignalFilter`/`setSearchQuery`/`resetFilters`                                                                                                                                                                                                |

> Screener subscribe filter state + actions. Visibility overlay tidak masuk Redux, jadi buka/tutup dialog tidak memicu re-render screener.

### Server state = react-query

`QueryClient` adalah de-facto server-state store. Semua data Supabase + API di react-query. 5-min cadence app-wide, tightened per-query.

### Context

- `ThemeProvider` (`src/components/theme-provider.tsx:23`) — dark/light/system, persist `localStorage("rabalaba-theme")`.

### i18n

- `src/app/config/i18n.ts` — i18next + react-i18next + LanguageDetector. `en`/`id`, default/fallback `id`. 1 124 translation leaf per locale, parity. Detection `localStorage → navigator`. Single `translation` namespace, flat dot-path keys. Tidak ada provider component — side-effect import di `main.tsx:4`.

> 🇮🇩 **Gak ada Zustand lagi** — `favorite-store` zustand+persist diganti `useFavorites` (Supabase `user_favorites`); localStorage grant diganti `use-premium-access`.
> 🇺🇸 **No Zustand anymore** — the old `favorite-store` was replaced by `useFavorites`; the localStorage grant by `use-premium-access`.

---

## 🪝 Custom hooks non-query (`src/hooks/`)

Feature hooks: auth/access/invitation/disclaimer in `src/features/auth/hooks/`; favorites/universe in `src/features/market/hooks/`; admin/assets/settings/subscription/payment in `src/features/management/hooks/`; session activity in `src/app/hooks/`. Generic utility: `use-debounce`, `use-media-query`, `use-table-pagination` in `src/hooks/`.

---

## 🔗 Terkait / Related

- [`00-architecture.md`](00-architecture.md) — layering
- [`../fsd/01-terminal-screener.md`](../fsd/01-terminal-screener.md) — konsumen engine
- [`04-cloudflare-proxy.md`](04-cloudflare-proxy.md) — proxy detail

## Browser execution / Eksekusi browser

🇮🇩 Screener memakai `applyOptionalOverlays: false`. Detail market/jurnal hanya memasang query, normalisasi candle, dan analisis ketika dibuka. Backtest memakai engine yang sama melalui [Vite module worker](https://vite.dev/guide/features#web-workers); Promise mengonsumsi AbortSignal React Query dan menghentikan worker pada cancel/sukses/error. Statistik dapat retry terpisah. Tidak ada pool, dependensi baru, atau perubahan kontrak API.

🇺🇸 The screener disables optional overlays. Market/journal detail mounts queries, candle normalization, and analysis only while open. Backtesting uses the same engine through a Vite module worker; its Promise consumes React Query's AbortSignal and terminates the worker on cancellation/success/error. Statistics retry independently. No worker pool, new dependency, or API-contract change is introduced.

🇮🇩 State chat dimiliki ResearchCopilot. Launcher tetap berupa floating action button pada mobile dan desktop. Panel berada di luar Header agar fixed positioning tidak mengikuti backdrop-filter header. Buka chat memindahkan fokus ke tombol tutup; Escape menutup panel dan fokus kembali ke pemicu. ID baris simbol/UUID jurnal mempertahankan identitas; refresh mempertahankan halaman dan perubahan filter/search/sort meresetnya.

🇺🇸 ResearchCopilot owns chat visibility. Both mobile and desktop use a floating action button. The panel stays outside Header, avoiding the backdrop-filter containing block. Opening chat focuses its close button; Escape closes the panel and restores trigger focus. Symbol/journal-UUID row IDs preserve identity; refresh keeps the page and filters/search/sort reset it.
