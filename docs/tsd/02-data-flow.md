# TSD 02 — Data Flow & State

> 🇮🇩 Flow data market (API → adapter → react-query → engine → UI) + state management (Redux/react-query/Context/i18n).
> 🇺🇸 Market data flow (API → adapter → react-query → engine → UI) + state management (Redux/react-query/Context/i18n).

---

## 🌊 Flow data market / Market data flow

```
External APIs                 Adapters                 react-query cache        Engine              UI
─────────────                 ────────                 ────────────────         ──────              ──
CoinGecko /global    ───────────────────────────────────▶ ["dominance"]          ─▶ deriveCryptoContext ─▶ MarketSummaryRow
Binance derivatives  ───────────────────────────────────▶ ["smart-money",sym]    ─▶ derivePositioning   ─▶ AssetSignalTable
alternative.me F&G   ─────────▶ fetchFearGreedIndex ────▶ ["fear-greed"]         ─▶ sentiment           ─▶ FearGreedBar
Yahoo chart          ─────────▶ adaptYahooChart ───────▶ ["asset-data",sym,…]   ─▶ computeSignal        ─▶ screener / dialog
Yahoo quoteSummary   ─────────▶ adaptYahooFundamentals ─▶ ["fundamentals",sym]   ─▶ applyFundamentals    ─▶ detail dialog
Yahoo calendar       ─────────▶ fetchEconomicCalendar ──▶ ["economic-calendar"]  ─                      ─▶ CalendarPage
Supabase journal     ─────────▶ rowToFollowedTrade ─────▶ ["journal-trades"]     ─▶ buildTrackerStats   ─▶ JournalDashboard
Supabase profiles    ─────────▶ usePremiumAccess ──────▶ ["profile",uid]         ─                      ─▶ gating
```

### API clients (`src/services/api/`)
| File | Endpoint | Via |
|---|---|---|
| `client.ts:54` | shared HTTP (timeout, `ApiError`) | direct fetch |
| `coingecko.ts:18` | `fetchDominance` → `api.coingecko.com/api/v3/global` | **direct** (IP visitor) |
| `binance.ts:76` | `fetchBinanceDerivatives` (3 endpoint: premiumIndex, openInterestHist, globalLongShortAccountRatio) | **direct** (IP visitor) |
| `yahoo-finance.ts:82` | chart/search/quoteSummary | **CF proxy** `/api/yahoo` |
| `fear-greed.ts:13` | alternative.me F&G | **CF proxy** `/api/fng` |
| `calendar.ts:36` | Yahoo calendar events | **CF proxy** `/api/yahoo` |

### Adapters (`src/services/adapters/`)
| File | Fungsi / Function | Output |
|---|---|---|
| `yahoo-adapter.ts:44` | `adaptYahooChart` | `UnifiedAsset` (computeSignal + tradingPlan + dailyChange) |
| `yahoo-candles.ts:40` | `normalizeYahooCandles`, `buildSignalSeriesFromCandles`, `resampleCandles`, `resampleCandlesToDaily`, `deriveCandleTrend` | `NormalizedYahooCandle[]` |
| `yahoo-fundamentals.ts:37` | `adaptYahooFundamentals` | `Fundamentals \| null` |

### react-query hooks (`src/services/queries/`)
Global default (`app/config/query-client.ts:3`): `staleTime`/`refetchInterval` 300 000ms (5 min), `retry:1`, `refetchOnWindowFocus:false`, `gcTime:5min`.

| Hook | queryKey | Cadence | Dedupe pattern |
|---|---|---|---|
| `useFearGreedIndex` (`:5`) | `["fear-greed"]` | 1 day | — |
| `useCryptoDominance` (`:14`) | `["dominance"]` | 30 min | — |
| `useMarketData(symbols)` (`:28`) | `["asset-data",sym,range,interval,fng]` | 30 min | `useQueries` per-symbol |
| `usePeriodCandles` (`:69`) | `["period-candles",sym,p1,p2,int]` | `Infinity` (history closed) | — |
| `useYahooSearch` (`:112`) | `["yahoo-search",q]` | 5 min | enabled `q.length>=2` |
| `useCryptoContext` (`:28`) | `["crypto-context",…]` | 30 min | reuse `["asset-data",^BTC]` + F&G + dominance |
| `useUsContext` (`:25`) | reuse `["asset-data",^GSPC/^VIX/DX-Y.NYB]` | — | subscribe shared cache |
| `useIdxContext` (`:25`) | reuse `["asset-data",^JKSE/USDIDR=X]` | — | subscribe shared cache |
| `useSmartMoney` (`:44`) | `["smart-money",sym]` per crypto | 30 min | `MAX_SYMBOLS=40`, plain object (bukan Map) |
| `useMarketMomentum` (`:16`) | reuse crypto cache + cryptoContext | — | pure derived `Breadth` |
| `useFundamentals` (`:17`) | `["fundamentals",sym]` | 1 day | stocks only |
| `useEconomicCalendar` (`:7`) | `["economic-calendar"]` | 30 min | poll auto-stop unmount |

