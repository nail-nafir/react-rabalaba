# TSD 08 — Core Signal Flow Diagrams

> 🇮🇩 Diagram kanonis untuk alur sinyal production `main`: dari pemilihan
> universe dan candle sampai trading setup, auto-journal, dashboard, dan
> Discord.
>
> 🇺🇸 Canonical diagrams for the production `main` signal flow: from universe
> selection and candles through the trading setup, auto-journal, dashboard,
> and Discord.

Dokumen ini memetakan implementasi yang benar-benar berjalan. `computeSignal`,
`computeTradingPlan`, `enrichAsset`, dan `runAutoJournal` tetap merupakan modul
yang berbeda; diagram tidak menggabungkannya menjadi satu langkah fiktif.

This document maps the code that actually runs. `computeSignal`,
`computeTradingPlan`, `enrichAsset`, and `runAutoJournal` remain separate
modules; the diagrams do not collapse them into one fictional step.

## 1. End-to-end flowchart / Flowchart end-to-end

```mermaid
flowchart LR
  subgraph FEEDS["Market feeds / Feed market"]
    CG["CoinGecko trending"]
    BZ["Binance 24h futures"]
    YS["Yahoo screeners, search, chart"]
  end

  PROXY["Cloudflare Pages proxy\n/api/coingecko · /api/binance · /api/yahoo"]
  CG --> PROXY
  BZ --> PROXY
  YS --> PROXY

  subgraph DISCOVERY["Universe discovery / Discovery universe"]
    AD["asset-discovery\nSupabase Edge Function"]
    RANK["Parse → rank → dedupe\nresolve ticker → validate ≥120 candles"]
    PLAN["planDiscovery\ninsert / reactivate / refresh / prune"]
    JA[("journal_assets\nactive universe")]
    ADMIN["Admin asset management"]
    PROXY --> AD --> RANK --> PLAN --> JA
    ADMIN --> JA
  end

  JA --> U["Active DB universe\ncrypto / US stock / IDX stock"]
  CONST["Commodity + forex constants"] --> U

  subgraph BROWSER["Browser path / Jalur browser"]
    SU["useScreenerUniverse\npremium DB rows; free fallback"]
    MQ["useMarketData\nReact Query per symbol"]
    BA["yahoo-adapter\nnormalize quote + candles\nresample HTF trend"]
    SIG["computeSignal\nindicators → regime → scores\nLONG / SHORT / neutral"]
    TP["computeTradingPlan\nentry · stop · TP1/2/3 · RR"]
    EN["enrichAsset\ncontext de-rate\noptional evidence display-only*"]
    UI["AssetSignalTable / AssetDetailDialog\nscreener + signal detail"]
    BT["runBacktest + calibrateConfidence\nwalk-forward evidence"]

    U --> SU --> MQ --> PROXY
    PROXY --> BA --> SIG
    SIG --> TP --> EN --> UI
    BA --> BT
    UI --> BT
  end

  subgraph SERVER["Server path / Jalur server"]
    TRIGGER["pg_cron or admin force\nauto-journal"]
    SETTINGS[("journal_settings\nenabled · interval · market hours")]
    OPEN[("journal_trades\nopen")]
    AJ["auto-journal\nfetch + adapt + contexts"]
    CORE["runAutoJournal\nemit inserts + sync closures"]
    WRITES["Service-role DB writes\nINSERT new trade / UPDATE closure"]

    TRIGGER --> AJ
    SETTINGS --> AJ
    JA --> AJ
    OPEN --> AJ
    AJ --> PROXY
    PROXY --> BA
    BA --> CORE
    CORE --> WRITES
  end

  WRITES --> JT[("journal_trades")]
  JT --> JD["Journal UI\nuseJournalTrades → dashboard / history"]
  WRITES --> ALERT["buildAutoJournalAlerts\nformatAlertBatchesForDiscord"]
  ALERT --> DISCORD["Discord webhook\nimmediate signal / TP / SL alert"]

  subgraph RECAP["Periodic recap / Rekap periodik"]
    SUM["daily-summary\nhourly tick + WIB window gate"]
    SUMCORE["read journal rows + live open prices\nformatDailySummaryForDiscord"]
    SUM --> SUMCORE --> DISCORD2["Discord webhook\ndaily / weekly / monthly recap"]
  end
  JT --> SUM
  PROXY --> SUM

  NOTE["* Fundamentals are browser-only; Edge has no browser fundamentals.\n* Edge imports the same pure engine through edge-engine.ts → _engine.mjs."]
  EN -.-> NOTE
  CORE -.-> NOTE

  classDef store fill:#eef2ff,stroke:#4f46e5,color:#111827
  classDef service fill:#ecfeff,stroke:#0891b2,color:#111827
  classDef engine fill:#fef3c7,stroke:#d97706,color:#111827
  class JA,SETTINGS,OPEN,JT store
  class AD,AJ,SUM,PROXY service
  class SIG,TP,EN,CORE,BA engine
```

