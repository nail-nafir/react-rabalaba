# FSD 03 — Auto-Journal Robot / Auto-Journal Robot

> Status: Aktif / Active | Terverifikasi / Verified: Ya / Yes | Tanggal / Date: 2026-09-16 | Cakupan / Scope: Cron 30 Menit, Emit/Close, Phantom Guard, Discord, Discovery, Rekap

[Bahasa Indonesia](#bagian-id) · [English](#english-part)

<a id="bagian-id"></a>

## 🇮🇩 Ringkasan

Cron pg_cron POST ke Supabase Edge Function auto-journal tiap 30 menit. Function menarik candle Yahoo 60d/1h via proxy untuk universe journal_assets. Core murni `auto-journal-core.ts › runAutoJournal` lalu emit trade baru dan close trade open. Alur gas dari fetch sampai Discord tetap stabil.

Emit mencatat LONG/SHORT fresh plus trading plan bila entry executable dan episode mengizinkan. Close memproses TP/SL progresif plus reversal. Tulis memakai service-role bypass RLS ke journal_trades. Alert Discord bersifat best-effort. Gating data-driven via journal_settings tanpa edit cron atau redeploy.

Browser membaca episode dan jurnal tiap 60 detik atau saat mount, focus, refresh. Terminal hanya menerbitkan LONG/SHORT dari episode aktif plus snapshot valid. Kandidat belum tercatat berlabel Netral.

## 🇮🇩 Satu Siklus

Secret cron via header x-cron-secret dari Vault. Clock-aligned ke WIB midnight dengan dedup last_run_at. Concurrency fetch 8 dengan timeout 12 detik per aset.

| No | Tahap | Deskripsi |
|---|---|---|
| 1 | Trigger | pg_cron POST tiap 30 menit |
| 2 | Gating | Baca journal_settings: enabled dan due |
| 3 | Muat | Baca trade open, episode, universe |
| 4 | Fetch | Candle Yahoo 60d/1h via proxy |
| 5 | Putus | Build context plus run core murni |
| 6 | Simpan | Claim, tulis jurnal, rekonsiliasi episode |
| 7 | Alert | Batch Discord best-effort |
| 8 | Selesai | Ringkasan run untuk observability |

Context top-down BTC/IHSG/S&P dibangun via buildEngineContexts. Keputusan murni via runAutoJournal dengan contexts. Claim slot setelah fetch sukses. UPDATE milestone/closure, INSERT trade, lalu rekonsiliasi journal_signal_states dari tulis sukses. Alert via buildAutoJournalAlerts plus format batch Discord.

## 🇮🇩 Inti Keputusan

Emit melewati quote tanpa timestamp. Emit melewati quote stale di atas 90 menit atau di atas 5 menit masa depan. Candle keputusan entry wajib selesai dengan usia 0-15 menit. Enrich memakai context own-index agar strength/tier sama dengan screener. Context tidak menyembunyikan sinyal.

- Entry memakai open candle eksekusi pertama setelah candle keputusan selesai.
- Kandidat LONG/SHORT fresh plus plan tercatat bila executable dan episode mengizinkan.
- Tanpa trade lain tetap open pada simbol/timeframe sama.
- Setelah TP/SL, arah sama diblokir sampai raw signal lewat netral; reversal boleh flip langsung.
- Snapshot simpan engine_version, decision_candle_open_at, decision_candle_closed_at, regime, HTF trend, direction score.

Close me-replay candle sejak entry per trade. Close progressive: TP1 pindah stop aktif ke entry; TP2 pindah ke TP1; TP final tutup posisi. Final close kembali lewat stop baru menutup di level stop pada candle selesai capai TP baru; wick saja tidak. Gap pada stop aktif mengisi di open aktual. Reversal long-short exit di close candle terkoroborasi tanpa perfect-fill sintetis.

Phantom guard: hanya candle timestamped memutuskan TP/SL. Spot price di atas SL diabaikan sebagai anti phantom close dari quote transient. Trade lama engine-v3 tertutup di ratchet non-final tidak ditulis ulang. Migrasi v4 hanya pindah trade open ke kontrak progressive plus exit_reason initial_stop, breakeven_stop, progressive_stop, final_take_profit, reversal.

## 🇮🇩 Gating dan Discord

Singleton journal_settings mengendalikan robot tanpa redeploy. Interval clock-aligned ke WIB midnight. Tick hanya jalan bila slotMin modulo interval nol plus dedup vs last_run_at. Admin dapat trigger manual Scan Sekarang via useMarketScan force true dengan gate admin.

| Field | Efek |
|---|---|
| enabled | Pause global robot |
| interval_minutes | Clock-aligned plus dedup |
| market_hours_only | Skip simbol bursa tutup |

Alert memakai `alerts.ts › buildAutoJournalAlerts` plus format batch Discord. Insert sukses menjadi new_long atau new_short memakai snapshot entry, TP, SL awal jurnal. Tulis DB gagal tidak membuat alert. Closure menjadi tp_hit, sl_hit, protected_stop, atau reversed berdasar exit_reason. Format SINYAL lalu HASIL, persen direction-aware dari entry, label durasi Indonesia. DISCORD_MAX 1900 per batch; blok alert tidak dipotong. HTTP 429 menghormati Retry-After dan retry sekali dalam budget function. Gagal webhook tidak membatalkan jurnal.

## 🇮🇩 Discovery dan Rekap

Discovery bukan bagian auto-journal, tetapi mengisi universe yang dibaca auto-journal. Cron daily 30 22 UTC atau 05.30 WIB harian. Core murni asset-discovery-core plus function asset-discovery. Fetch feed trending CoinGecko, Binance 24h, Yahoo gainers plus most-actives, IDX most-actives. Rank dan dedup via pure core. Validasi tiap kandidat round-trip chart minimal 120 bar. INSERT, refresh, reactivate, prune journal_assets. Baris source admin tidak pernah disentuh.

Rekap memakai function daily-summary cron hourly dengan self-gate per hari/minggu/bulan WIB. Scoreboard Discord: TOTAL, TERBAIK, TERBURUK, SINYAL BARU, MASIH TERBUKA, SUDAH DITUTUP, RASIO LABA RUGI. Atomic send-once per kind via stamp kolom.

## 🇮🇩 Tautan Terkait

- Dashboard: docs/01-functional-specs/04-journal-dashboard.md
- Diagram: docs/02-technical-specs/08-signal-flow-diagrams.md
- Edge: docs/02-technical-specs/05-edge-functions.md
- Metodologi: docs/05-explainers/00-trading-methodology.md

---

<a id="english-part"></a>

## 🇺🇸 Summary

Pg_cron POSTs to Supabase auto-journal Edge Function every 30 minutes. Function pulls 60d/1h Yahoo candles via proxy for journal_assets universe. Pure core `auto-journal-core.ts › runAutoJournal` then emits fresh trades plus closes open trades. Deep-dive flow from fetch to Discord remains stable.

Emit records fresh LONG/SHORT plus trade plans when entries remain executable plus episodes allow. Close handles progressive TP/SL plus reversal. Writes use service-role bypassing RLS to journal_trades. Discord alerts remain best-effort. Data-driven gating via journal_settings avoids cron edits or redeploys.

Browser reads episodes plus journal every 60 seconds or at mount, focus, refresh. Terminal publishes LONG/SHORT only from active episodes plus valid snapshots. Unrecorded candidates show Neutral.

## 🇺🇸 One Cycle

Cron secret passes via x-cron-secret header from Vault. Clock alignment uses WIB midnight with last_run_at dedup. Fetch concurrency holds 8 with 12-second timeout per asset.

| No | Stage | Description |
|---|---|---|
| 1 | Trigger | Pg_cron POST every 30 minutes |
| 2 | Gating | Read journal_settings: enabled plus due |
| 3 | Load | Read open trades, episodes, universe |
| 4 | Fetch | 60d/1h Yahoo candles via proxy |
| 5 | Decide | Build contexts plus run pure core |
| 6 | Persist | Claim, write journal, reconcile episodes |
| 7 | Alert | Best-effort Discord batches |
| 8 | Finish | Run summary for observability |

Top-down BTC/IHSG/S&P contexts build via buildEngineContexts. Pure decisions run via runAutoJournal with contexts. Slot claim follows successful fetch. UPDATE milestones/closures, INSERT trades, then reconcile journal_signal_states from successful writes. Alerts via buildAutoJournalAlerts plus Discord batch format.

## 🇺🇸 Decision Core

Emit skips quotes without timestamps. Emit skips stale quotes above 90 minutes or above 5 minutes in future. Decision entry candles must finish with 0-15 minute age. Enrichment uses own-index context so strength/tier match screener. Context never hides signals.

- Entry uses first execution-candle open after decision candle finishes.
- Fresh LONG/SHORT candidates plus plans record when executable plus episodes allow.
- No other trade stays open at same symbol/timeframe.
- After TP/SL, same direction blocks until raw signal passes neutral; reversal may flip directly.
- Snapshots store engine_version, decision_candle_open_at, decision_candle_closed_at, regime, HTF trend, direction score.

Close replays candles from entry per trade. Progressive close: TP1 moves active stop to entry; TP2 moves to TP1; final TP closes position. Final close back through fresh stop closes at stop level on finished candles reaching fresh TP; wick alone never closes. Gaps at active stops fill at actual open. Long-short reversal exits at corroborated candle close without synthetic perfect-fill.

Phantom guard: only timestamped candles decide TP/SL. Spot price above SL ignores as anti phantom close from transient quotes. Old engine-v3 trades closed at non-final ratchet never rewrite. V4 migration only moves open trades to progressive contract plus exit_reason initial_stop, breakeven_stop, progressive_stop, final_take_profit, reversal.

## 🇺🇸 Gating and Discord

Singleton journal_settings controls robot without redeploys. Interval clock-aligns to WIB midnight. Ticks run only when slotMin modulo interval hits zero plus dedup versus last_run_at. Admins may trigger manual Scan Now via useMarketScan force true with admin gate.

| Field | Effect |
|---|---|
| enabled | Global robot pause |
| interval_minutes | Clock alignment plus dedup |
| market_hours_only | Skip closed-exchange symbols |

Alerts use `alerts.ts › buildAutoJournalAlerts` plus Discord batch format. Successful inserts become new_long or new_short with journal entry, TP, initial SL snapshots. Failed DB writes create no alerts. Closures become tp_hit, sl_hit, protected_stop, or reversed from exit_reason. Format SIGNAL then RESULT, direction-aware percent from entry, Indonesia duration label. DISCORD_MAX 1900 per batch; alert blocks never split. HTTP 429 respects Retry-After plus one retry inside function budget. Webhook failure never cancels journal.

## 🇺🇸 Discovery and Recap

Discovery remains outside auto-journal, but fills universe read at auto-journal. Daily cron at 30 22 UTC or 05.30 WIB daily. Pure core asset-discovery-core plus asset-discovery function. Trending feeds fetch CoinGecko, Binance 24h, Yahoo gainers plus most-actives, IDX most-actives. Rank plus dedup run via pure core. Each candidate validates round-trip charts at minimum 120 bars. INSERT, refresh, reactivate, prune journal_assets. Admin-source rows never touched.

Recap uses daily-summary function hourly cron with self-gate per WIB day/week/month. Discord scoreboard: TOTAL, BEST, WORST, FRESH SIGNALS, STILL OPEN, CLOSED, PROFIT-LOSS RATIO. Atomic send-once per kind via stamp columns.

## 🇺🇸 Related Links

- Dashboard: docs/01-functional-specs/04-journal-dashboard.md
- Diagrams: docs/02-technical-specs/08-signal-flow-diagrams.md
- Edge: docs/02-technical-specs/05-edge-functions.md
- Methodology: docs/05-explainers/00-trading-methodology.md