> 🇮🇩 Pola kunci: **dedupe-by-shared-key** — context subscribe cache screener (`["asset-data",…]`) → nyaris nol fetch ekstra di `/terminal`. `fearGreedValue`/`dominance` di-bake ke key biar sinyal recompute konsisten.
> 🇺🇸 Key pattern: **dedupe-by-shared-key** — contexts subscribe to the screener's cache → near-zero extra fetches on `/terminal`.

---

## 🧠 State management

### Redux (`src/store/`)
Store: `src/store/index.ts:6` — `configureStore({ reducer: { ui, filter, auth } })`. Middleware skip serializability check `auth.session`/`auth.user` (Supabase Session/User besar + library-typed). Typed `useAppDispatch`/`useAppSelector` (`hooks.ts:9`). Bound action selectors `useUIActions`/`useFilterActions` (stable identity).

| Slice | State | Actions |
|---|---|---|
| `auth-slice.ts` | `session`, `user`, `ready` | `setSession`, `setReady` |
| `ui-slice.ts` | `selectedAssetSymbol`, `isDetailDialogOpen`, `isLicenseDialogOpen`, `terminalView`, `isSearchOpen`, `isPageLoading` | `openDetailDialog`/`closeDetailDialog`/`setLicenseDialogOpen`/`setTerminalView`/`setSearchOpen`/`toggleSearch`/`setPageLoading`. License success callback di module ref (`pendingLicenseAction`) bukan Redux (serializability) |
| `filter-slice.ts` | `assetType`, `signalFilter`, `searchQuery` | `setAssetType`/`setSignalFilter`/`setSearchQuery`/`resetFilters` |

> Screener subscribe **actions-only** (`"use no memo"` + Redux actions-only) buat hindari re-render loop.

### Server state = react-query
`QueryClient` adalah de-facto server-state store. Semua data Supabase + API di react-query. 5-min cadence app-wide, tightened per-query.

### Context
- `ThemeProvider` (`src/components/theme-provider.tsx:23`) — dark/light/system, persist `localStorage("rabalaba-theme")`.

### i18n
- `src/app/config/i18n.ts` — i18next + react-i18next + LanguageDetector. `en`/`id`, default/fallback `id`. 1 749 keys per locale, parity. Detection `localStorage → navigator`. Single `translation` namespace, flat dot-path keys. Tidak ada provider component — side-effect import di `main.tsx:4`.

> 🇮🇩 **Gak ada Zustand lagi** — `favorite-store` zustand+persist diganti `useFavorites` (Supabase `user_favorites`); localStorage grant diganti `use-premium-access`.
> 🇺🇸 **No Zustand anymore** — the old `favorite-store` was replaced by `useFavorites`; the localStorage grant by `use-premium-access`.

---

## 🪝 Custom hooks non-query (`src/hooks/`)

Auth/entitlement: `use-auth`, `use-premium-access`, `use-favorites`, `use-screener-universe`, `use-journal-assets`, `use-journal-settings`, `use-asset-discovery`, `use-market-scan`, `use-subscription-plans`, `use-payment-methods`, `use-disclaimer`, `use-session-activity`, `use-admin-users`, `use-admin-invitations`, `use-invitation`. Utility: `use-debounce`, `use-media-query`, `use-mobile`, `use-keyboard-shortcut`.

---

## 🔗 Terkait / Related
- [`00-architecture.md`](00-architecture.md) — layering
- [`../fsd/01-terminal-screener.md`](../fsd/01-terminal-screener.md) — konsumen engine
- [`04-cloudflare-proxy.md`](04-cloudflare-proxy.md) — proxy detail