🇮🇩 `journal_assets` mengatur universe crypto/US/IDX untuk user premium dan
cron; komoditas/forex tetap berasal dari konstanta. Jalur browser dan Edge
melewati adapter serta engine pure yang sama. Jalur Edge memakai bundle
`_engine.mjs`, bukan implementasi sinyal kedua.

🇺🇸 `journal_assets` supplies the crypto/US/IDX universe for premium users and
the cron; commodities/forex remain constant-driven. Browser and Edge paths use
the same adapter and pure engine. Edge runs the `_engine.mjs` bundle, not a
second signal implementation.

## 2. Signal and journal activity / Activity sinyal dan jurnal

Mermaid tidak menyediakan UML activity diagram native. Swimlane di bawah
menggunakan `flowchart` dan `subgraph` supaya setiap tanggung jawab runtime
tetap terlihat tanpa menambah generator diagram.

Mermaid has no native UML activity diagram. The swimlanes below use `flowchart`
and `subgraph` so each runtime responsibility remains visible without adding a
diagram generator.

```mermaid
flowchart TB
  START(("Cron tick / admin force"))

  subgraph GATE["Trigger + settings lane / Lane trigger + settings"]
    READSET["Read journal_settings"]
    ENABLED{"enabled?"}
    DUE{"forced or aligned\nslot not already run?"}
    SKIPG["Return skipped\nno market fetch, no stamp"]
    START --> READSET --> ENABLED
    ENABLED -- "no" --> SKIPG
    ENABLED -- "yes" --> DUE
    DUE -- "no" --> SKIPG
  end

  subgraph IO["Data lane / Lane data"]
    LOAD["Read active journal_assets\nopen journal_trades + recent closed"]
    BENCH["Fetch benchmark-only symbols\nfor top-down context"]
    FETCH["Fetch universe candles via\nCloudflare Yahoo proxy\n(cache-bust, bounded pool)"]
    ADAPT["adaptYahooChart\nnormalize candles + quote time\nbuild HTF trend"]
    HEALTH{"Provider response\nand candle data usable?"}
    OMIT["Omit failed asset\nkeep existing trade untouched"]
    DUE --> LOAD --> FETCH
    LOAD --> BENCH --> FETCH
    FETCH --> ADAPT --> HEALTH
    HEALTH -- "no" --> OMIT
  end

  subgraph ENGINE["Shared engine lane / Lane engine bersama"]
    SIGNAL["computeSignal\nindicator set → regime → weighted scores\nHTF confirmation + data-quality gate"]
    ACTION{"LONG/SHORT\nor neutral?"}
    PLAN["computeTradingPlan\nonly for actionable signal"]
    CONTEXT["enrichAsset\ncontext de-rate\noptional evidence display-only"]
    SIGNAL --> ACTION
    ACTION -- "neutral" --> NOEMIT["No new trade\nneutral never closes an open trade"]
    ACTION -- "LONG / SHORT" --> PLAN --> CONTEXT
  end

  subgraph DECISIONS["Journal decision lane / Lane keputusan jurnal"]
    LOOP["For each fetched journal asset"]
    OPENQ{"Symbol/timeframe still open\nafter planned closures?"}
    STALEQ{"Quote older than\n90-minute freshness guard?"}
    INSERT["Build FollowedTrade\nINSERT journal_trades"]
    SKIPNEW["Skip new emission"]
    LOOP --> STALEQ
    STALEQ -- "yes" --> SKIPNEW
    STALEQ -- "no" --> OPENQ
    OPENQ -- "yes" --> SKIPNEW
    OPENQ -- "no" --> SIGNAL
    CONTEXT --> INSERT
  end

  subgraph SYNC["Open-trade sync lane / Lane sinkronisasi trade"]
    OPENLOOP["For each open trade"]
    FRESH{"Fresh asset and\ncandle since entry?"}
    REPLAY["Replay timestamped candles\nsince followedAt"]
    HITS["applyPriceSync\nTP/SL ordered evaluation"]
    RESULT{"Final TP / active stop /\nreversal hit?"}
    SECURED["Stop-first within a candle\nTP1→entry; TP2→TP1 next step"]
    CLOSE["UPDATE journal_trades\nstatus + exit_reason + price"]
    KEEP["Leave open\nno raw spot-only close"]
    OPENLOOP --> FRESH
    FRESH -- "no" --> KEEP
    FRESH -- "yes" --> REPLAY --> HITS --> RESULT
    RESULT -- "final TP / active stop" --> SECURED --> CLOSE
    RESULT -- "opposite signal" --> CLOSE
    RESULT -- "none / neutral" --> KEEP
  end

  subgraph OUTPUT["Persistence + notification lane / Lane persistensi + notifikasi"]
    DB["journal_trades\nINSERTs + UPDATEs"]
    CYCLE["Collect per-run results\nno-op branches produce no DB write"]
    ALERTS["buildAutoJournalAlerts\nformatAlertBatchesForDiscord"]
    WEBHOOK["Discord webhook\nbest-effort"]
    STAMP["Stamp journal_settings.last_run_at\nonly after a due run"]
    INSERT --> DB
    CLOSE --> DB
    DB --> CYCLE
    CYCLE --> ALERTS --> WEBHOOK
    CYCLE --> STAMP
  end

  HEALTH -- "yes" --> OPENLOOP
  CLOSE --> LOOP
  KEEP --> LOOP
  OMIT --> CYCLE
  NOEMIT --> CYCLE
  SKIPNEW --> CYCLE
  KEEP --> CYCLE
```

