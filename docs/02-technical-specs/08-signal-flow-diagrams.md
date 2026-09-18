# TSD 08 — Diagram Alur Sinyal / Signal Flow Diagrams

> Status: Kanonis
> Terverifikasi: 2026-09-16
> Tanggal: 2026-09-16
> Cakupan: End-to-end, activity swimlanes, sequence production

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

## Bagian ID

### Ringkasan
- Dokumen memetakan kode production yang benar-benar berjalan. Cakupan sat-set.
- Tiga diagram kanonis: end-to-end, activity, sequence production.
- Modul compute, plan, enrich, dan journal tetap terpisah.

### Diagram End-To-End

```mermaid
flowchart LR
  FEED[Market Feeds] --> PROXY[Cloudflare Proxy]
  PROXY --> DISC[Asset Discovery]
  DISC --> UNI[(Active Universe)]
  UNI --> BROW[Browser Analysis]
  BROW --> PUB[Episode Publish]
  PUB --> UI[Terminal UI]
  UNI --> CRON[Auto Journal Cron]
  CRON --> PROXY
  CRON --> DB[(Journal Trades)]
  DB --> ALERT[Discord Alerts]
  DB --> RECAP[Periodic Recap]
  RECAP --> ALERT
```

- Caption ID: Universe mengatur crypto dan saham Amerika plus IDX untuk premium dan cron.
- Jalur browser dan edge memakai adapter plus engine pure yang sama.
- Edge memakai bundle `_engine.mjs`, bukan implementasi sinyal kedua.

### Diagram Activity Swimlanes

```mermaid
flowchart TB
  START((Cron Tick))
  subgraph GATE[Trigger Lane]
    READ[Read Settings]
    EN{Enabled}
    DUE{Due Slot}
    SKIP[Return Skipped]
    READ --> EN
    EN -->|No| SKIP
    EN -->|Yes| DUE
    DUE -->|No| SKIP
  end
  subgraph IOL[Data Lane]
    LOAD[Read Assets plus Trades]
    FETCH[Fetch Candles via Proxy]
    ADAPT[Adapt plus Normalize]
    HEALTH{Data Usable}
    OMIT[Omit Failed Asset]
    FETCH --> ADAPT --> HEALTH
    HEALTH -->|No| OMIT
  end
  subgraph ENGL[Engine Lane]
    SIG[Compute Signal]
    ACT{LONG or SHORT}
    PLAN[Compute Plan]
    CTX[Enrich Context]
    SIG --> ACT
    ACT -->|Neutral| NOEMIT[No Emit]
    ACT -->|Signal| PLAN --> CTX
  end
  subgraph SYNC[Sync Lane]
    REPLAY[Replay Candles]
    CLOSE[Update Trade]
    KEEP[Keep Open]
    REPLAY --> CLOSE
  end
  DUE -->|Yes| LOAD
  LOAD --> FETCH
  HEALTH -->|Yes| SIG
  CTX --> REPLAY
```

- Caption ID: Emission ditahan oleh data-quality, stale quote, dan episode blokir.
- Trade terbuka disinkronkan dari candle bertimestamp sejak entry.
- Plan dihitung di adapter sebelum enrichment penyesuaian conviction.

### Sequence Production

```mermaid
sequenceDiagram
  participant S as Scheduler
  participant D as Discovery
  participant A as Auto Journal
  participant DB as Postgres
  participant P as Proxy
  participant M as Providers
  participant E as Engine Bundle
  participant UI as Browser UI
  participant R as Summary
  participant DC as Discord
  S->>D: POST trigger
  D->>DB: Read settings plus assets
  D->>P: Request feeds
  P->>M: Provider requests
  M-->>P: Candidate data
  P-->>D: Normalized feeds
  D->>E: Rank plus plan
  D->>DB: Upsert auto rows
  S->>A: POST trigger
  A->>DB: Read settings plus universe
  A->>P: Fetch charts
  P->>M: Chart requests
  M-->>P: OHLCV
  P-->>A: Chart results
  A->>E: Adapt plus contexts plus journal
  A->>DB: Insert plus update
  A->>DC: Post alerts
  UI->>DB: Read episodes plus trades
  UI->>P: Fetch market data
  UI->>E: Signal plus plan plus enrich
  S->>R: POST trigger
  R->>DB: Read period rows
  R->>DC: Post recap
```

- Caption ID: Browser publikasi LONG dan SHORT hanya dari episode aktif valid.
- Entry, TP, SL awal, dan R:R tetap, evidence market tetap live.
- Notifikasi immediate via auto-journal dan rekap via summary.

### Realitas Implementasi
| Aspek | Perilaku Aktual |
|---|---|
| Sumber sinyal | Modul pure sama via bundle edge |
| Urutan plan | Sinyal lalu plan lalu enrich |
| Publikasi | Episode valid tentukan LONG dan SHORT |