### Decision notes / Catatan keputusan

- 🇮🇩 Data-quality, stale quote, missing candle, dan trade yang tetap open
  menahan emission. Trade yang ditutup boleh diganti sinyal aktif dalam scan sama.
- 🇺🇸 Data quality, stale quotes, missing candles, and still-open duplicates
  suppress emission. A closed trade may be replaced by the current signal in
  the same scan.
- 🇮🇩 Trade terbuka disinkronkan dari candle bertimestamp sejak entry. Harga
  spot mentah tidak boleh sendirian menciptakan TP/SL phantom.
- 🇺🇸 Open trades are synchronized from timestamped candles since entry. A raw
  spot quote cannot create a phantom TP/SL close by itself.
- 🇮🇩 `computeTradingPlan` berjalan di adapter sebelum post-signal enrichment;
  enrichment menyesuaikan conviction/outlook, bukan membuat ulang plan di Edge.
- 🇺🇸 `computeTradingPlan` runs in the adapter before post-signal enrichment;
  enrichment adjusts conviction/outlook and does not rebuild the plan in Edge.

## 3. Production sequence / Sequence production

```mermaid
sequenceDiagram
  autonumber
  participant S as Scheduler / Admin
  participant D as asset-discovery
  participant A as auto-journal
  participant DB as Supabase Postgres
  participant P as Cloudflare proxy
  participant M as CoinGecko / Binance / Yahoo
  participant E as Shared engine bundle<br/>edge-engine.ts → _engine.mjs
  participant UI as Browser UI
  participant R as daily-summary
  participant DC as Discord webhook

  Note over S,DC: Discovery phase / Fase discovery — daily cron or admin force
  S->>D: POST trigger (scheduled or manual)
  D->>DB: Read discovery settings, assets, open symbols
  D->>P: Request trending, screeners, search, validation charts
  P->>M: Provider requests
  alt Provider failure or unhealthy feed
    M-->>P: Error / incomplete feed
    P-->>D: Failed or unhealthy source
    D->>D: Keep pruning disabled for unsafe run
  else Feeds healthy
    M-->>P: Candidate feeds + chart data
    P-->>D: Normalized provider responses
    D->>E: parse → rank → dedupe → validate → planDiscovery
    E-->>D: Insert/reactivate/refresh/prune plan
    D->>DB: Apply auto-row plan to journal_assets
    Note over D,DB: source=admin rows are never pruned or overwritten
  end
  D-->>S: Discovery summary

  Note over S,DC: Scan phase / Fase scan — auto-journal base tick
  S->>A: POST trigger (cron or admin force)
  A->>DB: Read journal_settings
  alt Disabled or not aligned / already-ran slot
    DB-->>A: Gate rejects run
    A-->>S: skipped — no market fetch
  else Due and enabled
    A->>DB: Read active journal_assets
    A->>DB: Read open trades
    A->>P: Fetch universe + context-only benchmark charts
    P->>M: Yahoo chart requests
    alt One provider response fails
      M-->>P: Error / stale / malformed chart
      P-->>A: Null asset for that symbol
      A->>A: Omit failed symbol — preserve open row
    else Charts available
      M-->>P: Yahoo chart result
      P-->>A: Chart result
    end
    A->>E: adaptYahooChart + buildEngineContexts
    E-->>A: UnifiedAsset list + top-down contexts
    A->>E: runAutoJournal(assets, openRows, contexts)
    E-->>A: progress updates + closures + current-signal inserts

    opt Existing trade reaches a non-terminal TP milestone
      A->>DB: UPDATE highest_tp_reached
    end
    opt Active stop, final TP, or opposite signal closes an existing trade
      A->>DB: UPDATE status + exit_reason + close price
      Note over E,A: Milestones/closures persist before same-scan replacement
    end
    alt Fresh actionable LONG/SHORT and no surviving open symbol/timeframe
      A->>DB: INSERT journal_trades
    else Neutral / stale / still-open duplicate
      A->>A: Skip new emission
    end

    opt There are inserts or closures
      A->>E: buildAutoJournalAlerts + formatAlertBatchesForDiscord
      E-->>A: Complete alert batches ≤1900 chars
      loop Each batch
        A->>DC: POST immediate signal / TP / SL alerts
        alt Webhook fails
          DC-->>A: Error
          A->>A: Stop delivery — journal remains successful
        else Webhook succeeds
          DC-->>A: 2xx
        end
      end
    end
    A->>DB: Stamp journal_settings.last_run_at
    A-->>S: Run summary
  end

  Note over UI,DB: Consumption phase / Fase konsumsi browser
  UI->>DB: Read premium journal_assets (or fallback constants)
  UI->>P: Fetch Yahoo market data per symbol
  P->>M: Chart request
  M-->>P: OHLCV + metadata
  P-->>UI: Chart response
  UI->>E: Browser adapter → computeSignal → computeTradingPlan
  UI->>E: enrichAsset (+ browser fundamentals when available)
  E-->>UI: Screener/detail/trading setup
  UI->>DB: Read journal_trades via useJournalTrades
  DB-->>UI: Open/closed rows
  UI-->>UI: Journal dashboard, history, P&L

  Note over S,DC: Recap phase / Fase rekap — hourly tick, WIB window gate
  S->>R: POST trigger
  R->>DB: Read recap settings and send-once stamps
  R->>DB: Read open, emitted, and closed rows for period
  opt Open trades exist
    R->>P: Fetch live prices for open symbols
    P->>M: Yahoo chart requests
    M-->>P: Latest chart data
    P-->>R: Live prices
  end
  R->>E: recapWindow + formatDailySummaryForDiscord
  E-->>R: Daily/weekly/monthly recap or empty result
  opt Recap has content and webhook configured
    R->>DC: POST periodic recap
    alt Webhook fails
      DC-->>R: Error
      R->>DB: Release send stamp for retry
    else Webhook succeeds
      DC-->>R: 2xx
    end
  end
```

## Implementation reality / Realitas implementasi

| Concern / Concern | Actual behavior / Perilaku aktual |
|---|---|
| Signal source / Sumber sinyal | Browser and Edge use the same pure modules bundled from `src/`; Edge imports the façade at `src/core/edge-engine.ts` and runs `_engine.mjs`. |
| Trading plan order / Urutan trading plan | `yahoo-adapter.ts` calls `computeSignal`, then `computeTradingPlan` for non-neutral output. `enrichAsset` runs afterward. |
| Edge vs browser / Edge vs browser | Edge does not have browser fundamentals. Browser detail may add fundamentals, smart money, accumulation, relative strength, backtest, and calibration overlays. |
| Universe / Universe | Active `journal_assets` rows drive premium browser and server crypto/US/IDX scans; commodities and forex are constant-driven. Discovery only mutates `source='auto'` rows. |
| Journal writes / Penulisan jurnal | `auto-journal` uses the Supabase service-role client for inserts/updates; browser journal reads are entitlement/RLS-gated. |
| Notifications / Notifikasi | Immediate alerts come from `auto-journal`; daily/weekly/monthly recap comes from `daily-summary`. Both are best-effort Discord side effects. |

## Related docs / Dokumen terkait

- [`00-architecture.md`](00-architecture.md) — runtime placement and pure/IO split.
- [`02-data-flow.md`](02-data-flow.md) — browser market-data path and state.
- [`05-edge-functions.md`](05-edge-functions.md) — cron gates, database reads/writes, and Discord.
- [`06-engine-internals.md`](06-engine-internals.md) — engine exports and formulas.
- [`../fsd/02-trading-engine.md`](../fsd/02-trading-engine.md) — feature-level signal behavior.
- [`../fsd/03-auto-journal.md`](../fsd/03-auto-journal.md) — auto-journal cycle and lifecycle.