### Terkait
- Metodologi di `../05-explainers/00-trading-methodology.md`.
- Arsitektur di `00-architecture.md`.
- Engine di `06-engine-internals.md`.

---
## English Part

### Overview
- Document maps production code in actual execution. Scope deep-dive.
- Three canonical diagrams: end-to-end, activity, production sequence.
- Compute, plan, enrich, and journal modules stay separate.

### End-To-End Diagram

```mermaid
flowchart LR
  FEED[Market Feeds] --> PROXY[Cloudflare Proxy]
  PROXY --> DISC[Asset Discovery]
  DISC --> UNI[(Active Universe)]
  UNI --> BROW[Browser Analysis]
  BROW --> PUB[Episode Publish]
  PUB --> UI[Terminal UI]
  UNI --> CRON[Auto Journal Cron]
  CRON --> PROXY
  CRON --> DB[(Journal Trades)]
  DB --> ALERT[Discord Alerts]
  DB --> RECAP[Periodic Recap]
  RECAP --> ALERT
```

- EN caption: Universe supplies crypto and American plus IDX equities for premium and cron.
- Browser and edge paths use same adapter plus pure engine.
- Edge runs `_engine.mjs` bundle, not a second signal implementation.

### Activity Swimlanes Diagram

```mermaid
flowchart TB
  START((Cron Tick))
  subgraph GATE[Trigger Lane]
    READ[Read Settings]
    EN{Enabled}
    DUE{Due Slot}
    SKIP[Return Skipped]
    READ --> EN
    EN -->|No| SKIP
    EN -->|Yes| DUE
    DUE -->|No| SKIP
  end
  subgraph IOL[Data Lane]
    LOAD[Read Assets plus Trades]
    FETCH[Fetch Candles via Proxy]
    ADAPT[Adapt plus Normalize]
    HEALTH{Data Usable}
    OMIT[Omit Failed Asset]
    FETCH --> ADAPT --> HEALTH
    HEALTH -->|No| OMIT
  end
  subgraph ENGL[Engine Lane]
    SIG[Compute Signal]
    ACT{LONG or SHORT}
    PLAN[Compute Plan]
    CTX[Enrich Context]
    SIG --> ACT
    ACT -->|Neutral| NOEMIT[No Emit]
    ACT -->|Signal| PLAN --> CTX
  end
  subgraph SYNC[Sync Lane]
    REPLAY[Replay Candles]
    CLOSE[Update Trade]
    KEEP[Keep Open]
    REPLAY --> CLOSE
  end
  DUE -->|Yes| LOAD
  LOAD --> FETCH
  HEALTH -->|Yes| SIG
  CTX --> REPLAY
```

- EN caption: Emission is held by data quality, stale quotes, and blocked episodes.
- Open trades sync from timestamped candles since entry.
- Plan is computed in adapter before conviction-adjusting enrichment.

### Production Sequence

```mermaid
sequenceDiagram
  participant S as Scheduler
  participant D as Discovery
  participant A as Auto Journal
  participant DB as Postgres
  participant P as Proxy
  participant M as Providers
  participant E as Engine Bundle
  participant UI as Browser UI
  participant R as Summary
  participant DC as Discord
  S->>D: POST trigger
  D->>DB: Read settings plus assets
  D->>P: Request feeds
  P->>M: Provider requests
  M-->>P: Candidate data
  P-->>D: Normalized feeds
  D->>E: Rank plus plan
  D->>DB: Upsert auto rows
  S->>A: POST trigger
  A->>DB: Read settings plus universe
  A->>P: Fetch charts
  P->>M: Chart requests
  M-->>P: OHLCV
  P-->>A: Chart results
  A->>E: Adapt plus contexts plus journal
  A->>DB: Insert plus update
  A->>DC: Post alerts
  UI->>DB: Read episodes plus trades
  UI->>P: Fetch market data
  UI->>E: Signal plus plan plus enrich
  S->>R: POST trigger
  R->>DB: Read period rows
  R->>DC: Post recap
```

- EN caption: Browser publishes LONG and SHORT only from valid active episodes.
- Entry, TP, initial SL, and R:R stay fixed, market evidence stays live.
- Immediate notifications via auto-journal and recaps via summary.

### Implementation Reality
| Aspect | Actual Behavior |
|---|---|
| Signal source | Same pure modules via edge bundle |
| Plan order | Signal then plan then enrich |
| Publication | Valid episodes set LONG and SHORT |

### Related
- Methodology in `../05-explainers/00-trading-methodology.md`.
- Architecture in `00-architecture.md`.
- Engine in `06-engine-internals.md`.
